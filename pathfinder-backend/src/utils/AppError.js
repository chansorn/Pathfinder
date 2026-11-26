import { log } from './log.js';

// Errors we throw on purpose. The error handler sends status/code/message straight to the client,
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

export const badRequest = (message, code = 'VALIDATION_ERROR', details) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'กรุณาเข้าสู่ระบบก่อนใช้งาน', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const notFound = (message = 'ไม่พบข้อมูลที่ต้องการ', code = 'NOT_FOUND') =>
  new AppError(404, code, message);

// log the real db error server side, give the client something generic
export function dbError(error, context) {
  log.error(`[db] ${context}:`, error?.code ?? '', error?.message ?? error);
  return new AppError(500, 'DATABASE_ERROR', 'ระบบฐานข้อมูลมีปัญหา กรุณาลองใหม่อีกครั้ง');
}
