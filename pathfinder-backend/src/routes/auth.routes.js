import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { registerLimiter, authLimiter, authIpLimiter, demoLimiter } from '../middlewares/rateLimit.js';
import {
  registerBody,
  loginBody,
  refreshBody,
  forgotPasswordBody,
  resetPasswordBody,
  changePasswordBody,
} from '../schemas/auth.schema.js';
import { schoolsQuery } from '../schemas/request.schema.js';

const router = Router();

// limiters go before validate so junk requests count too.
// authLimiter = per IP + email, authIpLimiter = per IP (x multiplier on shared venue IPs)
router.post('/auth/register', registerLimiter, validate({ body: registerBody }), c.register);
router.post('/auth/login', authIpLimiter, authLimiter, validate({ body: loginBody }), c.login);
router.post('/auth/refresh', validate({ body: refreshBody }), c.refresh);

// each call creates a throwaway account, so it gets its own per-IP limit + a daily cap
router.post('/auth/demo', demoLimiter, c.demo);
router.post('/auth/logout', requireAuth, c.logout);

router.post('/auth/forgot-password', authIpLimiter, authLimiter, validate({ body: forgotPasswordBody }), c.forgotPassword);
router.post('/auth/reset-password', authIpLimiter, validate({ body: resetPasswordBody }), c.resetPassword);
router.post('/auth/change-password', requireAuth, authLimiter, validate({ body: changePasswordBody }), c.changePassword);

router.get('/schools', validate({ query: schoolsQuery }), c.listSchools);
router.get('/grade-levels', c.listGradeLevels);

export default router;
