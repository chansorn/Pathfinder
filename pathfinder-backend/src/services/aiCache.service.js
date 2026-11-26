import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { geminiModel } from '../config/gemini.js';
import { log } from '../utils/log.js';

// bump when prompts/schemas change in a way that should invalidate old answers
const CACHE_VERSION = 1;

// Fingerprint of everything that goes into an AI call. Same fingerprint = same question,
// so the previous answer can be reused instead of paying Gemini again.
// Model + mock flag are part of it so switching either never serves a stale/fake result.
export function inputHash(parts) {
  const payload = JSON.stringify({ ...parts, model: geminiModel, mock: env.USE_MOCK_AI, v: CACHE_VERSION });
  return createHash('sha256').update(payload).digest('hex');
}

// newest saved result of a feature (AI fallback "previous"). match(row) keeps it to results that
// answered the same question - a physics plan is no answer to "TPAT3"
export async function findLatest(db, { table, cols, userId, type, match = () => true }) {
  let q = db.from(table).select(cols).eq('user_id', userId);
  if (type) q = q.eq('type', type);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(20);
  if (error) {
    log.warn(`[fallback] ${table} lookup failed:`, error.code ?? '', error.message);
    return null;
  }
  return data.find(match) ?? null;
}

export async function findCached(db, { table, cols, userId, hash, type }) {
  if (!env.AI_CACHE_DAYS) return null;

  const since = new Date(Date.now() - env.AI_CACHE_DAYS * 24 * 3600 * 1000).toISOString();
  let q = db.from(table).select(cols).eq('user_id', userId).eq('input_hash', hash).gte('created_at', since);
  if (type) q = q.eq('type', type);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    // a broken cache lookup shouldn't break the feature, just treat it as a miss
    log.warn(`[cache] ${table} lookup failed:`, error.code ?? '', error.message);
    return null;
  }
  return data;
}
