import { Router } from 'express';
import * as c from '../controllers/account.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import { deleteAccountBody } from '../schemas/auth.schema.js';
import { historyItemParams } from '../schemas/request.schema.js';

// PDPA: consent, export, delete
const router = Router();

router.get('/me', requireAuth, c.me);
router.get('/account/export', requireAuth, c.exportData);
router.delete('/account', requireAuth, authLimiter, validate({ body: deleteAccountBody }), c.deleteAccount);

router.get('/account/consent', requireAuth, c.getConsent);
router.post('/account/consent', requireAuth, c.acceptConsent);

router.delete('/chat/messages', requireAuth, c.deleteChatMessages);
router.delete('/history/:type/:id', requireAuth, validate({ params: historyItemParams }), c.deleteHistoryItem);

export default router;
