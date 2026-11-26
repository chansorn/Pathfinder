# PathFinder Backend

REST API ของ PathFinder แอปแนะแนวและวางแผนเรียนต่อด้วย AI สำหรับนักเรียน ม.ปลาย ที่เตรียมสอบ TCAS

Node.js + Express 5 (ES Modules) · Supabase (PostgreSQL + Auth) · Google Gemini (`@google/genai`) · Zod

รายละเอียดทุก endpoint อยู่ใน [API.md](API.md) และมีไฟล์ทดสอบ [requests.http](requests.http)

## ติดตั้ง

ต้องมี Node.js 20 ขึ้นไป (แนะนำ LTS ล่าสุด)

```bash
npm install
cp .env.example .env
```

## ตั้งค่า .env

| ตัวแปร | ความหมาย |
| --- | --- |
| `PORT` | port ที่ API รัน (ค่าเริ่มต้น 4000) |
| `FRONTEND_URL` | URL ของหน้าเว็บ ใช้สร้างลิงก์ในอีเมลและลิงก์แชร์ และอนุญาต CORS ถ้า backend เสิร์ฟหน้าเว็บเอง (ค่าปกติ) ให้ตั้งเป็น URL ของ backend เช่น `http://localhost:4000` |
| `SERVE_FRONTEND` | (ไม่ใส่ก็ได้) ค่าเริ่มต้น `true` = เสิร์ฟหน้าเว็บ PC UI ที่ `/` จาก origin เดียวกับ API ไม่ต้องตั้ง CORS |
| `FRONTEND_DIR` | (ไม่ใส่ก็ได้) โฟลเดอร์หน้าเว็บ ค่าเริ่มต้น `../frontend/UI/PC UI` ถ้าไม่มี `index.html` ในโฟลเดอร์นี้ backend จะเสิร์ฟแค่ API |
| `CORS_ORIGINS` | (ไม่ใส่ก็ได้) origin เพิ่มเติม คั่นด้วย `,` เช่น `http://127.0.0.1:5500` ตอนเปิดหน้าเว็บด้วย Live Server |
| `GEMINI_API_KEY` | key จาก [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | ชื่อ model เช่น `gemini-3.5-flash` |
| `GEMINI_TIMEOUT_MS` | (ไม่ใส่ก็ได้) timeout ต่อการเรียก Gemini ค่าเริ่มต้น 60000 (เรียกจริงใช้เวลา 15–26 วินาที) |
| `REQUEST_TIMEOUT_MS` | (ไม่ใส่ก็ได้) timeout ของ request ทั่วไป ค่าเริ่มต้น 15000 (endpoint AI ได้นานกว่านี้, `/chat` ไม่มี) |
| `AI_CACHE_DAYS` | (ไม่ใส่ก็ได้) ใช้ผล AI เดิมซ้ำได้กี่วันถ้าข้อมูลไม่เปลี่ยน ค่าเริ่มต้น 7, `0` = ปิด |
| `SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `SUPABASE_ANON_KEY` | Supabase > Project Settings > API > anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > service_role / secret key |
| `AUTH_LOCAL_VERIFY` | (ไม่ใส่ก็ได้) ค่าเริ่มต้น `true` = ตรวจ token เองด้วย public key ของโปรเจกต์ (JWKS) ไม่ต้องถาม Supabase ทุก request ตั้ง `false` ถ้าอยากกลับไปถามทุกครั้ง |
| `SUPABASE_JWT_SECRET` | (ไม่ใส่ก็ได้) ใช้เฉพาะโปรเจกต์ที่ยังเซ็น token ด้วย JWT secret แบบเก่า (HS256) เป็นความลับระดับเดียวกับ service role key |
| `USE_MOCK_AI` | `true` = ไม่เรียก Gemini ใช้ข้อมูลจาก `src/mocks` แทน |
| `RATE_LIMIT_*` | จำนวนครั้งที่ยอมให้เรียก (ทั่วไป / AI / สมัคร / auth) ดูค่าเริ่มต้นใน `.env.example` |
| `TCAS_WEB_SEARCH` | `true` = ให้ Gemini ค้น Google (mytcas.com, เว็บมหาวิทยาลัย) เมื่อฐานข้อมูล TCAS ของเราไม่มีข้อมูล มีค่าใช้จ่ายเพิ่มต่อครั้งที่ค้น |
| `AI_DAILY_LIMIT` | เพดานเรียก AI รวมทั้งระบบต่อวัน (เวลาไทย) กันค่า Gemini บานปลาย ค่าเริ่มต้น 1000 |
| `AI_FALLBACK` | (ไม่ใส่ก็ได้) ค่าเริ่มต้น `true` = เมื่อ Gemini ล่ม หรือโควตาของวันหมด ให้ตอบผลล่าสุดของนักเรียนหรือผลตัวอย่างที่มีป้ายบอกแทน error |
| `KEEP_ALIVE_URL` | (ไม่ใส่ก็ได้) URL สาธารณะของ backend เพื่อ ping ตัวเองทุก 10 นาทีกัน host ฟรีหลับ |
| `PASSWORD_RESET_REDIRECT_URL` | (ไม่ใส่ก็ได้) หน้าที่ลิงก์รีเซ็ตรหัสผ่านพาไป ค่าเริ่มต้น `FRONTEND_URL/` (หน้า index เปิดฟอร์มตั้งรหัสใหม่ให้เอง) |
| `STATS_MIN_GROUP` | (ไม่ใส่ก็ได้) `/api/stats/overview` ซ่อนกลุ่มที่มีคนน้อยกว่านี้ กันการระบุตัวตน ค่าเริ่มต้น 3 |
| `SHARE_BASE_URL` | (ไม่ใส่ก็ได้) ลิงก์แชร์ใน QR ชี้ไปที่ `SHARE_BASE_URL/:token` ค่าเริ่มต้นคือ `FRONTEND_URL/share.html?t={token}` (หน้าแชร์ที่ backend เสิร์ฟเอง) · ใส่ `{token}` ตรงที่ token ต้องอยู่ ถ้าไม่ใส่จะต่อท้ายเป็น `/<token>` |
| `SHARE_DAYS` | (ไม่ใส่ก็ได้) ลิงก์แชร์มีอายุกี่วัน ค่าเริ่มต้น 30 |
| `DEMO_LOGIN` | (ไม่ใส่ก็ได้) `false` = ปิดปุ่ม Demo Student ค่าเริ่มต้นคือเปิด |
| `DEMO_TTL_HOURS` / `DEMO_DAILY_LIMIT` / `RATE_LIMIT_DEMO_PER_HOUR` | (ไม่ใส่ก็ได้) บัญชีทดลองอยู่ได้กี่ชั่วโมง (6) สร้างได้กี่บัญชีต่อวัน (300) และกี่ครั้งต่อ IP ต่อชั่วโมง (10) |
| `SENTRY_DSN` | (ไม่ใส่ก็ได้) ส่ง error 5xx ไป [Sentry](https://sentry.io) พร้อม request id ไม่ส่ง body/header/ข้อมูลผู้ใช้ |
| `TERMS_VERSION` | เวอร์ชันข้อตกลง/นโยบายความเป็นส่วนตัว เปลี่ยนเมื่อแก้เนื้อหา ผู้ใช้จะถูกขอให้ยอมรับใหม่ |

> **ความปลอดภัย:** key ทุกตัวอยู่ฝั่ง backend เท่านั้น ห้าม commit `.env` (อยู่ใน `.gitignore` แล้ว)
> โดยเฉพาะ `SUPABASE_SERVICE_ROLE_KEY` ข้าม RLS ได้ทั้งหมด ห้ามใส่ใน frontend เด็ดขาด

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. ไปที่ **SQL Editor** > New query > วางเนื้อหาไฟล์ [supabase/schema.sql](supabase/schema.sql) ทั้งไฟล์ > **Run** (รันซ้ำได้)
   - สร้างตาราง, เปิด RLS ทุกตาราง, ใส่ระดับชั้น ม.4-ม.6 และโรงเรียนตัวอย่าง
   - มี trigger สร้างแถว `profiles` ให้อัตโนมัติตอนสมัครสมาชิก
3. ไปที่ **Authentication > Sign In / Providers > Email**
   - ถ้าเปิด **Confirm email** อยู่: ตอนสมัครจะยังไม่ได้ token (`requires_email_confirmation: true`) น้องต้องกดลิงก์ในอีเมลก่อน login
   - ถ้าอยากทดสอบเร็วๆ ปิด Confirm email ไว้ก่อนได้
4. เพิ่มรายชื่อโรงเรียนจริงในตาราง `schools` ผ่าน Table Editor

### รีเซ็ตรหัสผ่าน

backend ใช้ `token_hash` จากลิงก์ในอีเมล ต้องตั้งค่า 2 อย่าง

1. **Authentication > URL Configuration > Redirect URLs** เพิ่ม `http://localhost:4000/` และ URL จริงหลัง deploy
2. **Authentication > Emails > Reset Password** เปลี่ยนลิงก์ใน template เป็น

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">ตั้งรหัสผ่านใหม่</a>
   ```

หน้า index ของ PC UI อ่าน `token_hash` จาก URL แล้วเรียก `POST /api/auth/reset-password`

> อีเมลของ Supabase แบบฟรีส่งได้น้อยมากต่อชั่วโมง ใช้จริงควรตั้ง SMTP ของตัวเอง (Authentication > Emails > SMTP Settings)

### กันคนสมัครรัวๆ มาผลาญโควตา AI

มีให้แล้วใน backend: จำกัดการสมัคร 5 ครั้ง/ชม./IP, AI 20 ครั้ง/ชม./คน และเพดาน AI รวมต่อวัน (`AI_DAILY_LIMIT`)
แนะนำให้เปิด CAPTCHA เพิ่ม

1. สมัคร [hCaptcha](https://www.hcaptcha.com) หรือ [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
2. Supabase > **Authentication > Attack Protection** > เปิด CAPTCHA แล้วใส่ secret key
3. ฝั่ง frontend ใส่ widget แล้วส่ง `captcha_token` มากับ register / login / forgot-password / change-password / ลบบัญชี (ดู API.md)

## ข้อมูล TCAS ให้ AI ใช้

AI ใช้ข้อมูล TCAS 2 แหล่ง เรียงตามลำดับ

1. **ฐานข้อมูลของเรา** (`tcas_programs`, `tcas_admissions`, `tcas_calendar`) แม่นและตรวจสอบได้ AI อ้างตัวเลขจากตรงนี้ได้พร้อมบอกปีการศึกษา
2. **Google Search** (ถ้า `TCAS_WEB_SEARCH=true`) ใช้เมื่อฐานข้อมูลไม่มีหลักสูตรที่ถาม ผลลัพธ์จะแนบลิงก์ที่ใช้มาใน `web_sources`

myTCAS ไม่มี API/ข้อมูลเปิดอย่างเป็นทางการ ต้องเตรียมข้อมูลเองจากประกาศของ ทปอ. (mytcas.com) และเว็บไซต์มหาวิทยาลัย

### ดึงข้อมูลจาก myTCAS อัตโนมัติ

```bash
node scripts/fetch-mytcas.js --year 2570 --rounds 002 --out tcas-data/tcas70.json
npm run tcas:import -- tcas-data/tcas70.json --replace
```

- ได้รายชื่อหลักสูตรทุกมหาวิทยาลัยพร้อมค่าเทอม จากไฟล์ JSON สาธารณะที่ course.mytcas.com ใช้เอง
- `--rounds` คือรหัสมหาวิทยาลัยที่จะดึงเกณฑ์รายรอบด้วย (`002` = เกษตรศาสตร์) คั่นด้วย `,` ต้องยิง 1 request ต่อหลักสูตร จึงควรใส่เฉพาะที่ต้องใช้
- ใช้ `--replace` ตอนนำเข้าซ้ำ จะได้ไม่มีหลักสูตรชื่อเก่าค้าง
- ปฏิทินอยู่แยกใน `tcas-data/tcas70-calendar.json` (ทำมือจาก mytcas.com) นำเข้าด้วย `npm run tcas:import -- tcas-data/tcas70-calendar.json`
- URL เหล่านี้ไม่ใช่ API ทางการ ถ้า myTCAS เปลี่ยนเว็บ สคริปต์อาจต้องแก้
- คะแนนต่ำสุด/สูงสุดรอบ 3 ย้อนหลัง (TCAS67–69 จากไฟล์ทางการที่ mytcas.com/stat) ใช้ใน Score Simulator นำเข้าด้วย `npm run tcas:cutoffs` (ดาวน์โหลดเองแล้วแทนที่ข้อมูลทั้งปี) ถ้ามีปีใหม่ให้เพิ่ม URL ใน `SOURCES` ของ [scripts/import-cutoffs.js](scripts/import-cutoffs.js)

### นำเข้าข้อมูลเอง

1. คัดลอก [tcas-data/template.json](tcas-data/template.json) เป็นไฟล์ใหม่ เช่น `tcas-data/tcas69.json` แล้วใส่ข้อมูลจริง (ค่าในเทมเพลตเป็นตัวอย่างที่แต่งขึ้นทั้งหมด)
   - `academic_year` เป็นปี พ.ศ. เช่น `2569`
   - `score_weights` เป็นสัดส่วนคะแนนเป็นเปอร์เซ็นต์ เช่น `{ "TGAT": 20, "TPAT3": 30 }`
   - ใส่ `source_url` ทุกครั้ง เพื่อให้ตรวจย้อนได้
2. รัน

   ```bash
   npm run tcas:import -- tcas-data/tcas69.json
   ```

   ถ้าข้อมูลผิดรูปแบบ สคริปต์จะบอกว่าผิดตรงไหนและไม่นำเข้าอะไรเลย
   - นำเข้าซ้ำได้: หลักสูตรเดิมถูกอัปเดต รายการรับสมัครของหลักสูตรนั้นถูกแทนที่ทั้งหมด
   - `--replace` ลบข้อมูลทั้งปีนั้นก่อนนำเข้าใหม่
   - ถ้ามี `calendar` ในไฟล์ ปฏิทินของปีนั้นจะถูกแทนที่ทั้งหมด
3. AI จะใช้ข้อมูลปีล่าสุดที่มีในฐานข้อมูลทันที ผล AI ที่แคชไว้ซึ่งเกี่ยวกับหลักสูตรที่ข้อมูลเปลี่ยนจะถูกคิดใหม่อัตโนมัติ

ทำไฟล์จาก Excel ได้: จัดตารางให้คอลัมน์ตรงกับ field ในเทมเพลต แล้วแปลงเป็น JSON (เช่นใช้สคริปต์ หรือให้ AI ช่วยแปลงแล้วตรวจอีกรอบ)

## ข้อมูลส่วนบุคคล (PDPA)

ผู้ใช้ส่วนใหญ่เป็นนักเรียนที่ยังไม่บรรลุนิติภาวะ backend เตรียมไว้ให้แล้ว

- สมัครต้องส่ง `accept_terms: true` ระบบบันทึกเวอร์ชันข้อตกลงและเวลาที่ยอมรับ
- เปลี่ยน `TERMS_VERSION` เมื่อแก้นโยบาย แล้ว `GET /api/account/consent` จะบอกให้ขอความยินยอมใหม่
- ผู้ใช้ส่งออกข้อมูลตัวเองได้ (`GET /api/account/export`) ลบประวัติได้ และลบบัญชีพร้อมข้อมูลทั้งหมดได้ (`DELETE /api/account`)
- ข้อมูลที่ส่งให้ AI ไม่มีอีเมล ชื่อ หรือโรงเรียน

สิ่งที่ต้องทำเอง (ไม่ใช่โค้ด):

- เขียนข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว และแสดงในหน้าสมัคร ควรให้ผู้เชี่ยวชาญกฎหมายตรวจ โดยเฉพาะเรื่องความยินยอมของผู้ปกครองสำหรับผู้เยาว์
- **ใช้ Gemini API แบบเปิด billing (แบบเสียเงิน)** เงื่อนไขของแบบฟรีอนุญาตให้ Google นำข้อมูลที่ส่งไปใช้ปรับปรุงโมเดลได้

## รันโปรเจกต์

```bash
npm run dev     # ตอนพัฒนา (nodemon รีสตาร์ตเองเมื่อแก้โค้ด)
npm start       # production
npm test        # เทสทุก endpoint ในโหมด mock (ไม่ต้องมี Supabase/Gemini จริง)
```

เช็กว่ารันแล้ว: `curl http://localhost:4000/api/health` ต้องได้ `{"status":"ok"}`

**หน้าเว็บ:** เปิด `http://localhost:4000/` ได้เลย backend เสิร์ฟ `../frontend/UI/PC UI` ให้เองจาก origin เดียวกับ API จึงไม่ต้องใช้ Live Server และไม่ต้องตั้ง CORS
(ถ้ายังเปิดด้วย Live Server ที่ `127.0.0.1:5500` ได้อยู่ หน้าเว็บจะเรียก `localhost:4000` เอง แต่ต้องใส่ `CORS_ORIGINS=http://127.0.0.1:5500`)
หน้าเว็บใช้ Content-Security-Policy: ห้ามใช้ `<script>` แบบ inline และ `onclick=` ให้เขียนเป็นไฟล์ใน `js/` แทน ถ้าจะโหลด script จากโดเมนใหม่ ต้องเพิ่มใน `pageCsp` ใน `src/app.js`

### โหมด mock

ตั้ง `USE_MOCK_AI=true` แล้ว endpoint AI ทั้งหมดจะตอบด้วยข้อมูลใน `src/mocks/index.js` (โครงสร้างเหมือนของจริง ผ่าน Zod schema เดียวกัน)
frontend พัฒนาได้โดยไม่เสียโควตา Gemini ส่วน auth/profile ยังใช้ Supabase จริง

## โครงสร้างโปรเจกต์

```text
src/
  server.js          จุดเริ่มต้น (listen port)
  app.js             ตั้งค่า express, middleware, routes
  config/            env (ตรวจด้วย zod), supabase client, gemini client
  routes/            แยกตามกลุ่ม endpoint
  controllers/       รับ request -> เรียก service -> ส่ง response
  services/          business logic, ai.service.js = ที่เดียวที่เรียก Gemini
  prompts/           prompt ของแต่ละฟีเจอร์
  schemas/           zod schema ของ request และของคำตอบ AI
  middlewares/       auth, validate, rateLimit, errorHandler
  mocks/             ข้อมูลจำลองสำหรับ USE_MOCK_AI
  data/              คำถามแบบทดสอบ (ตายตัว)
supabase/schema.sql
test/                เทส (ใช้ Supabase ปลอม in-memory)
```

หลักๆ ที่ควรรู้:

- ทุก query ข้อมูลผู้ใช้ใช้ Supabase client ที่แนบ token ของผู้ใช้ จึงโดน RLS กันให้เห็นแค่ข้อมูลตัวเอง ส่วน service role ใช้เฉพาะงาน admin ได้แก่ logout / เปลี่ยนรหัส / ลบบัญชี, สถิติรวมแบบนับจำนวน, อ่านลิงก์แชร์ด้วย token, อัปโหลดรูปโปรไฟล์ (path มาจาก user id เสมอ) และสร้าง/ลบบัญชีทดลอง
- schema ของคำตอบ AI เขียนด้วย Zod ที่เดียวใน `src/schemas/ai.schema.js` แล้วแปลงเป็น `responseSchema` ของ Gemini อัตโนมัติ (`src/utils/geminiSchema.js`) คำตอบที่ได้ validate ด้วย Zod อีกชั้น ไม่ผ่านจะลองใหม่ 1 ครั้ง
- ข้อมูลที่ส่งให้ AI สร้างใน `src/services/student.service.js` มีแค่ข้อมูลการเรียน/ความสนใจ ไม่มีอีเมล ชื่อ หรือโรงเรียน
- คะแนน RIASEC/ความถนัดคำนวณฝั่ง server จากคำตอบ AI แค่ตีความ

## CI

[.github/workflows/backend-ci.yml](../.github/workflows/backend-ci.yml) รัน `npm ci && npm test` ทุกครั้งที่ push หรือเปิด PR ที่แก้ไฟล์ใน `pathfinder-backend/`
เทสใช้ mock AI + Supabase ปลอม จึงไม่ต้องตั้ง secret ใน GitHub

## Deploy

### Render

1. push โค้ดขึ้น GitHub (เช็กว่าไม่มีไฟล์ `.env` ติดไป)
2. Render > **New > Web Service** > เลือก repo
3. ตั้งค่า
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. **Environment** > ใส่ตัวแปรทั้งหมดจาก `.env` (ไม่ต้องใส่ `PORT` Render กำหนดให้เอง)
   - `FRONTEND_URL` = URL ของเว็บ ถ้า backend เสิร์ฟหน้าเว็บเองก็คือ URL ของ service นี้ เช่น `https://pathfinder.onrender.com` (ไม่มี `/` ท้าย)
   - หน้าเว็บจะถูกเสิร์ฟก็ต่อเมื่อโฟลเดอร์ `frontend/UI/PC UI` อยู่ใน repo ที่ deploy ด้วย ไม่งั้นต้องตั้ง `FRONTEND_DIR` หรือ host หน้าเว็บแยก
5. Deploy แล้วลอง `https://<ชื่อ-service>.onrender.com/api/health`

> แพ็กเกจฟรีของ Render จะหลับเมื่อไม่มีคนใช้ request แรกหลังหลับอาจช้า 30-60 วินาที

### Railway

1. Railway > **New Project > Deploy from GitHub repo** > เลือก repo
2. Railway เจอ `package.json` แล้วรัน `npm install` / `npm start` ให้เอง
3. **Variables** > ใส่ตัวแปรจาก `.env` (ไม่ต้องใส่ `PORT`)
4. **Settings > Networking > Generate Domain** เพื่อได้ URL สาธารณะ
5. ตั้ง Healthcheck Path เป็น `/api/health` ใน Settings > Deploy

ถ้า host หน้าเว็บแยกจาก backend: ตั้ง `SEPARATE_API_URL` ใน `js/config.js` ของ frontend และตั้ง `FRONTEND_URL` ให้ตรงกับโดเมนของหน้าเว็บ

## เตรียมก่อนวันงาน open house

ในงาน นักเรียนทุกคนที่ต่อ Wi-Fi ของงานจะออกอินเทอร์เน็ตด้วย IP สาธารณะเดียวกัน ถ้าไม่ตั้งค่าตามนี้ ระบบจะบล็อกคนทั้งงาน (ผลจาก load test จริง)

1. **Supabase Auth rate limit** ⚠️ สำคัญที่สุด
   Supabase จำกัดการ login ต่อ IP และทุก login ผ่าน backend จึงมาจาก IP ของ server ทั้งหมด จาก load test login พร้อมกันได้ประมาณ 30 ครั้ง ครั้งที่เกินจะได้ `over_request_rate_limit`
   ให้ไปที่ Supabase > **Authentication > Rate Limits** แล้วเพิ่ม "sign-ups and sign-ins" และ "token refreshes" ให้พอกับจำนวนคน เช่น 1000 ต่อ 5 นาที
   ระหว่างนั้น backend จะตอบ 429 `RATE_LIMITED` (ไม่ได้ทำให้ผู้ใช้หลุดออกจากระบบ) ให้ frontend แสดง "รอสักครู่แล้วลองใหม่"
2. **`RATE_LIMIT_SHARED_IPS`** ใส่ IP สาธารณะของ Wi-Fi ในงาน (ต่อ Wi-Fi นั้นแล้วเปิด <https://api.ipify.org> ดู) limit ที่นับต่อ IP เช่น การสมัคร, demo, และ login รวมต่อ IP จะคูณด้วย `RATE_LIMIT_SHARED_MULTIPLIER` (ค่าเริ่มต้น 30)
   ส่วนการใช้งานทั่วไปหลัง login นับต่อ token อยู่แล้ว และ login นับต่อ IP+อีเมล คนในงานจึงไม่แย่งโควตากัน
3. **`AI_DAILY_LIMIT`** โควตา AI ทั้งระบบต่อวัน (ค่าเริ่มต้น 1000 ครั้ง) ถ้าคาดว่ามีนักเรียน 300 คน คนละ 5–6 ครั้ง ควรตั้ง 2000–3000 และดูงบ Gemini ประกอบ
4. **ลอง load test** กับ server ที่ deploy แล้ว (จะสร้างบัญชีทดลอง และลบให้เองตอนจบ)

   ```bash
   node scripts/load-test.js --url https://<backend> --users 100
   node scripts/load-test.js --url https://<backend> --users 10 --ai 1   # ใช้ Gemini จริง มีค่าใช้จ่าย
   ```

   ผลบนเครื่องพัฒนา (Supabase จริง, mock AI): 50 คนพร้อมกัน endpoint ทั่วไปใช้เวลา p95 ต่ำกว่า 1.5 วินาที ส่วน Gemini จริง 10 คนพร้อมกันใช้ 18–23 วินาที ไม่มี error
5. **กันเซิร์ฟเวอร์หลับ** Render แบบฟรีจะหลับเมื่อไม่มีคนใช้ 15 นาที คนแรกที่เข้ามาจะรอ 30–60 วินาที
   - ตั้ง `KEEP_ALIVE_URL` เป็น URL สาธารณะของ backend แล้ว server จะ ping ตัวเองทุก 10 นาที
   - ทางที่ดีกว่าคือตั้ง uptime monitor ภายนอก (เช่น UptimeRobot หรือ cron-job.org) ให้ยิง `GET /api/health/deep` ทุก 5 นาที ได้ทั้งปลุก server และได้แจ้งเตือนเมื่อ `status` เป็น `down` (HTTP 503)
6. **เช็กสถานะเช้าวันงาน** เปิด `/api/health/deep` ต้องเห็น `status: "ok"`, `db.ok: true`, `auth.mode: "local_jwks"` และ `ai.configured: true` ระหว่างงานใช้ดู `ai.daily_used` เทียบกับ `daily_limit` ได้
7. **ถ้า Gemini ล่มกลางงาน** endpoint AI จะตอบผลล่าสุดของนักเรียน หรือผลตัวอย่างที่มีป้ายบอก (`fallback` ใน response ดู API.md) แทนหน้า error แชทยังได้ error ตามปกติ
