import { Router } from 'express';
import * as c from '../controllers/share.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { createShareBody, tokenParam } from '../schemas/share.schema.js';

const router = Router();

// owner side
router.post('/share', requireAuth, validate({ body: createShareBody }), c.create);
router.get('/share', requireAuth, c.list);
router.delete('/share/:token', requireAuth, validate({ params: tokenParam }), c.revoke);

// public side - whoever has the link (scanned the QR) can read it
router.get('/share/:token/qr.svg', validate({ params: tokenParam }), c.qr);
router.get('/share/:token', validate({ params: tokenParam }), c.read);

export default router;
