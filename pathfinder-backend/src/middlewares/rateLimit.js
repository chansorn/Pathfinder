import { createHash } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { log } from '../utils/log.js';

// NOTE: all counters live in memory. A restart resets them and multiple instances
// count separately. Fine for a single Render box, switch to a Redis store if we scale out.
//
// Open house problem: every student on the venue Wi-Fi reaches us from the SAME public IP.
// So nothing here is per-IP alone if it can be avoided:
//   - general traffic is counted per login token (per IP only for anonymous calls)
//   - login / forgot password are counted per IP + email
//   - what has to stay per IP (sign-up, demo, the anonymous ceiling) is multiplied for the
//     IPs listed in RATE_LIMIT_SHARED_IPS (the venue's public IP / range)

const tooMany = (message, code = 'RATE_LIMITED') => (req, res, next) => next(new AppError(429, code, message));

const base = { standardHeaders: 'draft-8', legacyHeaders: false };

// --- shared IPs (venue Wi-Fi, school network) ---

const sharedIps = new BlockList();
for (const entry of env.RATE_LIMIT_SHARED_IPS.split(',').map((s) => s.trim()).filter(Boolean)) {
  const [addr, prefix] = entry.split('/');
  const type = isIP(addr) === 6 ? 'ipv6' : 'ipv4';
  if (!isIP(addr)) {
    log.warn(`[rate-limit] ignoring RATE_LIMIT_SHARED_IPS entry "${entry}" (not an IP)`);
    continue;
  }
  if (prefix) sharedIps.addSubnet(addr, Number(prefix), type);
  else sharedIps.addAddress(addr, type);
}

export function isSharedIp(ip = '') {
  const plain = ip.replace(/^::ffff:/, ''); // IPv4 seen through an IPv6 socket
  const type = isIP(plain) === 6 ? 'ipv6' : 'ipv4';
  return isIP(plain) ? sharedIps.check(plain, type) : false;
}

// limit for this request: normal, or x RATE_LIMIT_SHARED_MULTIPLIER on a shared IP
export const perIp = (limit) => (req) => (isSharedIp(req.ip) ? limit * env.RATE_LIMIT_SHARED_MULTIPLIER : limit);

const ipKey = (req) => `ip:${ipKeyGenerator(req.ip)}`;
const bearer = (req) => req.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
// hashed so raw tokens never sit in memory as map keys
const tokenKey = (token) => `tok:${createHash('sha256').update(token).digest('base64url').slice(0, 32)}`;

// logged-in traffic: per token. Not verified here (requireAuth does that), so a made-up token
// gets its own bucket - which is why ipCeiling below also caps every IP as a whole
export const generalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: (req) => (bearer(req) ? env.RATE_LIMIT_GENERAL_PER_15MIN : perIp(env.RATE_LIMIT_GENERAL_PER_15MIN)(req)),
  keyGenerator: (req) => (bearer(req) ? tokenKey(bearer(req)) : ipKey(req)),
  handler: tooMany('ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'),
});

// everything from one IP together. high on purpose - it only stops floods
export const ipCeiling = rateLimit({
  ...base,
  standardHeaders: false, // generalLimiter's headers are the useful ones
  windowMs: 15 * 60 * 1000,
  limit: perIp(env.RATE_LIMIT_IP_PER_15MIN),
  keyGenerator: ipKey,
  handler: tooMany('มีคำขอจากเครือข่ายนี้มากเกินไป กรุณารอสักครู่แล้วลองใหม่'),
});

// stops people mass-creating accounts to burn AI quota
export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: perIp(env.RATE_LIMIT_REGISTER_PER_HOUR),
  keyGenerator: ipKey,
  handler: tooMany('สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่ภายหลัง'),
});

// POST /api/auth/demo creates an account every time
export const demoLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: perIp(env.RATE_LIMIT_DEMO_PER_HOUR),
  keyGenerator: ipKey,
  handler: tooMany('ขอบัญชีทดลองบ่อยเกินไป กรุณาลองใหม่ภายหลัง'),
});

// anything that checks a password or sends an email: per IP + email (or per user when logged in),
// so 300 students behind one IP each get their own tries, but guessing one account is still slow
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_PER_15MIN,
  keyGenerator: (req) =>
    req.user ? `user:${req.user.id}` : `${ipKey(req)}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  handler: tooMany('พยายามบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'),
});

// ...and a per-IP cap across all emails, against trying many accounts from one place
export const authIpLimiter = rateLimit({
  ...base,
  standardHeaders: false,
  windowMs: 15 * 60 * 1000,
  limit: perIp(env.RATE_LIMIT_AUTH_IP_PER_15MIN),
  keyGenerator: ipKey,
  handler: tooMany('มีการเข้าสู่ระบบจากเครือข่ายนี้บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'),
});

// per user, so it has to go after requireAuth
export const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_AI_PER_HOUR,
  // cached answers cost nothing, give the hit back (controller sets res.locals.aiCached)
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.locals.aiCached === true,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  handler: tooMany(`ใช้ฟีเจอร์ AI ครบ ${env.RATE_LIMIT_AI_PER_HOUR} ครั้งในชั่วโมงนี้แล้ว พักสักหน่อยแล้วกลับมาใหม่นะ`),
});

// --- daily cap for the whole app ---

// YYYY-MM-DD in Bangkok time (UTC+7)
const bangkokDay = (ms) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);

export function createDailyCounter({ limit, now = Date.now }) {
  let day = bangkokDay(now());
  let count = 0;
  return {
    // true = allowed (and counted)
    take() {
      const today = bangkokDay(now());
      if (today !== day) {
        day = today;
        count = 0;
      }
      if (count >= limit) return false;
      count++;
      return true;
    },
    // undo a take() (cached answer, nothing was spent)
    release() {
      if (count > 0) count--;
    },
    // 0 once the day has turned, even before the next take() resets it
    get count() {
      return bangkokDay(now()) === day ? count : 0;
    },
  };
}

const dailyCounter = createDailyCounter({ limit: env.AI_DAILY_LIMIT });

// for /api/health/deep
export const aiDailyUsage = () => ({ used: dailyCounter.count, limit: env.AI_DAILY_LIMIT });

function takeDailySlot(res) {
  if (!dailyCounter.take()) return false;
  const day = bangkokDay(Date.now());
  // the controller calls this as soon as it knows the answer came from cache. Not on 'finish':
  // an SSE client that left early never fires it, and the slot would stay used
  let released = false;
  res.locals.releaseAiQuota = () => {
    if (released) return;
    released = true;
    // taken yesterday: the counter has reset since, nothing of today's to give back
    if (bangkokDay(Date.now()) === day) dailyCounter.release();
  };
  return true;
}

// chat: no slot left -> 429
export function aiDailyCap(req, res, next) {
  if (takeDailySlot(res)) return next();
  log.warn(`[ai] daily cap of ${env.AI_DAILY_LIMIT} reached`);
  next(new AppError(429, 'AI_DAILY_LIMIT', 'วันนี้ระบบ AI ถูกใช้ครบโควตาแล้ว กลับมาใช้ใหม่พรุ่งนี้นะ'));
}

// JSON AI features: no slot left -> carry on with res.locals.aiNoBudget, the service then answers
// from cache, the student's last result or a sample (services/aiFallback.js)
export function aiDailyCapSoft(req, res, next) {
  if (!takeDailySlot(res)) {
    log.warn(`[ai] daily cap of ${env.AI_DAILY_LIMIT} reached, cache / fallback answers only`);
    res.locals.aiNoBudget = true;
  }
  next();
}
