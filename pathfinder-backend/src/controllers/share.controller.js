import * as share from '../services/share.service.js';
import { ok } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';

export const create = async (req, res) => {
  const link = await share.createShare(req.db, req.user.id, req.valid.body);
  // QR comes back inline so the frontend can show it right away (null if qrcode isn't installed)
  ok(res, { ...link, qr_svg: await share.qrSvg(link.url) }, link.reused ? 200 : 201);
};

export const list = async (req, res) => ok(res, await share.listShares(req.db, req.user.id));
export const revoke = async (req, res) => ok(res, await share.revokeShare(req.db, req.user.id, req.valid.params.token));

export const read = async (req, res) => {
  const data = await share.readShare(req.valid.params.token);
  // short cache so a revoked link stops working soon, and keep these out of search engines
  res.set({ 'Cache-Control': 'private, max-age=60', 'X-Robots-Tag': 'noindex' });
  ok(res, data);
};

// <img src="/api/share/:token/qr.svg"> - only encodes the url, so it works without checking the link
export const qr = async (req, res) => {
  const svg = await share.qrSvg(share.shareUrl(req.valid.params.token));
  if (!svg) throw new AppError(501, 'QR_UNAVAILABLE', 'เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง qrcode');
  res.set({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }).send(svg);
};
