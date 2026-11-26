import { AppError } from '../utils/AppError.js';
import { log } from '../utils/log.js';
import { reportError } from '../config/sentry.js';
import { errorMessage } from '../utils/i18n.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'ไม่พบ endpoint ที่เรียก'));
}

// the one error handler for the whole app
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'รูปแบบ JSON ที่ส่งมาไม่ถูกต้อง';
  } else if (err?.type === 'entity.too.large') {
    status = 400;
    code = 'PAYLOAD_TOO_LARGE';
    // limit is 1MB for JSON, 2MB for the avatar upload
    message = `ข้อมูลที่ส่งมามีขนาดใหญ่เกิน ${Math.round((err.limit ?? 1048576) / 1048576)}MB`;
  }

  // e.g. SSE already started, or the handler finished after a timeout - too late for JSON
  if (res.headersSent) {
    if (!req.timedOut) log.error(`[error] ${req.method} ${req.path} after headers sent ->`, err?.message ?? err);
    return res.end();
  }

  // only our own failures, and never the body/headers (tokens, personal data)
  if (status >= 500) {
    log.error(`[error] ${req.method} ${req.path} ->`, err?.code ?? '', err?.message ?? err);
    reportError(err, req);
  }

  res.status(status).json({
    success: false,
    // request_id lets a user quote the exact request when they report a problem
    error: { code, message: errorMessage(req.lang, code, message), request_id: req.id, ...(details && { details }) },
  });
}
