// Hits every endpoint in mock mode: no real Gemini, fake Supabase.
// run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'true';
process.env.FRONTEND_URL = 'http://localhost:3000';
// pinned so a developer's .env (Live Server URLs etc.) can't change what the tests expect
process.env.PASSWORD_RESET_REDIRECT_URL = 'http://localhost:3000/reset-password';
process.env.SHARE_BASE_URL = 'http://localhost:3000/share';
process.env.CORS_ORIGINS = '';
// loosen the limits we're not testing so the suite doesn't trip over them
process.env.RATE_LIMIT_GENERAL_PER_15MIN = '1000';
process.env.RATE_LIMIT_AUTH_PER_15MIN = '1000';
process.env.RATE_LIMIT_REGISTER_PER_HOUR = '12';
process.env.AI_DAILY_LIMIT = '1000';
process.env.REQUEST_TIMEOUT_MS = '1000';
process.env.STATS_MIN_GROUP = '1';
process.env.RATE_LIMIT_SHARED_IPS = '203.0.113.0/24, 2001:db8::1, not-an-ip';
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';

const { createFakeSupabase } = await import('./fakeSupabase.js');
const { setSupabaseFactoryForTests } = await import('../src/config/supabase.js');
const { createApp } = await import('../src/app.js');
const { createDailyCounter } = await import('../src/middlewares/rateLimit.js');
const aiSchemas = await import('../src/schemas/ai.schema.js');
const { toGeminiSchema } = await import('../src/utils/geminiSchema.js');
const { QUESTIONS } = await import('../src/data/assessmentQuestions.js');
const { importTcasData, buildTcasContext } = await import('../src/services/tcas.service.js');
const { tcasImportSchema } = await import('../src/schemas/tcas.schema.js');
const { tcasBlock } = await import('../src/prompts/shared.js');
const { extractSources, toGeminiTurns } = await import('../src/services/ai.service.js');
const { overview } = await import('../src/services/stats.service.js');
const { setJwksFetchForTests, revokeUserTokens } = await import('../src/services/token.service.js');
const { aiOrFallback } = await import('../src/services/aiFallback.js');
const { recommend, createTcasPlan } = await import('../src/services/recommend.service.js');
const { AppError } = await import('../src/utils/AppError.js');
const scoring = await import('../src/services/scoring.js');
const { bangkokDay, addDays } = await import('../src/utils/date.js');
const { sweepDemoAccounts } = await import('../src/services/demo.service.js');
const { parseCutoffSheet } = await import('../scripts/import-cutoffs.js');

const fake = createFakeSupabase();
setSupabaseFactoryForTests(fake.factory);

let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, { body, token, headers = {}, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text, headers: res.headers };
}

const expectError = (r, status, code) => {
  assert.equal(r.status, status, r.text);
  assert.equal(r.json.success, false);
  assert.equal(r.json.error.code, code);
  assert.ok(r.json.error.message.length > 0);
};

const fullAnswers = () => QUESTIONS.map((q, i) => ({ question_id: q.id, value: (i % 5) + 1 }));

const register = (email, extra = {}) =>
  call('POST', '/api/auth/register', {
    body: { email, password: 'password123', display_name: 'ทดสอบ', accept_terms: true, ...extra },
  });

const EMAIL = 'student@test.com';
let password = 'password123';
let token;
let refreshToken;

// ---------- system ----------

test('GET /api/health', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { status: 'ok' });
});

test('CORS only allows FRONTEND_URL', async () => {
  const good = await call('GET', '/api/health', { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  const bad = await call('GET', '/api/health', { headers: { Origin: 'http://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('unknown endpoint -> 404 in the standard shape', async () => {
  expectError(await call('GET', '/api/nope'), 404, 'NOT_FOUND');
});

test('the backend serves the PC UI on the same origin, with a page CSP', async () => {
  const page = await call('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.text, /<script src="js\/api.js"><\/script>/);
  const csp = page.headers.get('content-security-policy');
  // Tailwind is a local stylesheet now (css/tailwind.css): no third-party script origin
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(page.text, /<link rel="stylesheet" href="css\/tailwind.css">/);
  assert.equal((await call('GET', '/css/tailwind.css')).status, 200);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);

  assert.equal((await call('GET', '/share.html')).status, 200);
  assert.equal((await call('GET', '/js/config.js')).status, 200);
  // nothing outside the UI folder, no dotfiles
  assert.equal((await call('GET', '/../pathfinder-backend/.env')).status, 404);
  assert.equal((await call('GET', '/%2e%2e/%2e%2e/pathfinder-backend/.env')).status, 404);
  assert.equal((await call('GET', '/.env')).status, 404);
  // the API keeps its own 404s
  expectError(await call('GET', '/api/nope'), 404, 'NOT_FOUND');
});

test('broken JSON -> 400 INVALID_JSON', async () => {
  expectError(await call('POST', '/api/auth/login', { raw: '{bad' }), 400, 'INVALID_JSON');
});

test('every response carries a request id, errors repeat it in the body', async () => {
  const ok = await call('GET', '/api/health');
  assert.match(ok.headers.get('x-request-id'), /^[\w-]{8,64}$/);

  const err = await call('GET', '/api/nope');
  assert.equal(err.json.error.request_id, err.headers.get('x-request-id'));

  // a sane incoming id is reused, junk is replaced
  const mine = await call('GET', '/api/health', { headers: { 'X-Request-Id': 'frontend-1234abcd' } });
  assert.equal(mine.headers.get('x-request-id'), 'frontend-1234abcd');
  const junk = await call('GET', '/api/health', { headers: { 'X-Request-Id': 'bad id!' } });
  assert.notEqual(junk.headers.get('x-request-id'), 'bad id!');
});

test('GET /api/schools search', async () => {
  assert.equal((await call('GET', '/api/schools?q=สาธิต')).json.data.length, 1);
  assert.equal((await call('GET', '/api/schools?province=เชียงใหม่')).json.data[0].name, 'โรงเรียนสาธิตทดสอบ');
  assert.equal((await call('GET', '/api/schools?q=%25')).json.data.length, 0); // "%" is literal, not a wildcard
  assert.equal((await call('GET', '/api/schools?limit=1')).json.data.length, 1);
  expectError(await call('GET', '/api/schools?limit=1000'), 400, 'VALIDATION_ERROR');
});

// ---------- TCAS data ----------

// made-up university so nothing here looks like real admission data
const TCAS = {
  academic_year: 2569,
  programs: [
    {
      university: 'มหาวิทยาลัยตัวอย่าง',
      faculty: 'วิศวกรรมศาสตร์',
      program: 'วิศวกรรมคอมพิวเตอร์',
      admissions: [
        { round: 3, project_name: 'Admission', seats: 60, score_weights: { TGAT: 20, TPAT3: 30 }, last_year_min_score: 62.5 },
        { round: 1, project_name: 'Portfolio', seats: 30, min_gpax: 3 },
      ],
    },
    { university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'แพทยศาสตร์', program: 'แพทยศาสตรบัณฑิต' },
  ],
  calendar: [{ round: 1, event: 'ยื่นพอร์ตรอบ 1', start_date: '2026-02-01' }],
};

test('TCAS import upserts programs and replaces admissions', async () => {
  const data = tcasImportSchema.parse(TCAS);
  assert.deepEqual(await importTcasData(fake.factory(), data), { academic_year: 2569, programs: 2, admissions: 2, calendar: 1 });

  // importing the same file again must not duplicate anything
  await importTcasData(fake.factory(), data);
  assert.equal(fake.tables.tcas_programs.length, 2);
  assert.equal(fake.tables.tcas_admissions.length, 2);
  assert.equal(fake.tables.tcas_calendar.length, 1);

  const template = JSON.parse(await readFile(new URL('../tcas-data/template.json', import.meta.url), 'utf8'));
  assert.ok(tcasImportSchema.safeParse(template).success, 'template.json should be importable');

  const bad = { academic_year: 2569, programs: [{ university: 'x', faculty: 'y', program: 'z', admissions: [{ round: 5, project_name: 'a' }] }] };
  assert.equal(tcasImportSchema.safeParse(bad).success, false);
});

test('GET /api/tcas/programs, /programs/:id, /calendar', async () => {
  // "คณะ" and "ม." get stripped so loose spellings still match
  const found = await call('GET', `/api/tcas/programs?q=${encodeURIComponent('คณะวิศวกรรมคอมพิวเตอร์')}&university=${encodeURIComponent('ม.ตัวอย่าง')}`);
  assert.equal(found.status, 200);
  assert.equal(found.json.data.academic_year, 2569);
  assert.equal(found.json.data.items.length, 1);

  assert.equal((await call('GET', `/api/tcas/programs?q=${encodeURIComponent('แพทย')}`)).json.data.items.length, 1);
  assert.equal((await call('GET', `/api/tcas/programs?university=${encodeURIComponent('มหาวิทยาลัยอื่น')}`)).json.data.items.length, 0);
  // filter syntax characters in the query can't break the request
  assert.equal((await call('GET', `/api/tcas/programs?q=${encodeURIComponent('a,b),or(x')}`)).status, 200);

  const id = found.json.data.items[0].id;
  const detail = await call('GET', `/api/tcas/programs/${id}`);
  assert.deepEqual(detail.json.data.admissions.map((a) => a.round), [1, 3]);
  expectError(await call('GET', '/api/tcas/programs/00000000-0000-4000-8000-000000000000'), 404, 'NOT_FOUND');
  expectError(await call('GET', '/api/tcas/programs/nope'), 400, 'VALIDATION_ERROR');

  const cal = await call('GET', '/api/tcas/calendar');
  assert.equal(cal.json.data.items[0].event, 'ยื่นพอร์ตรอบ 1');
});

test('program search ranks the best match first', async () => {
  await importTcasData(fake.factory(), tcasImportSchema.parse({
    academic_year: 2569,
    programs: [
      { university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'ทันตแพทยศาสตร์', program: 'ทันตแพทยศาสตรบัณฑิต (ภาษาไทย ปกติ)' },
      { university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'วิทยาศาสตร์', program: 'วท.บ. สาขาวิชาวิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)' },
      { university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'วิศวกรรมศาสตร์', program: 'วศ.บ. สาขาวิชาวิศวกรรมคอมพิวเตอร์ (ภาษาไทย พิเศษ)' },
    ],
  }));
  const first = async (q) => (await call('GET', `/api/tcas/programs?q=${encodeURIComponent(q)}`)).json.data.items.map((p) => p.program);

  // "แพทยศาสตร์" (with ์) must still find แพทยศาสตรบัณฑิต, and rank it above dentistry
  const med = await first('แพทยศาสตร์');
  assert.equal(med[0], 'แพทยศาสตรบัณฑิต');
  assert.ok(med.includes('ทันตแพทยศาสตรบัณฑิต (ภาษาไทย ปกติ)'));

  assert.equal((await first('คณะทันตแพทยศาสตร์'))[0], 'ทันตแพทยศาสตรบัณฑิต (ภาษาไทย ปกติ)');

  // regular Thai track before the special one for the same name
  const cpe = await first('วิศวกรรมคอมพิวเตอร์');
  assert.equal(cpe[0], 'วิศวกรรมคอมพิวเตอร์');
  assert.equal((await first('วิทยาการคอมพิวเตอร์'))[0], 'วท.บ. สาขาวิชาวิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)');
});

test('per-university calendar rows: own import scope + filtering', async () => {
  const uniCal = tcasImportSchema.parse({
    academic_year: 2569,
    calendar: [
      { university: 'มหาวิทยาลัยตัวอย่าง', round: 1, event: 'รอบ 1.1 รับสมัคร', start_date: '2025-10-01', end_date: '2025-10-15' },
      { university: 'มหาวิทยาลัยอื่น', round: 2, event: 'รอบ 2 รับสมัคร', start_date: '2026-03-15' },
    ],
  });
  await importTcasData(fake.factory(), uniCal);
  // the central row from the earlier import must survive
  assert.equal(fake.tables.tcas_calendar.filter((c) => !c.university).length, 1);
  assert.equal(fake.tables.tcas_calendar.length, 3);

  // re-importing one university only replaces that university's rows
  await importTcasData(fake.factory(), tcasImportSchema.parse({
    academic_year: 2569,
    calendar: [{ university: 'มหาวิทยาลัยตัวอย่าง', round: 1, event: 'รอบ 1.1 รับสมัคร (แก้ไข)', start_date: '2025-10-02' }],
  }));
  assert.equal(fake.tables.tcas_calendar.length, 3);
  assert.ok(fake.tables.tcas_calendar.some((c) => c.event === 'รอบ 1.1 รับสมัคร (แก้ไข)'));
  assert.ok(fake.tables.tcas_calendar.some((c) => c.university === 'มหาวิทยาลัยอื่น'));

  // API: central only by default, plus the asked-for university
  assert.equal((await call('GET', '/api/tcas/calendar')).json.data.items.length, 1);
  const withUni = await call('GET', `/api/tcas/calendar?university=${encodeURIComponent('ม.ตัวอย่าง')}`);
  assert.deepEqual(withUni.json.data.items.map((c) => c.university ?? null).sort(), [null, 'มหาวิทยาลัยตัวอย่าง'].sort());

  // and the AI context picks up the target university's dates
  const ctx = await buildTcasContext([{ faculty: 'วิศวกรรมคอมพิวเตอร์', university: 'มหาวิทยาลัยตัวอย่าง' }], fake.factory());
  assert.ok(ctx.calendar.some((c) => c.university === 'มหาวิทยาลัยตัวอย่าง'));
  assert.ok(!ctx.calendar.some((c) => c.university === 'มหาวิทยาลัยอื่น'));
});

test('scoring: subject names from both sides map to the same code', () => {
  assert.equal(scoring.weightCode('TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์'), 'TPAT3');
  assert.equal(scoring.weightCode('TGAT1 การสื่อสารภาษาอังกฤษ'), 'TGAT1');
  assert.equal(scoring.weightCode('TGAT'), 'TGAT');
  assert.equal(scoring.weightCode('A-Level คณิตศาสตร์ประยุกต์ 1'), 'A61');
  assert.equal(scoring.weightCode('A-Level คณิตศาสตร์ประยุกต์ 2'), 'A62');
  assert.equal(scoring.weightCode('สัมภาษณ์'), 'INTERVIEW');

  assert.equal(scoring.examCode({ exam_type: 'TGAT', subject: 'TGAT รวม' }), 'TGAT');
  assert.equal(scoring.examCode({ exam_type: 'TGAT', subject: 'การสื่อสารภาษาอังกฤษ' }), 'TGAT1');
  assert.equal(scoring.examCode({ exam_type: 'TPAT', subject: 'TPAT3' }), 'TPAT3');
  assert.equal(scoring.examCode({ exam_type: 'A-Level', subject: 'คณิต 1' }), 'A61');
  assert.equal(scoring.examCode({ exam_type: 'A-Level', subject: 'ฟิสิกส์' }), 'A64');
});

test('scoring: weighted score, partial score and eligibility', () => {
  const map = scoring.buildScoreMap(
    [
      { exam_type: 'TGAT', subject: 'TGAT1', score: 60, max_score: 100 },
      { exam_type: 'TGAT', subject: 'TGAT2', score: 80, max_score: 100 },
      { exam_type: 'TGAT', subject: 'TGAT3', score: 70, max_score: 100 },
      { exam_type: 'TPAT', subject: 'TPAT3', score: 40, max_score: 100 },
      { exam_type: 'TPAT', subject: 'TPAT3', score: 55, max_score: 100 }, // retake, best counts
    ],
    3.2,
  );
  assert.equal(map.get('TGAT'), 70); // filled in from the 3 parts
  assert.equal(map.get('TPAT3'), 55);
  assert.equal(map.get('GPAX'), 80);

  const full = scoring.computeScore({ TGAT: 20, 'TPAT3 วิทยาศาสตร์': 30, GPAX: 50 }, map);
  assert.equal(full.weighted_score, (20 * 70 + 30 * 55 + 50 * 80) / 100);

  const partial = scoring.computeScore({ TGAT: 40, 'A-Level ฟิสิกส์': 60 }, map);
  assert.equal(partial.weighted_score, null);
  assert.equal(partial.partial_score, 28);
  assert.equal(partial.max_possible, 88);
  assert.equal(partial.missing[0].subject, 'A-Level ฟิสิกส์');

  const today = '2026-11-24';
  const ok = scoring.checkEligibility({ min_gpax: 3, apply_end: '2026-12-01' }, { gpax: 3.2, score: full, today });
  assert.equal(ok.status, 'eligible');
  assert.equal(scoring.checkEligibility({ min_gpax: 3.5 }, { gpax: 3.2, score: full, today }).status, 'not_eligible');
  assert.equal(scoring.checkEligibility({ apply_end: '2026-11-01' }, { gpax: 3.2, score: full, today }).status, 'closed');
  assert.equal(scoring.checkEligibility({}, { gpax: 3.2, score: partial, today }).status, 'missing_scores');
  // our own "ต้องมีคะแนน X" lines are not an extra requirement
  assert.equal(scoring.checkEligibility({ requirements: 'ต้องมีคะแนน TGAT, ต้องมีคะแนน TPAT3' }, { gpax: 3.2, score: full, today }).status, 'eligible');
  assert.equal(scoring.checkEligibility({ requirements: 'แฟ้มผลงานไม่เกิน 10 หน้า' }, { gpax: 3.2, score: full, today }).status, 'check_requirements');
});

test('extractSources pulls deduped web sources out of grounding metadata', () => {
  const res = {
    candidates: [
      {
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: 'https://www.mytcas.com/a', title: 'myTCAS' } },
            { web: { uri: 'https://www.mytcas.com/a', title: 'dup' } },
            { web: { uri: 'https://uni.example/b' } },
            { retrievedContext: {} },
          ],
        },
      },
    ],
  };
  assert.deepEqual(extractSources(res), [
    { title: 'myTCAS', url: 'https://www.mytcas.com/a' },
    { title: 'https://uni.example/b', url: 'https://uni.example/b' },
  ]);
  assert.deepEqual(extractSources({}), []);
});

test('every AI schema converts to a Gemini responseSchema', () => {
  for (const name of ['assessmentAiSchema', 'facultiesAiSchema', 'careersAiSchema', 'tcasPlanAiSchema', 'portfolioAiSchema', 'skillsAiSchema']) {
    const s = toGeminiSchema(aiSchemas[name]);
    assert.equal(s.type, 'OBJECT', name);
    assert.ok(s.required.length > 0, name);
  }
  const f = toGeminiSchema(aiSchemas.facultiesAiSchema);
  // bounds become hints, not constraints (real Gemini rejects big constrained schemas)
  const recs = f.properties.recommendations;
  assert.equal(recs.minItems, undefined);
  assert.match(recs.description, /\(5-\d+ items\)$/);
  const ms = recs.items.properties.match_score;
  assert.equal(ms.type, 'INTEGER');
  assert.equal(ms.maximum, undefined);
  assert.match(ms.description, /\(0-100\)$/);
  // no constraint keys anywhere in any schema
  for (const name of Object.keys(aiSchemas).filter((k) => k.endsWith('AiSchema'))) {
    assert.ok(!/"(minItems|maxItems|minimum|maximum)"/.test(JSON.stringify(toGeminiSchema(aiSchemas[name]))), name);
  }
});

test('shared venue IPs get multiplied per-IP limits', async () => {
  const { isSharedIp, perIp } = await import('../src/middlewares/rateLimit.js');
  assert.equal(isSharedIp('203.0.113.7'), true); // inside the /24
  assert.equal(isSharedIp('::ffff:203.0.113.7'), true); // same IPv4 through an IPv6 socket
  assert.equal(isSharedIp('2001:db8::1'), true);
  assert.equal(isSharedIp('198.51.100.1'), false);
  assert.equal(isSharedIp(undefined), false);
  assert.equal(perIp(5)({ ip: '203.0.113.7' }), 150); // x30 default
  assert.equal(perIp(5)({ ip: '198.51.100.1' }), 5);
});

test('daily AI cap counts per Bangkok day', () => {
  let t = Date.parse('2026-11-24T10:00:00Z');
  const c = createDailyCounter({ limit: 2, now: () => t });
  assert.equal(c.take(), true);
  assert.equal(c.take(), true);
  assert.equal(c.take(), false);
  t = Date.parse('2026-11-24T16:59:00Z'); // 23:59 in Bangkok, same day
  assert.equal(c.take(), false);
  t = Date.parse('2026-11-24T17:00:00Z'); // midnight in Bangkok -> new day
  assert.equal(c.take(), true);
});

// ---------- auth / public ----------

test('GET /api/schools and /api/grade-levels', async () => {
  const s = await call('GET', '/api/schools');
  assert.equal(s.status, 200);
  assert.equal(s.json.success, true);
  assert.equal(s.json.data.length, 2);
  const g = await call('GET', '/api/grade-levels');
  assert.deepEqual(g.json.data.map((x) => x.code), ['M4', 'M5', 'M6']);
});

test('POST /api/auth/register', async () => {
  expectError(await register('bad'), 400, 'VALIDATION_ERROR');
  expectError(await register('x@test.com', { school_id: 999 }), 400, 'VALIDATION_ERROR');
  expectError(await register('x@test.com', { accept_terms: false }), 400, 'VALIDATION_ERROR');

  const r = await register('Student@Test.com', { display_name: 'น้องเอ', school_id: 1, grade_level_id: 2 });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.user.email, EMAIL);
  assert.ok(r.json.data.session.access_token);
  assert.equal(r.json.data.requires_email_confirmation, false);

  const profile = fake.tables.profiles.find((p) => p.id === r.json.data.user.id);
  assert.equal(profile.terms_version, '1.0');
  assert.ok(profile.terms_accepted_at);

  expectError(await register(EMAIL), 400, 'EMAIL_TAKEN');
});

test('POST /api/auth/login', async () => {
  expectError(await call('POST', '/api/auth/login', { body: { email: EMAIL, password: 'wrongpass' } }), 401, 'INVALID_CREDENTIALS');
  const r = await call('POST', '/api/auth/login', { body: { email: EMAIL, password } });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.access_token);
  assert.ok(r.json.data.refresh_token);
  assert.equal(r.json.data.user.display_name, 'น้องเอ');
  token = r.json.data.access_token;
  refreshToken = r.json.data.refresh_token;
});

test('POST /api/auth/refresh', async () => {
  expectError(await call('POST', '/api/auth/refresh', { body: { refresh_token: 'nope' } }), 401, 'INVALID_REFRESH_TOKEN');
  const r = await call('POST', '/api/auth/refresh', { body: { refresh_token: refreshToken } });
  assert.equal(r.status, 200);
  token = r.json.data.access_token;
});

test('Supabase auth busy (429) -> 429 RATE_LIMITED, never "logged out" or "link expired"', async () => {
  const fresh = (await call('POST', '/api/auth/login', { body: { email: EMAIL, password } })).json.data;
  refreshToken = fresh.refresh_token;
  fake.state.authBusy = true;
  try {
    expectError(await call('POST', '/api/auth/login', { body: { email: EMAIL, password } }), 429, 'RATE_LIMITED');
    // a 401 here would make the frontend throw the session away
    expectError(await call('POST', '/api/auth/refresh', { body: { refresh_token: refreshToken } }), 429, 'RATE_LIMITED');
    expectError(await call('POST', '/api/auth/reset-password', { body: { token_hash: 'th_x', password: 'whatever123' } }), 429, 'RATE_LIMITED');
    expectError(await call('POST', '/api/auth/demo'), 429, 'RATE_LIMITED');
    // token checks on every request too: busy must not look like an expired token
    expectError(await call('GET', '/api/me', { token: fresh.access_token }), 429, 'RATE_LIMITED');
  } finally {
    fake.state.authBusy = false;
  }
  // the refresh token is still good afterwards
  const r = await call('POST', '/api/auth/refresh', { body: { refresh_token: refreshToken } });
  assert.equal(r.status, 200, r.text);
  refreshToken = r.json.data.refresh_token;
  token = r.json.data.access_token;
});

test('forgot + reset password', async () => {
  // same answer whether the account exists or not
  const unknown = await call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@test.com' } });
  assert.equal(unknown.status, 200);
  assert.equal(fake.state.lastReset, null);

  const known = await call('POST', '/api/auth/forgot-password', { body: { email: EMAIL } });
  assert.equal(known.status, 200);
  assert.equal(known.json.data.message, unknown.json.data.message);
  assert.equal(fake.state.lastReset.redirectTo, 'http://localhost:3000/reset-password');
  const { token_hash } = fake.state.lastReset;

  expectError(await call('POST', '/api/auth/reset-password', { body: { token_hash: 'nope', password: 'newpass123' } }), 400, 'INVALID_RESET_TOKEN');
  expectError(await call('POST', '/api/auth/reset-password', { body: { token_hash, password: 'short' } }), 400, 'VALIDATION_ERROR');

  const r = await call('POST', '/api/auth/reset-password', { body: { token_hash, password: 'newpass123' } });
  assert.equal(r.status, 200, r.text);

  // all old sessions are gone and the link is single-use
  expectError(await call('GET', '/api/profile', { token }), 401, 'INVALID_TOKEN');
  expectError(await call('POST', '/api/auth/reset-password', { body: { token_hash, password: 'again1234' } }), 400, 'INVALID_RESET_TOKEN');
  expectError(await call('POST', '/api/auth/login', { body: { email: EMAIL, password } }), 401, 'INVALID_CREDENTIALS');

  password = 'newpass123';
  const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password } });
  assert.equal(login.status, 200);
  token = login.json.data.access_token;
});

// ---------- profile ----------

test('no token / bad token -> 401', async () => {
  expectError(await call('GET', '/api/profile'), 401, 'UNAUTHORIZED');
  expectError(await call('GET', '/api/profile', { token: 'garbage' }), 401, 'INVALID_TOKEN');
});

test('GET/PUT /api/profile', async () => {
  const g = await call('GET', '/api/profile', { token });
  assert.equal(g.status, 200);
  assert.equal(g.json.data.display_name, 'น้องเอ');

  const p = await call('PUT', '/api/profile', {
    token,
    body: {
      gpax: 3.45,
      subject_grades: { คณิตศาสตร์: 4, ฟิสิกส์: 3.5 },
      interests: ['เทคโนโลยี', 'หุ่นยนต์'],
      skills: ['Python'],
      activities: [{ name: 'ค่ายคอมพิวเตอร์', role: 'ผู้เข้าร่วม', year: 2568 }],
      awards: [{ name: 'เหรียญทองแดงโครงงาน', level: 'จังหวัด' }],
      target_faculties: [{ faculty: 'วิศวกรรมคอมพิวเตอร์', university: 'มหาวิทยาลัยเกษตรศาสตร์' }],
    },
  });
  assert.equal(p.status, 200, p.text);
  assert.equal(p.json.data.gpax, 3.45);
  assert.deepEqual(p.json.data.interests, ['เทคโนโลยี', 'หุ่นยนต์']);

  expectError(await call('PUT', '/api/profile', { token, body: { gpax: 5 } }), 400, 'VALIDATION_ERROR');
  expectError(await call('PUT', '/api/profile', { token, body: { email: 'x@y.com' } }), 400, 'VALIDATION_ERROR');
  expectError(await call('PUT', '/api/profile', { token, body: { terms_version: '9.9' } }), 400, 'VALIDATION_ERROR');
  expectError(await call('PUT', '/api/profile', { token, body: {} }), 400, 'VALIDATION_ERROR');
  expectError(await call('PUT', '/api/profile', { token, body: { grade_level_id: 99 } }), 400, 'VALIDATION_ERROR');
});

test('exam-scores: add / list / delete', async () => {
  expectError(
    await call('POST', '/api/exam-scores', { token, body: { exam_type: 'TGAT', subject: 'TGAT1', score: 120, max_score: 100 } }),
    400,
    'VALIDATION_ERROR',
  );
  expectError(await call('POST', '/api/exam-scores', { token, body: { exam_type: 'GAT', subject: 'x', score: 1, max_score: 2 } }), 400, 'VALIDATION_ERROR');

  const c = await call('POST', '/api/exam-scores', {
    token,
    body: { exam_type: 'TPAT', subject: 'TPAT3', score: 62.5, max_score: 100, taken_at: '2026-10-01' },
  });
  assert.equal(c.status, 201, c.text);
  const id = c.json.data.id;

  const l = await call('GET', '/api/exam-scores', { token });
  assert.equal(l.json.data.length, 1);
  assert.equal(l.json.data[0].subject, 'TPAT3');

  expectError(await call('DELETE', '/api/exam-scores/not-a-uuid', { token }), 400, 'VALIDATION_ERROR');
  assert.equal((await call('DELETE', `/api/exam-scores/${id}`, { token })).status, 200);
  expectError(await call('DELETE', `/api/exam-scores/${id}`, { token }), 404, 'NOT_FOUND');

  // keep one around for the export test
  await call('POST', '/api/exam-scores', { token, body: { exam_type: 'TGAT', subject: 'TGAT รวม', score: 70, max_score: 100 } });
});

// ---------- AI ----------

test('GET /api/assessment/questions', async () => {
  const r = await call('GET', '/api/assessment/questions', { token });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.questions.length >= 20 && r.json.data.questions.length <= 30);
  assert.equal(r.json.data.scale.length, 5);
});

test('POST /api/assessment/analyze', async () => {
  expectError(await call('POST', '/api/assessment/analyze', { token, body: { answers: fullAnswers().slice(0, 5) } }), 400, 'INCOMPLETE_ANSWERS');
  expectError(await call('POST', '/api/assessment/analyze', { token, body: { answers: [{ question_id: 'R1', value: 9 }] } }), 400, 'VALIDATION_ERROR');

  const r = await call('POST', '/api/assessment/analyze', { token, body: { answers: fullAnswers() } });
  assert.equal(r.status, 201, r.text);
  const { result } = r.json.data;
  assert.match(result.riasec_code, /^[RIASEC]{3}$/);
  assert.deepEqual(Object.keys(result.scores.riasec).sort(), ['A', 'C', 'E', 'I', 'R', 'S']);
  assert.ok(Object.values(result.scores.riasec).every((v) => v >= 0 && v <= 100));
});

test('POST /api/recommend/faculties', async () => {
  const r = await call('POST', '/api/recommend/faculties', { token });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.type, 'faculty');
  const { recommendations, verify_note } = r.json.data.result;
  assert.ok(recommendations.length >= 5 && recommendations.length <= 8);
  for (const k of ['faculty', 'university_examples', 'match_score', 'reasons', 'related_careers', 'key_subjects', 'gap_to_close']) {
    assert.ok(k in recommendations[0], k);
  }
  assert.match(verify_note, /mytcas\.com/);
});

test('POST /api/recommend/careers', async () => {
  const r = await call('POST', '/api/recommend/careers', { token, body: { faculty: 'วิศวกรรมคอมพิวเตอร์' } });
  assert.equal(r.status, 201, r.text);
  const c = r.json.data.result.careers[0];
  for (const k of ['career', 'description', 'future_trend', 'salary_range_note', 'required_skills', 'match_score']) assert.ok(k in c, k);
  assert.equal(r.json.data.result.faculty, 'วิศวกรรมคอมพิวเตอร์');
});

test('POST /api/plan/tcas', async () => {
  expectError(await call('POST', '/api/plan/tcas', { token, body: { target_faculty: 'วิศวะ' } }), 400, 'VALIDATION_ERROR');
  const r = await call('POST', '/api/plan/tcas', {
    token,
    body: { target_faculty: 'วิศวกรรมคอมพิวเตอร์', target_university: 'มหาวิทยาลัยเกษตรศาสตร์' },
  });
  assert.equal(r.status, 201, r.text);
  const { plan, target } = r.json.data;
  assert.equal(target.university, 'มหาวิทยาลัยเกษตรศาสตร์');
  assert.deepEqual(plan.rounds.map((x) => x.round), [1, 2, 3, 4]);
  assert.ok(plan.timeline.length > 0 && plan.score_targets.length > 0 && plan.checklist.length > 0);
  assert.match(plan.verify_note, /mytcas\.com/);
});

test('AI endpoints stream progress when asked (Accept: text/event-stream)', async () => {
  const sse = { Accept: 'text/event-stream' };
  let r = await call('POST', '/api/plan/tcas', {
    token,
    headers: sse,
    body: { target_faculty: 'วิศวกรรมคอมพิวเตอร์', target_university: 'มหาวิทยาลัยเกษตรศาสตร์', force: true },
  });
  assert.equal(r.status, 200, r.text);
  assert.match(r.headers.get('content-type'), /text\/event-stream/);
  const events = [...r.text.matchAll(/event: (\w+)\ndata: (.*)/g)].map(([, e, d]) => [e, JSON.parse(d)]);
  const stages = events.filter(([e]) => e === 'progress').map(([, d]) => d.stage);
  assert.deepEqual(stages.slice(0, 3), ['started', 'profile', 'tcas_data']);
  assert.ok(stages.includes('saving'));
  const [last, done] = events.at(-1);
  assert.equal(last, 'done');
  assert.equal(done.status, 201);
  assert.deepEqual(done.data.plan.rounds.map((x) => x.round), [1, 2, 3, 4]);
  // later tests count plans
  assert.equal((await call('DELETE', `/api/history/tcas/${done.data.id}`, { token })).status, 200);

  // errors after the stream started come as an event, in the right language
  r = await call('POST', '/api/assessment/analyze', { token, headers: { ...sse, 'X-Lang': 'en' }, body: { answers: [{ question_id: 'R1', value: 3 }] } });
  const err = [...r.text.matchAll(/event: error\ndata: (.*)/g)].map(([, d]) => JSON.parse(d))[0];
  assert.equal(err.code, 'INCOMPLETE_ANSWERS');
  assert.equal(err.message, 'Please answer every question first.');

  // validation / auth still fail as normal JSON, before any stream starts
  expectError(await call('POST', '/api/plan/tcas', { token, headers: sse, body: {} }), 400, 'VALIDATION_ERROR');
  expectError(await call('POST', '/api/plan/tcas', { headers: sse, body: {} }), 401, 'UNAUTHORIZED');
});

test('POST /api/recommend/portfolio', async () => {
  const r = await call('POST', '/api/recommend/portfolio', { token, body: {} });
  assert.equal(r.status, 201, r.text);
  const idea = r.json.data.result.ideas[0];
  for (const k of ['title', 'description', 'difficulty', 'duration', 'skills_gained', 'how_to_start']) assert.ok(k in idea, k);
});

test('POST /api/recommend/skills', async () => {
  const r = await call('POST', '/api/recommend/skills', { token });
  assert.equal(r.status, 201, r.text);
  assert.ok(r.json.data.result.skills.length >= 3);
  assert.ok(r.json.data.result.learning_path.length >= 2);
});

test('unknown body fields -> 400', async () => {
  expectError(await call('POST', '/api/recommend/faculties', { token, body: { hack: 1 } }), 400, 'VALIDATION_ERROR');
});

test('POST /api/chat streams SSE and saves to chat_messages', async () => {
  expectError(await call('POST', '/api/chat', { token, body: { message: '' } }), 400, 'VALIDATION_ERROR');

  const r = await call('POST', '/api/chat', { token, body: { message: 'อยากเข้าวิศวะคอม ต้องเตรียมอะไรบ้าง' } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/event-stream/);

  const events = r.text
    .trim()
    .split('\n\n')
    .map((block) => ({
      event: block.match(/^event: (.+)$/m)[1],
      data: JSON.parse(block.match(/^data: (.+)$/m)[1]),
    }));
  const deltas = events.filter((e) => e.event === 'delta');
  const done = events.at(-1);
  assert.ok(deltas.length > 1);
  assert.equal(done.event, 'done');
  assert.equal(done.data.content, deltas.map((d) => d.data.text).join(''));
  assert.deepEqual(done.data.sources, []); // no web search in mock mode

  const h = await call('GET', '/api/history?type=chat', { token });
  assert.deepEqual(h.json.data.items.map((m) => m.role), ['user', 'assistant']);
});

test('GET /api/history', async () => {
  const all = await call('GET', '/api/history', { token });
  assert.equal(all.status, 200);
  for (const k of ['faculty', 'career', 'portfolio', 'skill', 'tcas', 'assessment']) {
    assert.equal(all.json.data[k].length, 1, k);
  }
  const f = await call('GET', '/api/history?type=faculty&limit=5', { token });
  assert.equal(f.json.data.type, 'faculty');
  assert.equal(f.json.data.items.length, 1);
  expectError(await call('GET', '/api/history?type=nope', { token }), 400, 'VALIDATION_ERROR');
});

test('data sent to the AI has no email/name/school', async () => {
  const { buildStudentContext } = await import('../src/services/student.service.js');
  const userId = fake.tables.profiles.find((p) => p.display_name === 'น้องเอ').id;
  const ctx = await buildStudentContext(fake.factory(), userId);
  const json = JSON.stringify(ctx);
  assert.ok(!json.includes(EMAIL));
  assert.ok(!json.includes('น้องเอ'));
  assert.ok(!('school_id' in ctx) && !('display_name' in ctx) && !('id' in ctx));
  assert.equal(ctx.gpax, 3.45);
  assert.equal(ctx.grade_level, 'มัธยมศึกษาปีที่ 5');
});

test('AI rate limit: more than 20/hour -> 429', async () => {
  const reg = await register('limit@test.com');
  const t = reg.json.data.session.access_token;
  // force skips the cache, so every call really "hits" the AI
  const body = { force: true };
  for (let i = 0; i < 20; i++) {
    const r = await call('POST', '/api/recommend/skills', { token: t, body });
    assert.equal(r.status, 201, `call ${i + 1}`);
  }
  expectError(await call('POST', '/api/recommend/skills', { token: t, body }), 429, 'RATE_LIMITED');
  // counted per user, so someone else is still fine
  assert.equal((await call('POST', '/api/recommend/skills', { token, body })).status, 201);
});

test('AI answers are reused while nothing changes', async () => {
  const t = (await register('cache@test.com')).json.data.session.access_token;
  // both limiters write into RateLimit, the AI one's policy is named "20-in-1hr"-ish
  const remaining = (r) => Number(r.headers.get('ratelimit').match(/"20-in[^"]*";\s*r=(\d+)/)[1]);

  const first = await call('POST', '/api/recommend/faculties', { token: t });
  assert.equal(first.status, 201);
  assert.equal(first.json.data.cached, false);

  const second = await call('POST', '/api/recommend/faculties', { token: t });
  assert.equal(second.status, 200);
  assert.equal(second.json.data.cached, true);
  assert.equal(second.json.data.id, first.json.data.id);

  // cached calls give their rate limit hit back
  const third = await call('POST', '/api/recommend/faculties', { token: t });
  assert.equal(remaining(third), remaining(second));

  const forced = await call('POST', '/api/recommend/faculties', { token: t, body: { force: true } });
  assert.equal(forced.status, 201);
  assert.notEqual(forced.json.data.id, first.json.data.id);

  // profile changed -> different input -> fresh answer
  await call('PUT', '/api/profile', { token: t, body: { interests: ['ดนตรี'] } });
  const afterEdit = await call('POST', '/api/recommend/faculties', { token: t });
  assert.equal(afterEdit.json.data.cached, false);

  // careers: a different faculty is a different question
  const c1 = await call('POST', '/api/recommend/careers', { token: t, body: { faculty: 'แพทยศาสตร์' } });
  const c2 = await call('POST', '/api/recommend/careers', { token: t, body: { faculty: 'แพทยศาสตร์' } });
  const c3 = await call('POST', '/api/recommend/careers', { token: t, body: { faculty: 'นิติศาสตร์' } });
  assert.deepEqual([c1.json.data.cached, c2.json.data.cached, c3.json.data.cached], [false, true, false]);

  // assessment: same answers in another order still count as the same
  const answers = fullAnswers();
  const a1 = await call('POST', '/api/assessment/analyze', { token: t, body: { answers } });
  const a2 = await call('POST', '/api/assessment/analyze', { token: t, body: { answers: [...answers].reverse() } });
  assert.equal(a1.json.data.cached, false);
  assert.equal(a2.json.data.cached, true);
});

test('slow database -> 500 REQUEST_TIMEOUT instead of hanging', async () => {
  fake.state.delayMs = 1500;
  try {
    const r = await call('GET', '/api/exam-scores', { token });
    expectError(r, 500, 'REQUEST_TIMEOUT');
    assert.equal(r.json.error.request_id, r.headers.get('x-request-id'));
    // let the abandoned handler finish, it must not crash anything
    await new Promise((res) => setTimeout(res, 700));
  } finally {
    fake.state.delayMs = 0;
  }
  assert.equal((await call('GET', '/api/exam-scores', { token })).status, 200);
});

// ---------- account / PDPA ----------

test('consent status + accept', async () => {
  const g = await call('GET', '/api/account/consent', { token });
  assert.equal(g.status, 200);
  assert.equal(g.json.data.current_version, '1.0');
  assert.equal(g.json.data.accepted_version, '1.0');
  assert.equal(g.json.data.needs_consent, false);

  // pretend the user signed up under an older version
  fake.tables.profiles.find((p) => p.display_name === 'น้องเอ').terms_version = '0.9';
  assert.equal((await call('GET', '/api/account/consent', { token })).json.data.needs_consent, true);

  const p = await call('POST', '/api/account/consent', { token });
  assert.equal(p.status, 200);
  assert.equal(p.json.data.needs_consent, false);
});

test('GET /api/account/export', async () => {
  const r = await call('GET', '/api/account/export', { token });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  const d = r.json.data;
  assert.equal(d.account.email, EMAIL);
  assert.equal(d.profile.display_name, 'น้องเอ');
  assert.equal(d.exam_scores.length, 1);
  assert.equal(d.chat_messages.length, 2);
  assert.ok(d.recommendations.length >= 4);
  assert.equal(d.tcas_plans.length, 1);
  assert.equal(d.assessments.length, 1);
});

test('DELETE /api/history/:type/:id', async () => {
  const { items } = (await call('GET', '/api/history?type=faculty', { token })).json.data;
  const id = items[0].id;

  // wrong type for that id -> not found, nothing deleted
  expectError(await call('DELETE', `/api/history/career/${id}`, { token }), 404, 'NOT_FOUND');
  expectError(await call('DELETE', `/api/history/chat/${id}`, { token }), 400, 'VALIDATION_ERROR');

  assert.equal((await call('DELETE', `/api/history/faculty/${id}`, { token })).status, 200);
  expectError(await call('DELETE', `/api/history/faculty/${id}`, { token }), 404, 'NOT_FOUND');
  assert.equal((await call('GET', '/api/history?type=faculty', { token })).json.data.items.length, 0);
});

test('DELETE /api/chat/messages', async () => {
  const r = await call('DELETE', '/api/chat/messages', { token });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.deleted, 2);
  assert.equal((await call('GET', '/api/history?type=chat', { token })).json.data.items.length, 0);
});

test('AI prompts get real TCAS data for the target program', async () => {
  const ctx = await buildTcasContext([{ faculty: 'วิศวกรรมคอมพิวเตอร์', university: 'ม.ตัวอย่าง' }], fake.factory());
  assert.equal(ctx.academic_year, 2569);
  // the plain program + the special-track one added by the ranking test
  assert.equal(ctx.programs.length, 2);
  const cpe = ctx.programs.find((p) => p.program === 'วิศวกรรมคอมพิวเตอร์');
  assert.equal(cpe.admissions.find((a) => a.round === 3).last_year_min_score, 62.5);
  // central row + the target university's own row (from the per-university test)
  assert.equal(ctx.calendar.length, 2);

  const block = tcasBlock(ctx, { webSearch: true });
  assert.match(block, /ปีการศึกษา 2569/);
  assert.match(block, /62\.5/);
  assert.match(block, /mytcas\.com/);
  assert.match(tcasBlock(null), /ยังไม่มีข้อมูล TCAS/);

  // matched in the db -> plan says so
  const hit = await call('POST', '/api/plan/tcas', {
    token,
    body: { target_faculty: 'คณะวิศวกรรมคอมพิวเตอร์', target_university: 'ม.ตัวอย่าง' },
  });
  assert.equal(hit.status, 201, hit.text);
  assert.deepEqual(hit.json.data.plan.tcas_data, { academic_year: 2569, programs_found: 2 });
  assert.deepEqual(hit.json.data.plan.web_sources, []);

  // not in the db -> programs_found 0 (real mode would fall back to web search here)
  const miss = await call('POST', '/api/plan/tcas', {
    token,
    body: { target_faculty: 'สัตวแพทยศาสตร์', target_university: 'มหาวิทยาลัยอื่น' },
  });
  assert.equal(miss.json.data.plan.tcas_data.programs_found, 0);
});

// ---------- planner: check / compare / saved / deadlines / stats ----------

const programId = async (program) => (await call('GET', `/api/tcas/programs?q=${encodeURIComponent(program)}`)).json.data.items.find((p) => p.program === program).id;

test('GET /api/tcas/programs/:id/check - your score + eligibility per project', async () => {
  const id = await programId('วิศวกรรมคอมพิวเตอร์');
  expectError(await call('GET', `/api/tcas/programs/${id}/check`), 401, 'UNAUTHORIZED');

  // the user has TGAT 70 but no TPAT3 yet
  let r = await call('GET', `/api/tcas/programs/${id}/check`, { token });
  assert.equal(r.status, 200, r.text);
  let r3 = r.json.data.admissions.find((a) => a.round === 3);
  assert.equal(r3.score.weighted_score, null);
  assert.equal(r3.score.partial_score, 28); // 70 * 20 / 50
  assert.equal(r3.eligibility.status, 'missing_scores');
  const r1 = r.json.data.admissions.find((a) => a.round === 1);
  assert.equal(r1.eligibility.status, 'eligible'); // min GPAX 3, user has 3.45

  await call('POST', '/api/exam-scores', { token, body: { exam_type: 'TPAT', subject: 'TPAT3', score: 80, max_score: 100 } });
  r = await call('GET', `/api/tcas/programs/${id}/check`, { token });
  r3 = r.json.data.admissions.find((a) => a.round === 3);
  assert.equal(r3.score.weighted_score, 76); // (20*70 + 30*80) / 50
  assert.equal(r3.gap_to_last_year, 13.5); // 76 - 62.5
  assert.equal(r3.eligibility.status, 'eligible');
  assert.equal(r.json.data.summary.best_score, 76);

  expectError(await call('GET', '/api/tcas/programs/00000000-0000-4000-8000-000000000000/check', { token }), 404, 'NOT_FOUND');
});

let nitet;
test('saved programs + compare', async () => {
  const soon = addDays(bangkokDay(), 5);
  await importTcasData(fake.factory(), tcasImportSchema.parse({
    academic_year: 2569,
    programs: [{
      university: 'มหาวิทยาลัยตัวอย่าง',
      faculty: 'นิเทศศาสตร์',
      program: 'นิเทศศาสตรบัณฑิต',
      admissions: [
        { round: 1, project_name: 'Portfolio นิเทศ', seats: 20, apply_end: soon },
        { round: 1, project_name: 'Portfolio นิเทศ รอบหลัง', seats: 10, apply_end: addDays(bangkokDay(), 60) },
      ],
    }],
  }));
  nitet = await programId('นิเทศศาสตรบัณฑิต');
  const cpe = await programId('วิศวกรรมคอมพิวเตอร์');

  expectError(await call('POST', '/api/saved-programs', { token, body: { program_id: '00000000-0000-4000-8000-000000000000' } }), 404, 'NOT_FOUND');
  assert.equal((await call('POST', '/api/saved-programs', { token, body: { program_id: nitet } })).status, 201);
  // saving again just updates the note
  assert.equal((await call('POST', '/api/saved-programs', { token, body: { program_id: nitet, note: 'สนใจ' } })).status, 201);
  const list = await call('GET', '/api/saved-programs', { token });
  assert.equal(list.json.data.length, 1);
  assert.equal(list.json.data[0].note, 'สนใจ');
  assert.equal(list.json.data[0].program.program, 'นิเทศศาสตรบัณฑิต');

  const cmp = await call('GET', `/api/tcas/compare?ids=${cpe},${nitet}`, { token });
  assert.equal(cmp.status, 200, cmp.text);
  assert.deepEqual(cmp.json.data.programs.map((p) => p.program), ['วิศวกรรมคอมพิวเตอร์', 'นิเทศศาสตรบัณฑิต']);
  assert.ok('summary' in cmp.json.data.programs[0]);
  expectError(await call('GET', `/api/tcas/compare?ids=${cpe}`, { token }), 400, 'VALIDATION_ERROR');
  expectError(await call('GET', `/api/tcas/compare?ids=${cpe},${nitet},${cpe},${nitet},${cpe}`, { token }), 400, 'VALIDATION_ERROR');
});

test('GET /api/tcas/deadlines - saved programs + their university calendar', async () => {
  await importTcasData(fake.factory(), tcasImportSchema.parse({
    academic_year: 2569,
    calendar: [{ university: 'มหาวิทยาลัยตัวอย่าง', round: 2, event: 'รอบ 2 รับสมัคร', start_date: addDays(bangkokDay(), 10), end_date: addDays(bangkokDay(), 20) }],
  }));

  const r = await call('GET', '/api/tcas/deadlines?days=30', { token });
  assert.equal(r.status, 200, r.text);
  const titles = r.json.data.items.map((i) => i.title);
  assert.ok(titles.includes('ปิดรับสมัคร Portfolio นิเทศ'));
  assert.ok(!titles.includes('ปิดรับสมัคร Portfolio นิเทศ รอบหลัง')); // 60 days out
  assert.ok(titles.includes('รอบ 2 รับสมัคร'));
  // sorted by date
  const dates = r.json.data.items.map((i) => i.date);
  assert.deepEqual(dates, [...dates].sort());

  expectError(await call('GET', '/api/tcas/deadlines?days=999', { token }), 400, 'VALIDATION_ERROR');
});

test('DELETE /api/saved-programs/:programId', async () => {
  assert.equal((await call('DELETE', `/api/saved-programs/${nitet}`, { token })).status, 200);
  expectError(await call('DELETE', `/api/saved-programs/${nitet}`, { token }), 404, 'NOT_FOUND');
});

test('re-import with replace keeps ids of programs that stay, drops the rest', async () => {
  const before = await programId('วิศวกรรมคอมพิวเตอร์');
  await new Promise((r) => setTimeout(r, 5)); // make sure "now" moves on
  await importTcasData(fake.factory(), { ...tcasImportSchema.parse(TCAS), replace: true });
  assert.equal(await programId('วิศวกรรมคอมพิวเตอร์'), before);
  assert.ok(!fake.tables.tcas_programs.some((p) => p.program === 'นิเทศศาสตรบัณฑิต'));
  assert.equal(fake.tables.tcas_programs.length, 2);
});

// ---------- cutoffs, simulator, roadmap, profile settings, demo, coach ----------

test('cutoff sheet parser finds columns by header text', () => {
  const rows = parseCutoffSheet(
    [
      { A: 'สถาบัน', C: 'รหัสหลักสูตร', H: 'รายละเอียด', I: 'สาขา/วิชาเอก', K: 'รับ', N: 'คะแนนสูงสุด', O: 'คะแนนต่ำสุด', R: 'คะแนนต่ำสุด DS' },
      { A: 'มหาวิทยาลัยตัวอย่าง', C: 'TEST0000000001A', H: 'Admission', K: '60', N: '85.5', O: '60.1234567', R: '59.9' },
      { A: 'มหาวิทยาลัยตัวอย่าง', C: 'TEST0000000002A', I: 'ฟิสิกส์', K: '5', N: '0', O: '0' },
      { A: 'รวม' }, // footer rows without a code are skipped
    ],
    2569,
    'https://assets.mytcas.com/x.xlsx',
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { code: rows[0].program_code, detail: rows[0].detail, seats: rows[0].seats, min: rows[0].min_score, final: rows[0].min_score_final },
    { code: 'TEST0000000001A', detail: 'Admission', seats: 60, min: 60.1235, final: 59.9 },
  );
  assert.equal(rows[1].detail, 'ฟิสิกส์'); // falls back to the major
  assert.throws(() => parseCutoffSheet([{ A: 'อะไรก็ไม่รู้' }], 2569, 'x'), /สถาบัน/);
});

test('scoring: cutoffs match by project, zone + buffer', () => {
  const cutoffs = [
    { academic_year: 2569, detail: 'Admission  รูปแบบที่ 1', min_score: 60, max_score: 85 },
    { academic_year: 2569, detail: 'Admission รูปแบบที่ 2', min_score: 40, max_score: 70 },
    { academic_year: 2568, detail: null, min_score: 58, max_score: 80 }, // only row that year -> program level
    { academic_year: 2567, detail: 'อื่น', min_score: 50 },
    { academic_year: 2567, detail: 'อื่นอีก', min_score: 52 }, // two rows, no match -> skipped
  ];
  const h = scoring.matchCutoffs({ project_name: 'Admission รูปแบบที่ 1' }, cutoffs);
  assert.deepEqual(h.map((x) => [x.academic_year, x.min_score, x.match]), [[2569, 60, 'project'], [2568, 58, 'program']]);

  assert.equal(scoring.scoreZone(86, h).zone, 'safe'); // >= max(60, 58) + 3
  assert.equal(scoring.scoreZone(62, h).zone, 'target');
  assert.equal(scoring.scoreZone(58.5, h).buffer, -1.5);
  assert.equal(scoring.scoreZone(58.5, h).zone, 'target');
  assert.equal(scoring.scoreZone(50, h).zone, 'reach');
  assert.equal(scoring.scoreZone(72.5, h).position_in_last_year_range, 50);
  assert.equal(scoring.scoreZone(50, []), null);
  // nobody admitted (min 0) is not a cutoff
  assert.deepEqual(scoring.matchCutoffs({ project_name: 'x' }, [{ academic_year: 2569, detail: 'x', min_score: 0 }]), []);
});

let cpeId;
test('POST /api/tcas/programs/:id/simulate - public, uses official cutoffs', async () => {
  cpeId = await programId('วิศวกรรมคอมพิวเตอร์');
  fake.tables.tcas_programs.find((p) => p.id === cpeId).url = 'https://course.mytcas.com/programs/TEST0000000001A';
  const src = 'https://assets.mytcas.com/test.xlsx';
  fake.tables.tcas_cutoffs.push(
    { academic_year: 2568, program_code: 'TEST0000000001A', detail: 'Admission', min_score: 60, max_score: 85, seats: 60, applicants: 300, source_url: src },
    { academic_year: 2567, program_code: 'TEST0000000001A', detail: null, min_score: 58, max_score: 80, source_url: src },
    { academic_year: 2568, program_code: 'OTHER00000001A', detail: 'Admission', min_score: 99, source_url: src },
  );

  const sim = (scores) => call('POST', `/api/tcas/programs/${cpeId}/simulate`, { body: { scores } });
  let r = await sim([{ exam_type: 'TGAT', subject: 'TGAT', score: 80 }, { exam_type: 'TPAT', subject: 'TPAT3', score: 90 }]);
  assert.equal(r.status, 200, r.text);
  const a = r.json.data.admissions.find((x) => x.round === 3);
  assert.equal(a.score.weighted_score, 86); // (20*80 + 30*90) / 50
  assert.deepEqual(a.cutoff_history.map((h) => h.academic_year), [2568, 2567]);
  assert.equal(a.zone.zone, 'safe');
  assert.equal(a.zone.buffer, 26);
  assert.equal(r.json.data.best.zone.zone, 'safe');
  assert.ok(!r.json.data.admissions.some((x) => x.round === 1)); // portfolio has no weights
  assert.match(r.json.data.verify_note, /mytcas\.com/);

  r = await sim([{ exam_type: 'TGAT', subject: 'TGAT', score: 60 }, { exam_type: 'TPAT', subject: 'TPAT3', score: 58 }]);
  assert.equal(r.json.data.best.zone.zone, 'target'); // 58.8, 1.2 under last year
  r = await sim([{ exam_type: 'TGAT', subject: 'TGAT', score: 40 }]);
  assert.equal(r.json.data.admissions[0].zone, null); // TPAT3 missing -> no full score, no zone

  expectError(await sim([{ exam_type: 'TGAT', score: 120 }]), 400, 'VALIDATION_ERROR');
  expectError(await call('POST', `/api/tcas/programs/${cpeId}/simulate`, { body: {} }), 400, 'VALIDATION_ERROR');

  // /check now uses the official cutoff instead of the hand-entered one (76 - 60)
  const check = await call('GET', `/api/tcas/programs/${cpeId}/check`, { token });
  const c3 = check.json.data.admissions.find((x) => x.round === 3);
  assert.equal(c3.last_year_min_score, 60);
  assert.equal(c3.gap_to_last_year, 16);
  assert.equal(c3.zone.zone, 'safe');
});

test('GET/PATCH /api/me/state - synced app state, merged', async () => {
  expectError(await call('GET', '/api/me/state'), 401, 'UNAUTHORIZED');
  let r = await call('GET', '/api/me/state', { token });
  assert.deepEqual(r.json.data.state, {});

  r = await call('PATCH', '/api/me/state', {
    token,
    body: { lang: 'en', beyond_4: true, weekly_hours: 12, target_programs: [cpeId], behavior: { visited_pages: ['home'] } },
  });
  assert.equal(r.status, 200, r.text);
  r = await call('PATCH', '/api/me/state', { token, body: { lang: 'th', behavior: { last_action: 'open_simulator' } } });
  const s = r.json.data.state;
  assert.equal(s.lang, 'th');
  assert.equal(s.weekly_hours, 12); // untouched keys stay
  assert.deepEqual(s.behavior, { visited_pages: ['home'], last_action: 'open_simulator' }); // behavior merges

  expectError(await call('PATCH', '/api/me/state', { token, body: {} }), 400, 'VALIDATION_ERROR');
  expectError(await call('PATCH', '/api/me/state', { token, body: { email: 'x@y.z' } }), 400, 'VALIDATION_ERROR');
  expectError(await call('PATCH', '/api/me/state', { token, body: { target_programs: [cpeId, cpeId, cpeId, cpeId] } }), 400, 'VALIDATION_ERROR');
});

test('/api/my-plan - targets, checklist items, progress, reset', async () => {
  let r = await call('GET', '/api/my-plan', { token });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.targets[0].rank, 1);
  assert.equal(r.json.data.targets[0].program.id, cpeId);
  assert.deepEqual(r.json.data.targets[0].rounds.map((x) => x.available), [true, false, true, false]);
  assert.deepEqual(r.json.data.items, []);

  // frontend-generated item: first PATCH needs a title
  expectError(await call('PATCH', '/api/my-plan/items/r3-tpat3-practice', { token, body: { status: 'done' } }), 400, 'ITEM_TITLE_REQUIRED');
  r = await call('PATCH', '/api/my-plan/items/r3-tpat3-practice', { token, body: { title: 'ทำข้อสอบเก่า TPAT3', round: 3, tier: 'required' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.status, 'todo');
  r = await call('PATCH', '/api/my-plan/items/r3-tpat3-practice', { token, body: { status: 'done' } });
  assert.equal(r.json.data.status, 'done');
  assert.equal(r.json.data.title, 'ทำข้อสอบเก่า TPAT3');
  expectError(await call('PATCH', '/api/my-plan/items/bad key!', { token, body: { status: 'done' } }), 400, 'VALIDATION_ERROR');
  // a task the student added on a device keeps the frontend's key
  r = await call('PATCH', '/api/my-plan/items/1-r1-custom-1700000000000', { token, body: { title: 'สรุปสูตร "ฟิสิกส์"', round: 1, tier: 'required', source: 'custom' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.source, 'custom');
  assert.equal((await call('DELETE', '/api/my-plan/items/1-r1-custom-1700000000000', { token })).status, 200); // keep the counts below as they were

  r = await call('PUT', '/api/my-plan/items', {
    token,
    body: { items: [
      { id: 'r1-portfolio', title: 'ทำพอร์ต 10 หน้า', round: 1, tier: 'required', due_date: addDays(bangkokDay(), 14) },
      { id: 'opt-camp', title: 'เข้าค่าย', tier: 'optional', status: 'dismissed' },
    ] },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.items.length, 3);

  r = await call('POST', '/api/my-plan/items', { token, body: { title: 'อ่านฟิสิกส์บทไฟฟ้า', round: 3, due_date: addDays(bangkokDay(), 7) } });
  assert.equal(r.status, 201, r.text);
  const custom = r.json.data;
  assert.match(custom.id, /^custom-/);
  assert.equal(custom.source, 'custom');

  r = await call('GET', '/api/my-plan', { token });
  assert.deepEqual(r.json.data.items.map((i) => i.id), ['r1-portfolio', 'r3-tpat3-practice', custom.id, 'opt-camp']);
  assert.deepEqual({ done: r.json.data.progress.done, total: r.json.data.progress.total }, { done: 1, total: 3 }); // dismissed doesn't count

  const ics = await call('GET', '/api/my-plan/calendar.ics', { token });
  assert.equal(ics.status, 200);
  assert.match(ics.headers.get('content-type'), /text\/calendar/);
  assert.match(ics.text, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics.text, /SUMMARY:อ่านฟิสิกส์บทไฟฟ้า/);
  assert.ok(!/เข้าค่าย/.test(ics.text)); // dismissed + no date
  assert.ok(ics.text.split('\r\n').every((line) => Buffer.byteLength(line) <= 75)); // folded

  const pub = await call('GET', '/api/tcas/calendar.ics');
  assert.equal(pub.status, 200);
  assert.match(pub.text, /BEGIN:VEVENT/);

  assert.equal((await call('DELETE', `/api/my-plan/items/${custom.id}`, { token })).status, 200);
  expectError(await call('DELETE', `/api/my-plan/items/${custom.id}`, { token }), 404, 'NOT_FOUND');

  // export carries the new tables
  const exp = await call('GET', '/api/account/export', { token });
  assert.equal(exp.json.data.plan_items.length, 3);
  assert.equal(exp.json.data.user_state.length, 1);

  r = await call('POST', '/api/my-plan/reset', { token });
  assert.equal(r.json.data.deleted_items, 3);
  const state = (await call('GET', '/api/me/state', { token })).json.data.state;
  assert.equal(state.target_programs, undefined);
  assert.equal(state.lang, 'th'); // non-plan state survives
});

test('regressions: duplicate ids, high_yield in history', async () => {
  // same id twice in one sync -> last one wins instead of a postgres "affect row a second time" error
  const r = await call('PUT', '/api/my-plan/items', {
    token,
    body: { items: [{ id: 'dup-1', title: 'เก่า' }, { id: 'dup-1', title: 'ใหม่', status: 'done' }] },
  });
  assert.equal(r.status, 200, r.text);
  const dup = r.json.data.items.filter((i) => i.id === 'dup-1');
  assert.equal(dup.length, 1);
  assert.equal(dup[0].title, 'ใหม่');
  await call('DELETE', '/api/my-plan/items/dup-1', { token });

  expectError(await call('PATCH', '/api/me/state', { token, body: { target_programs: [cpeId, cpeId] } }), 400, 'VALIDATION_ERROR');

  await call('POST', '/api/coach/high-yield', { token, body: { subject: 'คณิต' } });
  const h = await call('GET', '/api/history?type=high_yield', { token });
  assert.equal(h.status, 200, h.text);
  assert.ok(h.json.data.items.length >= 1);
  assert.equal((await call('DELETE', `/api/history/high_yield/${h.json.data.items[0].id}`, { token })).status, 200);
});

test('profile settings fields + avatar upload', async () => {
  let r = await call('PUT', '/api/profile', {
    token,
    body: { nickname: 'มิ้นท์', bio: 'อยากเป็นวิศวกร', target_tcas_year: 2570, avatar_icon: 'robot', avatar_frame_color: '#A3E635' },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.nickname, 'มิ้นท์');
  expectError(await call('PUT', '/api/profile', { token, body: { avatar_frame_color: 'red' } }), 400, 'VALIDATION_ERROR');
  expectError(await call('PUT', '/api/profile', { token, body: { avatar_url: 'https://evil.example/x.png' } }), 400, 'VALIDATION_ERROR');

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const upload = (body, type) =>
    fetch(`${base}/api/profile/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': type }, body });

  let res = await upload(png, 'image/png');
  let json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  assert.match(json.data.avatar_url, /\/avatars\/[0-9a-f-]+\/\d+\.png$/);
  // a second upload replaces the first file
  await upload(png, 'image/png');
  assert.equal([...fake.files.keys()].filter((k) => k.startsWith('avatars/')).length, 1);

  // says png, isn't
  res = await upload(Buffer.from('<?php echo 1; ?>'), 'image/png');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_IMAGE');
  res = await upload(Buffer.alloc(3 * 1024 * 1024, 1), 'image/png');
  assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE');

  r = await call('DELETE', '/api/profile/avatar', { token });
  assert.equal(r.json.data.avatar_url, null);
  assert.equal([...fake.files.keys()].filter((k) => k.startsWith('avatars/')).length, 0);

  // none of the settings fields reach the AI
  const ctx = await buildStudentContextFor();
  assert.ok(!/มิ้นท์|อยากเป็นวิศวกร|robot/.test(JSON.stringify(ctx)));
});

async function buildStudentContextFor() {
  const { buildStudentContext } = await import('../src/services/student.service.js');
  const me = (await call('GET', '/api/profile', { token })).json.data;
  return buildStudentContext(fake.factory(), me.id);
}

test('POST /api/chat with attachments: checked, sent with the message, only the name is stored', async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]).toString('base64');
  const pdfBytes = Buffer.from('%PDF-1.4 test').toString('base64');
  // its own account: these AI calls must not use up the main test user's hourly AI quota
  const token = (await register('attach@test.com')).json.data.session.access_token;
  const file = (name, mime_type, data) => ({ name, mime_type, data });
  const parse = (txt) => txt.trim().split('\n\n').map((b) => ({ event: b.match(/^event: (.+)$/m)[1], data: JSON.parse(b.match(/^data: (.+)$/m)[1]) }));

  const r = await call('POST', '/api/chat', { token, body: { message: 'ช่วยดูตารางสอบนี้หน่อย', attachments: [file('ตาราง.png', 'image/png', png), file('แผน.pdf', 'application/pdf', pdfBytes)] } });
  assert.equal(r.status, 200, r.text);
  const done = parse(r.text).at(-1);
  assert.equal(done.event, 'done');
  assert.match(done.data.content, /ตาราง\.png/); // mock reply names the files it got

  const h = await call('GET', '/api/history?type=chat&limit=50', { token });
  const saved = h.json.data.items.filter((m) => m.role === 'user').at(-1).content;
  assert.match(saved, /📎 ตาราง\.png, แผน\.pdf$/);
  assert.ok(!saved.includes(png.slice(0, 20)), 'file data is not stored');

  // declared type must match the content, max 3 files, max 4 MB each, known types only
  expectError(await call('POST', '/api/chat', { token, body: { message: 'x', attachments: [file('a.png', 'image/png', pdfBytes)] } }), 400, 'VALIDATION_ERROR');
  expectError(await call('POST', '/api/chat', { token, body: { message: 'x', attachments: [1, 2, 3, 4].map((i) => file(i + '.png', 'image/png', png)) } }), 400, 'VALIDATION_ERROR');
  const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(4 * 1024 * 1024 + 10)]).toString('base64');
  expectError(await call('POST', '/api/chat', { token, body: { message: 'x', attachments: [file('big.png', 'image/png', big)] } }), 400, 'VALIDATION_ERROR');
  expectError(await call('POST', '/api/chat', { token, body: { message: 'x', attachments: [file('a.exe', 'application/x-msdownload', png)] } }), 400, 'VALIDATION_ERROR');
  // other routes keep the small body limit
  assert.ok([400, 413].includes((await call('POST', '/api/match/programs', { body: { interests: ['tech-ai'], custom_text: 'x'.repeat(1_200_000) } })).status));
});

test('POST /api/chat accepts page context', async () => {
  const r = await call('POST', '/api/chat', {
    token,
    body: { message: 'ควรอ่านอะไรก่อน', context: { page: 'simulator', program_id: cpeId, simulated_score: 58.8, gap_subjects: [{ subject: 'TPAT3', gap: -5 }], roadmap: { done: 1, total: 3 } } },
  });
  assert.equal(r.status, 200, r.text);
  assert.match(r.text, /event: done/);
  expectError(await call('POST', '/api/chat', { token, body: { message: 'hi', context: { email: 'a@b.c' } } }), 400, 'VALIDATION_ERROR');
});

test('POST /api/coach/high-yield - AI quota + cache', async () => {
  expectError(await call('POST', '/api/coach/high-yield', { body: { subject: 'ฟิสิกส์' } }), 401, 'UNAUTHORIZED');
  expectError(await call('POST', '/api/coach/high-yield', { token, body: {} }), 400, 'VALIDATION_ERROR');
  const body = { subject: 'A-Level ฟิสิกส์', current_score: 48, target_score: 65, weekly_hours: 6 };
  let r = await call('POST', '/api/coach/high-yield', { token, body });
  assert.equal(r.status, 201, r.text);
  assert.ok(r.json.data.result.chapters.length >= 3);
  assert.match(r.json.data.result.verify_note, /mytcas\.com/);
  r = await call('POST', '/api/coach/high-yield', { token, body });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.cached, true);
});

test('POST /api/match/programs - top real programs, one per university, refresh + AI pick', async () => {
  const { resetMatchCacheForTests } = await import('../src/services/match.service.js');
  const year = Math.max(...fake.tables.tcas_programs.map((p) => p.academic_year));
  const mk = (n, university, faculty, program, extra = {}) => ({
    id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
    academic_year: year, university, faculty, program, campus: null,
    url: `https://course.mytcas.com/programs/MATCH0000000${String(n).padStart(2, '0')}A`, tuition_note: null, ...extra,
  });
  const rows = [
    mk(1, 'มหาวิทยาลัยเกษตรศาสตร์', 'คณะวิศวกรรมศาสตร์', 'วศ.บ. วิศวกรรมคอมพิวเตอร์ (ภาษาไทย ปกติ)'),
    mk(2, 'มหาวิทยาลัยเกษตรศาสตร์', 'คณะวิทยาศาสตร์', 'วท.บ. วิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)'),
    mk(3, 'มหาวิทยาลัยมหิดล', 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร', 'วท.บ. วิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)'),
    mk(4, 'มหาวิทยาลัยบูรพา', 'คณะวิทยาการสารสนเทศ', 'วท.บ. วิศวกรรมซอฟต์แวร์ (ภาษาไทย ปกติ)'),
    mk(5, 'มหาวิทยาลัยขอนแก่น', 'คณะวิศวกรรมศาสตร์', 'วศ.บ. วิศวกรรมคอมพิวเตอร์ (ภาษาไทย ปกติ)'),
    mk(6, 'มหาวิทยาลัยศิลปากร', 'คณะวิทยาศาสตร์', 'วท.บ. วิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)'),
    mk(7, 'มหาวิทยาลัยเชียงใหม่', 'คณะวิศวกรรมศาสตร์', 'วศ.บ. วิศวกรรมคอมพิวเตอร์ (ภาษาไทย ปกติ)'),
    mk(8, 'มหาวิทยาลัยนเรศวร', 'คณะนิติศาสตร์', 'น.บ. นิติศาสตร์ (ภาษาไทย ปกติ)'), // no interest hit
    mk(9, 'มหาวิทยาลัยทักษิณ', 'คณะวิศวกรรมศาสตร์', 'วศ.บ. วิศวกรรมคอมพิวเตอร์ (ภาษาไทย ปกติ)'), // GPAX too low
  ];
  const adm = (n, program, round, extra = {}) => ({
    id: `00000000-0000-4000-9000-0000000000${String(n).padStart(2, '0')}`, program_id: rows[program - 1].id, round,
    project_name: round === 1 ? 'Portfolio' : 'Admission', seats: 10, min_gpax: null, requirements: null,
    score_weights: round === 3 ? { TGAT: 20, 'TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์': 40, 'A-Level คณิตศาสตร์ประยุกต์ 1': 40 } : null,
    last_year_min_score: null, apply_start: null, apply_end: round === 1 ? '2099-01-15' : null, source_url: null, notes: null, ...extra,
  });
  const adms = [adm(1, 1, 1, { min_gpax: 3.0 }), adm(2, 1, 3), adm(3, 3, 1), adm(4, 9, 3, { min_gpax: 3.8 })];
  const cut = { id: 'm-cut-1', program_code: 'MATCH000000001A', academic_year: year - 1, seats: 20, applicants: 900, min_score: 55.5 };
  fake.tables.tcas_programs.push(...rows);
  fake.tables.tcas_admissions.push(...adms);
  fake.tables.tcas_cutoffs.push(cut);
  resetMatchCacheForTests();
  try {
    const body = { interests: ['tech-ai', 'robotics'], gpax: 3.4, beyond_4: true, target_universities: ['ku', 'มหาวิทยาลัยบูรพา'], weekly_hours: 9 };
    let r = await call('POST', '/api/match/programs', { body });
    assert.equal(r.status, 200, r.text);
    const items = r.json.data.items;
    assert.equal(items.length, 5);
    assert.equal(new Set(items.map((i) => i.university)).size, 5, 'one program per university');
    assert.ok(!items.some((i) => i.program.includes('นิติศาสตร์')), 'no interest hit -> not shown');
    assert.ok(!items.some((i) => i.university === 'มหาวิทยาลัยทักษิณ'), 'GPAX below every minimum -> not shown');
    const ku = items[0];
    assert.equal(ku.university, 'มหาวิทยาลัยเกษตรศาสตร์'); // target uni + interests + Round 1 + GPAX
    assert.equal(ku.id, rows[0].id);
    assert.ok(ku.match_pct >= items[1].match_pct);
    assert.ok(ku.reasons.some((x) => /มหาวิทยาลัยที่คุณเลือกไว้/.test(x.th)));
    assert.ok(ku.reasons.some((x) => /Portfolio/.test(x.th)));
    assert.deepEqual(ku.last_year, { academic_year: year - 1, applicants: 900, seats: 20, lowest_min_score: 55.5 });
    assert.equal(ku.rounds[0].projects, 1);
    assert.equal(ku.rounds[0].next_apply_end, '2099-01-15');
    assert.equal(ku.weights.round, 3);
    assert.equal(ku.weights.parts[0].weight, 40);
    assert.ok(items.some((i) => i.university === 'มหาวิทยาลัยบูรพา' && i.target_university), 'typed target university counts');
    // picked universities come first, before higher-scoring others
    assert.deepEqual(items.slice(0, 2).map((i) => i.target_university), [true, true]);
    // a typed name only matches the university it starts with (not ราชภัฏ... with the same city)
    r = await call('POST', '/api/match/programs', { body: { interests: ['tech-ai'], target_universities: ['บูรพา', 'มหาวิทยาลัยที่ไม่มีจริง'] } });
    assert.equal(r.json.data.items[0].university, 'มหาวิทยาลัยบูรพา');
    assert.deepEqual(r.json.data.targets_without_match, ['มหาวิทยาลัยที่ไม่มีจริง']);

    // refresh: shown ones are excluded
    r = await call('POST', '/api/match/programs', { body: { ...body, exclude_ids: items.map((i) => i.id) } });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.items.every((i) => !items.some((x) => x.id === i.id)));
    assert.ok(r.json.data.items.some((i) => i.id === rows[1].id), 'next best of KU shows up');

    // AI refresh needs login, picks only from real candidates (mock = first ones), each with a reason.
    // its own account: the AI calls here must not use up the main test user's hourly AI quota
    const matcher = (await register('matcher@test.com')).json.data.session.access_token;
    expectError(await call('POST', '/api/match/programs/ai', { body }), 401, 'UNAUTHORIZED');
    r = await call('POST', '/api/match/programs/ai', { token: matcher, body });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.data.method, 'ai');
    assert.equal(new Set(r.json.data.items.map((i) => i.university)).size, r.json.data.items.length);
    assert.ok(r.json.data.items.every((i) => fake.tables.tcas_programs.some((x) => x.id === i.id) && i.ai_reason));

    expectError(await call('POST', '/api/match/programs', { body: { interests: [] } }), 400, 'VALIDATION_ERROR');
    // card shuffle: a liked program gets points + a reason, a skipped one never comes back
    r = await call('POST', '/api/match/programs', { body: { interests: ['tech-ai'], liked_ids: [rows[5].id], skipped_ids: [rows[2].id] } });
    assert.ok(r.json.data.items.find((i) => i.id === rows[5].id).reasons.some((x) => /ปัดถูกใจ/.test(x.th)));
    assert.ok(!r.json.data.items.some((i) => i.id === rows[2].id));
    // main vs secondary interest: the main one is named in the reasons and weighs more
    const law = (await call('POST', '/api/match/programs', { body: { interests: ['law-policy', 'tech-ai'] } })).json.data.items;
    assert.equal(law[0].program, 'น.บ. นิติศาสตร์ (ภาษาไทย ปกติ)', 'main interest (law) first');
    assert.ok(law[0].reasons.some((x) => /ความสนใจหลัก: กฎหมาย/.test(x.th)));
    assert.ok(law.slice(1).some((i) => i.reasons.some((x) => /ความสนใจรอง/.test(x.th))));
    // province: must be a real Thai province; a program in that province gets the near-home points
    expectError(await call('POST', '/api/match/programs', { body: { interests: ['tech-ai'], province: 'Atlantis' } }), 400, 'VALIDATION_ERROR');
    const { provinceOf } = await import('../src/data/provinces.js');
    assert.equal(provinceOf('002', 'ศรีราชา'), 'ชลบุรี');
    assert.equal(provinceOf('002', 'เฉลิมพระเกียรติ จ.สกลนคร'), 'สกลนคร');
    assert.equal(provinceOf('019', 'หลัก'), 'ชลบุรี');
    rows[3].campus = 'บางแสน ชลบุรี';
    resetMatchCacheForTests();
    r = await call('POST', '/api/match/programs', { body: { interests: ['tech-ai'], province: 'ชลบุรี' } });
    const buu = r.json.data.items.find((i) => i.university === 'มหาวิทยาลัยบูรพา');
    assert.equal(buu.province, 'ชลบุรี');
    assert.equal(buu.near_home, 'province');
    assert.ok(buu.reasons.some((x) => /จังหวัดเดียวกับคุณ/.test(x.th)));
    assert.equal(r.json.data.items[0].university, 'มหาวิทยาลัยบูรพา', 'near home ranks first');
    expectError(await call('POST', '/api/match/programs', { body: { interests: ['a', 'b', 'c', 'd', 'e'] } }), 400, 'VALIDATION_ERROR');

    // Step 1 free text -> interest keys (AI; mock maps the words)
    expectError(await call('POST', '/api/match/interests', { body: { text: 'ชอบเขียนโปรแกรม' } }), 401, 'UNAUTHORIZED');
    r = await call('POST', '/api/match/interests', { token: matcher, body: { text: 'ชอบวิศวกรรมคอมพิวเตอร์ และนิติศาสตร์' } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json.data.interests, ['tech-ai', 'law-policy']);
    assert.ok(r.json.data.summary);

    // same answers, different students: a per-student seed changes the order only among near-equal fits;
    // the same seed always gives the same list, the % stays the real score, targets stay first
    const tieBody = { interests: ['tech-ai'] };
    const orderFor = async (seed) => (await call('POST', '/api/match/programs', { body: { ...tieBody, ...(seed ? { variety_seed: seed } : {}) } })).json.data.items.map((i) => i.id).join(',');
    const seeds = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'];
    const orders = new Set();
    for (const sd of seeds) orders.add(await orderFor(sd));
    assert.ok(orders.size > 1, 'different seeds -> not all identical');
    assert.equal(await orderFor('a1'), await orderFor('a1'), 'same seed -> same list');
    r = await call('POST', '/api/match/programs', { body: { ...body, variety_seed: 'zz' } });
    assert.deepEqual(r.json.data.items.slice(0, 2).map((i) => i.target_university), [true, true], 'targets still first');
    expectError(await call('POST', '/api/match/programs', { body: { ...tieBody, variety_seed: 'bad seed!' } }), 400, 'VALIDATION_ERROR');

    // AI coach "แนวทาง": login, real programs only, each refresh = another angle and new programs
    expectError(await call('POST', '/api/coach/guidance', { body: tieBody }), 401, 'UNAUTHORIZED');
    const g1 = await call('POST', '/api/coach/guidance', { token: matcher, body: { ...tieBody, variety_seed: 'a1', refresh: 0 } });
    assert.equal(g1.status, 200, g1.text);
    const d1 = g1.json.data;
    assert.ok(d1.angle.key && d1.headline && d1.moves.length >= 2);
    assert.ok(d1.programs.length >= 1 && d1.programs.every((i) => fake.tables.tcas_programs.some((x) => x.id === i.id)));
    assert.equal(new Set(d1.programs.map((i) => i.university)).size, d1.programs.length, 'one per university');
    const g2 = (await call('POST', '/api/coach/guidance', { token: matcher, body: { ...tieBody, variety_seed: 'a1', refresh: 1, avoid_ids: d1.programs.map((i) => i.id) } })).json.data;
    assert.notEqual(g2.angle.key, d1.angle.key, 'refresh -> another angle');
    assert.ok(g2.programs.every((i) => !d1.programs.some((x) => x.id === i.id)), 'refresh -> programs not shown before');
  } finally {
    fake.tables.tcas_programs = fake.tables.tcas_programs.filter((p) => !rows.includes(p));
    fake.tables.tcas_admissions = fake.tables.tcas_admissions.filter((a) => !adms.includes(a));
    fake.tables.tcas_cutoffs = fake.tables.tcas_cutoffs.filter((c) => c !== cut);
    resetMatchCacheForTests();
  }
});

test('google sign-in endpoints are gone', async () => {
  assert.equal((await call('GET', '/api/auth/google')).status, 404);
  assert.equal((await call('POST', '/api/auth/google/callback', { body: { code: 'abc', code_verifier: 'x'.repeat(43) } })).status, 404);
});

test('POST /api/auth/demo - own throwaway account with sample data', async () => {
  const r = await call('POST', '/api/auth/demo');
  assert.equal(r.status, 201, r.text);
  const d = r.json.data;
  assert.equal(d.demo, true);
  assert.ok(d.demo_expires_at);
  assert.equal(d.user.email, null); // the generated address is internal

  const profile = (await call('GET', '/api/profile', { token: d.access_token })).json.data;
  assert.equal(profile.gpax, 3.45);
  assert.equal(profile.is_demo, true);
  assert.equal((await call('GET', '/api/exam-scores', { token: d.access_token })).json.data.length, 4);

  // two clicks = two separate accounts
  const other = (await call('POST', '/api/auth/demo')).json.data;
  assert.notEqual(other.user.id, d.user.id);

  // no password to type -> confirm with DELETE instead
  expectError(await call('DELETE', '/api/account', { token: other.access_token, body: {} }), 400, 'CONFIRM_REQUIRED');
  assert.equal((await call('DELETE', '/api/account', { token: other.access_token, body: { confirm: 'DELETE' } })).status, 200);

  // expired demo accounts get swept, normal accounts never
  for (const u of fake.users.values()) u.created_at = '2000-01-01T00:00:00.000Z';
  const removed = await sweepDemoAccounts({ force: true });
  assert.equal(removed, 1);
  expectError(await call('GET', '/api/profile', { token: d.access_token }), 401, 'INVALID_TOKEN');
  assert.equal((await call('GET', '/api/profile', { token })).status, 200);
});

// ---------- /me, documents, faculty groups, English ----------

test('requirements text -> criteria + documents (real myTCAS shapes)', async () => {
  const { parseRequirements, docsForRound } = await import('../src/services/requirements.js');
  let p = parseRequirements(
    '1. ประวัติผลงาน (Portfolio) (ควรมีผลงานตรงกับสาขาที่ต้องการสมัคร)  สัดส่วน 35.00\n' +
      '2.  ผลคะแนนภาษาอังกฤษ หรือระดับความสามารถในการใช้ภาษาอังกฤษ  สัดส่วน 30.00\n' +
      '3. การสอบสัมภาษณ์  สัดส่วน 35.00\n' +
      '    3.1 คำถามเชิงวิชาการ  สัดส่วนย่อย 60.00\n' +
      '4. ผู้สมัครโครงการช้างเผือก TCAS รอบที่ 1 (1.1 และ 1.2) สามารถสมัครทุนได้',
  );
  assert.deepEqual(p.criteria.map((c) => [c.weight, c.sub]), [[35, false], [30, false], [35, false], [60, true]]);
  assert.equal(p.criteria[3].item, 'คำถามเชิงวิชาการ');
  assert.deepEqual(p.documents.map((d) => [d.type, d.weight]), [['portfolio', 35], ['interview', 35], ['english_test', 30]]);
  assert.equal(p.notes.length, 1); // "(1.1 และ 1.2)" is not a weight

  p = parseRequirements('แฟ้มสะสมผลงาน ร้อยละ 40 การสัมภาษณ์ ร้อยละ 60 ตรวจสอบรายละเอียด คลิกที่ https://admission.example.ac.th/x.php?id=1775');
  assert.deepEqual(p.criteria.map((c) => c.weight), [40, 60]);
  assert.deepEqual(p.links, ['https://admission.example.ac.th/x.php?id=1775']);

  p = parseRequirements('gpa22 ขั้นต่ำ 3, gpa23 ขั้นต่ำ 3');
  assert.equal(p.conditions.length, 2);
  assert.deepEqual(parseRequirements(null).documents, []);

  const round = docsForRound([
    { requirements: 'แฟ้มสะสมผลงาน = 50%\nสอบสัมภาษณ์ = 50%' },
    { requirements: '1. แฟ้มผลงาน  สัดส่วน 100.00' },
  ]);
  assert.deepEqual(round.map((d) => [d.type, d.projects]), [['portfolio', 2], ['interview', 1]]);
});

test('GET /api/tcas/programs/:id/documents + recommended_docs in /my-plan', async () => {
  const portfolio = fake.tables.tcas_admissions.find((a) => a.program_id === cpeId && a.round === 1);
  portfolio.requirements = '1. แฟ้มสะสมผลงาน  สัดส่วน 60.00\n2. การสอบสัมภาษณ์  สัดส่วน 40.00\nแนบเกียรติบัตรการแข่งขันได้';

  const r = await call('GET', `/api/tcas/programs/${cpeId}/documents`);
  assert.equal(r.status, 200, r.text);
  const r1 = r.json.data.rounds.find((x) => x.round === 1);
  assert.deepEqual(r1.recommended_docs.map((d) => d.type), ['portfolio', 'interview', 'certificates']);
  assert.ok(r1.recommended_docs.every((d) => d.evidence && d.label_en));
  assert.equal(r1.projects[0].criteria.length, 2);

  await call('PATCH', '/api/me/state', { token, body: { target_programs: [cpeId] } });
  const plan = await call('GET', '/api/my-plan', { token });
  assert.deepEqual(plan.json.data.targets[0].rounds[0].recommended_docs.map((d) => d.type), ['portfolio', 'interview', 'certificates']);

  const check = await call('GET', `/api/tcas/programs/${cpeId}/check`, { token });
  assert.ok(check.json.data.admissions.find((a) => a.round === 1).requirements_parsed.documents.length);
});

test('faculty groups: list, popular programs by last year applicants, group simulate', async () => {
  let r = await call('GET', '/api/tcas/faculty-groups');
  assert.deepEqual(r.json.data.map((g) => g.key), ['computer-eng', 'medicine', 'bba', 'architecture-design', 'comm-arts', 'law']);

  r = await call('GET', '/api/tcas/faculty-groups/computer-eng/programs');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.items[0].id, cpeId);
  assert.equal(r.json.data.items[0].last_year.academic_year, 2568);
  assert.equal(r.json.data.items[0].last_year.applicants, 300);
  assert.equal(r.json.data.items[0].last_year.lowest_min_score, 60);

  r = await call('GET', '/api/tcas/faculty-groups/medicine/programs');
  assert.ok(r.json.data.items.some((p) => p.program === 'แพทยศาสตรบัณฑิต'));
  expectError(await call('GET', '/api/tcas/faculty-groups/astrology/programs'), 400, 'VALIDATION_ERROR');

  r = await call('POST', '/api/tcas/faculty-groups/computer-eng/simulate', {
    body: { scores: [{ exam_type: 'TGAT', subject: 'TGAT', score: 60 }, { exam_type: 'TPAT', subject: 'TPAT3', score: 58 }] },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.items[0].best.zone.zone, 'target');
  assert.deepEqual(r.json.data.summary, { safe: 0, target: 1, reach: 0, no_data: 0 });
});

test('GET /api/me - email + account type', async () => {
  expectError(await call('GET', '/api/me'), 401, 'UNAUTHORIZED');
  const r = await call('GET', '/api/me', { token });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.email, EMAIL);
  assert.equal(r.json.data.account_type, 'email');
  assert.equal(r.json.data.can_change_password, true);
  assert.equal(r.json.data.delete_confirmation, 'password');
  assert.equal(r.json.data.needs_consent, false);
  assert.equal(r.json.data.profile.nickname, 'มิ้นท์');

  const demo = (await call('POST', '/api/auth/demo')).json.data;
  const d = await call('GET', '/api/me', { token: demo.access_token });
  assert.deepEqual(
    [d.json.data.email, d.json.data.account_type, d.json.data.delete_confirmation],
    [null, 'demo', 'type_DELETE'],
  );
});

test('access tokens are verified locally (JWKS); logout / password change still end them', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'ES256', use: 'sig' };
  let jwksCalls = 0;
  setJwksFetchForTests(async (url) => {
    jwksCalls++;
    assert.equal(url, 'https://fake.supabase.co/auth/v1/.well-known/jwks.json');
    return new Response(JSON.stringify({ keys: [jwk] }));
  });
  const me = (await call('GET', '/api/me', { token })).json.data;
  const now = Math.floor(Date.now() / 1000);
  const mint = (claims = {}) => {
    const h = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'test-key', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(
      JSON.stringify({
        iss: 'https://fake.supabase.co/auth/v1',
        sub: me.id,
        role: 'authenticated',
        email: EMAIL,
        // not backdated: the reset-password test a few seconds earlier revoked this user's older tokens
        iat: now,
        exp: now + 3600,
        session_id: randomUUID(),
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        ...claims,
      }),
    ).toString('base64url');
    const sig = sign('sha256', Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    return `${h}.${p}.${sig}`;
  };

  try {
    const jwt = mint();
    // getUser would answer 429 now, so a 200 proves Supabase Auth wasn't asked
    fake.state.authBusy = true;
    let r = await call('GET', '/api/me', { token: jwt });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.data.id, me.id);
    assert.equal(r.json.data.account_type, 'email');
    assert.ok(r.json.data.created_at, 'created_at comes from the profile row');
    await call('GET', '/api/profile', { token: jwt });
    assert.equal(jwksCalls, 1, 'keys are cached');

    const [h, p] = jwt.split('.');
    expectError(await call('GET', '/api/me', { token: `${h}.${p}.${mint().split('.')[2]}` }), 401, 'INVALID_TOKEN');
    expectError(await call('GET', '/api/me', { token: mint({ exp: now - 1 }) }), 401, 'INVALID_TOKEN');
    expectError(await call('GET', '/api/me', { token: mint({ iss: 'https://evil.example/auth/v1' }) }), 401, 'INVALID_TOKEN');
    expectError(await call('GET', '/api/me', { token: mint({ role: 'anon' }) }), 401, 'INVALID_TOKEN');
    fake.state.authBusy = false;

    // logout ends that session only
    const other = mint();
    assert.equal((await call('POST', '/api/auth/logout', { token: jwt })).status, 200);
    expectError(await call('GET', '/api/me', { token: jwt }), 401, 'INVALID_TOKEN');
    assert.equal((await call('GET', '/api/me', { token: other })).status, 200);

    // password change: every older session dies except the one that changed it
    const keep = mint();
    // revocation works in whole seconds: let the clock pass the tokens' iat first
    await new Promise((r) => setTimeout(r, 1100));
    revokeUserTokens(me.id, { keepToken: keep });
    assert.equal((await call('GET', '/api/me', { token: keep })).status, 200);
    expectError(await call('GET', '/api/me', { token: other }), 401, 'INVALID_TOKEN');
  } finally {
    fake.state.authBusy = false;
    setJwksFetchForTests();
  }
});

test('AI fallback: last result or a labelled sample when Gemini fails or the budget is gone', async () => {
  const me = (await call('GET', '/api/me', { token })).json.data;
  const sample = () => ({ id: null, result: { s: 1 } });
  const boom = (code) => async () => {
    throw new AppError(500, code, 'x');
  };

  let r = await aiOrFallback({ call: boom('AI_TIMEOUT'), previous: async () => ({ id: 'p1', result: {} }), sample });
  assert.deepEqual([r.fallback.kind, r.fallback.reason, r.cached, r.id], ['previous', 'AI_TIMEOUT', true, 'p1']);
  r = await aiOrFallback({ call: boom('AI_QUOTA_EXCEEDED'), previous: async () => null, sample, lang: 'en' });
  assert.equal(r.fallback.kind, 'sample');
  assert.match(r.fallback.note, /SAMPLE/);
  // not an AI problem -> stays an error
  await assert.rejects(aiOrFallback({ call: boom('DATABASE_ERROR'), previous: async () => null, sample }), { code: 'DATABASE_ERROR' });

  // through the services: no budget -> no AI call and nothing saved
  const db = fake.factory();
  const plans = fake.tables.tcas_plans.length;
  await recommend(db, me.id, 'high_yield', { subject: 'ฟิสิกส์ fallback' }, { force: true });
  const recs = fake.tables.recommendations.length;
  // same subject, different hours -> no exact cache hit, but last physics plan is still a fair answer
  r = await recommend(db, me.id, 'high_yield', { subject: 'ฟิสิกส์ fallback', weekly_hours: 5 }, { force: true, noBudget: true });
  assert.equal(r.fallback.kind, 'previous');
  assert.equal(r.type, 'high_yield');
  assert.equal(r.result.subject, 'ฟิสิกส์ fallback');
  // another subject must not get the physics plan
  r = await recommend(db, me.id, 'high_yield', { subject: 'วิชาที่ไม่เคยถาม' }, { force: true, noBudget: true });
  assert.equal(r.fallback.kind, 'sample');
  assert.equal(r.id, null);
  r = await createTcasPlan(db, me.id, { target_faculty: 'คณะที่ไม่เคยขอ', target_university: 'ม.ที่ไม่มีจริง' }, { noBudget: true });
  assert.equal(r.fallback.kind, 'sample');
  assert.equal(r.id, null);
  assert.ok(r.plan.rounds.length > 0);
  assert.equal(fake.tables.recommendations.length, recs);
  assert.equal(fake.tables.tcas_plans.length, plans);
});

test('GET /api/health/deep - db, auth keys, AI status, nothing personal', async () => {
  setJwksFetchForTests(async () => new Response(JSON.stringify({ keys: [] })));
  try {
    const r = await call('GET', '/api/health/deep');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.status, 'ok');
    assert.equal(r.json.db.ok, true);
    assert.equal(r.json.ai.mode, 'mock');
    assert.equal(r.json.ai.daily_limit, 1000);
    assert.equal(r.json.auth.mode, 'supabase_fallback'); // no keys, no secret
    assert.ok(!/@|user_id|email/.test(r.text));
  } finally {
    setJwksFetchForTests();
  }
});

test('X-Lang: en -> English errors, texts and a separate AI cache entry', async () => {
  const en = { 'X-Lang': 'en' };
  let r = await call('GET', '/api/nope', { headers: en });
  assert.equal(r.json.error.message, 'Not found.');
  assert.equal(r.headers.get('content-language'), 'en');
  r = await call('GET', '/api/nope', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
  assert.equal(r.json.error.message, 'Not found.');
  r = await call('GET', '/api/nope');
  assert.match(r.json.error.message, /ไม่พบ/); // Thai stays the default
  expectError(await call('GET', '/api/profile', { headers: en }), 401, 'UNAUTHORIZED');
  assert.equal((await call('GET', '/api/profile', { headers: en })).json.error.message, 'Please log in first.');

  r = await call('POST', `/api/tcas/programs/${cpeId}/simulate`, { headers: en, body: { scores: [{ exam_type: 'TGAT', subject: 'TGAT', score: 50 }] } });
  const a = r.json.data.admissions.find((x) => x.round === 3);
  assert.match(r.json.data.zone_rule, /^safe = at least 3 points/);
  assert.match(a.eligibility.reasons[0], /^No score yet for: TPAT3/);
  assert.deepEqual(a.eligibility.reason_codes[0].code, 'missing_scores');

  // chat: lang has to survive controller -> chat.service -> ai.service
  const chat = await call('POST', '/api/chat', { token, headers: en, body: { message: 'hi' } });
  assert.match(chat.text, /mock answer/);

  // a Thai answer is cached; English must not reuse it
  await call('POST', '/api/recommend/skills', { token });
  assert.equal((await call('POST', '/api/recommend/skills', { token })).status, 200);
  assert.equal((await call('POST', '/api/recommend/skills', { token, headers: en })).status, 201);
  assert.equal((await call('POST', '/api/recommend/skills', { token, headers: en })).status, 200);
});

test('CORS preflight allows PATCH and X-Lang', async () => {
  const res = await fetch(`${base}/api/me/state`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'authorization,content-type,x-lang' },
  });
  assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
  assert.match(res.headers.get('access-control-allow-headers'), /X-Lang/);
});

test('GET /api/stats/overview - aggregates only', async () => {
  const r = await call('GET', '/api/stats/overview');
  assert.equal(r.status, 200, r.text);
  const d = r.json.data;
  assert.ok(d.users >= 1);
  assert.ok(d.ai_usage.faculty_recommendations >= 1);
  assert.ok(d.top_target_faculties.items.some((i) => i.name === 'วิศวกรรมคอมพิวเตอร์'));
  // nothing that points at a person
  assert.ok(!/@test\.com|user_id|display_name/.test(r.text));
});

test('lists past Supabase "Max rows" are paged, not cut off', async () => {
  fake.state.maxRows = 2;
  try {
    const realUsers = fake.tables.profiles.filter((p) => !p.is_demo).length;
    assert.ok(realUsers > 2, 'need more rows than maxRows for this test');
    const s = await overview({ fresh: true });
    assert.equal(s.users, realUsers);

    const exp = await call('GET', '/api/account/export', { token });
    assert.equal(exp.status, 200, exp.text);
    const mine = fake.tables.chat_messages.filter((m) => m.user_id === exp.json.data.account.id).length;
    assert.ok(mine > 2, 'need more chat rows than maxRows for this test');
    assert.equal(exp.json.data.chat_messages.length, mine);
  } finally {
    fake.state.maxRows = undefined;
  }
});

test('chat history -> valid Gemini turns (starts with user, alternates)', () => {
  const turns = toGeminiTurns([
    { role: 'assistant', content: 'cut-off answer' },
    { role: 'user', content: 'q1' },
    { role: 'user', content: 'q1 again (first one failed)' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: 'new question' },
  ]);
  assert.deepEqual(turns.map((t) => t.role), ['user', 'model', 'user']);
  assert.equal(turns[0].parts[0].text, 'q1\n\nq1 again (first one failed)');
  assert.equal(turns[2].parts[0].text, 'new question');
});

test('share link + QR: create, read without login, revoke', async () => {
  const plan = (await call('GET', '/api/history?type=tcas', { token })).json.data.items[0];
  const VALID_TOKEN = 'A'.repeat(22);

  expectError(await call('POST', '/api/share', { body: { kind: 'tcas', id: plan.id } }), 401, 'UNAUTHORIZED');
  expectError(await call('POST', '/api/share', { token, body: { kind: 'chat', id: plan.id } }), 400, 'VALIDATION_ERROR');
  // right id, wrong kind -> not found (no peeking at other tables)
  expectError(await call('POST', '/api/share', { token, body: { kind: 'faculty', id: plan.id } }), 404, 'NOT_FOUND');

  const r = await call('POST', '/api/share', { token, body: { kind: 'tcas', id: plan.id } });
  assert.equal(r.status, 201, r.text);
  const link = r.json.data;
  assert.match(link.token, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(link.url, `http://localhost:3000/share/${link.token}`);
  assert.match(link.qr_svg, /^<svg/);

  // same result again -> same link
  const again = await call('POST', '/api/share', { token, body: { kind: 'tcas', id: plan.id } });
  assert.equal(again.status, 200);
  assert.equal(again.json.data.token, link.token);

  // someone else's result can't be shared
  const other = (await register('sharer@test.com')).json.data.session.access_token;
  expectError(await call('POST', '/api/share', { token: other, body: { kind: 'tcas', id: plan.id } }), 404, 'NOT_FOUND');

  // public read: no token needed, only the plan comes back
  const pub = await call('GET', `/api/share/${link.token}`);
  assert.equal(pub.status, 200, pub.text);
  assert.equal(pub.json.data.kind, 'tcas');
  assert.deepEqual(pub.json.data.plan, plan.plan);
  assert.match(pub.json.data.verify_note, /mytcas\.com/);
  assert.ok(!/user_id|@test\.com|display_name/.test(pub.text));
  assert.equal(pub.headers.get('x-robots-tag'), 'noindex');

  const qr = await call('GET', `/api/share/${link.token}/qr.svg`);
  assert.equal(qr.status, 200);
  assert.match(qr.headers.get('content-type'), /image\/svg\+xml/);

  expectError(await call('GET', '/api/share/short'), 400, 'VALIDATION_ERROR');
  expectError(await call('GET', `/api/share/${VALID_TOKEN}`), 404, 'SHARE_NOT_FOUND');

  const mine = await call('GET', '/api/share', { token });
  assert.equal(mine.json.data.length, 1);
  assert.equal(mine.json.data[0].expired, false);

  // only the owner can revoke
  expectError(await call('DELETE', `/api/share/${link.token}`, { token: other }), 404, 'NOT_FOUND');
  assert.equal((await call('DELETE', `/api/share/${link.token}`, { token })).status, 200);
  expectError(await call('GET', `/api/share/${link.token}`), 404, 'SHARE_NOT_FOUND');

  // expired links stop working
  const r2 = await call('POST', '/api/share', { token, body: { kind: 'tcas', id: plan.id } });
  fake.tables.shared_links.find((l) => l.token === r2.json.data.token).expires_at = '2000-01-01T00:00:00.000Z';
  expectError(await call('GET', `/api/share/${r2.json.data.token}`), 404, 'SHARE_NOT_FOUND');
});

test('progress snapshots for the analytics page: add, dedupe, list, validation', async () => {
  const snap = {
    event_type: 'checkin',
    gpax: 3.5,
    readiness_pct: 25,
    weekly_hours: 6,
    locked_major: '1',
    completed_count: 2,
    total_count: 8,
    round_breakdown: { r1: 50, r2: 0, r3: 0, r4: 0 },
  };
  let r = await call('POST', '/api/me/progress', { token, body: snap });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.snapshot.readiness_pct, 25);
  // same numbers again within a minute -> not stored twice
  r = await call('POST', '/api/me/progress', { token, body: snap });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.created, false);
  r = await call('POST', '/api/me/progress', { token, body: { ...snap, event_type: 'waypoint_complete', completed_count: 3, readiness_pct: 38 } });
  assert.equal(r.status, 201, r.text);

  r = await call('GET', '/api/me/progress?days=7', { token });
  assert.equal(r.status, 200, r.text);
  const items = r.json.data.items;
  assert.ok(items.length >= 2);
  assert.equal(items.at(-1).event_type, 'waypoint_complete'); // oldest first
  assert.deepEqual(items.at(-1).round_breakdown, snap.round_breakdown);

  expectError(await call('POST', '/api/me/progress', { token, body: { ...snap, readiness_pct: 140 } }), 400, 'VALIDATION_ERROR');
  expectError(await call('POST', '/api/me/progress', { token, body: { ...snap, email: 'x@y.z' } }), 400, 'VALIDATION_ERROR');
  expectError(await call('GET', '/api/me/progress'), 401, 'UNAUTHORIZED');

  r = await call('PUT', '/api/profile', { token, body: { avatar_bg_color: '#1F3A3D', school_id: 1 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.avatar_bg_color, '#1F3A3D');
  assert.equal(r.json.data.school_name, 'โรงเรียนตัวอย่างวิทยา');
  r = await call('GET', '/api/profile', { token });
  assert.equal(r.json.data.school_name, 'โรงเรียนตัวอย่างวิทยา');
});

test('POST /api/auth/change-password', async () => {
  const body = (current_password, new_password) => ({ token, body: { current_password, new_password } });

  expectError(await call('POST', '/api/auth/change-password', { body: { current_password: 'x', new_password: 'whatever1' } }), 401, 'UNAUTHORIZED');
  expectError(await call('POST', '/api/auth/change-password', body('wrongpass', 'brandnew123')), 400, 'WRONG_PASSWORD');
  expectError(await call('POST', '/api/auth/change-password', body(password, password)), 400, 'VALIDATION_ERROR');

  // a second session on another "device"
  const other = (await call('POST', '/api/auth/login', { body: { email: EMAIL, password } })).json.data.access_token;

  const r = await call('POST', '/api/auth/change-password', body(password, 'brandnew123'));
  assert.equal(r.status, 200, r.text);
  password = 'brandnew123';

  // this device stays logged in, the other one is kicked out
  assert.equal((await call('GET', '/api/profile', { token })).status, 200);
  expectError(await call('GET', '/api/profile', { token: other }), 401, 'INVALID_TOKEN');
  assert.equal((await call('POST', '/api/auth/login', { body: { email: EMAIL, password } })).status, 200);
});

test('DELETE /api/account removes the user and all their data', async () => {
  const reg = await register('bye@test.com');
  const t = reg.json.data.session.access_token;
  const userId = reg.json.data.user.id;
  await call('POST', '/api/exam-scores', { token: t, body: { exam_type: 'TGAT', subject: 'TGAT1', score: 50, max_score: 100 } });
  await call('POST', '/api/recommend/faculties', { token: t });

  expectError(await call('DELETE', '/api/account', { token: t, body: {} }), 400, 'VALIDATION_ERROR');
  expectError(await call('DELETE', '/api/account', { token: t, body: { password: 'wrongpass' } }), 400, 'WRONG_PASSWORD');

  const r = await call('DELETE', '/api/account', { token: t, body: { password: 'password123' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.deleted, true);

  expectError(await call('GET', '/api/profile', { token: t }), 401, 'INVALID_TOKEN');
  expectError(await call('POST', '/api/auth/login', { body: { email: 'bye@test.com', password: 'password123' } }), 401, 'INVALID_CREDENTIALS');
  assert.ok(!fake.tables.profiles.some((p) => p.id === userId));
  assert.ok(!fake.tables.exam_scores.some((x) => x.user_id === userId));
  assert.ok(!fake.tables.recommendations.some((x) => x.user_id === userId));
});

test('POST /api/auth/logout kills the token', async () => {
  expectError(await call('POST', '/api/auth/logout'), 401, 'UNAUTHORIZED');
  assert.equal((await call('POST', '/api/auth/logout', { token })).status, 200);
  expectError(await call('GET', '/api/profile', { token }), 401, 'INVALID_TOKEN');
});

// keep last: burns through the per-IP register quota
test('register limit per IP -> 429', async () => {
  let hit;
  for (let i = 0; i < 15 && !hit; i++) {
    const r = await register(`spam${i}@test.com`);
    if (r.status === 429) hit = r;
  }
  assert.ok(hit, 'never got rate limited');
  expectError(hit, 429, 'RATE_LIMITED');
});


test('share URL: {token} placeholder for static sites, path segment otherwise', async () => {
  const { env } = await import('../src/config/env.js');
  const { shareUrl } = await import('../src/services/share.service.js');
  const before = env.SHARE_BASE_URL;
  try {
    env.SHARE_BASE_URL = 'https://site.example/share.html?t={token}';
    assert.equal(shareUrl('tok_1'), 'https://site.example/share.html?t=tok_1');
    env.SHARE_BASE_URL = 'https://site.example/share';
    assert.equal(shareUrl('tok_1'), 'https://site.example/share/tok_1');
  } finally {
    env.SHARE_BASE_URL = before;
  }
});
