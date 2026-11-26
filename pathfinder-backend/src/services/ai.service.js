import { getGeminiClient, geminiModel, geminiTimeoutMs } from '../config/gemini.js';
import { env } from '../config/env.js';
import { SYSTEM_PROMPT } from '../prompts/system.prompt.js';
import { toGeminiSchema } from '../utils/geminiSchema.js';
import { AppError } from '../utils/AppError.js';
import { log } from '../utils/log.js';
import { AI_LANGUAGE_RULE } from '../utils/i18n.js';
import { noteAiCall } from './health.service.js';

// The only file that talks to Gemini.

const schemaCache = new WeakMap();
const geminiSchemaOf = (zodSchema) => {
  if (!schemaCache.has(zodSchema)) schemaCache.set(zodSchema, toGeminiSchema(zodSchema));
  return schemaCache.get(zodSchema);
};

const SEARCH_TOOLS = [{ googleSearch: {} }];

// Some models refuse tools together with JSON mode. If that happens once, stop trying for this process.
let searchUnsupported = false;
const isToolRejection = (err) => err?.status === 400 && /tool|search|mime|grounding/i.test(err?.message ?? '');

// every failure ends up here, so /api/health/deep knows Gemini is struggling
function toAppError(err, timedOut) {
  const e = classify(err, timedOut);
  noteAiCall(false, e.code);
  return e;
}

function classify(err, timedOut) {
  if (err instanceof AppError) return err;
  if (timedOut) {
    return new AppError(500, 'AI_TIMEOUT', 'AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่อีกครั้ง');
  }
  if (err?.status === 429) {
    return new AppError(429, 'AI_QUOTA_EXCEEDED', 'ตอนนี้มีคนใช้ AI เยอะมาก กรุณารอสักครู่แล้วลองใหม่');
  }
  // status + message only - the request holds the student's data
  log.error('[ai] gemini error:', err?.status ?? '', err?.message ?? err);
  return new AppError(500, 'AI_ERROR', 'ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
}

// web pages Gemini used when Google Search grounding was on
export function extractSources(response) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Map();
  for (const c of chunks) {
    const url = c?.web?.uri;
    if (url && !seen.has(url)) seen.set(url, { title: c.web.title ?? url, url });
  }
  return [...seen.values()].slice(0, 10);
}

/**
 * Ask Gemini for JSON matching a zod schema. Returns { result, sources }.
 * useSearch turns on Google Search grounding (sources = the pages it used).
 * Mock mode returns `mock` (still run through the schema).
 * If the answer doesn't parse/validate we retry once, then give up.
 */
export async function generateJson({ feature, prompt: basePrompt, schema, mock, useSearch = false, lang = 'th' }) {
  if (env.USE_MOCK_AI) return { result: schema.parse(structuredClone(mock)), sources: [] };
  const prompt = basePrompt + AI_LANGUAGE_RULE[lang];

  const ai = getGeminiClient();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const search = useSearch && !searchUnsupported;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), geminiTimeoutMs);
    let res;
    try {
      res = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT + AI_LANGUAGE_RULE[lang],
          responseMimeType: 'application/json',
          responseSchema: geminiSchemaOf(schema),
          temperature: 0.7,
          tools: search ? SEARCH_TOOLS : undefined,
          abortSignal: controller.signal,
        },
      });
    } catch (err) {
      if (search && isToolRejection(err)) {
        log.warn(`[ai] ${geminiModel} rejected google search + JSON, continuing without search`);
        searchUnsupported = true;
        attempt--; // doesn't count as a try
        continue;
      }
      throw toAppError(err, controller.signal.aborted);
    } finally {
      clearTimeout(timer);
    }

    try {
      const out = { result: schema.parse(JSON.parse(res.text ?? '')), sources: extractSources(res) };
      noteAiCall(true);
      return out;
    } catch {
      log.warn(`[ai] ${feature}: response didn't match schema (attempt ${attempt})`);
    }
  }
  throw toAppError(new AppError(500, 'AI_INVALID_RESPONSE', 'AI ตอบกลับมาในรูปแบบที่ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'));
}

/**
 * Saved chat rows -> Gemini contents. Gemini wants user/model turns alternating and starting with
 * the user, but our history doesn't always look like that: a failed answer leaves two user rows in
 * a row, and the last-10 window can start on an assistant row. So: drop leading model turns and
 * merge neighbours with the same role (an unanswered question gets folded into the next one).
 */
export function toGeminiTurns(history = []) {
  const turns = [];
  for (const m of history) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (!turns.length && role === 'model') continue;
    const last = turns.at(-1);
    if (last?.role === role) last.parts[0].text += `\n\n${m.content}`;
    else turns.push({ role, parts: [{ text: m.content }] });
  }
  return turns;
}

/**
 * Streaming chat, yields text chunks.
 * history: [{ role: 'user' | 'assistant', content }]
 * onSources(list) is called at the end when search grounding was used.
 * The timeout is an idle timeout - it only fires if no new chunk shows up for geminiTimeoutMs,
 * so long answers are fine.
 */
export async function* streamChat({ systemPrompt: basePrompt, history, message, signal, mockReply, useSearch = false, onSources, lang = 'th' }) {
  const systemPrompt = basePrompt + AI_LANGUAGE_RULE[lang];
  if (env.USE_MOCK_AI) {
    // split by code point so emoji don't get cut in half.
    // English mode gets an English canned line, so tests can see that lang made it all the way here
    const chars = Array.from(lang === 'en' ? 'This is a mock answer (USE_MOCK_AI=true). Real answers come from Gemini.' : mockReply);
    for (let i = 0; i < chars.length; i += 24) {
      if (signal?.aborted) return;
      await new Promise((r) => setTimeout(r, 25));
      yield chars.slice(i, i + 24).join('');
    }
    onSources?.([]);
    return;
  }

  const ai = getGeminiClient();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  let timedOut = false;
  let timer;
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, geminiTimeoutMs);
  };

  // in English mode the rule rides on the newest message too - with a long Thai system prompt and
  // Thai history, real Gemini kept answering in Thai when it was only in the system prompt.
  // (the saved chat_messages row keeps what the student actually typed)
  const newest = lang === 'en' ? `${message}\n\n(Reply in English.)` : message;
  const turns = toGeminiTurns([...history, { role: 'user', content: newest }]);
  const open = (search) =>
    ai.models.generateContentStream({
      model: geminiModel,
      contents: turns,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
        tools: search ? SEARCH_TOOLS : undefined,
        abortSignal: controller.signal,
      },
    });

  try {
    resetTimer();
    const search = useSearch && !searchUnsupported;
    let stream;
    try {
      stream = await open(search);
    } catch (err) {
      if (!(search && isToolRejection(err))) throw err;
      log.warn(`[ai] ${geminiModel} rejected google search in chat, continuing without search`);
      searchUnsupported = true;
      stream = await open(false);
    }

    const sources = new Map();
    for await (const chunk of stream) {
      resetTimer();
      for (const s of extractSources(chunk)) sources.set(s.url, s);
      if (chunk.text) yield chunk.text;
    }
    onSources?.([...sources.values()].slice(0, 10));
    noteAiCall(true);
  } catch (err) {
    if (signal?.aborted && !timedOut) return; // client went away, not an error
    throw toAppError(err, timedOut);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
