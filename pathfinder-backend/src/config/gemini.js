import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';

let client;

// the only place that builds a Gemini client
export function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(500, 'CONFIG_ERROR', 'ระบบ AI ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแล');
  }
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

export const geminiModel = env.GEMINI_MODEL;
export const geminiTimeoutMs = env.GEMINI_TIMEOUT_MS;
