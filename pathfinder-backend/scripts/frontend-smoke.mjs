// Smoke test for the PC UI's js/api.js + js/auth-analytics-profile.js against the real Express app
// with the fake Supabase from the tests (no network, no real accounts).
// Run: node scripts/frontend-smoke.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'true';
process.env.FRONTEND_URL = 'http://localhost:3000';
// pinned so a developer's .env (Live Server URLs etc.) can't change what the tests expect
process.env.PASSWORD_RESET_REDIRECT_URL = 'http://localhost:3000/reset-password';
process.env.SHARE_BASE_URL = 'http://localhost:3000/share';
process.env.CORS_ORIGINS = '';
process.env.RATE_LIMIT_AUTH_PER_15MIN = '1000';
process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';

const here = path.dirname(fileURLToPath(import.meta.url));
const UI = path.resolve(here, '../../frontend/UI/PC UI');

const { createFakeSupabase } = await import('../test/fakeSupabase.js');
const { setSupabaseFactoryForTests } = await import('../src/config/supabase.js');
const { createApp } = await import('../src/app.js');
const fake = createFakeSupabase();
setSupabaseFactoryForTests(fake.factory);
const server = createApp().listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/api`;

// --- a tiny browser: storage, location, history, inert DOM ---
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};
const localStorage = mem();
const sessionStorage = mem();
const toasts = [];
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, getAttribute: () => null, addEventListener() {}, style: {}, value: '', textContent: '' });
const toastText = { ...el(), set textContent(v) { toasts.push(v); }, get textContent() { return toasts.at(-1) ?? ''; } };
const document = {
  getElementById: (id) => (id === 'pf-toast' ? el() : id === 'pf-toast-text' ? toastText : null),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener() {},
  createElement: () => el(),
  visibilityState: 'visible',
};
let href = 'http://localhost:3000/index.html';
const location = {
  get href() { return href; },
  get search() { return new URL(href).search; },
  get origin() { return new URL(href).origin; },
  get pathname() { return new URL(href).pathname; },
  assign(u) { this.assigned = u; },
};
const history = { replaceState: (_s, _t, u) => { href = new URL(u, href).href; } };
const listeners = {};
const window = {
  PF_API_URL: base,
  addEventListener: (t, fn) => (listeners[t] ??= []).push(fn),
  dispatchEvent: (e) => (listeners[e.type] ?? []).forEach((fn) => fn(e)),
  confirm: () => true,
  console,
};
const ctx = {
  window, document, location, history, localStorage, sessionStorage, console, fetch, URL, URLSearchParams,
  AbortController, TextDecoder, Blob, CustomEvent, setTimeout, clearTimeout, Promise, JSON, Math, Date,
  PF_STATE: { lang: 'th', page: '1', interests: ['tech-ai'], grade: 'M.5', gpax: 3.6, gpaxSet: true, beyond400: true, acceptedMajors: ['Computer Engineering'], ignoredMajors: [], targetUnis: ['ku'], weeklyHours: 8, hoursSet: true, checkedWaypoints: { '1-r1-0': true }, lockedMajorId: '1' },
  INTEREST_KEYWORD_MAP: [{ key: 'tech-ai' }, { key: 'business' }],
  goToPage() {}, setLang() {},
};
ctx.window.PF_STATE = ctx.PF_STATE;
Object.assign(window, { localStorage, sessionStorage, location, document });
vm.createContext(ctx);
for (const f of ['js/api.js', 'js/sync.js', 'js/auth-analytics-profile.js']) {
  vm.runInContext(readFileSync(path.join(UI, f), 'utf8'), ctx, { filename: f });
}
const { PF_API, PF_AUTH, PF_ANALYTICS, PF_SYNC } = ctx.window;
const settle = () => new Promise((r) => setTimeout(r, 50));
await settle(); // PF_AUTH.init() from the bottom of the file

let ok = 0;
const step = async (name, fn) => {
  await fn();
  ok++;
  console.log('  ok -', name);
};

try {
  await step('guest: no session, no user', () => {
    assert.equal(PF_API.hasSession(), false);
    assert.equal(PF_AUTH.getCurrentUser(), null);
  });

  await step('signup without terms is refused locally', async () => {
    const r = await PF_AUTH.signup({ email: 'a@b.co', password: 'password123', fullName: 'A' });
    assert.equal(r.ok, false);
  });

  await step('signup -> session + guest plan migrated', async () => {
    const r = await PF_AUTH.signup({
      email: 'smoke@example.com', password: 'password123', fullName: 'Smoke Test', nickname: 'สโม้ค',
      grade: 'M.6', school: 'โรงเรียนตัวอย่างวิทยา', acceptTerms: true, avatarPreset: 'brain', avatarColor: '#4F46E5',
    });
    assert.equal(r.ok, true, r.th);
    const u = PF_AUTH.getCurrentUser();
    assert.equal(u.profile.nickname, 'สโม้ค');
    assert.equal(u.profile.grade, 'M.6');
    assert.equal(u.profile.school, 'โรงเรียนตัวอย่างวิทยา');
    assert.equal(u.profile.avatarPreset, 'brain');
    assert.equal(u.state.weekly_hours, 8);
    assert.deepEqual(u.state.checked_waypoints, ['1-r1-0']);
    assert.equal(u.profile.gpax, 3.6);
    assert.ok(localStorage.getItem('pf_auth_v1'), 'remembered session in localStorage');
  });

  await step('snapshot -> POST /me/progress, repeat skipped', async () => {
    const before = PF_AUTH.getCurrentUser().analyticsHistory.length;
    PF_ANALYTICS.recordSnapshot('reroute');
    PF_ANALYTICS.recordSnapshot('reroute');
    await settle();
    assert.equal(PF_AUTH.getCurrentUser().analyticsHistory.length, before + 1);
    const items = (await PF_API.request('/me/progress', { auth: true })).items;
    assert.equal(items.at(-1).event_type, 'reroute');
  });

  await step('expired access token -> refreshed once, request succeeds', async () => {
    const saved = JSON.parse(localStorage.getItem('pf_auth_v1'));
    PF_API.setSession({ ...saved, access_token: 'not-a-real-token' }, true);
    const me = await PF_API.request('/me', { auth: true });
    assert.equal(me.email, 'smoke@example.com');
    assert.notEqual(JSON.parse(localStorage.getItem('pf_auth_v1')).access_token, 'not-a-real-token');
  });

  await step('auth busy (429) -> error, but still logged in', async () => {
    fake.state.authBusy = true;
    const saved = JSON.parse(localStorage.getItem('pf_auth_v1'));
    PF_API.setSession({ ...saved, access_token: 'not-a-real-token-2' }, true);
    await assert.rejects(PF_API.request('/me', { auth: true }), (e) => e.status === 429 || e.status === 503);
    assert.equal(PF_API.hasSession(), true);
    fake.state.authBusy = false;
    PF_API.setSession(saved, true);
  });

  await step('PF_SYNC: changed PF_STATE -> PATCH /me/state + PUT /profile', async () => {
    ctx.PF_STATE.weeklyHours = 12;
    ctx.PF_STATE.gpax = 3.8;
    await PF_SYNC.flush();
    const st = (await PF_API.request('/me/state', { auth: true })).state;
    assert.equal(st.weekly_hours, 12);
    const prof = await PF_API.request('/profile', { auth: true });
    assert.equal(prof.gpax, 3.8);
  });

  await step('roadmap checkbox -> PATCH /my-plan/items (created with title)', async () => {
    PF_SYNC.planItem('1-r1-0', true, { title: 'ทำ Portfolio ฉบับร่าง', round: 'r1' });
    await settle();
    const plan = await PF_API.request('/my-plan', { auth: true });
    const it = plan.items.find((i) => i.id === '1-r1-0');
    assert.equal(it?.status, 'done');
    assert.equal(it?.round, 1);
  });

  await step('.ics comes back as a file (Blob)', async () => {
    const blob = await PF_API.request('/my-plan/calendar.ics', { auth: true });
    assert.match(await blob.text(), /BEGIN:VCALENDAR/);
    const pub = await PF_API.request('/tcas/calendar.ics', { auth: false });
    assert.match(await pub.text(), /BEGIN:VCALENDAR/);
  });

  await step('chat streams deltas then done (with context)', async () => {
    let deltas = 0;
    const done = await PF_API.stream('/chat', {
      body: { message: 'ควรอ่านอะไรก่อน', context: { page: 'coach', simulated_score: 61.5, roadmap: { done: 1, total: 8, next_tasks: ['ทำพอร์ต'] } } },
      onEvent: (ev) => { if (ev === 'delta') deltas++; },
    });
    assert.ok(deltas > 0);
    assert.ok(done.content.length > 0);
  });

  await step('high-yield over SSE -> chapters, then share it with a QR', async () => {
    const stages = [];
    const data = await PF_API.stream('/coach/high-yield', { body: { subject: 'A-Level ฟิสิกส์', current_score: 48, weekly_hours: 6 }, onProgress: (p) => stages.push(p.stage) });
    assert.ok(stages.includes('started'));
    assert.ok(data.result.chapters.length >= 3);
    assert.ok(data.id);
    const share = await PF_API.request('/share', { method: 'POST', auth: true, body: { kind: 'high_yield', id: data.id } });
    assert.match(share.qr_svg, /^<svg/);
    const pub = await PF_API.request('/share/' + share.token, { auth: false });
    assert.equal(pub.kind, 'high_yield');
    assert.ok(pub.result.chapters.length >= 3);
  });

  await step('profile save + avatar upload + school not in list', async () => {
    const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(32).fill(0)])], { type: 'image/png' });
    const r = await PF_AUTH.saveProfile({
      fullName: 'Smoke Renamed', nickname: 'สโม้ค', grade: 'M.5', targetYear: 'TCAS71', school: 'โรงเรียนที่ไม่มีจริง',
      bio: 'hi', avatarPreset: 'star', avatarColor: '#C94B77', avatarFrameColor: '#EAB308',
    }, { blob: png });
    assert.equal(r.ok, true, r.th);
    assert.equal(r.schoolNotFound, true);
    const u = PF_AUTH.getCurrentUser();
    assert.equal(u.profile.fullName, 'Smoke Renamed');
    assert.equal(u.profile.targetYear, 'TCAS71');
    assert.equal(u.profile.avatarColor, '#C94B77');
    assert.equal(u.profile.avatarFrameColor, '#EAB308');
    assert.ok(u.profile.avatarImage, 'avatar url set');
    assert.equal(u.profile.school, '');
  });

  await step('logout -> session gone, old token dead', async () => {
    const saved = JSON.parse(localStorage.getItem('pf_auth_v1'));
    await PF_AUTH.logout();
    assert.equal(PF_API.hasSession(), false);
    assert.equal(PF_AUTH.getCurrentUser(), null);
    const res = await fetch(base + '/me', { headers: { Authorization: 'Bearer ' + saved.access_token } });
    assert.equal(res.status, 401);
  });

  await step('login wrong password -> message, no session', async () => {
    const r = await PF_AUTH.login('smoke@example.com', 'wrong-password', true);
    assert.equal(r.ok, false);
    assert.ok(r.th.length > 0);
    assert.equal(PF_API.hasSession(), false);
  });

  await step('login without "remember me" -> sessionStorage only', async () => {
    const r = await PF_AUTH.login('smoke@example.com', 'password123', false);
    assert.equal(r.ok, true, r.th);
    assert.equal(localStorage.getItem('pf_auth_v1'), null);
    assert.ok(sessionStorage.getItem('pf_auth_v1'));
    assert.equal(PF_AUTH.getCurrentUser().profile.fullName, 'Smoke Renamed');
    await PF_AUTH.logout();
  });

  await step('forgot password -> generic message', async () => {
    const r = await PF_AUTH.forgotPassword('smoke@example.com');
    assert.equal(r.ok, true);
    assert.ok(r.message);
  });

  await step('demo login -> demo account, no email shown', async () => {
    const r = await PF_AUTH.loginDemo();
    assert.equal(r.ok, true, r.th);
    const u = PF_AUTH.getCurrentUser();
    assert.equal(u.isDemo, true);
    assert.equal(u.email, '');
    assert.equal(localStorage.getItem('pf_auth_v1'), null); // tab only
    await PF_AUTH.logout();
  });

  await step('no Google sign-in in the UI', async () => {
    assert.equal(PF_AUTH.startGoogle, undefined);
  });

  console.log(`\n${ok} steps passed`);
} finally {
  server.close();
}
