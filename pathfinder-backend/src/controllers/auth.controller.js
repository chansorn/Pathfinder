import * as authService from '../services/auth.service.js';
import * as referenceService from '../services/reference.service.js';
import * as demoService from '../services/demo.service.js';
import { ok } from '../utils/response.js';

export const register = async (req, res) => ok(res, await authService.register(req.valid.body), 201);
export const login = async (req, res) => ok(res, await authService.login(req.valid.body));
export const refresh = async (req, res) => ok(res, await authService.refresh(req.valid.body));

export const logout = async (req, res) => {
  await authService.logout(req.accessToken);
  ok(res, { message: 'ออกจากระบบแล้ว' });
};

export const demo = async (req, res) => ok(res, await demoService.startDemo(), 201);

export const forgotPassword = async (req, res) => ok(res, await authService.forgotPassword(req.valid.body));
export const resetPassword = async (req, res) => ok(res, await authService.resetPassword(req.valid.body));

export const changePassword = async (req, res) =>
  ok(res, await authService.changePassword(req.user, req.accessToken, req.valid.body));

export const listSchools = async (req, res) => ok(res, await referenceService.listSchools(req.valid.query));
export const listGradeLevels = async (req, res) => ok(res, await referenceService.listGradeLevels());
