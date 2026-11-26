import { serviceClient } from '../config/supabase.js';
import { AppError, badRequest, dbError } from '../utils/AppError.js';
import { log } from '../utils/log.js';

// Profile photos in the public "avatars" bucket, one folder per user: avatars/<user id>/<time>.<ext>
// Uploads go through here (not straight from the browser) so we control size and file type.
// The service client is only used for storage; the path always comes from req.user.id.

const BUCKET = 'avatars';
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// trust the file's first bytes, not the Content-Type header
function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return { ext: 'png', type: 'image/png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return { ext: 'webp', type: 'image/webp' };
  }
  return null;
}

async function removeFolder(storage, userId) {
  const { data, error } = await storage.list(userId, { limit: 100 });
  if (error) throw error;
  if (data?.length) {
    const { error: rmErr } = await storage.remove(data.map((f) => `${userId}/${f.name}`));
    if (rmErr) throw rmErr;
  }
}

export async function uploadAvatar(db, userId, body) {
  if (!Buffer.isBuffer(body) || !body.length) throw badRequest('กรุณาส่งไฟล์รูป (PNG, JPG หรือ WEBP)', 'INVALID_IMAGE');
  const kind = sniff(body);
  if (!kind) throw badRequest('รองรับเฉพาะรูป PNG, JPG หรือ WEBP', 'INVALID_IMAGE');

  const storage = serviceClient().storage.from(BUCKET);
  try {
    await removeFolder(storage, userId); // keep only the newest photo
  } catch (err) {
    log.warn('[avatar] cleanup failed:', err?.message ?? err);
  }

  const path = `${userId}/${Date.now()}.${kind.ext}`;
  const { error } = await storage.upload(path, body, { contentType: kind.type, upsert: false, cacheControl: '3600' });
  if (error) {
    log.error('[avatar] upload:', error.message);
    throw new AppError(500, 'UPLOAD_FAILED', 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
  const avatar_url = storage.getPublicUrl(path).data.publicUrl;

  const { data, error: pErr } = await db.from('profiles').update({ avatar_url }).eq('id', userId).select('avatar_url').single();
  if (pErr) throw dbError(pErr, 'save avatar url');
  return data;
}

export async function deleteAvatar(db, userId) {
  try {
    await removeFolder(serviceClient().storage.from(BUCKET), userId);
  } catch (err) {
    log.error('[avatar] delete:', err?.message ?? err);
    throw new AppError(500, 'UPLOAD_FAILED', 'ลบรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
  const { error } = await db.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw dbError(error, 'clear avatar url');
  return { avatar_url: null };
}

// account deletion: storage files aren't covered by the auth.users cascade
export async function purgeAvatars(userId) {
  try {
    await removeFolder(serviceClient().storage.from(BUCKET), userId);
  } catch (err) {
    log.warn('[avatar] purge failed:', err?.message ?? err);
  }
}
