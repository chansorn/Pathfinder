import { serviceClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, badRequest, dbError, notFound } from '../utils/AppError.js';
import { verifyPassword } from './auth.service.js';
import { purgeAvatars } from './avatar.service.js';
import { log } from '../utils/log.js';
import { fetchAll } from '../utils/fetchAll.js';
import { revokeUserTokens } from './token.service.js';

// PDPA stuff: export, delete, consent

const USER_TABLES = ['exam_scores', 'assessments', 'recommendations', 'tcas_plans', 'chat_messages', 'saved_programs', 'shared_links', 'user_state', 'plan_items', 'progress_snapshots'];

// unique column per table, so paging (fetchAll) has a stable order
const ROW_KEY = { saved_programs: 'program_id', shared_links: 'token', user_state: 'user_id', plan_items: 'item_key' };

export async function exportData(db, user) {
  // paged: a long chat history easily passes Supabase's 1000-row cut-off, and PDPA export must be complete
  const [profile, ...rest] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ...USER_TABLES.map((t) =>
      fetchAll(() =>
        db
          .from(t)
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .order(ROW_KEY[t] ?? 'id'),
      ),
    ),
  ]);
  for (const [i, res] of [profile, ...rest].entries()) {
    if (res.error) throw dbError(res.error, `export ${i === 0 ? 'profiles' : USER_TABLES[i - 1]}`);
  }
  return {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data,
    ...Object.fromEntries(USER_TABLES.map((t, i) => [t, rest[i].data])),
  };
}

// who am I: for the read-only email field, the account badge and which delete/password UI to show
export async function me(db, user) {
  const { data: profile, error } = await db
    .from('profiles')
    .select('display_name, nickname, avatar_url, avatar_icon, avatar_frame_color, avatar_bg_color, terms_version, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw dbError(error, 'me profile');

  const account_type = user.is_demo ? 'demo' : user.providers.includes('email') ? 'email' : user.providers.includes('google') ? 'google' : user.providers[0];
  return {
    id: user.id,
    // demo accounts get a generated address nobody should see
    email: user.is_demo ? null : user.email,
    account_type,
    providers: user.providers,
    can_change_password: user.has_password,
    // what DELETE /api/account expects
    delete_confirmation: user.has_password ? 'password' : 'type_DELETE',
    // not in the token when it was checked locally - the profile row is created together with the user
    created_at: user.created_at ?? profile?.created_at ?? null,
    needs_consent: profile?.terms_version !== env.TERMS_VERSION,
    profile: profile ? { ...profile, terms_version: undefined, created_at: undefined } : null,
  };
}

export async function deleteAccount(user, { password, confirm, captcha_token }) {
  if (user.has_password) {
    if (!password) throw badRequest('กรุณากรอกรหัสผ่านเพื่อยืนยันการลบบัญชี');
    await verifyPassword(user.email, password, captcha_token);
  } else if (confirm !== 'DELETE') {
    // google / demo accounts: no password to check
    throw badRequest('พิมพ์ DELETE ในช่อง confirm เพื่อยืนยันการลบบัญชี', 'CONFIRM_REQUIRED');
  }

  await purgeAvatars(user.id);

  // deleting the auth user cascades to every other table (on delete cascade in schema.sql)
  const { error } = await serviceClient().auth.admin.deleteUser(user.id);
  if (error) {
    log.error('[account] deleteUser:', error.code ?? '', error.message);
    throw new AppError(500, 'ACCOUNT_DELETE_FAILED', 'ลบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
  revokeUserTokens(user.id);
  return { deleted: true, message: 'ลบบัญชีและข้อมูลทั้งหมดเรียบร้อยแล้ว' };
}

export async function deleteChatMessages(db, userId) {
  const { data, error } = await db.from('chat_messages').delete().eq('user_id', userId).select('id');
  if (error) throw dbError(error, 'delete chat messages');
  return { deleted: data.length };
}

const HISTORY_TABLE = {
  faculty: ['recommendations', 'faculty'],
  career: ['recommendations', 'career'],
  portfolio: ['recommendations', 'portfolio'],
  skill: ['recommendations', 'skill'],
  high_yield: ['recommendations', 'high_yield'],
  tcas: ['tcas_plans'],
  assessment: ['assessments'],
};

export async function deleteHistoryItem(db, userId, { type, id }) {
  const [table, recType] = HISTORY_TABLE[type];
  let q = db.from(table).delete().eq('id', id).eq('user_id', userId);
  if (recType) q = q.eq('type', recType);
  const { data, error } = await q.select('id');
  if (error) throw dbError(error, `delete ${type}`);
  if (!data.length) throw notFound('ไม่พบรายการนี้');
  return { id };
}

export async function getConsent(db, userId) {
  const { data, error } = await db
    .from('profiles')
    .select('terms_version, terms_accepted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw dbError(error, 'get consent');
  return {
    current_version: env.TERMS_VERSION,
    accepted_version: data?.terms_version ?? null,
    accepted_at: data?.terms_accepted_at ?? null,
    // frontend should show the terms again before letting them continue
    needs_consent: data?.terms_version !== env.TERMS_VERSION,
  };
}

export async function acceptConsent(db, userId) {
  const { error } = await db
    .from('profiles')
    .upsert(
      { id: userId, terms_version: env.TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  if (error) throw dbError(error, 'accept consent');
  return getConsent(db, userId);
}
