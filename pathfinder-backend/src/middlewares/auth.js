import { anonClient, userClient } from '../config/supabase.js';
import { AppError, unauthorized } from '../utils/AppError.js';
import { log } from '../utils/log.js';
import { verifyAccessToken, InvalidTokenError } from '../services/token.service.js';

const invalidToken = () => unauthorized('เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่', 'INVALID_TOKEN');

const providersOf = (appMeta = {}) => appMeta.providers ?? [appMeta.provider ?? 'email'];

function toUser({ id, email, appMeta, userMeta, created_at }) {
  const providers = providersOf(appMeta);
  const is_demo = Boolean(userMeta?.is_demo);
  return {
    id,
    email,
    providers,
    is_demo,
    // google / demo accounts have no password the student knows - delete-account checks this
    has_password: providers.includes('email') && !is_demo,
    created_at: created_at ?? null,
  };
}

// the old way: one round trip to Supabase Auth
async function userFromSupabase(token) {
  const { data, error } = await anonClient().auth.getUser(token);
  // Supabase busy / unreachable is NOT a bad token. A 401 here makes the frontend log the student out
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
    throw new AppError(429, 'RATE_LIMITED', 'มีคนใช้งานพร้อมกันเยอะมาก กรุณารอสักครู่แล้วลองใหม่');
  }
  if (error && (!error.status || error.status >= 500)) {
    log.warn('[auth] getUser unavailable:', error.status ?? '', error.message);
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'ระบบยืนยันตัวตนขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
  }
  if (error || !data?.user) throw invalidToken();
  const u = data.user;
  return toUser({ id: u.id, email: u.email, appMeta: u.app_metadata, userMeta: u.user_metadata, created_at: u.created_at });
}

// Checks "Authorization: Bearer <token>".
// Sets req.user, req.accessToken and req.db (a client scoped to this user by RLS).
// Signature checked locally when possible (services/token.service.js), Supabase Auth otherwise.
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(unauthorized());
  }

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch (err) {
    if (err instanceof InvalidTokenError) return next(invalidToken());
    throw err;
  }

  req.user = claims
    ? toUser({ id: claims.sub, email: claims.email, appMeta: claims.app_metadata, userMeta: claims.user_metadata })
    : await userFromSupabase(token);
  req.accessToken = token;
  req.db = userClient(token);
  next();
}
