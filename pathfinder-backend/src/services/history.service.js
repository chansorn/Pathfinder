import { dbError } from '../utils/AppError.js';

const SOURCES = {
  faculty: { table: 'recommendations', cols: 'id, type, result, created_at', type: 'faculty' },
  career: { table: 'recommendations', cols: 'id, type, result, created_at', type: 'career' },
  portfolio: { table: 'recommendations', cols: 'id, type, result, created_at', type: 'portfolio' },
  skill: { table: 'recommendations', cols: 'id, type, result, created_at', type: 'skill' },
  high_yield: { table: 'recommendations', cols: 'id, type, result, created_at', type: 'high_yield' },
  tcas: { table: 'tcas_plans', cols: 'id, target, plan, created_at' },
  assessment: { table: 'assessments', cols: 'id, result, created_at' },
  chat: { table: 'chat_messages', cols: 'id, role, content, created_at' },
};

async function fetchSource(db, userId, key, limit) {
  const s = SOURCES[key];
  let q = db.from(s.table).select(s.cols).eq('user_id', userId);
  if (s.type) q = q.eq('type', s.type);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw dbError(error, `history ${key}`);
  // chat goes oldest -> newest so it renders as a conversation
  return key === 'chat' ? data.reverse() : data;
}

export async function getHistory(db, userId, { type, limit }) {
  if (type) return { type, items: await fetchSource(db, userId, type, limit) };

  // no type: everything except chat, grouped
  const keys = Object.keys(SOURCES).filter((k) => k !== 'chat');
  const lists = await Promise.all(keys.map((k) => fetchSource(db, userId, k, limit)));
  return Object.fromEntries(keys.map((k, i) => [k, lists[i]]));
}
