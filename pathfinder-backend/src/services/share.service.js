import { randomBytes } from 'node:crypto';
import { serviceClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, dbError, notFound } from '../utils/AppError.js';

// Share links: the student taps "share", gets a URL + QR code, scans it with their phone
// and opens the same result at home without logging in.
//
// We store a snapshot of the result (not a pointer) so the link keeps working even if they
// redo the plan later, and so the public read never touches the original tables.
// Only the AI result goes in - no name, email, school or scores from the profile.

const SOURCES = {
  tcas: { table: 'tcas_plans', cols: 'id, target, plan, created_at', pick: (r) => ({ target: r.target, plan: r.plan }) },
  assessment: { table: 'assessments', cols: 'id, result, created_at', pick: (r) => ({ result: r.result }) },
  faculty: { table: 'recommendations', type: 'faculty' },
  career: { table: 'recommendations', type: 'career' },
  portfolio: { table: 'recommendations', type: 'portfolio' },
  skill: { table: 'recommendations', type: 'skill' },
  high_yield: { table: 'recommendations', type: 'high_yield' },
};
export const SHARE_KINDS = Object.keys(SOURCES);

const MAX_ACTIVE_LINKS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// 16 random bytes -> 22 url-safe chars. unguessable, short enough for a small QR code
const newToken = () => randomBytes(16).toString('base64url');

// SHARE_BASE_URL may hold a {token} placeholder for static sites that can't route /share/:token
// (e.g. https://site/share.html?t={token}); otherwise the token is appended as a path segment
export const shareUrl = (token) => {
  // default = the share page the backend serves itself (static site, so the token is a query param)
  const base = env.SHARE_BASE_URL || `${env.FRONTEND_URL}/share.html?t={token}`;
  return base.includes('{token}') ? base.replace('{token}', token) : `${base}/${token}`;
};

const isExpired = (row, nowIso = new Date().toISOString()) => row.expires_at && row.expires_at <= nowIso;

async function loadSource(db, userId, kind, id) {
  const s = SOURCES[kind];
  let q = db
    .from(s.table)
    .select(s.cols ?? 'id, type, result, created_at')
    .eq('id', id)
    .eq('user_id', userId);
  if (s.type) q = q.eq('type', s.type);
  const { data, error } = await q.maybeSingle();
  if (error) throw dbError(error, `share load ${kind}`);
  if (!data) throw notFound('ไม่พบผลลัพธ์ที่ต้องการแชร์');
  return { created_at: data.created_at, ...(s.pick ? s.pick(data) : { result: data.result }) };
}

export async function createShare(db, userId, { kind, id }) {
  const snapshot = await loadSource(db, userId, kind, id);

  // reuse a live link for the same result instead of piling up new ones
  const { data: mine, error: listErr } = await db
    .from('shared_links')
    .select('token, source_id, expires_at')
    .eq('user_id', userId);
  if (listErr) throw dbError(listErr, 'share list');

  const now = new Date().toISOString();
  const live = mine.filter((r) => !isExpired(r, now));
  const existing = live.find((r) => r.source_id === id);
  if (existing) return { token: existing.token, url: shareUrl(existing.token), expires_at: existing.expires_at, reused: true };

  if (live.length >= MAX_ACTIVE_LINKS) {
    throw new AppError(400, 'SHARE_LIMIT', `แชร์ได้สูงสุด ${MAX_ACTIVE_LINKS} ลิงก์ กรุณายกเลิกลิงก์เก่าก่อน`);
  }

  const row = {
    token: newToken(),
    user_id: userId,
    kind,
    source_id: id,
    snapshot,
    expires_at: new Date(Date.now() + env.SHARE_DAYS * DAY_MS).toISOString(),
  };
  const { error } = await db.from('shared_links').insert(row);
  if (error) throw dbError(error, 'share insert');
  return { token: row.token, url: shareUrl(row.token), expires_at: row.expires_at, reused: false };
}

export async function listShares(db, userId) {
  const { data, error } = await db
    .from('shared_links')
    .select('token, kind, source_id, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw dbError(error, 'share list');
  const now = new Date().toISOString();
  return data.map((r) => ({ ...r, url: shareUrl(r.token), expired: Boolean(isExpired(r, now)) }));
}

export async function revokeShare(db, userId, token) {
  const { data, error } = await db.from('shared_links').delete().eq('token', token).eq('user_id', userId).select('token');
  if (error) throw dbError(error, 'share revoke');
  if (!data.length) throw notFound('ไม่พบลิงก์นี้');
  return { revoked: true };
}

// public - no login. RLS only lets owners read their rows, so this goes through the service
// client, looks up by the exact token and returns the snapshot only (never user_id)
export async function readShare(token) {
  const { data, error } = await serviceClient()
    .from('shared_links')
    .select('kind, snapshot, expires_at, created_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw dbError(error, 'share read');
  if (!data || isExpired(data)) throw notFound('ลิงก์นี้หมดอายุหรือถูกยกเลิกแล้ว', 'SHARE_NOT_FOUND');
  return {
    kind: data.kind,
    ...data.snapshot,
    shared_at: data.created_at,
    expires_at: data.expires_at,
    verify_note: 'ข้อมูลนี้เป็นคำแนะนำจาก AI ณ วันที่สร้าง กรุณาตรวจสอบวันสมัครและเกณฑ์ล่าสุดที่ mytcas.com',
  };
}

// QR as SVG. qrcode is an optional dependency - without it the frontend can still draw
// the QR itself from the url
let qrLib;
export async function qrSvg(text) {
  if (qrLib === undefined) {
    qrLib = await import('qrcode').then((m) => m.default ?? m).catch(() => null);
  }
  if (!qrLib) return null;
  return qrLib.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}
