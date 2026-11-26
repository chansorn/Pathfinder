import { z } from 'zod';

// trimmed, non-empty string with Thai error messages
export const text = (max, label = 'ข้อความ') =>
  z
    .string({ error: `${label}ต้องเป็นข้อความ` })
    .trim()
    .min(1, `กรุณากรอก${label}`)
    .max(max, `${label}ยาวได้ไม่เกิน ${max} ตัวอักษร`);

export const id = z.coerce.number({ error: 'ต้องเป็นตัวเลข' }).int().positive('ต้องเป็นเลขจำนวนเต็มบวก');

export const uuidParam = z.object({
  id: z.uuid('รหัสอ้างอิงไม่ถูกต้อง'),
});

// body can be missing or {}, but no extra fields
export const emptyBody = z.strictObject({}).default({});
