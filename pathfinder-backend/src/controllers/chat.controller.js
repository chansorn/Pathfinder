import { prepareChat, chatStream, saveAssistantMessage } from '../services/chat.service.js';
import { AppError } from '../utils/AppError.js';
import { log } from '../utils/log.js';
import { errorMessage } from '../utils/i18n.js';

const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/**
 * POST /api/chat - Server-Sent Events
 *   event: delta  { text }                          (many)
 *   event: done   { message_id, content, created_at, sources: [{ title, url }] }
 *   event: error  { code, message }
 * Anything that fails before the stream starts (validation, auth, db) is still a normal JSON error.
 */
export async function chat(req, res) {
  const { message, context } = req.valid.body;
  const { systemPrompt, history, webSearch } = await prepareChat(req.db, req.user.id, message, context);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop nginx-style proxies from buffering
  });
  res.flushHeaders?.();

  // tab closed / user hit stop -> stop paying for tokens
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  let content = '';
  let sources = [];
  const onSources = (list) => {
    sources = list;
  };
  try {
    for await (const text of chatStream({ systemPrompt, history, message, signal: controller.signal, webSearch, onSources, lang: req.lang })) {
      content += text;
      send(res, 'delta', { text });
    }
  } catch (err) {
    const e = err instanceof AppError ? err : new AppError(500, 'AI_ERROR', 'ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
    if (!(err instanceof AppError)) log.error('[chat] stream error:', err?.message ?? err);
    if (!res.writableEnded) {
      send(res, 'error', { code: e.code, message: errorMessage(req.lang, e.code, e.message) });
      res.end();
    }
    // keep whatever we got
    if (content) await saveAssistantMessage(req.db, req.user.id, content).catch(() => {});
    return;
  }

  // also covers an abort halfway through - save the partial answer
  if (!content) {
    if (!res.writableEnded) res.end();
    return;
  }
  try {
    const saved = await saveAssistantMessage(req.db, req.user.id, content);
    if (!res.writableEnded) send(res, 'done', { message_id: saved.id, content, created_at: saved.created_at, sources });
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'DATABASE_ERROR';
    const message = err instanceof AppError ? err.message : 'บันทึกคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    if (!res.writableEnded) send(res, 'error', { code, message: errorMessage(req.lang, code, message) });
  }
  if (!res.writableEnded) res.end();
}
