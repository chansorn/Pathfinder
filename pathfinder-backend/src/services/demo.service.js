import { randomBytes, randomUUID } from 'node:crypto';
import { anonClient, serviceClient, userClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, notFound } from '../utils/AppError.js';
import { createDailyCounter } from '../middlewares/rateLimit.js';
import { log } from '../utils/log.js';
import { purgeAvatars } from './avatar.service.js';
import { revokeUserTokens } from './token.service.js';

// "1-click Demo Student": every click gets its OWN throwaway account with sample data,
// so visitors at the open house never overwrite each other. Accounts are deleted after
// DEMO_TTL_HOURS (checked whenever someone starts a demo) and are left out of /api/stats.

const EMAIL_PREFIX = 'pf-demo-';
const EMAIL_DOMAIN = '@example.com'; // reserved domain, nothing is ever emailed
export const isDemoEmail = (email = '') => email.startsWith(EMAIL_PREFIX) && email.endsWith(EMAIL_DOMAIN);

const daily = createDailyCounter({ limit: env.DEMO_DAILY_LIMIT });

const SAMPLE_SCORES = [
  { exam_type: 'TGAT', subject: 'TGAT', score: 62, max_score: 100 },
  { exam_type: 'TPAT', subject: 'TPAT3', score: 68, max_score: 100 },
  { exam_type: 'A-Level', subject: 'คณิตศาสตร์ประยุกต์ 1', score: 55, max_score: 100 },
  { exam_type: 'A-Level', subject: 'ฟิสิกส์', score: 48, max_score: 100 },
];

async function seed(db, userId) {
  const { data: grade } = await db.from('grade_levels').select('id').eq('code', 'M6').maybeSingle();
  const steps = [
    db
      .from('profiles')
      .update({
        grade_level_id: grade?.id ?? null,
        gpax: 3.45,
        interests: ['AI & Tech', 'Robotics', 'Data & Business'],
        skills: ['Python เบื้องต้น', 'ทำงานเป็นทีม'],
        target_faculties: [
          { faculty: 'วิศวกรรมคอมพิวเตอร์', university: 'มหาวิทยาลัยเกษตรศาสตร์' },
          { faculty: 'วิทยาการคอมพิวเตอร์', university: 'มหาวิทยาลัยมหิดล' },
        ],
        target_tcas_year: 2570,
        nickname: 'เดโม่',
      })
      .eq('id', userId),
    db.from('exam_scores').insert(SAMPLE_SCORES.map((s) => ({ ...s, user_id: userId }))),
    db.from('user_state').upsert(
      { user_id: userId, state: { lang: 'th', beyond_4: false, weekly_hours: 10, target_universities: ['KU', 'MU'] } },
      { onConflict: 'user_id' },
    ),
  ];
  for (const res of await Promise.all(steps)) {
    if (res.error) log.warn('[demo] seed step failed:', res.error.code ?? '', res.error.message);
  }
}

// delete expired demo accounts. throttled so it runs at most every 10 minutes
let lastSweep = 0;
export async function sweepDemoAccounts({ force = false } = {}) {
  if (!force && Date.now() - lastSweep < 10 * 60 * 1000) return 0;
  lastSweep = Date.now();
  const cutoff = Date.now() - env.DEMO_TTL_HOURS * 3600 * 1000;
  const admin = serviceClient().auth.admin;
  let removed = 0;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) {
      log.warn('[demo] listUsers:', error.message);
      break;
    }
    for (const u of data.users) {
      if (isDemoEmail(u.email) && new Date(u.created_at).getTime() < cutoff) {
        // storage isn't covered by the auth.users cascade
        await purgeAvatars(u.id);
        const { error: delErr } = await admin.deleteUser(u.id);
        if (!delErr) {
          revokeUserTokens(u.id);
          removed++;
        }
      }
    }
    if (data.users.length < 1000) break;
  }
  if (removed) log.info(`[demo] removed ${removed} expired demo accounts`);
  return removed;
}

export async function startDemo() {
  if (!env.DEMO_LOGIN) throw notFound('ปิดการใช้งานบัญชีทดลองอยู่', 'DEMO_DISABLED');
  if (!daily.take()) throw new AppError(429, 'DEMO_DAILY_LIMIT', 'บัญชีทดลองวันนี้ถูกใช้ครบแล้ว กรุณาสมัครสมาชิกแทน');

  // fire and forget - a slow cleanup shouldn't hold up the visitor
  sweepDemoAccounts().catch((err) => log.warn('[demo] sweep failed:', err?.message ?? err));

  const email = `${EMAIL_PREFIX}${randomUUID()}${EMAIL_DOMAIN}`;
  const password = randomBytes(24).toString('base64url');
  const { data: created, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: 'นักเรียนตัวอย่าง',
      is_demo: true,
      terms_version: env.TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    },
  });
  if (error) {
    daily.release();
    log.error('[demo] createUser:', error.code ?? '', error.message);
    throw new AppError(500, 'DEMO_FAILED', 'สร้างบัญชีทดลองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }

  const { data: signin, error: sErr } = await anonClient().auth.signInWithPassword({ email, password });
  if (sErr || !signin?.session) {
    await serviceClient().auth.admin.deleteUser(created.user.id).catch(() => {});
    daily.release();
    // Supabase Auth limits sign-ins per IP, and every sign-in comes from this server's IP.
    // Load test: ~30 demo logins in a few seconds -> over_request_rate_limit. Raise it in
    // Supabase > Authentication > Rate Limits before the event (see README).
    if (sErr?.status === 429 || sErr?.code === 'over_request_rate_limit') {
      log.warn('[demo] supabase auth rate limit hit - raise "sign-ups and sign-ins" in the Supabase dashboard');
      throw new AppError(429, 'RATE_LIMITED', 'มีคนเข้าสู่ระบบพร้อมกันเยอะมาก กรุณารอสักครู่แล้วลองใหม่');
    }
    log.error('[demo] signIn:', sErr?.code ?? '', sErr?.message);
    throw new AppError(500, 'DEMO_FAILED', 'สร้างบัญชีทดลองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }

  await seed(userClient(signin.session.access_token), created.user.id);

  const s = signin.session;
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: s.expires_in,
    expires_at: s.expires_at,
    token_type: s.token_type,
    user: { id: created.user.id, email: null, display_name: 'นักเรียนตัวอย่าง' },
    demo: true,
    // after this the account and everything in it is deleted
    demo_expires_at: new Date(Date.now() + env.DEMO_TTL_HOURS * 3600 * 1000).toISOString(),
  };
}
