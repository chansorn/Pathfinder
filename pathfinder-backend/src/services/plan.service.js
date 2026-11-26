import { randomBytes } from 'node:crypto';
import { dbError, badRequest, notFound } from '../utils/AppError.js';
import { buildIcs } from '../utils/ics.js';
import { getProgram, getCalendar } from './tcas.service.js';
import { docsForRound } from './requirements.js';

// The roadmap page: app state synced from localStorage (user_state), the checklist
// (plan_items) and the student's Rank 1-3 target programs with their real round dates.

// --- app state (PF_STATE) ---

export async function getState(db, userId) {
  const { data, error } = await db.from('user_state').select('state, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw dbError(error, 'get state');
  return { state: data?.state ?? {}, updated_at: data?.updated_at ?? null };
}

// top-level keys replace, except behavior which merges one level down
export async function patchState(db, userId, patch) {
  const { state: current } = await getState(db, userId);
  const next = { ...current, ...patch };
  if (patch.behavior) next.behavior = { ...(current.behavior ?? {}), ...patch.behavior };

  const { data, error } = await db
    .from('user_state')
    .upsert({ user_id: userId, state: next }, { onConflict: 'user_id' })
    .select('state, updated_at')
    .single();
  if (error) throw dbError(error, 'save state');
  return data;
}

// --- checklist ---

const ITEM_COLS = 'item_key, round, tier, title, detail, status, due_date, source, created_at, updated_at';
const TIER_ORDER = { required: 0, recommended: 1, optional: 2 };
// the frontend calls it "id"
const toItem = ({ item_key, user_id, ...r }) => ({ ...r, id: item_key });

async function listItems(db, userId) {
  const { data, error } = await db.from('plan_items').select(ITEM_COLS).eq('user_id', userId);
  if (error) throw dbError(error, 'list plan items');
  return data
    .map(toItem)
    .sort((a, b) => (a.round ?? 9) - (b.round ?? 9) || TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || (a.created_at < b.created_at ? -1 : 1));
}

function progress(items) {
  const live = items.filter((i) => i.status !== 'dismissed');
  const tiers = {};
  for (const t of Object.keys(TIER_ORDER)) {
    const inTier = live.filter((i) => i.tier === t);
    tiers[t] = { done: inTier.filter((i) => i.status === 'done').length, total: inTier.length };
  }
  const done = live.filter((i) => i.status === 'done').length;
  return { done, total: live.length, percent: live.length ? Math.round((done / live.length) * 100) : 0, tiers };
}

// spelled out instead of relying on column defaults: a multi-row upsert with mixed keys
// would otherwise send NULL for the missing columns
const ITEM_DEFAULTS = { round: null, tier: 'recommended', detail: {}, status: 'todo', due_date: null, source: 'system' };

// batches of 100 keys keep the request url well under PostgREST's limit
async function existingItems(db, userId, keys) {
  const found = new Map();
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await db.from('plan_items').select(ITEM_COLS).eq('user_id', userId).in('item_key', keys.slice(i, i + 100));
    if (error) throw dbError(error, 'find plan items');
    data.forEach((r) => found.set(r.item_key, r));
  }
  return found;
}

export async function patchItem(db, userId, key, patch) {
  const existing = (await existingItems(db, userId, [key])).get(key);
  if (!existing && !patch.title) throw badRequest('งานนี้ยังไม่มีในระบบ ต้องส่ง title มาด้วยในครั้งแรก', 'ITEM_TITLE_REQUIRED');

  const q = existing
    ? db.from('plan_items').update(patch).eq('user_id', userId).eq('item_key', key)
    : db.from('plan_items').insert({ ...ITEM_DEFAULTS, ...patch, user_id: userId, item_key: key });
  const { data, error } = await q.select(ITEM_COLS).single();
  if (error) throw dbError(error, 'save plan item');
  return toItem(data);
}

export async function syncItems(db, userId, rawItems) {
  // the same id twice in one upsert makes postgres refuse the whole batch - last one wins
  const items = [...new Map(rawItems.map((i) => [i.id, i])).values()];
  if (items.length) {
    const existing = await existingItems(db, userId, items.map((i) => i.id));
    // every row gets every column: incoming wins, then what's stored, then defaults
    const rows = items.map(({ id, ...incoming }) => {
      const { created_at, updated_at, ...stored } = existing.get(id) ?? {};
      return { ...ITEM_DEFAULTS, ...stored, ...incoming, user_id: userId, item_key: id };
    });
    const { error } = await db.from('plan_items').upsert(rows, { onConflict: 'user_id,item_key' });
    if (error) throw dbError(error, 'sync plan items');
  }
  return { items: await listItems(db, userId) };
}

export async function addCustomItem(db, userId, item) {
  const row = { ...ITEM_DEFAULTS, ...item, user_id: userId, item_key: `custom-${randomBytes(6).toString('base64url')}`, source: 'custom' };
  const { data, error } = await db.from('plan_items').insert(row).select(ITEM_COLS).single();
  if (error) throw dbError(error, 'add custom item');
  return toItem(data);
}

export async function deleteItem(db, userId, key) {
  const { data, error } = await db.from('plan_items').delete().eq('user_id', userId).eq('item_key', key).select('item_key');
  if (error) throw dbError(error, 'delete plan item');
  if (!data.length) throw notFound('ไม่พบงานนี้');
  return { id: key };
}

// "Reset Plan": checklist + targets go, profile / scores / AI history stay
const PLAN_STATE_KEYS = ['target_programs', 'locked_program_id', 'locked_major', 'liked_majors', 'ignored_majors', 'checked_waypoints'];

export async function resetPlan(db, userId) {
  const { data, error } = await db.from('plan_items').delete().eq('user_id', userId).select('item_key');
  if (error) throw dbError(error, 'reset plan items');

  const { state } = await getState(db, userId);
  const kept = Object.fromEntries(Object.entries(state).filter(([k]) => !PLAN_STATE_KEYS.includes(k)));
  const { error: stErr } = await db.from('user_state').upsert({ user_id: userId, state: kept }, { onConflict: 'user_id' });
  if (stErr) throw dbError(stErr, 'reset plan state');
  return { deleted_items: data.length, cleared_state: PLAN_STATE_KEYS };
}

// --- the whole roadmap in one call ---

// Rank 1-3 from state.target_programs, or the 3 newest saved programs if none were picked
async function targetProgramIds(db, userId, state) {
  if (state.target_programs?.length) return state.target_programs.slice(0, 3);
  const { data, error } = await db
    .from('saved_programs')
    .select('program_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw dbError(error, 'plan saved programs');
  return data.map((s) => s.program_id);
}

// per round: the earliest opening / latest closing date across the program's projects
function roundsOf(program) {
  return [1, 2, 3, 4].map((round) => {
    const projects = program.admissions.filter((a) => a.round === round);
    const starts = projects.map((a) => a.apply_start).filter(Boolean).sort();
    const ends = projects.map((a) => a.apply_end).filter(Boolean).sort();
    return {
      round,
      available: projects.length > 0,
      projects: projects.length,
      apply_start: starts[0] ?? null,
      apply_end: ends.at(-1) ?? null,
      source_url: projects[0]?.source_url ?? null,
      // the "Recommended Docs" sub-card
      recommended_docs: docsForRound(projects),
    };
  });
}

async function loadTargets(db, userId, state) {
  const ids = await targetProgramIds(db, userId, state);
  const programs = await Promise.all(ids.map((id) => getProgram(id).catch(() => null)));
  return programs.map((p, i) => (p ? { rank: i + 1, program: { ...p, admissions: undefined }, rounds: roundsOf(p) } : null)).filter(Boolean);
}

export async function getMyPlan(db, userId) {
  const [{ state, updated_at }, items] = await Promise.all([getState(db, userId), listItems(db, userId)]);
  const targets = await loadTargets(db, userId, state);
  return {
    state,
    state_updated_at: updated_at,
    targets,
    locked_program_id: state.locked_program_id ?? null,
    items,
    progress: progress(items),
  };
}

// --- .ics ---

export async function myPlanIcs(db, userId) {
  const [{ state }, items] = await Promise.all([getState(db, userId), listItems(db, userId)]);
  const targets = await loadTargets(db, userId, state);
  const events = [];

  for (const t of targets) {
    for (const r of t.rounds) {
      if (!r.apply_end) continue;
      events.push({
        uid: `t-${t.program.id}-r${r.round}`,
        title: `TCAS รอบ ${r.round}: ${t.program.university} ${t.program.program}`,
        start: r.apply_start ?? r.apply_end,
        end: r.apply_end,
        description: `ช่วงรับสมัครรอบ ${r.round} (อันดับ ${t.rank}) ตรวจสอบประกาศล่าสุดที่ mytcas.com`,
        url: r.source_url ?? undefined,
      });
    }
  }

  const { items: calendar } = await getCalendar({ universities: targets.map((t) => t.program.university) }, db);
  calendar.forEach((c, i) =>
    events.push({
      uid: `c-${c.start_date}-${i}`,
      title: c.university ? `${c.university}: ${c.event}` : `TCAS: ${c.event}`,
      start: c.start_date,
      end: c.end_date ?? c.start_date,
      url: c.source_url ?? undefined,
    }),
  );

  for (const it of items) {
    if (!it.due_date || it.status === 'dismissed') continue;
    events.push({ uid: `i-${it.id}`, title: `${it.status === 'done' ? '✓ ' : ''}${it.title}`, start: it.due_date });
  }

  return buildIcs('PathFinder - แผน TCAS ของฉัน', events);
}

export async function tcasCalendarIcs({ year, university }, db) {
  const { academic_year, items } = await getCalendar({ year, university }, db);
  const events = items.map((c, i) => ({
    uid: `tcas${academic_year}-${i}-${c.start_date}`,
    title: c.university ? `${c.university}: ${c.event}` : `TCAS: ${c.event}`,
    start: c.start_date,
    end: c.end_date ?? c.start_date,
    url: c.source_url ?? undefined,
  }));
  return buildIcs(`ปฏิทิน TCAS${String(academic_year ?? '').slice(-2)}`, events);
}

// --- analytics page: progress snapshots ---

const PROGRESS_COLS = 'id, event_type, metrics, created_at';
const PROGRESS_MAX = 500;
// the page records a snapshot on every checkbox click; the same numbers again this soon add nothing
const PROGRESS_DEDUPE_MS = 60 * 1000;

const toSnapshot = ({ metrics, ...r }) => ({ ...r, ...metrics });

// oldest first, ready for a trend chart
export async function listProgress(db, userId, { days } = {}) {
  let q = db.from('progress_snapshots').select(PROGRESS_COLS).eq('user_id', userId);
  if (days) q = q.gte('created_at', new Date(Date.now() - days * 24 * 3600 * 1000).toISOString());
  const { data, error } = await q.order('created_at', { ascending: false }).limit(PROGRESS_MAX);
  if (error) throw dbError(error, 'list progress');
  return { items: data.reverse().map(toSnapshot) };
}

export async function addProgress(db, userId, { event_type, ...metrics }) {
  const { data: last, error: lastErr } = await db
    .from('progress_snapshots')
    .select(PROGRESS_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw dbError(lastErr, 'last progress');
  const same =
    last &&
    last.event_type === event_type &&
    Date.now() - new Date(last.created_at).getTime() < PROGRESS_DEDUPE_MS &&
    JSON.stringify(last.metrics) === JSON.stringify(metrics);
  if (same) return { snapshot: toSnapshot(last), created: false };

  const { data, error } = await db
    .from('progress_snapshots')
    .insert({ user_id: userId, event_type, metrics })
    .select(PROGRESS_COLS)
    .single();
  if (error) throw dbError(error, 'save progress');
  return { snapshot: toSnapshot(data), created: true };
}
