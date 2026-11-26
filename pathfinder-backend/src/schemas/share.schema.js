import { z } from 'zod';
import { SHARE_KINDS } from '../services/share.service.js';

export const createShareBody = z.strictObject({
  kind: z.enum(SHARE_KINDS, { error: `kind ต้องเป็นหนึ่งใน ${SHARE_KINDS.join(', ')}` }),
  id: z.uuid('รหัสผลลัพธ์ไม่ถูกต้อง'),
});

export const tokenParam = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{22}$/, 'ลิงก์ไม่ถูกต้อง'),
});
