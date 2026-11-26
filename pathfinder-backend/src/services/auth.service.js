import { anonClient, serviceClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, badRequest, unauthorized } from '../utils/AppError.js';
import { assertReferencesExist } from './reference.service.js';
import { log } from '../utils/log.js';
import { revokeToken, revokeUserTokens } from './token.service.js';

// don't leak the whole supabase user object
const publicUser = (u) => ({ id: u.id, email: u.email, display_name: u.user_metadata?.display_name ?? null });

const publicSession = (s) =>
  s
    ? {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_in: s.expires_in,
        expires_at: s.expires_at,
        token_type: s.token_type,
      }
    : null;

// supabase auth errors we know how to explain. null = caller decides
function knownAuthError(error) {
  if (error?.status === 429 || error?.code === 'over_request_rate_limit' || error?.code === 'over_email_send_rate_limit') {
    return new AppError(429, 'RATE_LIMITED', 'พยายามบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
  }
  if (error?.code === 'captcha_failed') {
    return badRequest('ยืนยัน CAPTCHA ไม่ผ่าน กรุณาลองใหม่', 'CAPTCHA_FAILED');
  }
  if (error?.code === 'weak_password') {
    return badRequest('รหัสผ่านง่ายเกินไป ลองตั้งให้ยากขึ้น', 'WEAK_PASSWORD');
  }
  return null;
}

function authError(error, context) {
  const known = knownAuthError(error);
  if (known) return known;
  log.error(`[auth] ${context}:`, error?.code ?? '', error?.message ?? error);
  return new AppError(500, 'AUTH_ERROR', 'ระบบยืนยันตัวตนมีปัญหา กรุณาลองใหม่อีกครั้ง');
}

const captcha = (token) => (token ? { captchaToken: token } : {});

export async function register({ email, password, display_name, school_id, grade_level_id, captcha_token }) {
  const supabase = anonClient();
  await assertReferencesExist(supabase, { school_id, grade_level_id });

  // the handle_new_user trigger (schema.sql) turns this metadata into a profiles row
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...captcha(captcha_token),
      data: {
        display_name,
        school_id: school_id ?? null,
        grade_level_id: grade_level_id ?? null,
        // proof of consent for PDPA
        terms_version: env.TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      throw badRequest('อีเมลนี้ถูกใช้สมัครแล้ว', 'EMAIL_TAKEN');
    }
    const known = knownAuthError(error);
    if (known) throw known;
    if (error.status === 400 || error.status === 422) throw badRequest('ไม่สามารถสมัครด้วยข้อมูลนี้ได้', 'REGISTER_FAILED');
    throw authError(error, 'signUp');
  }

  // with "confirm email" on, a duplicate email comes back as a user with no identities instead of an error
  if (data.user && data.user.identities?.length === 0) {
    throw badRequest('อีเมลนี้ถูกใช้สมัครแล้ว', 'EMAIL_TAKEN');
  }

  return {
    user: publicUser(data.user),
    session: publicSession(data.session),
    // no session = they have to click the email link before logging in
    requires_email_confirmation: !data.session,
  };
}

export async function login({ email, password, captcha_token }) {
  const { data, error } = await anonClient().auth.signInWithPassword({
    email,
    password,
    options: captcha(captcha_token),
  });
  if (error) {
    if (error.code === 'email_not_confirmed') {
      throw unauthorized('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', 'EMAIL_NOT_CONFIRMED');
    }
    const known = knownAuthError(error);
    if (known) throw known;
    if (error.status === 400 || error.code === 'invalid_credentials') {
      throw unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');
    }
    throw authError(error, 'signIn');
  }
  return { ...publicSession(data.session), user: publicUser(data.user) };
}

export async function refresh({ refresh_token }) {
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token });
  // a 429 from Supabase is "busy", not "bad token" - answering 401 here would log the student out
  const known = knownAuthError(error);
  if (known) throw known;
  if (error || !data.session) {
    if (!error || (error.status >= 400 && error.status < 500)) {
      throw unauthorized('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'INVALID_REFRESH_TOKEN');
    }
    throw authError(error, 'refresh');
  }
  return { ...publicSession(data.session), user: publicUser(data.user) };
}

export async function logout(accessToken) {
  // tokens are checked locally now, so remember this one is dead (Supabase only kills the refresh token)
  revokeToken(accessToken);
  // revokes this session's refresh token on Supabase's side
  const { error } = await serviceClient().auth.admin.signOut(accessToken, 'local');
  if (error) {
    // the client throws its tokens away regardless, so don't fail the request
    log.warn('[auth] signOut:', error.code ?? '', error.message);
  }
}

// Re-check the password before changing it / deleting the account.
// Wrong password is a 400, not 401 - a 401 would make the frontend think the session died.
export async function verifyPassword(email, password, captchaToken) {
  const { data, error } = await anonClient().auth.signInWithPassword({
    email,
    password,
    options: captcha(captchaToken),
  });
  if (error) {
    const known = knownAuthError(error);
    if (known) throw known;
    if (error.status === 400 || error.code === 'invalid_credentials') {
      throw badRequest('รหัสผ่านไม่ถูกต้อง', 'WRONG_PASSWORD');
    }
    throw authError(error, 'verifyPassword');
  }
  // that sign-in created a session we don't need
  await serviceClient().auth.admin.signOut(data.session.access_token, 'local');
}

// default = the served index page, which opens the new-password form for ?token_hash=&type=recovery
const resetRedirectUrl = () => env.PASSWORD_RESET_REDIRECT_URL ?? `${env.FRONTEND_URL}/`;

export async function forgotPassword({ email, captcha_token }) {
  const { error } = await anonClient().auth.resetPasswordForEmail(email, {
    redirectTo: resetRedirectUrl(),
    ...captcha(captcha_token),
  });
  if (error) {
    const known = knownAuthError(error);
    if (known && known.code !== 'WEAK_PASSWORD') throw known;
    // anything else stays server side so nobody can probe which emails have accounts
    log.error('[auth] resetPasswordForEmail:', error.code ?? '', error.message);
  }
  // same answer either way
  return { message: 'ถ้ามีบัญชีที่ใช้อีเมลนี้ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาเช็กอีเมล (รวมถึงโฟลเดอร์สแปม)' };
}

export async function resetPassword({ token_hash, password }) {
  const { data, error } = await anonClient().auth.verifyOtp({ token_hash, type: 'recovery' });
  // busy != expired link, don't tell them to request a new one
  const known = knownAuthError(error);
  if (known && known.status === 429) throw known;
  if (error || !data?.user) {
    if (!error || (error.status >= 400 && error.status < 500)) {
      throw badRequest('ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่', 'INVALID_RESET_TOKEN');
    }
    throw authError(error, 'verifyOtp');
  }

  const admin = serviceClient().auth.admin;
  const { error: updateError } = await admin.updateUserById(data.user.id, { password });
  if (updateError) throw authError(updateError, 'reset updateUser');

  // kick every session out, in case someone else was logged in
  revokeUserTokens(data.user.id);
  if (data.session) await admin.signOut(data.session.access_token, 'global');

  return { message: 'ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' };
}

export async function changePassword(user, accessToken, { current_password, new_password, captcha_token }) {
  await verifyPassword(user.email, current_password, captcha_token);

  const admin = serviceClient().auth.admin;
  const { error } = await admin.updateUserById(user.id, { password: new_password });
  if (error) throw authError(error, 'change updateUser');

  // log out every other device, keep this one
  revokeUserTokens(user.id, { keepToken: accessToken });
  const { error: signOutError } = await admin.signOut(accessToken, 'others');
  if (signOutError) log.warn('[auth] signOut others:', signOutError.code ?? '', signOutError.message);

  return { message: 'เปลี่ยนรหัสผ่านเรียบร้อย อุปกรณ์อื่นถูกออกจากระบบแล้ว' };
}
