# PathFinder API

Base URL: `http://localhost:4000/api` (ตอน deploy เปลี่ยนเป็นโดเมนของ backend)

## หลักการทั่วไป

### รูปแบบ response

สำเร็จ

```json
{ "success": true, "data": { } }
```

ผิดพลาด (`message` เป็นภาษาไทย แสดงให้ผู้ใช้ดูได้เลย)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลไม่ถูกต้อง: email - รูปแบบอีเมลไม่ถูกต้อง",
    "request_id": "5efd58e6-13be-4611-86e2-10e6229a4dba",
    "details": [{ "field": "email", "message": "รูปแบบอีเมลไม่ถูกต้อง" }]
  }
}
```

`details` มีเฉพาะ `VALIDATION_ERROR` จาก body/query ที่ผิดรูปแบบ

### Request ID

ทุก response มี header `X-Request-Id` และ error จะมี `request_id` ใน body ด้วย
ควรแสดง `request_id` ในหน้า error ให้ผู้ใช้แจ้งมาได้ แล้วค้นใน log ของ server จะเจอทุกบรรทัดของ request นั้น (log ขึ้นต้นด้วย `[request_id]`)
frontend ส่ง header `X-Request-Id` มาเองก็ได้ (ตัวอักษร/ตัวเลข/`-`/`_` ยาว 8-64 ตัว) ระบบจะใช้ค่านั้นแทน

### Timeout

request ทั่วไปถูกตัดที่ 15 วินาที endpoint AI ประมาณ 70 วินาที `/chat` ไม่มี timeout (เป็น stream)
เกินแล้วได้ 500 `REQUEST_TIMEOUT`

| status | ใช้เมื่อ | code ที่เป็นไปได้ |
| --- | --- | --- |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง | `VALIDATION_ERROR`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `EMAIL_TAKEN`, `WEAK_PASSWORD`, `REGISTER_FAILED`, `INCOMPLETE_ANSWERS`, `CAPTCHA_FAILED`, `WRONG_PASSWORD`, `INVALID_RESET_TOKEN` |
| 401 | ไม่ได้ login / token หมดอายุ | `UNAUTHORIZED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `INVALID_REFRESH_TOKEN` |
| 404 | ไม่พบข้อมูล / endpoint | `NOT_FOUND`, `PROFILE_NOT_FOUND` |
| 429 | เรียกถี่เกิน | `RATE_LIMITED`, `AI_QUOTA_EXCEEDED`, `AI_DAILY_LIMIT` |
| 503 | ระบบยืนยันตัวตน (Supabase) ขัดข้องชั่วคราว | `AUTH_UNAVAILABLE` |
| 500 | ระบบขัดข้อง | `INTERNAL_ERROR`, `DATABASE_ERROR`, `AUTH_ERROR`, `CONFIG_ERROR`, `AI_ERROR`, `AI_TIMEOUT`, `AI_INVALID_RESPONSE`, `ACCOUNT_DELETE_FAILED`, `REQUEST_TIMEOUT` |

> `WRONG_PASSWORD` (รหัสผ่านปัจจุบันผิดตอนเปลี่ยนรหัส/ลบบัญชี) ตั้งใจให้เป็น 400 ไม่ใช่ 401 อย่าให้ frontend เด้งไปหน้า login
>
> ทุก endpoint ที่ต้อง login อาจได้ 429 `RATE_LIMITED` หรือ 503 `AUTH_UNAVAILABLE` ตอน Supabase ยุ่ง/ล่ม: token ยังใช้ได้ ให้รอแล้วลองใหม่ **อย่า** logout

### การยืนยันตัวตน

endpoint ที่ระบุว่า 🔒 ต้องส่ง header

```text
Authorization: Bearer <access_token>
```

`access_token` ได้จาก `/auth/login` หรือ `/auth/register` อายุประมาณ 1 ชั่วโมง (ตามที่ตั้งใน Supabase)
หมดอายุแล้วจะได้ 401 `INVALID_TOKEN` ให้เรียก `/auth/refresh` ด้วย `refresh_token` เพื่อขอ token ใหม่

### Rate limit

ค่าเริ่มต้น (ปรับได้ใน `.env`)

- ทุก endpoint (ยกเว้น `/health`): 100 ครั้ง / 15 นาที / IP
- `/auth/register`: 5 ครั้ง / ชั่วโมง / IP
- endpoint ที่ตรวจรหัสผ่านหรือส่งอีเมล (login, forgot/reset/change password, ลบบัญชี): 10 ครั้ง / 15 นาที / IP
- endpoint ที่เรียก AI (✨): 20 ครั้ง / ชั่วโมง / ผู้ใช้
- AI รวมทั้งระบบ: 1000 ครั้ง / วัน (นับตามเวลาไทย) เต็มแล้วได้ 429 `AI_DAILY_LIMIT` ถึงเที่ยงคืน
- เกินแล้วได้ 429 `RATE_LIMITED` ดูเวลาที่ต้องรอได้จาก header `RateLimit` / `Retry-After`

### CAPTCHA (ไม่บังคับ)

ถ้าเปิด CAPTCHA ใน Supabase (Authentication > Attack Protection) ให้ส่ง `captcha_token` ที่ได้จาก widget (hCaptcha / Cloudflare Turnstile) มาใน body ของ
`/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/change-password` และ `DELETE /account`
ถ้าไม่ได้เปิดก็ไม่ต้องส่ง token ไม่ผ่านจะได้ 400 `CAPTCHA_FAILED`

### ตัวอย่าง helper ฝั่ง frontend

ตัวอย่างทั้งหมดในไฟล์นี้ใช้ helper นี้

```js
const API_URL = 'http://localhost:4000/api';

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    // json.error.message เป็นภาษาไทย เอาไปแสดงได้เลย
    const err = new Error(json.error.message);
    err.code = json.error.code;
    err.status = res.status;
    throw err;
  }
  return json.data;
}
```

---

## ระบบ

### `GET /health`

```json
{ "status": "ok" }
```

(ไม่ใช้รูปแบบ `success/data` เอาไว้ให้ Render/Railway เช็ก)

### `GET /health/deep`

เช็กว่าแต่ละส่วนใช้งานได้จริงไหม เหมาะกับทีมงานเปิดดูวันงาน และให้ uptime monitor ยิงทุก 5 นาที ผลถูก cache 10 วินาที และไม่มีข้อมูลส่วนตัว

```json
{
  "status": "ok",
  "checked_at": "2026-11-25T03:00:00.000Z",
  "uptime_s": 5231,
  "db": { "ok": true, "ms": 180, "tcas_year": 2569 },
  "auth": { "ok": true, "mode": "local_jwks", "jwks_keys": 1, "jwks_loaded_at": "..." },
  "ai": { "ok": true, "mode": "gemini", "model": "gemini-3.5-flash", "configured": true,
          "last_call": { "ok": true, "at": "...", "code": null }, "daily_used": 412, "daily_limit": 3000, "fallback": true }
}
```

- `status`: `ok` | `degraded` (Gemini เรียกล่าสุดแล้วพัง ระบบจะตอบแบบสำรองแทน) | `down` (ต่อฐานข้อมูลไม่ได้ ได้ HTTP 503)
- `auth.mode`: `local_jwks` = ตรวจ token เองในเครื่อง (ปกติ), `local_secret` = ใช้ `SUPABASE_JWT_SECRET`, `supabase_fallback` = ถาม Supabase ทุก request (ช้ากว่า)
- ไม่เรียก Gemini จริง (เพราะมีค่าใช้จ่าย) แต่รายงานผลของการเรียกครั้งล่าสุด

---

## Auth (public)

### `POST /auth/register`

| field | type | |
| --- | --- | --- |
| `email` | string | จำเป็น |
| `password` | string | จำเป็น 8-72 ตัวอักษร |
| `display_name` | string | จำเป็น ไม่เกิน 100 ตัวอักษร |
| `school_id` | number \| null | ไม่บังคับ ต้องเป็น id ที่มีใน `/schools` |
| `grade_level_id` | number \| null | ไม่บังคับ ต้องเป็น id ที่มีใน `/grade-levels` |
| `accept_terms` | `true` | จำเป็น ผู้ใช้ต้องติ๊กยอมรับข้อตกลงและนโยบายความเป็นส่วนตัว (ระบบบันทึกเวอร์ชันและเวลาไว้) |
| `captcha_token` | string | ไม่บังคับ ดูหัวข้อ CAPTCHA |

```json
{
  "email": "student01@example.com",
  "password": "password123",
  "display_name": "น้องเอ",
  "school_id": 1,
  "grade_level_id": 2,
  "accept_terms": true
}
```

Response `201`

```json
{
  "success": true,
  "data": {
    "user": { "id": "6f1c...", "email": "student01@example.com", "display_name": "น้องเอ" },
    "session": {
      "access_token": "eyJ...",
      "refresh_token": "v1...",
      "expires_in": 3600,
      "expires_at": 1795000000,
      "token_type": "bearer"
    },
    "requires_email_confirmation": false
  }
}
```

ถ้าโปรเจกต์ Supabase เปิด Confirm email ไว้: `session` เป็น `null` และ `requires_email_confirmation` เป็น `true` ให้บอกผู้ใช้ไปยืนยันอีเมลก่อน

Error: 400 `EMAIL_TAKEN` อีเมลซ้ำ, 400 `VALIDATION_ERROR` โรงเรียน/ระดับชั้นไม่มีอยู่จริง

```js
const data = await api('/auth/register', { method: 'POST', body: form });
if (data.requires_email_confirmation) showMessage('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
else saveTokens(data.session);
```

### `POST /auth/login`

```json
{ "email": "student01@example.com", "password": "password123" }
```

Response `200`

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "v1...",
    "expires_in": 3600,
    "expires_at": 1795000000,
    "token_type": "bearer",
    "user": { "id": "6f1c...", "email": "student01@example.com", "display_name": "น้องเอ" }
  }
}
```

Error: 401 `INVALID_CREDENTIALS`, 401 `EMAIL_NOT_CONFIRMED`

```js
const { access_token, refresh_token, user } = await api('/auth/login', {
  method: 'POST',
  body: { email, password },
});
```

### `POST /auth/refresh`

```json
{ "refresh_token": "v1..." }
```

Response `200`: รูปแบบเดียวกับ login (refresh token เดิมใช้ซ้ำไม่ได้ ต้องเก็บตัวใหม่)

Error: 401 `INVALID_REFRESH_TOKEN` ให้พาไปหน้า login

```js
// เรียก api แล้วเจอ 401 -> refresh แล้วลองใหม่ 1 ครั้ง
async function apiWithRefresh(path, opts = {}) {
  try {
    return await api(path, { ...opts, token: getAccessToken() });
  } catch (err) {
    if (err.status !== 401) throw err;
    const s = await api('/auth/refresh', { method: 'POST', body: { refresh_token: getRefreshToken() } });
    saveTokens(s);
    return api(path, { ...opts, token: s.access_token });
  }
}
```

### `POST /auth/logout` 🔒

ไม่ต้องส่ง body เพิกถอน refresh token ของ session นี้ (access token เดิมจะหมดอายุเองตามเวลา ฝั่ง frontend ให้ลบทิ้งด้วย)

```json
{ "success": true, "data": { "message": "ออกจากระบบแล้ว" } }
```

### `POST /auth/forgot-password`

```json
{ "email": "student01@example.com" }
```

ตอบเหมือนกันเสมอ ไม่ว่าอีเมลนี้จะมีบัญชีหรือไม่ (กันคนเดาว่าใครสมัครไว้)

```json
{ "success": true, "data": { "message": "ถ้ามีบัญชีที่ใช้อีเมลนี้ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว ..." } }
```

Supabase จะส่งอีเมลที่มีลิงก์ไปหน้า `FRONTEND_URL/?token_hash=...&type=recovery` (เปลี่ยนได้ด้วย `PASSWORD_RESET_REDIRECT_URL`)
(ต้องตั้ง email template ก่อน ดู README หัวข้อ "รีเซ็ตรหัสผ่าน")

### `POST /auth/reset-password`

หน้า `/reset-password` ฝั่ง frontend อ่าน `token_hash` จาก URL แล้วส่งมาพร้อมรหัสใหม่

```json
{ "token_hash": "pkce_8f2c...", "password": "newpass123" }
```

Response `200` `{ "message": "ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่" }`
ทุก session เดิมของผู้ใช้จะถูกออกจากระบบ ลิงก์ใช้ได้ครั้งเดียว

Error: 400 `INVALID_RESET_TOKEN` ลิงก์หมดอายุ/ใช้ไปแล้ว ให้ผู้ใช้ขอลิงก์ใหม่

```js
// หน้า /reset-password
const tokenHash = new URLSearchParams(location.search).get('token_hash');
await api('/auth/reset-password', { method: 'POST', body: { token_hash: tokenHash, password } });
router.push('/login');
```

### `POST /auth/change-password` 🔒

```json
{ "current_password": "password123", "new_password": "brandnew123" }
```

Response `200` เครื่องที่ใช้อยู่ยัง login ต่อได้ อุปกรณ์อื่นถูกออกจากระบบ

Error: 400 `WRONG_PASSWORD`, 400 `VALIDATION_ERROR` (รหัสใหม่ซ้ำรหัสเดิม / สั้นเกิน)

### `GET /schools`

| query | |
| --- | --- |
| `q` | ไม่บังคับ ค้นจากชื่อโรงเรียน (ตรงบางส่วน ไม่สนตัวพิมพ์เล็ก/ใหญ่) |
| `province` | ไม่บังคับ กรองตามจังหวัด (ต้องตรงทั้งคำ) |
| `limit` | ไม่บังคับ 1-500 ค่าเริ่มต้น 100 |

เรียงตามชื่อ ถ้าไม่ส่ง `q` จะได้ `limit` รายการแรก ใช้ทำช่องค้นหาแบบพิมพ์แล้วขึ้นรายชื่อ (ควร debounce ~300ms)

```js
const schools = await api(`/schools?q=${encodeURIComponent(keyword)}&limit=20`);
```

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "โรงเรียนตัวอย่างวิทยา", "province": "กรุงเทพมหานคร" }
  ]
}
```

### `GET /grade-levels`

```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "M4", "name": "มัธยมศึกษาปีที่ 4" },
    { "id": 2, "code": "M5", "name": "มัธยมศึกษาปีที่ 5" },
    { "id": 3, "code": "M6", "name": "มัธยมศึกษาปีที่ 6" }
  ]
}
```

---

## TCAS (public)

ข้อมูลจากฐานข้อมูล TCAS ของระบบ (นำเข้าด้วย `npm run tcas:import` ดู README) ถ้าไม่ระบุ `year` จะใช้ปีล่าสุดที่มี
ถ้ายังไม่มีข้อมูลเลยจะได้ `{ "academic_year": null, "items": [] }`

### `GET /tcas/programs`

| query | |
| --- | --- |
| `q` | ไม่บังคับ ค้นจากชื่อคณะหรือสาขา ("คณะ" ข้างหน้าถูกตัดออกอัตโนมัติ) |
| `university` | ไม่บังคับ ("มหาวิทยาลัย" / "ม." ข้างหน้าถูกตัดออก จึงพิมพ์ "ม.เกษตรศาสตร์" ก็เจอ) |
| `year` | ไม่บังคับ ปี พ.ศ. เช่น 2569 |
| `limit` | ไม่บังคับ 1-100 ค่าเริ่มต้น 20 |

```json
{
  "success": true,
  "data": {
    "academic_year": 2569,
    "items": [
      {
        "id": "b1c2...",
        "academic_year": 2569,
        "university": "มหาวิทยาลัยตัวอย่าง",
        "faculty": "วิศวกรรมศาสตร์",
        "program": "วิศวกรรมคอมพิวเตอร์",
        "campus": "",
        "url": "https://...",
        "tuition_note": "..."
      }
    ]
  }
}
```

### `GET /tcas/programs/:id`

หลักสูตรเดียวพร้อม `admissions` (เรียงตามรอบ)

```json
{
  "success": true,
  "data": {
    "id": "b1c2...",
    "university": "มหาวิทยาลัยตัวอย่าง",
    "program": "วิศวกรรมคอมพิวเตอร์",
    "admissions": [
      {
        "round": 3,
        "project_name": "Admission",
        "seats": 60,
        "min_gpax": null,
        "requirements": null,
        "score_weights": { "TGAT": 20, "TPAT3": 30 },
        "last_year_min_score": 62.5,
        "apply_start": null,
        "apply_end": null,
        "source_url": "https://...",
        "notes": null
      }
    ]
  }
}
```

`apply_end` = วันปิดรับสมัคร/ส่งแฟ้มผลงานของโครงการนั้น (มีในรอบ 1 เป็นหลัก myTCAS ไม่มีวันเปิดรับ จึงเป็น `null`)

### `GET /tcas/calendar`

| query | |
| --- | --- |
| `year` | ไม่บังคับ |
| `university` | ไม่บังคับ ส่งมาแล้วจะได้กำหนดการของมหาวิทยาลัยนั้นเพิ่มด้วย (รอบ 1/2/4 ซึ่งแต่ละมหาวิทยาลัยกำหนดเอง) ไม่ส่งจะได้แค่ปฏิทินกลางของ TCAS |

แต่ละรายการมี `university` (`null` = กำหนดการกลางของ ทปอ.)

```json
{
  "success": true,
  "data": {
    "academic_year": 2569,
    "items": [{ "round": 1, "event": "ยื่นใบสมัครรอบ 1", "start_date": "2026-02-01", "end_date": "2026-02-10", "source_url": "https://..." }]
  }
}
```

---

## วางแผนจากข้อมูลจริง 🔒 (ไม่เรียก AI ไม่นับโควตา AI)

ใช้คะแนนสอบในโปรไฟล์ (`/exam-scores`) และ GPAX มาคำนวณกับเกณฑ์ของแต่ละโครงการ
ชื่อวิชาที่กรอกจับคู่ได้หลายแบบ เช่น `TPAT3`, `TGAT รวม`, `TGAT1` / `การสื่อสารภาษาอังกฤษ`, A-Level `คณิต 1`, `ฟิสิกส์`
ถ้ากรอก TGAT1-3 ครบแต่ไม่มี TGAT รวม ระบบเฉลี่ยให้ / กรอกวิชาเดียวกันหลายครั้งใช้คะแนนที่ดีที่สุด

### `GET /tcas/programs/:id/check`

คะแนนของน้องและสิทธิ์สมัครในทุกโครงการของหลักสูตรนี้

```json
{
  "success": true,
  "data": {
    "program": { "id": "b1c2...", "university": "มหาวิทยาลัยเกษตรศาสตร์", "program": "วศ.บ. สาขาวิชาวิศวกรรมคอมพิวเตอร์ (ภาษาไทย ปกติ)" },
    "student": { "gpax": 3.45, "exam_scores": 4 },
    "summary": { "eligible": 3, "total": 9, "best_score": 76 },
    "admissions": [
      {
        "round": 3,
        "project_name": "Admission",
        "seats": 35,
        "min_gpax": null,
        "apply_end": null,
        "score": {
          "weighted_score": 76,
          "partial_score": 76,
          "max_possible": 76,
          "parts": [{ "subject": "TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์", "weight": 45, "your_percent": 80, "contributes": 36, "precomputable": true }],
          "missing": []
        },
        "last_year_min_score": null,
        "gap_to_last_year": null,
        "eligibility": { "status": "eligible", "reasons": [] }
      }
    ]
  }
}
```

- `weighted_score` = คะแนนรวมตามสัดส่วน (เต็ม 100) มีค่าเมื่อมีคะแนนครบทุกวิชา
- ยังขาดบางวิชา: `partial_score` = ได้แล้วเท่าไร, `max_possible` = ถ้าวิชาที่ขาดได้เต็มจะได้สูงสุดเท่าไร, `missing` บอกว่าขาดอะไร
- `eligibility.status`: `eligible` | `missing_scores` (ยังไม่มีคะแนนบางวิชา) | `check_requirements` (มีเงื่อนไขอื่น เช่น แฟ้มผลงาน ต้องอ่านประกาศ) | `closed` (ปิดรับแล้ว) | `not_eligible` (GPAX ไม่ถึง)
- `gap_to_last_year` = คะแนนน้อง - คะแนนต่ำสุดปีก่อน (เมื่อมีข้อมูล)

### `GET /tcas/compare?ids=id1,id2,id3`

เทียบ 2-4 หลักสูตร แต่ละหลักสูตรได้ข้อมูลแบบเดียวกับ `/check` + `summary`

### `GET /tcas/deadlines?days=30`

กำหนดการที่ใกล้ถึงใน `days` วัน (1-180) ของหลักสูตรเป้าหมายในโปรไฟล์ + หลักสูตรที่บันทึกไว้ + ปฏิทินกลางและของมหาวิทยาลัยเหล่านั้น เรียงตามวันที่

```json
{
  "success": true,
  "data": {
    "from": "2026-11-24",
    "to": "2026-12-24",
    "items": [
      { "date": "2026-12-01", "kind": "project_deadline", "title": "ปิดรับสมัคร Portfolio ...", "round": 1, "university": "...", "program": "...", "program_id": "...", "source_url": "..." },
      { "date": "2026-12-15", "kind": "calendar", "title": "รอบ 1/2 Portfolio รับสมัครออนไลน์", "round": 1, "university": "มหาวิทยาลัยมหิดล", "start_date": "2026-12-15", "end_date": "2027-01-15" }
    ]
  }
}
```

### หลักสูตรที่บันทึกไว้

- `GET /saved-programs` → `[{ "program_id", "note", "created_at", "program": { ... } }]` (`program` เป็น `null` ถ้าหลักสูตรถูกลบออกจากข้อมูล TCAS แล้ว)
- `POST /saved-programs` `{ "program_id": "...", "note": "สนใจ" }` → `201` (บันทึกซ้ำ = แก้ note)
- `DELETE /saved-programs/:programId`

---

## สถิติ (public)

### `GET /stats/overview`

สถิติภาพรวมแบบไม่ระบุตัวตน สำหรับขึ้นจอในงาน (แคช 5 นาที) กลุ่มที่มีคนน้อยกว่า `min_group_size` จะไม่แสดง (นับรวมใน `others_hidden`)

```json
{
  "success": true,
  "data": {
    "generated_at": "2026-11-24T10:00:00Z",
    "min_group_size": 3,
    "users": 152,
    "grade_levels": { "items": [{ "name": "มัธยมศึกษาปีที่ 6", "count": 88 }], "others_hidden": 0 },
    "top_target_faculties": { "items": [{ "name": "วิศวกรรมคอมพิวเตอร์", "count": 31 }], "others_hidden": 12 },
    "top_saved_programs": { "items": [{ "id": "...", "university": "...", "program": "...", "count": 9 }], "others_hidden": 40 },
    "ai_usage": { "assessments": 120, "faculty_recommendations": 98, "career_recommendations": 40, "portfolio_ideas": 35, "skill_plans": 20, "tcas_plans": 77, "chat_messages": 640 }
  }
}
```

---

## Profile 🔒

### `GET /profile`

```json
{
  "success": true,
  "data": {
    "id": "6f1c...",
    "display_name": "น้องเอ",
    "school_id": 1,
    "grade_level_id": 2,
    "gpax": 3.45,
    "subject_grades": { "คณิตศาสตร์": 4, "ฟิสิกส์": 3.5 },
    "interests": ["เทคโนโลยี", "หุ่นยนต์"],
    "skills": ["Python"],
    "activities": [{ "name": "ค่ายคอมพิวเตอร์", "role": "ผู้เข้าร่วม", "year": 2568 }],
    "awards": [{ "name": "เหรียญทองแดงโครงงาน", "level": "จังหวัด" }],
    "target_faculties": [{ "faculty": "วิศวกรรมคอมพิวเตอร์", "university": "มหาวิทยาลัยเกษตรศาสตร์" }],
    "created_at": "2026-11-23T10:00:00Z",
    "updated_at": "2026-11-23T10:05:00Z"
  }
}
```

### `PUT /profile`

ส่งเฉพาะ field ที่จะแก้ (อย่างน้อย 1 field) field ที่ไม่รู้จักจะได้ 400

| field | type | เงื่อนไข |
| --- | --- | --- |
| `display_name` | string | 1-100 ตัวอักษร |
| `school_id` / `grade_level_id` | number \| null | ต้องมีอยู่จริง |
| `gpax` | number \| null | 0-4 |
| `subject_grades` | object `{ วิชา: เกรด }` | เกรด 0-4 ไม่เกิน 40 วิชา |
| `interests` / `skills` | string[] | ไม่เกิน 30 รายการ |
| `activities` | `{ name, role?, year?, description? }[]` | ไม่เกิน 50 |
| `awards` | `{ name, level?, year? }[]` | ไม่เกิน 50 |
| `target_faculties` | `{ faculty, university? }[]` | ไม่เกิน 10 |

```js
const profile = await api('/profile', {
  method: 'PUT',
  token,
  body: { gpax: 3.45, interests: ['เทคโนโลยี', 'หุ่นยนต์'] },
});
```

Response `200`: profile ทั้งก้อนหลังแก้

### `GET /exam-scores`

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2...",
      "user_id": "6f1c...",
      "exam_type": "TPAT",
      "subject": "TPAT3",
      "score": 62.5,
      "max_score": 100,
      "taken_at": "2026-10-01",
      "created_at": "2026-11-23T10:00:00Z"
    }
  ]
}
```

### `POST /exam-scores`

```json
{ "exam_type": "TPAT", "subject": "TPAT3", "score": 62.5, "max_score": 100, "taken_at": "2026-10-01" }
```

- `exam_type`: `TGAT` | `TPAT` | `A-Level` | `อื่นๆ`
- `score` ต้องไม่เกิน `max_score`
- `taken_at` (ไม่บังคับ) รูปแบบ `YYYY-MM-DD`

Response `201`: แถวที่สร้าง

### `DELETE /exam-scores/:id`

Response `200` `{ "success": true, "data": { "id": "a1b2..." } }` · ไม่พบได้ 404

---

## AI Features 🔒

endpoint ที่มี ✨ เรียก AI (นับ rate limit 20 ครั้ง/ชั่วโมง) อาจใช้เวลาหลายวินาที ควรแสดง loading
AI จะใช้ข้อมูลจากโปรไฟล์ คะแนนสอบ และผลแบบทดสอบล่าสุด ยิ่งกรอกครบยิ่งแม่น

ทุกผลลัพธ์ถูกบันทึกไว้ ดูย้อนหลังได้ที่ `/history`

**ข้อมูล TCAS:** แนะนำคณะ, พอร์ต, แผน TCAS และแชท ใช้ข้อมูลจากฐานข้อมูล TCAS ของหลักสูตรเป้าหมาย (จาก `target_faculties` ในโปรไฟล์ หรือ body ของ `/plan/tcas`)
ผลลัพธ์ของ 3 อย่างแรกมี field เพิ่ม

- `tcas_data`: `{ "academic_year": 2569, "programs_found": 1 }` หรือ `null` ถ้าระบบยังไม่มีข้อมูล TCAS เลย
- `web_sources`: `[{ "title", "url" }]` หน้าเว็บที่ AI ค้นมาใช้ (แผน TCAS จะค้นเว็บเมื่อฐานข้อมูลไม่มีหลักสูตรนั้น) ควรแสดงเป็นลิงก์ "แหล่งที่มา"

**แคชผลลัพธ์:** ถ้าข้อมูลที่ใช้ถามไม่เปลี่ยน (โปรไฟล์ คะแนนสอบ ผลแบบทดสอบ และ body) ภายใน 7 วัน ระบบจะส่งผลเดิมกลับทันทีโดยไม่เรียก AI

- ผลจากแคชได้ status `200` และ `"cached": true` / ผลใหม่ได้ `201` และ `"cached": false`
- ผลจากแคชไม่นับ rate limit AI
- อยากได้คำตอบใหม่ (เช่นปุ่ม "ขอคำแนะนำใหม่") ให้ส่ง `"force": true` ใน body ได้ทุก endpoint ✨ ยกเว้น `/chat`

**คำตอบสำรอง (`fallback`):** ถ้า Gemini ล่ม ช้าเกิน หรือโควตาหมด หรือโควตา AI ของวันนี้ (`AI_DAILY_LIMIT`) หมดแล้ว endpoint ✨ (ยกเว้น `/chat`) จะไม่ตอบ error แต่จะส่งผลสำรองกลับมาด้วย status `200` และ `"cached": true` พร้อม field

```json
"fallback": { "kind": "previous", "reason": "AI_TIMEOUT", "note": "ตอนนี้ระบบ AI ใช้งานไม่ได้ชั่วคราว จึงแสดงผลล่าสุดที่คุณเคยได้ไว้ ..." }
```

- `kind: "previous"` คือผลล่าสุดของนักเรียนคนนั้นในฟีเจอร์เดียวกัน (แผน TCAS ต้องเป็นคณะและมหาวิทยาลัยเดียวกัน) ส่วน `kind: "sample"` คือ**ผลตัวอย่าง** ที่ไม่ได้วิเคราะห์จากข้อมูลของเขา จะได้ `id: null` และไม่ถูกบันทึก (แบบทดสอบจะได้ `scores` จริง แต่คำอธิบายเป็นตัวอย่าง)
- `reason` เป็นหนึ่งใน `AI_ERROR`, `AI_TIMEOUT`, `AI_QUOTA_EXCEEDED`, `AI_INVALID_RESPONSE`, `AI_DAILY_LIMIT`
- เมื่อมี `fallback` ให้ frontend **แสดงแบนเนอร์ `fallback.note` เสมอ** โดยเฉพาะ `sample` ห้ามแสดงเหมือนเป็นผลวิเคราะห์จริง และควรมีปุ่มให้ลองใหม่ (`"force": true`)
- `/chat` ไม่มีคำตอบสำรอง ถ้าโควตาของวันหมดจะได้ 429 `AI_DAILY_LIMIT` เหมือนเดิม
- ถ้าอยากได้ error แบบเดิม ให้ตั้ง `AI_FALLBACK=false`

> ผลที่มีเรื่องเกณฑ์/ปฏิทินจะมี field `verify_note` ให้แสดงให้ผู้ใช้เห็นทุกครั้ง
> AI ถูกสั่งไม่ให้แต่งวันสอบ วันรับสมัคร คะแนนต่ำสุด หรือสัดส่วนคะแนน

### `GET /assessment/questions`

ไม่เรียก AI

```json
{
  "success": true,
  "data": {
    "scale": [
      { "value": 1, "label": "ไม่ตรงเลย" },
      { "value": 2, "label": "ไม่ค่อยตรง" },
      { "value": 3, "label": "เฉยๆ" },
      { "value": 4, "label": "ค่อนข้างตรง" },
      { "value": 5, "label": "ตรงมาก" }
    ],
    "dimensions": { "riasec": { "R": "Realistic - นักปฏิบัติ ชอบลงมือทำ" }, "aptitude": {}, "learning_style": {} },
    "total": 30,
    "questions": [
      { "id": "R1", "group": "riasec", "text": "ชอบซ่อม ประกอบ หรือแกะของดูว่าข้างในทำงานยังไง" }
    ]
  }
}
```

### `POST /assessment/analyze` ✨

ต้องตอบครบทุกข้อ (`total` ข้อ) ไม่งั้นได้ 400 `INCOMPLETE_ANSWERS`

```json
{
  "answers": [
    { "question_id": "R1", "value": 3 },
    { "question_id": "I1", "value": 5 }
  ]
}
```

Response `201`

```json
{
  "success": true,
  "data": {
    "id": "c3d4...",
    "created_at": "2026-11-23T10:00:00Z",
    "result": {
      "summary": "น้องเป็นคนช่างสงสัย ชอบคิดวิเคราะห์...",
      "riasec_code": "IAR",
      "top_types": [{ "type": "I", "name_th": "นักคิดวิเคราะห์", "description": "..." }],
      "personality_traits": ["ช่างสังเกต", "มีเหตุผล"],
      "strengths": ["คิดเป็นระบบ"],
      "areas_to_develop": ["ฝึกนำเสนองาน"],
      "learning_style": { "primary": "เรียนรู้ผ่านการลงมือทำ", "description": "...", "study_tips": ["ทำ mind map"] },
      "suggested_fields": ["วิศวกรรมศาสตร์", "วิทยาการคอมพิวเตอร์"],
      "encouragement": "สู้ๆ นะ!",
      "scores": {
        "riasec": { "R": 50, "I": 92, "A": 58, "S": 58, "E": 25, "C": 67 },
        "aptitude": { "linguistic": 50, "logical": 88, "spatial": 63, "interpersonal": 50 },
        "learning_style": { "visual": 75, "auditory": 25, "reading_writing": 50, "kinesthetic": 100 }
      }
    }
  }
}
```

`scores` (0-100) คำนวณจากคำตอบโดยตรง เอาไปทำกราฟเรดาร์ได้

### `POST /recommend/faculties` ✨

ไม่ต้องส่ง body (หรือ `{ "force": true }`) · ทุก response ของ endpoint ✨ มี field `cached` ด้วย

Response `201`

```json
{
  "success": true,
  "data": {
    "id": "e5f6...",
    "type": "faculty",
    "created_at": "2026-11-23T10:00:00Z",
    "result": {
      "recommendations": [
        {
          "rank": 1,
          "faculty": "วิศวกรรมศาสตร์ สาขาวิศวกรรมคอมพิวเตอร์",
          "university_examples": ["จุฬาลงกรณ์มหาวิทยาลัย", "มหาวิทยาลัยเกษตรศาสตร์"],
          "match_score": 88,
          "reasons": ["ผลแบบทดสอบเด่นด้านคิดวิเคราะห์"],
          "related_careers": ["Software Engineer"],
          "key_subjects": ["คณิตศาสตร์", "ฟิสิกส์"],
          "gap_to_close": ["ฝึกโจทย์ TPAT3 ให้คล่อง"]
        }
      ],
      "verify_note": "ข้อมูลวันสอบ ... เช็กล่าสุดจาก mytcas.com และเว็บไซต์ของมหาวิทยาลัย"
    }
  }
}
```

`recommendations` มี 5-8 อันดับ

### `POST /recommend/careers` ✨

```json
{ "faculty": "วิศวกรรมคอมพิวเตอร์" }
```

`faculty` ไม่บังคับ ไม่ส่งจะแนะนำจากภาพรวมของน้อง

Response `201`: `data.type = "career"`, `data.result`

```json
{
  "careers": [
    {
      "career": "Software Engineer",
      "description": "ออกแบบและพัฒนาซอฟต์แวร์",
      "future_trend": "ยังเป็นที่ต้องการสูง...",
      "salary_range_note": "เริ่มต้นอยู่ในระดับดี... ขึ้นกับบริษัทและประสบการณ์",
      "required_skills": ["การเขียนโปรแกรม"],
      "match_score": 87
    }
  ],
  "verify_note": "...",
  "faculty": "วิศวกรรมคอมพิวเตอร์"
}
```

### `POST /plan/tcas` ✨

```json
{ "target_faculty": "วิศวกรรมคอมพิวเตอร์", "target_university": "มหาวิทยาลัยเกษตรศาสตร์" }
```

Response `201`

```json
{
  "success": true,
  "data": {
    "id": "g7h8...",
    "created_at": "2026-11-23T10:00:00Z",
    "target": { "faculty": "วิศวกรรมคอมพิวเตอร์", "university": "มหาวิทยาลัยเกษตรศาสตร์" },
    "plan": {
      "overview": "...",
      "rounds": [
        {
          "round": 1,
          "name": "รอบ 1 Portfolio",
          "suitability": "สูง",
          "strategy": "...",
          "requirements": ["แฟ้มสะสมผลงาน"],
          "tips": ["..."]
        }
      ],
      "timeline": [{ "period": "ช่วงปิดเทอม", "focus": "เก็บผลงาน", "tasks": ["เข้าค่าย"] }],
      "score_targets": [
        { "exam": "TPAT", "subject": "TPAT3", "target_score": 65, "max_score": 100, "priority": "สูง", "reason": "..." }
      ],
      "specific_subjects": [{ "subject": "...", "note": "..." }],
      "checklist": [{ "item": "สมัครสอบ TGAT/TPAT", "category": "สอบ" }],
      "verify_note": "..."
    }
  }
}
```

- `rounds` มีครบ 4 รอบเรียง 1-4 · `suitability`: `สูง` | `กลาง` | `ต่ำ`
- `target_score` คือเป้าหมายส่วนตัวที่แนะนำ ไม่ใช่คะแนนต่ำสุดของคณะ
- `checklist[].category`: `เอกสาร` | `สอบ` | `พอร์ต` | `ทักษะ` | `อื่นๆ`

### `POST /recommend/portfolio` ✨

ไม่ต้องส่ง body · Response `201`: `data.type = "portfolio"`, `data.result`

```json
{
  "student_level_note": "น้องมีพื้นฐานดีอยู่แล้ว...",
  "ideas": [
    {
      "title": "แอปช่วยจัดตารางอ่านหนังสือ",
      "description": "...",
      "difficulty": "ปานกลาง",
      "duration": "4-6 สัปดาห์",
      "skills_gained": ["การเขียนโปรแกรม"],
      "how_to_start": ["เรียน HTML/CSS/JS พื้นฐาน"]
    }
  ],
  "portfolio_tips": ["เลือกผลงานที่เกี่ยวกับคณะ"]
}
```

`difficulty`: `ง่าย` | `ปานกลาง` | `ยาก` · AI ปรับไอเดียตามระดับของน้อง (ดูจาก gpax/กิจกรรม/รางวัล)

### `POST /recommend/skills` ✨

ไม่ต้องส่ง body · Response `201`: `data.type = "skill"`, `data.result`

```json
{
  "skills": [
    {
      "skill": "การเขียนโปรแกรม Python",
      "category": "hard skill",
      "why_important": "...",
      "priority": 1,
      "resources": [{ "name": "CS50 (Harvard)", "type": "วิดีโอ", "cost": "ฟรี" }],
      "how_to_practice": ["ทำโจทย์วันละข้อ"],
      "estimated_time": "2-3 เดือน"
    }
  ],
  "learning_path": [{ "step": 1, "title": "วางพื้นฐาน", "skills": ["การเขียนโปรแกรม Python"], "duration": "1-2 เดือน" }]
}
```

### `POST /chat` ✨ (Server-Sent Events)

แชทกับ "พี่แนะแนว AI" ซึ่งรู้ข้อมูลโปรไฟล์และจำ 10 ข้อความล่าสุด

```json
{ "message": "อยากเข้าวิศวะคอม ต้องเตรียมอะไรบ้าง" }
```

ถ้า validate/auth ไม่ผ่านจะได้ JSON error ปกติ (status 400/401/429)
ถ้าผ่านจะได้ `200` และ `Content-Type: text/event-stream` แบ่งเป็น event:

```text
event: delta
data: {"text":"สวัสดีน้อง! พี่ดู"}

event: delta
data: {"text":"ข้อมูลของน้องแล้ว..."}

event: done
data: {"message_id":"i9j0...","content":"สวัสดีน้อง! พี่ดูข้อมูลของน้องแล้ว...","created_at":"2026-11-23T10:00:00Z","sources":[{"title":"mytcas.com","url":"https://..."}]}
```

ถ้า AI ขัดข้องกลางทาง:

```text
event: error
data: {"code":"AI_ERROR","message":"ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"}
```

ข้อความของผู้ใช้และคำตอบถูกบันทึกลง `chat_messages` อัตโนมัติ

**รับ SSE จาก frontend** (`EventSource` ส่ง POST/header ไม่ได้ ต้องใช้ `fetch` อ่าน stream เอง)

```js
export async function sendChat(message, token, { onDelta, onDone, onError, signal } = {}) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
    signal, // ส่ง AbortController.signal มาเพื่อกดหยุดได้
  });

  // error ก่อนเริ่ม stream เป็น JSON ปกติ
  if (!res.ok) {
    const json = await res.json();
    throw Object.assign(new Error(json.error.message), { code: json.error.code, status: res.status });
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // แต่ละ event คั่นด้วยบรรทัดว่าง
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = raw.match(/^event: (.*)$/m)?.[1];
      const data = JSON.parse(raw.match(/^data: (.*)$/m)?.[1] ?? 'null');
      if (event === 'delta') onDelta?.(data.text);
      else if (event === 'done') onDone?.(data);
      else if (event === 'error') onError?.(data);
    }
  }
}

// ใช้งาน (React)
let answer = '';
await sendChat('อยากเข้าวิศวะคอม ต้องเตรียมอะไรบ้าง', token, {
  onDelta: (text) => setAnswer((answer += text)),
  onDone: ({ message_id }) => console.log('บันทึกแล้ว', message_id),
  onError: (err) => alert(err.message),
});
```

### `GET /history`

ไม่เรียก AI

| query | |
| --- | --- |
| `type` | ไม่บังคับ: `faculty` \| `career` \| `portfolio` \| `skill` \| `high_yield` \| `tcas` \| `assessment` \| `chat` |
| `limit` | ไม่บังคับ 1-50 ค่าเริ่มต้น 20 |

**มี `type`** → `{ type, items }` เรียงใหม่สุดก่อน (ยกเว้น `chat` เรียงเก่า → ใหม่ เอาไปแสดงเป็นบทสนทนาได้เลย)

```json
{
  "success": true,
  "data": {
    "type": "faculty",
    "items": [{ "id": "e5f6...", "type": "faculty", "result": { "recommendations": [] }, "created_at": "..." }]
  }
}
```

- `tcas` → items เป็น `{ id, target, plan, created_at }`
- `assessment` → items เป็น `{ id, result, created_at }`
- `chat` → items เป็น `{ id, role, content, created_at }` (`role`: `user` | `assistant`)

**ไม่มี `type`** → ได้ทุกกลุ่ม (ยกเว้นแชท) กลุ่มละไม่เกิน `limit`

```json
{
  "success": true,
  "data": {
    "faculty": [],
    "career": [],
    "portfolio": [],
    "skill": [],
    "tcas": [],
    "assessment": []
  }
}
```

```js
const { items: messages } = await api('/history?type=chat&limit=50', { token });
```

### `DELETE /history/:type/:id` 🔒

ลบผลแนะนำ/แผน/ผลแบบทดสอบทีละรายการ
`type`: `faculty` | `career` | `portfolio` | `skill` | `high_yield` | `tcas` | `assessment` (แชทใช้ `DELETE /chat/messages`)

Response `200` `{ "id": "e5f6..." }` · ไม่พบได้ 404

### `DELETE /chat/messages` 🔒

ลบประวัติแชททั้งหมดของผู้ใช้

```json
{ "success": true, "data": { "deleted": 12 } }
```

---

## Score Simulator และคะแนนต่ำสุดย้อนหลัง

คะแนนต่ำสุด/สูงสุดรอบ 3 (Admission) ของ TCAS67–69 มาจากไฟล์ทางการของ ทปอ. ที่ [mytcas.com/stat](https://www.mytcas.com/stat) โหลดเข้า DB ด้วย `npm run tcas:cutoffs`

- จับคู่กับโครงการรอบ 3 ปีนี้จากชื่อโครงการ (`match: "project"`) ถ้าปีนั้นมีแถวเดียวทั้งหลักสูตรจะใช้แถวนั้น (`match: "program"`) ถ้าจับคู่ไม่ได้จะไม่แสดง ไม่เดาตัวเลข
- `zone` ไม่ใช่โอกาสติด เป็นแค่ตำแหน่งเทียบกับสถิติ เกณฑ์อยู่ใน `zone_rule` ของ response:
  - `safe` = สูงกว่าคะแนนต่ำสุดของทุกปีที่มีข้อมูลอย่างน้อย 3 คะแนน
  - `target` = ไม่ต่ำกว่าคะแนนต่ำสุดปีล่าสุดเกิน 2 คะแนน
  - `reach` = ต่ำกว่านั้น
- `buffer` = คะแนนของน้อง − คะแนนต่ำสุดปีล่าสุด · `position_in_last_year_range` = 0 (เท่าคะแนนต่ำสุด) ถึง 100 (เท่าคะแนนสูงสุด) ใช้วาดแถบ admission chance ได้

`GET /tcas/programs/:id/check` และ `GET /tcas/compare` มี `cutoff_history` กับ `zone` ในแต่ละโครงการแล้ว

### `POST /tcas/programs/:id/simulate` (สาธารณะ ไม่บันทึกอะไร)

```json
{
  "scores": [
    { "exam_type": "TGAT", "subject": "TGAT", "score": 62 },
    { "exam_type": "TPAT", "subject": "TPAT3", "score": 70 },
    { "exam_type": "A-Level", "subject": "คณิตศาสตร์ประยุกต์ 1", "score": 55, "max_score": 100 }
  ],
  "gpax": 3.4
}
```

```json
{
  "success": true,
  "data": {
    "program": { "id": "...", "university": "...", "program": "..." },
    "admissions": [
      {
        "round": 3,
        "project_name": "Admission",
        "score": { "weighted_score": 63.2, "partial_score": 63.2, "max_possible": 63.2, "parts": [], "missing": [] },
        "cutoff_history": [
          { "academic_year": 2569, "min_score": 60.12, "max_score": 85.5, "min_score_final": 59.9, "seats": 35, "applicants": 412, "passed": 35, "match": "project", "source_url": "https://assets.mytcas.com/..." }
        ],
        "zone": { "zone": "target", "buffer": 3.08, "compared_to_year": 2569, "position_in_last_year_range": 12, "years_of_data": 3, "trend": 1.4 },
        "last_year_min_score": 60.12,
        "gap_to_last_year": 3.08,
        "eligibility": { "status": "eligible", "reasons": [] }
      }
    ],
    "best": { "project_name": "Admission", "round": 3, "zone": { "zone": "target" } },
    "zone_rule": "...",
    "verify_note": "..."
  }
}
```

ส่งเฉพาะโครงการที่มีสัดส่วนคะแนน · `zone` เป็น null ถ้าคะแนนไม่ครบหรือไม่มีสถิติ

---

### Simulator แบบเลือกกลุ่มคณะ (สาธารณะ)

- `GET /tcas/faculty-groups` จะได้ 6 กลุ่ม `computer-eng`, `medicine`, `bba`, `architecture-design`, `comm-arts`, `law` (บางกลุ่มมี `note` เช่น แพทย์ที่รับผ่าน กสพท จึงไม่มีสถิติ)
- `GET /tcas/faculty-groups/:key/programs?limit=10&university=` คือหลักสูตรยอดนิยมของกลุ่มนั้น เรียงตาม **จำนวนผู้สมัครรอบ 3 ปีล่าสุด** จากสถิติทางการ แต่ละรายการมี `last_year { academic_year, applicants, seats, lowest_min_score }` · สาขาย่อยที่ใช้รหัสหลักสูตรร่วมกันจะรวมเป็นรายการเดียว ส่วนที่เหลือจะอยู่ใน `other_program_ids`
- `POST /tcas/faculty-groups/:key/simulate` ส่ง body แบบเดียวกับ `/simulate` และเพิ่ม `limit` (≤15) กับ `university` ได้ จะได้คะแนนเทียบกับหลักสูตรยอดนิยม N อันดับแรก เรียง safe → target → reach พร้อม `summary { safe, target, reach, no_data }` และวิชาที่ยังขาด (`missing`)

### `GET /tcas/programs/:id/documents` (สาธารณะ) การ์ด Recommended Docs

แต่ละรอบจะมี `recommended_docs` (รวมทุกโครงการในรอบนั้น) และ `projects[]` ที่แยกเกณฑ์เป็นรายการ

```json
{
  "round": 1,
  "recommended_docs": [
    { "type": "portfolio", "label_th": "แฟ้มสะสมผลงาน (Portfolio)", "label_en": "Portfolio", "projects": 4, "evidence": "ประวัติผลงานและประกาศนียบัตร" }
  ],
  "projects": [
    {
      "project_name": "ช้างเผือก (รอบ 1.1)",
      "criteria": [{ "item": "การสอบสัมภาษณ์", "weight": 50, "sub": false }],
      "conditions": ["gpa22 ขั้นต่ำ 3"],
      "documents": [{ "type": "interview", "weight": 50, "evidence": "การสอบสัมภาษณ์" }],
      "links": [],
      "notes": []
    }
  ]
}
```

`type` ที่เป็นไปได้: `portfolio`, `interview`, `transcript`, `english_test`, `certificates`, `recommendation`, `essay`, `sport`, `health`, `talent_test` · ทุกรายการมี `evidence` คือข้อความต้นฉบับที่ใช้ตัดสิน และจะไม่ใส่เอกสารที่ประกาศไม่ได้พูดถึง · ข้อมูลเดียวกันนี้อยู่ใน `/check` (`requirements_parsed`) และใน `/my-plan` (`targets[].rounds[].recommended_docs`)

---

## บัญชีของฉัน 🔒

### `GET /me`

```json
{
  "id": "...",
  "email": "student@example.com",
  "account_type": "email",
  "providers": ["email"],
  "can_change_password": true,
  "delete_confirmation": "password",
  "created_at": "...",
  "needs_consent": false,
  "profile": { "display_name": "...", "nickname": "...", "avatar_url": null, "avatar_icon": "robot", "avatar_frame_color": "#A3E635" }
}
```

`account_type`: `email` | `google` | `demo` · ถ้าเป็นบัญชีทดลอง `email` จะเป็น null · ถ้า `delete_confirmation` เป็น `type_DELETE` ให้หน้าลบบัญชีแสดงช่องพิมพ์ DELETE แทนช่องรหัสผ่าน

---

## ภาษา (TH / EN)

ส่ง header `X-Lang: en` (หรือ `Accept-Language: en-...`) เมื่อแอปอยู่ในโหมดภาษาอังกฤษ ถ้าไม่ส่ง ค่าเริ่มต้นคือไทย

- `error.message` จะเป็นภาษาอังกฤษ (`error.code` ยังเหมือนเดิม) · `details` ของ VALIDATION_ERROR ยังเป็นไทย ให้ใช้ `path` ไปแปลเองถ้าต้องการ
- คำตอบ AI ทุก endpoint รวมถึงแชท จะตอบเป็นภาษาอังกฤษ โดยชื่อมหาวิทยาลัย/หลักสูตรยังเป็นไทย และคำตอบ EN จะ cache แยกจาก TH
- ข้อความที่ backend เขียนเองจะตามภาษาด้วย เช่น `zone_rule`, `verify_note`, `eligibility.reasons` · ส่วน `eligibility.reason_codes` (`[{ code, params }]`) ให้ frontend แปลเองได้
- โหมด mock (`USE_MOCK_AI=true`) ยังตอบเป็นไทย
- ข้อมูลจาก myTCAS (ชื่อหลักสูตร เกณฑ์) เป็นภาษาไทยตามต้นฉบับ
- response มี header `Content-Language`

---

## สถานะแอปและ Roadmap 🔒

### `GET /me/progress` · `POST /me/progress` (กราฟหน้า 7 วิเคราะห์ผล)

เก็บ snapshot ความคืบหน้าทีละจุด (ตอนติ๊ก waypoint, ปรับชั่วโมง, ล็อกคณะ, reroute, กดบันทึกเอง) ข้อมูลส่วนนี้ไม่ถูกส่งให้ AI

`POST /me/progress`

| field | type | |
| --- | --- | --- |
| `event_type` | `checkin` \| `gpax_update` \| `major_locked` \| `reroute` \| `waypoint_complete` | จำเป็น |
| `gpax` | number \| null | 0-4 |
| `readiness_pct` | integer | 0-100 |
| `weekly_hours` | number | 0-80 |
| `locked_major` | string \| null | ≤100 ตัวอักษร |
| `completed_count` / `total_count` | integer | 0-500 |
| `round_breakdown` | `{ r1, r2, r3, r4 }` | integer 0-100 ทุกช่อง |

ได้ `201 { snapshot, created: true }` · ถ้าตัวเลขชุดเดิมกับ event เดิมภายใน 1 นาที จะไม่บันทึกซ้ำ ได้ `200 { snapshot: <อันเดิม>, created: false }` · field ที่ไม่รู้จักได้ 400

`GET /me/progress?days=7` (ไม่ส่ง `days` = ทั้งหมด สูงสุด 500 จุดล่าสุด) ได้ `{ items: [...] }` เรียงจากเก่าไปใหม่ แต่ละจุดเป็น `{ id, event_type, created_at, gpax, readiness_pct, weekly_hours, locked_major, completed_count, total_count, round_breakdown }`

### `GET /me/state` · `PATCH /me/state`

เก็บ PF_STATE จาก localStorage ไว้ในบัญชี PATCH จะแทนที่ทีละ key (ยกเว้น `behavior` ที่ merge ลงไปอีกชั้น) ข้อมูลส่วนนี้ไม่ถูกส่งให้ AI

```json
{
  "lang": "th",
  "beyond_4": true,
  "custom_keywords": ["เกม"],
  "target_universities": ["KU", "CU"],
  "weekly_hours": 10,
  "liked_majors": ["computer-eng"],
  "ignored_majors": ["law"],
  "locked_major": "computer-eng",
  "target_programs": ["uuid อันดับ 1", "uuid อันดับ 2"],
  "locked_program_id": "uuid",
  "checked_waypoints": ["wp-oct-tgat"],
  "behavior": { "visited_pages": ["home", "simulator"], "interactions": { "match_accept": 3 }, "last_action": "open_simulator", "last_action_at": "2026-11-24T09:00:00Z" }
}
```

### `GET /my-plan`

```json
{
  "state": { "...": "เหมือน /me/state" },
  "targets": [
    {
      "rank": 1,
      "program": { "id": "...", "university": "...", "program": "..." },
      "rounds": [{ "round": 1, "available": true, "projects": 2, "apply_start": "2026-10-01", "apply_end": "2026-11-15", "source_url": "..." }]
    }
  ],
  "locked_program_id": null,
  "items": [{ "id": "r3-tpat3", "round": 3, "tier": "required", "title": "...", "detail": {}, "status": "done", "due_date": null, "source": "system" }],
  "progress": { "done": 1, "total": 3, "percent": 33, "tiers": { "required": { "done": 1, "total": 2 } } }
}
```

อันดับ 1–3 มาจาก `state.target_programs` ถ้ายังไม่ได้เลือก จะใช้หลักสูตรที่บันทึกไว้ล่าสุด 3 อัน · `progress` ไม่นับงานที่ dismissed

### `PATCH /my-plan/items/:id`

`id` ตั้งจาก frontend เองได้ (a-z 0-9 `: _ . -` ยาวไม่เกิน 100 ตัว) ถ้ายังไม่มีงานนี้ จะสร้างให้ใหม่ ครั้งแรกต้องส่ง `title`

```json
{ "status": "done" }
{ "title": "ทำข้อสอบเก่า TPAT3", "round": 3, "tier": "required", "due_date": "2027-02-01", "detail": { "steps": ["..."], "hours": 4 }, "source": "simulator" }
```

ยังไม่มีงานนี้และไม่ส่ง `title` จะได้ 400 `ITEM_TITLE_REQUIRED`

`source`: `system` (ค่าเริ่มต้น), `simulator`, หรือ `custom` (งานที่นักเรียนเพิ่มเองบนเครื่อง แล้ว frontend ตั้ง `id` เอง)

### `PUT /my-plan/items`

ส่ง checklist ทั้งหมดจาก localStorage ขึ้นไปทีเดียว (ใช้ตอนล็อกอินครั้งแรกบนเครื่องนั้น) `{ "items": [{ "id": "...", "title": "...", ... }] }` ได้สูงสุด 300 งาน

### `POST /my-plan/items`

งานที่นักเรียนเพิ่มเอง `{ "title": "...", "round": 3, "tier": "optional", "due_date": "..." }` จะได้ id เป็น `custom-xxxx` · `201`

### `DELETE /my-plan/items/:id` · `POST /my-plan/reset`

reset จะลบ checklist และเป้าหมาย (`target_programs`, `locked_*`, `liked/ignored_majors`, `checked_waypoints`) แต่โปรไฟล์ คะแนน และประวัติ AI ยังอยู่

### `GET /my-plan/calendar.ics` 🔒 · `GET /tcas/calendar.ics?university=` (สาธารณะ)

ไฟล์ iCalendar มีช่วงรับสมัครของเป้าหมายอันดับ 1–3, ปฏิทิน TCAS กลาง, วันของมหาลัยเป้าหมาย และงานใน checklist ที่มี `due_date` ตัว 🔒 ต้องส่ง header จึงเปิดด้วย `<a href>` ตรงๆ ไม่ได้ ให้ `fetch` แล้วสร้าง Blob เพื่อดาวน์โหลด ส่วนปุ่ม Google Calendar ทำฝั่ง frontend ได้เลย

---

## AI Coach 🔒

### ดูความคืบหน้าของ endpoint AI (SSE)

endpoint AI ทุกตัวที่ตอบเป็น JSON (`/assessment/analyze`, `/recommend/*`, `/plan/tcas`, `/coach/high-yield`) ถ้าส่ง header `Accept: text/event-stream` จะได้ความคืบหน้าทีละขั้น แทนที่จะต้องรอเฉยๆ (แผน TCAS ใช้ Gemini จริงประมาณ 45 วินาที)

```text
event: progress   data: {"stage":"started","elapsed_ms":0}
event: progress   data: {"stage":"profile","elapsed_ms":3}
event: progress   data: {"stage":"tcas_data","elapsed_ms":120}
event: progress   data: {"stage":"ai_web_search","elapsed_ms":410}
event: progress   data: {"stage":"working","elapsed_ms":5410}      <- ส่งทุก 5 วินาที
event: progress   data: {"stage":"saving","elapsed_ms":44800}
event: done       data: {"status":201,"data":{ ...เหมือน response JSON ปกติ... }}
```

- `stage`: `started`, `profile`, `tcas_data`, `ai`, `ai_web_search`, `saving`, `working` (heartbeat) · ถ้าใช้ผลจาก cache จะได้ `done` ทันทีพร้อม `status: 200`
- ถ้าพังหลังจากเริ่ม stream แล้ว จะได้ `event: error` `{ status, code, message, request_id }` ส่วน error ที่เกิดก่อนเริ่ม (401, 400 validation, 429) ยังตอบเป็น JSON ปกติ
- ถ้าผู้ใช้ปิดหน้าไประหว่างรอ backend จะทำต่อจนเสร็จและบันทึกผลไว้ เปิดใหม่จะได้ผลจาก cache
- `EventSource` ส่ง POST ไม่ได้ ให้ใช้ `fetch` แล้วอ่าน `response.body` ทีละ chunk เหมือนแชท

### `POST /chat` (เพิ่ม `context`)

```json
{
  "message": "ควรอ่านอะไรก่อน",
  "context": {
    "page": "simulator",
    "program_id": "uuid ของสาขาที่ล็อกไว้",
    "simulated_score": 58.8,
    "gap_subjects": [{ "subject": "TPAT3", "gap": -5 }],
    "roadmap": { "done": 4, "total": 12, "next_tasks": ["ทำพอร์ต"] }
  }
}
```

backend เป็นคนดึงสัดส่วนคะแนนและคะแนนต่ำสุดย้อนหลังจาก `program_id` เอง ไม่เชื่อตัวเลขที่ client ส่งมา

### `POST /match/programs` (สาธารณะ ไม่เรียก AI) หน้า "คณะที่ใช่"

5 หลักสูตรจริง (มหาวิทยาลัยละ 1 สาขา) ที่ตรงกับคำตอบขั้นที่ 1-3 จับคู่ในหน่วยความจำจาก `tcas_programs` + `tcas_admissions` + `tcas_cutoffs` (โหลดครั้งแรก ~8 วินาที แล้ว cache 30 นาที server โหลดรอไว้ตอนเปิด)

```json
{ "interests": ["tech-ai", "robotics"], "gpax": 3.4, "beyond_4": true, "target_universities": ["ku", "มหาวิทยาลัยบูรพา"], "weekly_hours": 9, "exclude_ids": [], "limit": 5 }
```

- ส่งเฉพาะค่าที่นักเรียนตั้งเอง (`gpax`, `weekly_hours` ไม่บังคับ) · `interests` 1-4 key ของ bubble ขั้นที่ 1 · `target_universities` = code ของปุ่ม (cu, ku, ...) หรือชื่อที่พิมพ์เอง
- `exclude_ids` = หลักสูตรที่แสดงไปแล้ว ใช้ตอนกด "หาใหม่"
- คะแนน 0-100 = ความสนใจ 50 + มหาวิทยาลัยเป้าหมาย 15 + GPAX 15 + Beyond 4.00 10 + ชั่วโมง/สัปดาห์ 10 ทุกคะแนนมีเหตุผลใน `reasons` · หลักสูตรที่ไม่ตรงความสนใจหรือ GPAX ต่ำกว่าขั้นต่ำทุกโครงการจะไม่ถูกเลือก

ได้ `items[]`: `id, university, faculty, program, campus, url, match_pct, matched_interests, target_university, reasons[{th,en}], min_gpax, rounds[{round, projects, next_apply_end}], weights{round, parts[{subject, weight}]}, last_year{academic_year, applicants, seats, lowest_min_score}` + `has_more`, `academic_year`

### `POST /match/programs/ai` 🔒 ✨

body เดียวกัน AI เลือก 5 จาก 15 หลักสูตรจริงถัดไป (เลือกได้แค่จากรายการ จึงไม่มีหลักสูตรที่แต่งขึ้น) แต่ละใบมี `ai_reason` · `method: "ai"` · AI ล่มหรือตอบผิดรูปแบบ → ใช้ลำดับจากระบบแทน (`ai_fallback: true`) · ใช้โควตา AI

### `POST /match/interests` 🔒 ✨

`{ "text": "ชอบเขียนโปรแกรม อยากทำหุ่นยนต์" }` → `{ "interests": ["tech-ai", "robotics"], "summary": "...", "method": "ai" }` ได้เฉพาะ key จากรายการ ไม่เกิน 4 · ใช้โควตา AI

### `POST /coach/high-yield` ✨

```json
{ "subject": "A-Level ฟิสิกส์", "current_score": 48, "target_score": 65, "weekly_hours": 6, "force": false }
```

ได้ `result.chapters` (3–5 บท: `chapter`, `why_high_yield`, `exam_weight_note`, `study_hours`, `how_to_study`, `practice_resources`), `weekly_plan`, `quick_prompts`, `verify_note` · ใช้โควตา AI และ cache เหมือน endpoint AI อื่น · endpoint นี้ไม่ค้นเว็บ จึงไม่แต่งสัดส่วนข้อสอบ แต่จะเขียนใน `exam_weight_note` ว่า "ไม่มีข้อมูลทางการ" ให้ frontend ลิงก์ไปที่ mytcas.com/blueprint แทน · กับ Gemini จริงใช้เวลาประมาณ 15–20 วินาที

---

## บัญชีทดลอง

### `POST /auth/demo`

กดแต่ละครั้งได้บัญชีใหม่ของตัวเองพร้อมข้อมูลตัวอย่าง (ม.6, GPAX 3.45, คะแนน 4 วิชา, เป้าหมาย 2 คณะ) จะได้ session + `demo: true` + `demo_expires_at` และบัญชีจะถูกลบหลัง `DEMO_TTL_HOURS` ชั่วโมง · จำกัด `RATE_LIMIT_DEMO_PER_HOUR` ครั้งต่อ IP และ `DEMO_DAILY_LIMIT` ครั้งต่อวัน · ไม่นับใน `/stats` · ปิดได้ด้วย `DEMO_LOGIN=false` (จะได้ 404 `DEMO_DISABLED`)

`DELETE /account` สำหรับบัญชีที่ไม่มีรหัสผ่าน (บัญชีทดลอง และบัญชี Google เก่าที่สร้างไว้ก่อนเลิกใช้ Google sign-in) ใช้ `{ "confirm": "DELETE" }` แทนรหัสผ่าน

---

## รูปโปรไฟล์และหน้า Profile Settings 🔒

`PUT /profile` เพิ่มฟิลด์ `nickname`, `bio` (≤500), `target_tcas_year`, `avatar_icon` (a-z0-9_-), `avatar_frame_color` / `avatar_bg_color` (`#RRGGBB` สีกรอบ / สีพื้นหลังของอวตาร) · ข้อมูลพวกนี้ไม่ถูกส่งให้ AI · อีเมลอ่านได้จาก `/auth/login` (แก้ไม่ได้)

`GET /profile` และ `PUT /profile` ตอบ `school_name` มาด้วย (ชื่อโรงเรียนของ `school_id` หรือ null) เอาไปแสดงในช่องโรงเรียนได้เลย

### `POST /profile/avatar`

ส่งไฟล์รูปเป็น body ตรงๆ (ไม่ใช่ form) `Content-Type: image/png | image/jpeg | image/webp` ไม่เกิน 2MB

```js
await fetch(`${API}/api/profile/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type }, body: file });
```

ได้ `{ "avatar_url": "https://<project>.supabase.co/storage/v1/object/public/avatars/<user>/<time>.png" }` · backend ตรวจไบต์แรกของไฟล์ว่าเป็นรูปจริงไหม ถ้าไม่ใช่จะได้ 400 `INVALID_IMAGE` · ไฟล์เกิน 2MB ได้ 400 `PAYLOAD_TOO_LARGE` · อัปโหลดรูปใหม่แล้วรูปเก่าจะถูกลบ · URL เป็นแบบสาธารณะ (ใส่ใน `<img>` ได้เลย)

### `DELETE /profile/avatar`

ลบรูปและตั้ง `avatar_url` เป็น null

---

## แชร์ผลลัพธ์ด้วย QR code

นักเรียนกดแชร์ผลที่งาน แล้วสแกน QR เพื่อเปิดผลเดียวกันบนมือถือที่บ้านได้ ไม่ต้องล็อกอิน

- ลิงก์เก็บ **สำเนาผลลัพธ์ ณ ตอนกดแชร์** ถ้านักเรียนสร้างแผนใหม่ภายหลัง ลิงก์เดิมก็ยังเปิดได้
- เก็บเฉพาะผลจาก AI ไม่มีชื่อ อีเมล โรงเรียน หรือคะแนนจากโปรไฟล์
- ลิงก์หมดอายุใน `SHARE_DAYS` วัน (ค่าเริ่มต้น 30) เจ้าของยกเลิกลิงก์ได้ตลอด และลิงก์จะถูกลบไปด้วยตอนลบบัญชี
- ใครก็ตามที่มีลิงก์จะเปิดอ่านได้ เพราะฉะนั้นควรบอกนักเรียนว่าอย่าโพสต์ลิงก์ในที่สาธารณะ
- ลิงก์ชี้ไปที่ `FRONTEND_URL/share.html?t=<token>` คือหน้าแชร์ของ PC UI ที่ backend เสิร์ฟเอง ซึ่งเรียก `GET /api/share/:token` แล้วแสดงผล
- ถ้าหน้าเว็บอยู่ที่อื่น ตั้ง `SHARE_BASE_URL` ได้ โดยใส่ `{token}` ตรงที่ token ต้องอยู่ ถ้าไม่ใส่จะต่อท้ายเป็น `/<token>`

### `POST /share` 🔒

```json
{ "kind": "tcas", "id": "uuid ของผลลัพธ์" }
```

`kind`: `tcas` | `assessment` | `faculty` | `career` | `portfolio` | `skill` | `high_yield` (เอา `id` มาจาก response ตอนสร้างผลลัพธ์ หรือจาก `GET /history`)

Response `201` แต่ถ้าผลนี้มีลิงก์ที่ยังใช้ได้อยู่แล้ว จะได้ลิงก์เดิมกลับมาพร้อม `200`

```json
{
  "success": true,
  "data": {
    "token": "q3Vx9...",
    "url": "http://localhost:3000/share/q3Vx9...",
    "expires_at": "2026-12-24T10:00:00.000Z",
    "reused": false,
    "qr_svg": "<svg xmlns=...>...</svg>"
  }
}
```

เอา `qr_svg` ไปแสดงได้เลย หรือใช้ `<img src="{API}/api/share/{token}/qr.svg">` ก็ได้ · ไม่พบผลลัพธ์ หรือผลลัพธ์ไม่ใช่ของตัวเอง จะได้ 404 · มีลิงก์ที่ยังใช้ได้เกิน 50 อัน จะได้ 400 `SHARE_LIMIT`

### `GET /share` 🔒

รายการลิงก์ของตัวเอง `[{ token, kind, source_id, url, expires_at, expired, created_at }]`

### `DELETE /share/:token` 🔒

ยกเลิกลิงก์ คนที่สแกนหลังจากนี้จะได้ 404 · Response `200` `{ "revoked": true }`

### `GET /share/:token` (สาธารณะ)

```json
{
  "success": true,
  "data": {
    "kind": "tcas",
    "target": { "faculty": "วิศวกรรมคอมพิวเตอร์", "university": "มหาวิทยาลัยเกษตรศาสตร์" },
    "plan": { "...": "เหมือน POST /plan/tcas" },
    "created_at": "2026-11-24T09:00:00.000Z",
    "shared_at": "2026-11-24T09:05:00.000Z",
    "expires_at": "2026-12-24T09:05:00.000Z",
    "verify_note": "ข้อมูลนี้เป็นคำแนะนำจาก AI ณ วันที่สร้าง ..."
  }
}
```

ถ้า `kind` เป็นแบบอื่นที่ไม่ใช่ `tcas` จะได้ `result` แทน `target`/`plan` · ลิงก์หมดอายุหรือถูกยกเลิก จะได้ 404 `SHARE_NOT_FOUND`

### `GET /share/:token/qr.svg` (สาธารณะ)

รูป QR (`image/svg+xml`) ที่ข้างในเป็น URL ของลิงก์

---

## บัญชีและข้อมูลส่วนบุคคล (PDPA) 🔒

### `GET /account/consent`

```json
{
  "success": true,
  "data": {
    "current_version": "1.0",
    "accepted_version": "1.0",
    "accepted_at": "2026-11-24T10:00:00Z",
    "needs_consent": false
  }
}
```

ถ้า `needs_consent` เป็น `true` (เช่นแก้นโยบายแล้วเปลี่ยน `TERMS_VERSION`) ให้แสดงหน้าข้อตกลงก่อนใช้งานต่อ

### `POST /account/consent`

ไม่ต้องส่ง body บันทึกว่าผู้ใช้ยอมรับข้อตกลงเวอร์ชันปัจจุบัน Response เหมือน `GET /account/consent`

### `GET /account/export`

ดาวน์โหลดข้อมูลทั้งหมดของผู้ใช้ (สิทธิ์ขอรับสำเนาข้อมูลตาม PDPA)

```json
{
  "success": true,
  "data": {
    "exported_at": "2026-11-24T10:00:00Z",
    "account": { "id": "6f1c...", "email": "student01@example.com" },
    "profile": { },
    "exam_scores": [],
    "assessments": [],
    "recommendations": [],
    "tcas_plans": [],
    "chat_messages": []
  }
}
```

```js
const data = await api('/account/export', { token });
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pathfinder-my-data.json' });
a.click();
```

### `DELETE /account`

ลบบัญชีและข้อมูลทั้งหมดถาวร กู้คืนไม่ได้ ต้องยืนยันด้วยรหัสผ่าน

```json
{ "password": "password123" }
```

Response `200` `{ "deleted": true, "message": "ลบบัญชีและข้อมูลทั้งหมดเรียบร้อยแล้ว" }` แล้วให้ frontend ลบ token ทิ้ง

Error: 400 `WRONG_PASSWORD`
