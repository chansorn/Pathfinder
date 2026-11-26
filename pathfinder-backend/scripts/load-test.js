// Open-house load test: N students hitting the API at the same time, like one class at a booth.
//
//   node scripts/load-test.js --url http://localhost:4000 --users 50
//   node scripts/load-test.js --url https://api.example.com --users 100 --ai 1     (also 1 real AI call each)
//
// Each virtual student: demo login -> /me -> faculty groups -> simulator -> state -> roadmap item
// -> /my-plan -> deadlines -> calendar (+ --ai N calls to /recommend/skills).
// Prints latency (p50 / p95 / max) and errors per endpoint.
//
// Notes
// - Uses POST /api/auth/demo, so it creates real (throwaway) accounts. With SUPABASE_SERVICE_ROLE_KEY
//   in .env they are deleted at the end; otherwise the backend sweeps them after DEMO_TTL_HOURS.
// - All requests come from one IP, exactly like the venue Wi-Fi. Run the server with
//   RATE_LIMIT_SHARED_IPS=127.0.0.1,::1 (local) or the machine's public IP, or demo logins hit 429.
// - --ai uses real Gemini unless the server runs with USE_MOCK_AI=true. It costs money.
import 'dotenv/config';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = `${arg('url', 'http://localhost:4000').replace(/\/+$/, '')}/api`;
const USERS = Number(arg('users', 30));
const AI_CALLS = Number(arg('ai', 0));
const RAMP_MS = Number(arg('ramp', 2000)); // spread the start over this long

const stats = new Map(); // name -> { ms: [], errors: Map(code -> n) }
const record = (name, ms, error) => {
  if (!stats.has(name)) stats.set(name, { ms: [], errors: new Map() });
  const s = stats.get(name);
  s.ms.push(ms);
  if (error) s.errors.set(error, (s.errors.get(error) ?? 0) + 1);
};

async function call(name, method, path, { token, body, headers = {} } = {}) {
  const t = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      /* ics / sse */
    }
    record(name, Date.now() - t, res.ok ? null : `${res.status} ${json?.error?.code ?? ''}`.trim());
    return { ok: res.ok, json, text };
  } catch (err) {
    record(name, Date.now() - t, `NETWORK ${err.cause?.code ?? err.message}`);
    return { ok: false };
  }
}

const SCORES = [
  { exam_type: 'TGAT', subject: 'TGAT', score: 60 },
  { exam_type: 'TPAT', subject: 'TPAT3', score: 65 },
  { exam_type: 'A-Level', subject: 'คณิตศาสตร์ประยุกต์ 1', score: 55 },
  { exam_type: 'A-Level', subject: 'ฟิสิกส์', score: 50 },
];

async function student(i, created) {
  await new Promise((r) => setTimeout(r, (RAMP_MS * i) / Math.max(USERS, 1)));
  const login = await call('auth/demo', 'POST', '/auth/demo');
  if (!login.ok) return;
  const token = login.json.data.access_token;
  created.push(login.json.data.user.id);

  await call('me', 'GET', '/me', { token });
  const groups = await call('faculty-groups/programs', 'GET', '/tcas/faculty-groups/computer-eng/programs?limit=5');
  const programId = groups.json?.data?.items?.[i % 5]?.id ?? groups.json?.data?.items?.[0]?.id;
  if (programId) {
    await call('programs/:id/simulate', 'POST', `/tcas/programs/${programId}/simulate`, { body: { scores: SCORES } });
    await call('programs/:id/documents', 'GET', `/tcas/programs/${programId}/documents`);
    await call('me/state', 'PATCH', '/me/state', { token, body: { target_programs: [programId], weekly_hours: 8 } });
  }
  await call('faculty-groups/simulate', 'POST', '/tcas/faculty-groups/computer-eng/simulate', { body: { scores: SCORES, limit: 5 } });
  await call('my-plan/items/:id', 'PATCH', '/my-plan/items/load-test-1', { token, body: { title: 'load test', round: 3, status: 'done' } });
  await call('my-plan', 'GET', '/my-plan', { token });
  await call('tcas/deadlines', 'GET', '/tcas/deadlines?days=60', { token });
  await call('tcas/calendar', 'GET', '/tcas/calendar');
  for (let k = 0; k < AI_CALLS; k++) {
    await call('recommend/skills (AI)', 'POST', '/recommend/skills', { token, body: { force: k > 0 } });
  }
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function cleanup(ids) {
  if (!ids.length || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let n = 0;
  for (const id of ids) if (!(await admin.auth.admin.deleteUser(id)).error) n++;
  return n;
}

const started = Date.now();
console.log(`load test: ${USERS} students -> ${BASE}${AI_CALLS ? `, ${AI_CALLS} AI call(s) each` : ''}`);
const created = [];
await Promise.all(Array.from({ length: USERS }, (_, i) => student(i, created)));
const total = (Date.now() - started) / 1000;

console.log('');
console.log('endpoint'.padEnd(28), 'n'.padStart(5), 'p50'.padStart(7), 'p95'.padStart(7), 'max'.padStart(7), '  errors');
let requests = 0;
let failed = 0;
for (const [name, s] of stats) {
  requests += s.ms.length;
  const errs = [...s.errors].map(([k, v]) => `${k} x${v}`).join(', ');
  failed += [...s.errors.values()].reduce((a, b) => a + b, 0);
  console.log(name.padEnd(28), String(s.ms.length).padStart(5), `${pct(s.ms, 50)}`.padStart(7), `${pct(s.ms, 95)}`.padStart(7), `${Math.max(...s.ms)}`.padStart(7), ' ', errs || '-');
}
console.log('');
console.log(`${requests} requests in ${total.toFixed(1)}s (${(requests / total).toFixed(1)} req/s), ${failed} failed`);
if (stats.get('auth/demo')?.errors.size) {
  console.log('demo login failures (429 RATE_LIMITED): either RATE_LIMIT_SHARED_IPS is not set for this IP on the server,');
  console.log('or Supabase Auth hit its own sign-in limit (server log says "supabase auth rate limit hit") -');
  console.log('raise it in Supabase > Authentication > Rate Limits.');
}
const removed = await cleanup(created);
if (created.length) console.log(`demo accounts: ${created.length} created, ${removed} deleted now${removed < created.length ? ' (the rest expire after DEMO_TTL_HOURS)' : ''}`);
process.exit(failed ? 1 : 0);
