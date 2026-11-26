import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { errorHandler } from './errorHandler.js';

// Gemini gets two tries (see ai.service), so AI routes need room for both plus the db work around them.
const AI_ROUTES = /^\/(assessment\/analyze|recommend\/|plan\/|coach\/)/;

const limitFor = (req) => {
  if (req.method === 'POST' && req.path === '/chat') return null; // long-lived SSE stream
  if (req.method === 'POST' && AI_ROUTES.test(req.path)) return env.GEMINI_TIMEOUT_MS * 2 + 10_000;
  return env.REQUEST_TIMEOUT_MS;
};

// Stops a request from hanging forever (e.g. the database stops answering).
// The handler keeps running in the background, but whatever it sends later is dropped -
// the error handler just closes the connection once headers are out.
export function requestTimeout(req, res, next) {
  const ms = limitFor(req);
  if (!ms) return next();

  const timer = setTimeout(() => {
    if (res.headersSent) return;
    req.timedOut = true;
    // can't call next() a second time, so answer through the error handler directly
    errorHandler(new AppError(500, 'REQUEST_TIMEOUT', 'ระบบใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'), req, res, () => {});
  }, ms);

  const clear = () => clearTimeout(timer);
  res.on('finish', clear);
  res.on('close', clear);
  next();
}
