// TH / EN for what the backend writes itself. Thai stays the default everywhere.
// The frontend sends X-Lang: en (or Accept-Language: en-...) when the app is in English.

export function detectLang(req) {
  const x = req.get('x-lang')?.trim().toLowerCase();
  if (x === 'en' || x === 'th') return x;
  return /^en\b/i.test(req.get('accept-language') ?? '') ? 'en' : 'th';
}

// error code -> English message. Codes not listed keep their Thai message.
const ERRORS_EN = {
  VALIDATION_ERROR: 'Some of the data sent is invalid. See details for each field.',
  INVALID_JSON: 'The JSON body is malformed.',
  PAYLOAD_TOO_LARGE: 'The request body is too large.',
  NOT_FOUND: 'Not found.',
  UNAUTHORIZED: 'Please log in first.',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  INVALID_REFRESH_TOKEN: 'Your session has expired. Please log in again.',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  EMAIL_NOT_CONFIRMED: 'Please confirm your email before logging in.',
  EMAIL_TAKEN: 'This email is already registered.',
  REGISTER_FAILED: 'Could not sign up with these details.',
  WEAK_PASSWORD: 'This password is too easy to guess. Try a stronger one.',
  WRONG_PASSWORD: 'The password is incorrect.',
  CAPTCHA_FAILED: 'CAPTCHA check failed. Please try again.',
  INVALID_RESET_TOKEN: 'This reset link has expired or was already used. Please request a new one.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  AUTH_UNAVAILABLE: 'Sign-in is temporarily unavailable. Please try again.',
  AI_DAILY_LIMIT: 'The AI has reached its daily limit. Please come back tomorrow.',
  AI_QUOTA_EXCEEDED: 'The AI is busy right now. Please try again later.',
  AI_TIMEOUT: 'The AI took too long to answer. Please try again.',
  AI_ERROR: 'The AI is temporarily unavailable. Please try again.',
  AI_INVALID_RESPONSE: 'The AI gave an unusable answer. Please try again.',
  INCOMPLETE_ANSWERS: 'Please answer every question first.',
  PROFILE_NOT_FOUND: 'Profile not found. Please save your profile first.',
  DATABASE_ERROR: 'A database error occurred. Please try again.',
  AUTH_ERROR: 'The sign-in service had a problem. Please try again.',
  CONFIG_ERROR: 'The server is not fully configured. Please contact the admin.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  ACCOUNT_DELETE_FAILED: 'Could not delete the account. Please try again.',
  CONFIRM_REQUIRED: 'Type DELETE in the confirm field to delete your account.',
  SHARE_LIMIT: 'You have too many active share links. Revoke an old one first.',
  SHARE_NOT_FOUND: 'This link has expired or was revoked.',
  QR_UNAVAILABLE: 'QR codes are not available on this server.',
  ITEM_TITLE_REQUIRED: 'This task is new, so a title is required.',
  INVALID_IMAGE: 'Only PNG, JPG or WEBP images are supported.',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  DEMO_DISABLED: 'Demo accounts are turned off.',
  DEMO_DAILY_LIMIT: 'Demo accounts for today have run out. Please sign up instead.',
  DEMO_FAILED: 'Could not create a demo account. Please try again.',
};

export const errorMessage = (lang, code, thai) => (lang === 'en' && ERRORS_EN[code]) || thai;

// texts the backend puts into normal responses
const TEXT = {
  zone_rule: {
    th: 'safe = สูงกว่าคะแนนต่ำสุดของทุกปีที่มีข้อมูลอย่างน้อย 3 คะแนน, target = ไม่ต่ำกว่าคะแนนต่ำสุดปีล่าสุดเกิน 2 คะแนน, reach = ต่ำกว่านั้น (เกณฑ์นี้เป็นค่าประมาณจากสถิติย้อนหลัง ไม่ใช่โอกาสติดจริง และสัดส่วนคะแนนแต่ละปีอาจต่างกัน)',
    en: "safe = at least 3 points above every past year's minimum, target = no more than 2 points below last year's minimum, reach = lower than that (an estimate from past statistics, not a real admission chance; weights can change between years)",
  },
  cutoff_verify: {
    th: 'คะแนนต่ำสุดย้อนหลังมาจากประกาศทางการของ ทปอ. ที่ mytcas.com/stat สัดส่วนคะแนนปีนี้อาจต่างจากปีก่อน กรุณาตรวจสอบประกาศล่าสุดเสมอ',
    en: "Past minimum scores come from the official TCAS statistics at mytcas.com/stat. This year's weights may differ, always check the latest announcement.",
  },
  docs_note: {
    th: 'รายการเอกสารสรุปจากเกณฑ์ที่ประกาศใน mytcas.com แต่ละรายการมี evidence คือข้อความต้นฉบับ กรุณาตรวจสอบประกาศของมหาวิทยาลัยก่อนยื่นจริง',
    en: "Documents are summarised from the criteria published on mytcas.com; each one has the original line as evidence. Check the university's announcement before applying.",
  },
  group_ranking: {
    th: 'เรียงตามจำนวนผู้สมัครรอบ 3 ปีล่าสุดจากสถิติทางการ (mytcas.com/stat)',
    en: 'Sorted by last year’s round 3 applicants from the official statistics (mytcas.com/stat)',
  },
  // AI fallback banners (services/aiFallback.js)
  ai_fallback_previous: {
    th: 'ตอนนี้ระบบ AI ใช้งานไม่ได้ชั่วคราว จึงแสดงผลล่าสุดที่คุณเคยได้ไว้ ลองกดสร้างใหม่อีกครั้งภายหลัง',
    en: 'The AI is unavailable right now, so this is your most recent result. Try generating a new one later.',
  },
  ai_fallback_sample: {
    th: 'ตอนนี้ระบบ AI ใช้งานไม่ได้ชั่วคราว นี่เป็นตัวอย่างผลลัพธ์ ไม่ได้วิเคราะห์จากข้อมูลของคุณ ลองใหม่อีกครั้งภายหลัง',
    en: 'The AI is unavailable right now. This is a SAMPLE result, not based on your data. Please try again later.',
  },
  // eligibility reasons
  closed: { th: 'ปิดรับสมัครไปแล้วเมื่อ {date}', en: 'Applications closed on {date}' },
  gpax_missing: { th: 'ต้องมี GPAX อย่างน้อย {min} (ยังไม่ได้กรอก GPAX ในโปรไฟล์)', en: 'Requires GPAX of at least {min} (no GPAX in your profile yet)' },
  gpax_low: { th: 'GPAX {gpax} ต่ำกว่าเกณฑ์ขั้นต่ำ {min}', en: 'GPAX {gpax} is below the minimum of {min}' },
  missing_scores: { th: 'ยังไม่มีคะแนน: {subjects}', en: 'No score yet for: {subjects}' },
  extra_requirements: { th: 'มีคุณสมบัติเพิ่มเติม ดูรายละเอียดในประกาศของโครงการ', en: 'There are extra requirements, see the project announcement' },
  missing_subject: { th: 'ยังไม่มีคะแนนวิชานี้ในระบบ', en: 'No score for this subject yet' },
  not_precomputable: { th: 'คะแนนส่วนนี้ (แฟ้มผลงาน/สัมภาษณ์) คำนวณล่วงหน้าไม่ได้', en: 'Portfolio / interview scores cannot be calculated in advance' },
};

export function t(lang, key, params = {}) {
  const entry = TEXT[key];
  if (!entry) return key;
  const s = entry[lang] ?? entry.th;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

// appended to every AI prompt when the app is in English
export const AI_LANGUAGE_RULE = {
  th: '',
  en: '\n\nIMPORTANT: The student is using the app in English. Write every text value of your answer in natural English. Keep official Thai names of universities, faculties, programs and exams as they are, adding an English translation in parentheses when helpful.',
};
