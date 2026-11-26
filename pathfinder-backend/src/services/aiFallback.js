import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { log } from '../utils/log.js';
import { t } from '../utils/i18n.js';

// When Gemini can't answer (down, slow, out of quota) or today's AI cap is used up, the booth
// still needs something on screen instead of an error page:
//   1. the student's own last result for this feature ("previous"), or
//   2. a sample answer, clearly labelled ("sample"), never saved, so it can't end up in the cache.
// The response carries `fallback: { kind, reason, note }` so the frontend can show a banner.
// Turn off with AI_FALLBACK=false to get the plain errors back.

// AI failures worth covering. Anything else (db error, bad input) is a real error and stays one
const FALLBACK_ON = new Set(['AI_ERROR', 'AI_TIMEOUT', 'AI_QUOTA_EXCEEDED', 'AI_INVALID_RESPONSE']);

export const dailyLimitError = () => new AppError(429, 'AI_DAILY_LIMIT', 'วันนี้ระบบ AI ถูกใช้ครบโควตาแล้ว กลับมาใช้ใหม่พรุ่งนี้นะ');

/**
 * noBudget: today's AI cap is used up (set by aiDailyCapSoft), don't even try Gemini.
 * call(): the real thing, returns { ..., cached: false }.
 * previous(): the student's latest saved result for this feature or null.
 * sample(): a response-shaped object built from the mock answer.
 * A fallback counts as cached: 200, and it doesn't use the student's AI quota.
 */
export async function aiOrFallback({ noBudget = false, lang = 'th', call, previous, sample }) {
  let reason = 'AI_DAILY_LIMIT';
  if (noBudget) {
    if (!env.AI_FALLBACK) throw dailyLimitError();
  } else {
    try {
      return await call();
    } catch (err) {
      if (!env.AI_FALLBACK || !FALLBACK_ON.has(err?.code)) throw err;
      reason = err.code;
    }
  }

  const prev = await previous().catch(() => null);
  const kind = prev ? 'previous' : 'sample';
  log.warn(`[ai] answering with a ${kind} result (${reason})`);
  return { ...(prev ?? sample()), cached: true, fallback: { kind, reason, note: t(lang, `ai_fallback_${kind}`) } };
}

// sample answers still go through the schema, same as mock mode
export const sampleOf = (schema, mock) => schema.parse(structuredClone(mock));
