import { anonClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { latestYear } from './tcas.service.js';
import { aiDailyUsage } from '../middlewares/rateLimit.js';
import { jwksStatus, warmJwks } from './token.service.js';

// GET /api/health/deep - what's actually working, for the team's phone on the day and for an
// uptime monitor. Never calls Gemini (that costs money): it reports how the last real call went.

let lastAi = { ok: null, at: null, code: null };

// ai.service reports every real Gemini call here
export function noteAiCall(ok, code = null) {
  lastAi = { ok, at: new Date().toISOString(), code };
}

const CACHE_MS = 10_000; // monitors poll this; one db round trip per 10s at most
let cache = null;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms).unref())]);

async function checkDb() {
  const started = Date.now();
  try {
    const { error } = await withTimeout(anonClient().from('grade_levels').select('id').limit(1), 3000);
    if (error) return { ok: false, ms: Date.now() - started, error: error.code ?? 'error' };
    const year = await withTimeout(latestYear(), 3000);
    return { ok: true, ms: Date.now() - started, tcas_year: year };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err?.message ?? 'error' };
  }
}

async function checkAuth() {
  if (!env.AUTH_LOCAL_VERIFY) return { ok: true, mode: 'supabase' };
  await warmJwks();
  const { keys, loaded_at } = jwksStatus();
  // no keys = legacy HS256 project (needs SUPABASE_JWT_SECRET) or JWKS unreachable -> falls back to Supabase
  const mode = keys ? 'local_jwks' : env.SUPABASE_JWT_SECRET ? 'local_secret' : 'supabase_fallback';
  return { ok: true, mode, jwks_keys: keys, jwks_loaded_at: loaded_at };
}

function aiStatus() {
  const { used, limit } = aiDailyUsage();
  const configured = env.USE_MOCK_AI || Boolean(env.GEMINI_API_KEY);
  return {
    ok: configured && lastAi.ok !== false,
    mode: env.USE_MOCK_AI ? 'mock' : 'gemini',
    model: env.USE_MOCK_AI ? null : env.GEMINI_MODEL,
    configured,
    last_call: lastAi,
    daily_used: used,
    daily_limit: limit,
    fallback: env.AI_FALLBACK,
  };
}

export async function deepHealth() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [db, auth] = await Promise.all([checkDb(), checkAuth()]);
  const ai = aiStatus();
  // down = nothing works without the db. degraded = AI erroring (fallback answers kick in)
  const status = !db.ok ? 'down' : ai.ok ? 'ok' : 'degraded';
  const data = { status, checked_at: new Date().toISOString(), uptime_s: Math.round(process.uptime()), db, auth, ai };
  cache = { at: Date.now(), data };
  return data;
}
