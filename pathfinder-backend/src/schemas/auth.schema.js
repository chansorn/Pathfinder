import { z } from 'zod';
import { text, id } from './common.schema.js';

const email = z.email('รูปแบบอีเมลไม่ถูกต้อง').max(254).transform((v) => v.toLowerCase());

const newPassword = (label = 'รหัสผ่าน') =>
  z
    .string({ error: `กรุณากรอก${label}` })
    .min(8, `${label}ต้องยาวอย่างน้อย 8 ตัวอักษร`)
    .max(72, `${label}ยาวได้ไม่เกิน 72 ตัวอักษร`);

const currentPassword = z.string({ error: 'กรุณากรอกรหัสผ่าน' }).min(1, 'กรุณากรอกรหัสผ่าน').max(72);

// only needed once CAPTCHA is turned on in Supabase (Authentication > Attack Protection)
const captchaToken = z.string().min(1).max(4000).optional();

export const registerBody = z.object({
  email,
  password: newPassword(),
  display_name: text(100, 'ชื่อที่แสดง'),
  school_id: id.nullish(),
  grade_level_id: id.nullish(),
  accept_terms: z.literal(true, { error: 'กรุณายอมรับข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว' }),
  captcha_token: captchaToken,
});

export const loginBody = z.object({
  email,
  password: currentPassword,
  captcha_token: captchaToken,
});

export const refreshBody = z.object({
  refresh_token: z.string({ error: 'ไม่พบ refresh_token' }).min(1, 'ไม่พบ refresh_token').max(2000),
});

export const forgotPasswordBody = z.object({
  email,
  captcha_token: captchaToken,
});

export const resetPasswordBody = z.object({
  // from the email link: ?token_hash=...&type=recovery
  token_hash: z.string({ error: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง' }).min(1, 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง').max(2000),
  password: newPassword('รหัสผ่านใหม่'),
});

export const changePasswordBody = z
  .object({
    current_password: currentPassword,
    new_password: newPassword('รหัสผ่านใหม่'),
    captcha_token: captchaToken,
  })
  .refine((o) => o.current_password !== o.new_password, {
    message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
    path: ['new_password'],
  });

// password for normal accounts. google / demo accounts have none, they type "DELETE" instead
export const deleteAccountBody = z.object({
  password: currentPassword.optional(),
  confirm: z.literal('DELETE', { error: 'พิมพ์ DELETE เพื่อยืนยันการลบบัญชี' }).optional(),
  captcha_token: captchaToken,
});
 