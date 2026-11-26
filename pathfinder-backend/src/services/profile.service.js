import { dbError, notFound } from '../utils/AppError.js';
import { assertReferencesExist } from './reference.service.js';

// every query filters on the user id too, even though RLS already does. belt and braces

export async function getProfile(db, userId) {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw dbError(error, 'get profile');
  if (!data) throw notFound('ไม่พบโปรไฟล์ กรุณาบันทึกข้อมูลโปรไฟล์ก่อน', 'PROFILE_NOT_FOUND');
  return withSchoolName(db, data);
}

// the profile form shows the school by name, the row only has the id
async function withSchoolName(db, profile) {
  if (!profile.school_id) return { ...profile, school_name: null };
  const { data } = await db.from('schools').select('name').eq('id', profile.school_id).maybeSingle();
  return { ...profile, school_name: data?.name ?? null };
}

export async function updateProfile(db, userId, patch) {
  await assertReferencesExist(db, patch);
  // upsert in case the row is missing (users created before the trigger existed)
  const { data, error } = await db
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw dbError(error, 'update profile');
  return withSchoolName(db, data);
}

export async function listExamScores(db, userId) {
  const { data, error } = await db
    .from('exam_scores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw dbError(error, 'list exam scores');
  return data;
}

export async function addExamScore(db, userId, score) {
  const { data, error } = await db
    .from('exam_scores')
    .insert({ ...score, user_id: userId })
    .select()
    .single();
  if (error) throw dbError(error, 'add exam score');
  return data;
}

export async function deleteExamScore(db, userId, id) {
  const { data, error } = await db.from('exam_scores').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) throw dbError(error, 'delete exam score');
  if (!data?.length) throw notFound('ไม่พบคะแนนสอบนี้');
  return { id };
}
