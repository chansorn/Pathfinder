import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';

// New client per call. They're cheap, and it means one user's session
// can never stick around in a client someone else uses next.
function defaultFactory({ role, accessToken }) {
  const key = role === 'service' ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !key) {
    throw new AppError(500, 'CONFIG_ERROR', 'ระบบยังตั้งค่าฐานข้อมูลไม่ครบ กรุณาติดต่อผู้ดูแล');
  }
  return createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

let factory = defaultFactory;

// auth calls + public tables
export const anonClient = () => factory({ role: 'anon' });

// carries the user's JWT, so RLS only lets them see their own rows
export const userClient = (accessToken) => factory({ role: 'anon', accessToken });

// bypasses RLS - admin auth stuff only (sign out, update password, delete user).
// don't use this to read user data.
export const serviceClient = () => factory({ role: 'service' });

// tests swap in a fake
export function setSupabaseFactoryForTests(fn) {
  factory = fn ?? defaultFactory;
}
