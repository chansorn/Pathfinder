import { randomUUID } from 'node:crypto';

// In-memory stand-in for Supabase so the whole API can be tested without a real project.
// Only implements what our code actually calls.

export function createFakeSupabase() {
  const tables = {
    schools: [
      { id: 1, name: 'โรงเรียนตัวอย่างวิทยา', province: 'กรุงเทพมหานคร' },
      { id: 2, name: 'โรงเรียนสาธิตทดสอบ', province: 'เชียงใหม่' },
    ],
    grade_levels: [
      { id: 1, code: 'M4', name: 'มัธยมศึกษาปีที่ 4' },
      { id: 2, code: 'M5', name: 'มัธยมศึกษาปีที่ 5' },
      { id: 3, code: 'M6', name: 'มัธยมศึกษาปีที่ 6' },
    ],
    profiles: [],
    assessments: [],
    recommendations: [],
    tcas_plans: [],
    exam_scores: [],
    chat_messages: [],
    tcas_programs: [],
    tcas_admissions: [],
    tcas_calendar: [],
    saved_programs: [],
    shared_links: [],
    user_state: [],
    plan_items: [],
    progress_snapshots: [],
    tcas_cutoffs: [],
  };
  const files = new Map(); // storage: "bucket/path" -> { body, contentType }
  const users = new Map(); // email -> user
  const accessTokens = new Map(); // token -> userId
  const refreshTokens = new Map(); // token -> userId
  const resetTokens = new Map(); // token_hash -> userId
  // delayMs: make every db query slow, for the timeout test.
  // authBusy: auth calls answer like Supabase's per-IP rate limit
  const state = { lastReset: null, delayMs: 0, authBusy: false };
  const busy = () => ({ data: { user: null, session: null }, error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' } });

  let clock = Date.now();
  const now = () => new Date((clock += 1000)).toISOString();

  const publicUser = (u) => ({ id: u.id, email: u.email, user_metadata: u.user_metadata, identities: [{}] });
  const userById = (id) => [...users.values()].find((u) => u.id === id);

  const newSession = (u) => {
    const access_token = `at_${randomUUID()}`;
    const refresh_token = `rt_${randomUUID()}`;
    accessTokens.set(access_token, u.id);
    refreshTokens.set(refresh_token, u.id);
    return { access_token, refresh_token, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' };
  };

  const dropTokens = (userId, keep) => {
    for (const map of [accessTokens, refreshTokens]) {
      for (const [t, id] of map) if (id === userId && t !== keep) map.delete(t);
    }
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.filters = [];
      this.orders = [];
      this.limitN = null;
      this.mode = 'many';
      this.returning = false;
    }
    select(cols, opts = {}) {
      if (this.op !== 'select') this.returning = true;
      this.countOpts = opts;
      return this;
    }
    insert(rows) {
      this.op = 'insert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(patch) {
      this.op = 'update';
      this.payload = patch;
      return this;
    }
    upsert(rows, { onConflict = 'id' } = {}) {
      this.op = 'upsert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      this.conflictKeys = onConflict.split(',');
      this.singleRow = !Array.isArray(rows);
      return this;
    }
    is(col, val) {
      this.filters.push((row) => (row[col] ?? null) === val);
      return this;
    }
    in(col, vals) {
      const set = new Set(vals.map(String));
      this.filters.push((row) => set.has(String(row[col])));
      return this;
    }
    // only "col.ilike.%x%,col2.ilike.%x%" - the shape tcas.service uses
    or(expr) {
      const conds = expr.split(',').map((c) => {
        const [col, , ...rest] = c.split('.');
        return [col, rest.join('.').replace(/^%|%$/g, '').toLowerCase()];
      });
      this.filters.push((row) => conds.some(([col, term]) => String(row[col] ?? '').toLowerCase().includes(term)));
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    eq(col, val) {
      this.filters.push((row) => String(row[col]) === String(val));
      return this;
    }
    gte(col, val) {
      this.filters.push((row) => row[col] != null && row[col] >= val);
      return this;
    }
    lte(col, val) {
      this.filters.push((row) => row[col] != null && row[col] <= val);
      return this;
    }
    lt(col, val) {
      this.filters.push((row) => row[col] != null && row[col] < val);
      return this;
    }
    gt(col, val) {
      this.filters.push((row) => row[col] != null && row[col] > val);
      return this;
    }
    ilike(col, pattern) {
      // only handles the %term% shape we use, with \-escaped wildcards inside
      const term = pattern.replace(/^%|%$/g, '').replace(/\\(.)/g, '$1').toLowerCase();
      this.filters.push((row) => String(row[col] ?? '').toLowerCase().includes(term));
      return this;
    }
    order(col, { ascending = true } = {}) {
      this.orders.push([col, ascending]);
      return this;
    }
    limit(n) {
      this.limitN = n;
      return this;
    }
    // inclusive, like PostgREST. maxRows mimics Supabase's silent "Max rows" cut-off
    range(from, to) {
      this.offset = from;
      this.limitN = to - from + 1;
      return this;
    }
    single() {
      this.mode = 'single';
      return this;
    }
    maybeSingle() {
      this.mode = 'maybe';
      return this;
    }
    match(row) {
      return this.filters.every((f) => f(row));
    }
    run() {
      const rows = tables[this.table];
      if (!rows) return { data: null, error: { code: '42P01', message: `no table ${this.table}` } };

      let out;
      if (this.op === 'select') {
        out = rows.filter((r) => this.match(r));
        for (const [col, asc] of [...this.orders].reverse()) {
          out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
        }
        const cap = Math.min(this.limitN ?? Infinity, state.maxRows ?? Infinity);
        out = out.slice(this.offset ?? 0, (this.offset ?? 0) + cap);
      } else if (this.op === 'insert') {
        out = this.payload.map((p) => ({ id: randomUUID(), created_at: now(), ...structuredClone(p) }));
        rows.push(...out);
      } else if (this.op === 'update') {
        out = rows.filter((r) => this.match(r));
        out.forEach((r) => Object.assign(r, structuredClone(this.payload), { updated_at: now() }));
      } else if (this.op === 'upsert') {
        out = this.payload.map((p) => {
          const same = (r) => this.conflictKeys.every((k) => String(r[k] ?? '') === String(p[k] ?? ''));
          const existing = rows.find(same);
          // an explicit updated_at in the payload wins, like it does in postgres
          if (existing) return Object.assign(existing, { updated_at: now() }, structuredClone(p));
          const row = { id: randomUUID(), created_at: now(), updated_at: now(), ...structuredClone(p) };
          rows.push(row);
          return row;
        });
      } else if (this.op === 'delete') {
        out = rows.filter((r) => this.match(r));
        tables[this.table] = rows.filter((r) => !out.includes(r));
      }

      if (this.op !== 'select' && !this.returning) return { data: null, error: null };
      if (this.op === 'select' && this.countOpts?.count) {
        return { data: this.countOpts.head ? null : structuredClone(out), count: out.length, error: null };
      }
      const data = structuredClone(out);
      if (this.mode === 'single') {
        return data.length === 1
          ? { data: data[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not single' } };
      }
      if (this.mode === 'maybe') return { data: data[0] ?? null, error: null };
      return { data, error: null };
    }
    then(resolve, reject) {
      return new Promise((r) => setTimeout(r, state.delayMs))
        .then(() => this.run())
        .then(resolve, reject);
    }
  }

  // auth.users insert + what the handle_new_user trigger does
  function createUser({ email, password, meta = {} }) {
    if (users.has(email)) return null;
    const u = { id: randomUUID(), email, password, user_metadata: meta, created_at: new Date().toISOString() };
    users.set(email, u);
    tables.profiles.push({
      id: u.id,
      display_name: meta.display_name ?? '',
      school_id: meta.school_id ?? null,
      grade_level_id: meta.grade_level_id ?? null,
      gpax: null,
      subject_grades: {},
      interests: [],
      skills: [],
      activities: [],
      awards: [],
      target_faculties: [],
      terms_version: meta.terms_version ?? null,
      terms_accepted_at: meta.terms_accepted_at ?? null,
      is_demo: Boolean(meta.is_demo),
      created_at: now(),
      updated_at: now(),
    });
    return u;
  }

  const auth = {
    async getUser(token) {
      if (state.authBusy) return { data: { user: null }, error: { status: 429, code: 'over_request_rate_limit', message: 'busy' } };
      const u = userById(accessTokens.get(token));
      return u
        ? { data: { user: publicUser(u) }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'bad jwt' } };
    },

    async signUp({ email, password, options }) {
      const u = createUser({ email, password, meta: options?.data ?? {} });
      if (!u) {
        return { data: { user: null, session: null }, error: { status: 422, code: 'user_already_exists', message: 'exists' } };
      }
      return { data: { user: publicUser(u), session: newSession(u) }, error: null };
    },

    async signInWithPassword({ email, password }) {
      if (state.authBusy) return busy();
      const u = users.get(email);
      if (!u || u.password !== password) {
        return { data: {}, error: { status: 400, code: 'invalid_credentials', message: 'bad' } };
      }
      return { data: { user: publicUser(u), session: newSession(u) }, error: null };
    },

    async refreshSession({ refresh_token }) {
      if (state.authBusy) return busy();
      const u = userById(refreshTokens.get(refresh_token));
      if (!u) return { data: { session: null }, error: { status: 400, code: 'refresh_token_not_found', message: 'bad' } };
      refreshTokens.delete(refresh_token);
      return { data: { user: publicUser(u), session: newSession(u) }, error: null };
    },

    async resetPasswordForEmail(email, opts) {
      const u = users.get(email);
      state.lastReset = null;
      if (u) {
        const token_hash = `th_${randomUUID()}`;
        resetTokens.set(token_hash, u.id);
        state.lastReset = { email, token_hash, redirectTo: opts?.redirectTo };
      }
      return { data: {}, error: null };
    },

    async verifyOtp({ token_hash, type }) {
      if (state.authBusy) return busy();
      const u = type === 'recovery' && userById(resetTokens.get(token_hash));
      if (!u) return { data: { user: null, session: null }, error: { status: 403, code: 'otp_expired', message: 'expired' } };
      resetTokens.delete(token_hash);
      return { data: { user: publicUser(u), session: newSession(u) }, error: null };
    },

    admin: {
      async signOut(jwt, scope = 'global') {
        const userId = accessTokens.get(jwt);
        if (scope === 'local') accessTokens.delete(jwt);
        else if (userId) dropTokens(userId, scope === 'others' ? jwt : undefined);
        return { data: null, error: null };
      },
      async updateUserById(id, { password }) {
        const u = userById(id);
        if (!u) return { data: null, error: { status: 404, code: 'user_not_found', message: 'nope' } };
        u.password = password;
        return { data: { user: publicUser(u) }, error: null };
      },
      async createUser({ email, password, user_metadata }) {
        const u = createUser({ email, password, meta: user_metadata });
        if (!u) return { data: { user: null }, error: { status: 422, code: 'email_exists', message: 'exists' } };
        return { data: { user: publicUser(u) }, error: null };
      },
      async listUsers({ page = 1, perPage = 50 } = {}) {
        const all = [...users.values()].map((u) => ({ ...publicUser(u), created_at: u.created_at }));
        return { data: { users: all.slice((page - 1) * perPage, page * perPage) }, error: null };
      },
      async deleteUser(id) {
        const u = userById(id);
        if (!u) return { data: null, error: { status: 404, code: 'user_not_found', message: 'nope' } };
        users.delete(u.email);
        dropTokens(id);
        // on delete cascade
        tables.profiles = tables.profiles.filter((r) => r.id !== id);
        for (const t of ['assessments', 'recommendations', 'tcas_plans', 'exam_scores', 'chat_messages', 'saved_programs', 'shared_links', 'user_state', 'plan_items', 'progress_snapshots']) {
          tables[t] = tables[t].filter((r) => r.user_id !== id);
        }
        return { data: {}, error: null };
      },
    },
  };

  // just the storage calls avatar.service makes
  const storage = {
    from(bucket) {
      return {
        async upload(path, body, { contentType } = {}) {
          files.set(`${bucket}/${path}`, { body, contentType });
          return { data: { path }, error: null };
        },
        async list(folder) {
          const prefix = `${bucket}/${folder}/`;
          const data = [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ name: k.slice(prefix.length) }));
          return { data, error: null };
        },
        async remove(paths) {
          paths.forEach((p) => files.delete(`${bucket}/${p}`));
          return { data: paths, error: null };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` } };
        },
      };
    },
  };

  const client = { from: (t) => new Query(t), auth, storage };
  return { factory: () => client, tables, state, files, users };
}
