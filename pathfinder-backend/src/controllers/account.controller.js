import * as accountService from '../services/account.service.js';
import { ok } from '../utils/response.js';

export const exportData = async (req, res) => {
  const data = await accountService.exportData(req.db, req.user);
  // downloads as a file if opened directly in the browser
  res.set('Content-Disposition', 'attachment; filename="pathfinder-my-data.json"');
  ok(res, data);
};

export const me = async (req, res) => ok(res, await accountService.me(req.db, req.user));
export const deleteAccount =async (req, res) => ok(res, await accountService.deleteAccount(req.user, req.valid.body));

export const getConsent = async (req, res) => ok(res, await accountService.getConsent(req.db, req.user.id));
export const acceptConsent = async (req, res) => ok(res, await accountService.acceptConsent(req.db, req.user.id));

export const deleteChatMessages = async (req, res) =>
  ok(res, await accountService.deleteChatMessages(req.db, req.user.id));

export const deleteHistoryItem = async (req, res) =>
  ok(res, await accountService.deleteHistoryItem(req.db, req.user.id, req.valid.params));
