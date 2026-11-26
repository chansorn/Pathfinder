import * as profileService from '../services/profile.service.js';
import * as avatarService from '../services/avatar.service.js';
import { ok } from '../utils/response.js';

export const getProfile = async (req, res) => ok(res, await profileService.getProfile(req.db, req.user.id));

export const updateProfile = async (req, res) =>
  ok(res, await profileService.updateProfile(req.db, req.user.id, req.valid.body));

export const uploadAvatar = async (req, res) => ok(res, await avatarService.uploadAvatar(req.db, req.user.id, req.body));
export const deleteAvatar = async (req, res) => ok(res, await avatarService.deleteAvatar(req.db, req.user.id));

export const listExamScores = async (req, res) => ok(res, await profileService.listExamScores(req.db, req.user.id));

export const addExamScore = async (req, res) =>
  ok(res, await profileService.addExamScore(req.db, req.user.id, req.valid.body), 201);

export const deleteExamScore = async (req, res) =>
  ok(res, await profileService.deleteExamScore(req.db, req.user.id, req.valid.params.id));
