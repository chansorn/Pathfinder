import { serviceClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { dbError } from '../utils/AppError.js';
import { fetchAll } from '../utils/fetchAll.js';

// Anonymous aggregates for the big screen at the open house.
// Needs the service role to count across users, so it only ever returns counts -
// never a row, and any group smaller than STATS_MIN_GROUP is folded into "อื่นๆ"
// so nobody can be picked out of a tiny group.

const CACHE_MS = 5 * 60 * 1000;
let cache = null;

const coreFaculty = (s = '') => s.replace(/^(คณะ|สาขาวิชา|สาขา)\s*/, '').trim();

function topCounts(values, limit, minGroup) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const shown = sorted.filter(([, n]) => n >= minGroup).slice(0, limit);
  const hidden = sorted.length - shown.length;
  return { items: shown.map(([name, count]) => ({ name, count })), others_hidden: hidden };
}

async function count(db, table, filter) {
  let q = db.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) throw dbError(error, `stats count ${table}`);
  return n ?? 0;
}

async function compute() {
  const db = serviceClient();
  const minGroup = env.STATS_MIN_GROUP;

  // paged: Supabase silently stops at 1000 rows, and demo accounts alone can pass that
  const [allProfiles, saved, gradeLevels] = await Promise.all([
    fetchAll(() => db.from('profiles').select('id, grade_level_id, target_faculties, is_demo').order('id')),
    fetchAll(() => db.from('saved_programs').select('user_id, program_id').order('user_id').order('program_id')),
    db.from('grade_levels').select('id, name'),
  ]);
  for (const r of [allProfiles, saved, gradeLevels]) if (r.error) throw dbError(r.error, 'stats load');
  // demo accounts all carry the same sample data, they'd skew the charts
  const profiles = { data: allProfiles.data.filter((p) => !p.is_demo) };
  const demoIds = new Set(allProfiles.data.filter((p) => p.is_demo).map((p) => p.id));
  saved.data = saved.data.filter((s) => !demoIds.has(s.user_id));

  const gradeName = new Map(gradeLevels.data.map((g) => [g.id, g.name]));
  const targetFaculties = profiles.data.flatMap((p) => (p.target_faculties ?? []).map((t) => coreFaculty(t?.faculty)));

  // most saved programs, with readable names
  const savedTop = topCounts(saved.data.map((s) => s.program_id), 10, minGroup);
  let savedItems = [];
  if (savedTop.items.length) {
    const { data: progs, error } = await db
      .from('tcas_programs')
      .select('id, university, program')
      .in('id', savedTop.items.map((i) => i.name));
    if (error) throw dbError(error, 'stats saved names');
    const byId = new Map(progs.map((p) => [p.id, p]));
    savedItems = savedTop.items.map((i) => ({ ...byId.get(i.name), count: i.count }));
  }

  const users = profiles.data.length;
  const [faculty, career, portfolio, skill, tcasPlans, assessments, chats] = await Promise.all([
    count(db, 'recommendations', (q) => q.eq('type', 'faculty')),
    count(db, 'recommendations', (q) => q.eq('type', 'career')),
    count(db, 'recommendations', (q) => q.eq('type', 'portfolio')),
    count(db, 'recommendations', (q) => q.eq('type', 'skill')),
    count(db, 'tcas_plans'),
    count(db, 'assessments'),
    count(db, 'chat_messages', (q) => q.eq('role', 'user')),
  ]);

  return {
    generated_at: new Date().toISOString(),
    min_group_size: minGroup,
    users,
    grade_levels: topCounts(profiles.data.map((p) => gradeName.get(p.grade_level_id)), 10, minGroup),
    top_target_faculties: topCounts(targetFaculties, 10, minGroup),
    top_saved_programs: { items: savedItems, others_hidden: savedTop.others_hidden },
    ai_usage: {
      assessments,
      faculty_recommendations: faculty,
      career_recommendations: career,
      portfolio_ideas: portfolio,
      skill_plans: skill,
      tcas_plans: tcasPlans,
      chat_messages: chats,
    },
  };
}

export async function overview({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data = await compute();
  cache = { at: Date.now(), data };
  return data;
}
