import { Router } from 'express';
import * as c from '../controllers/match.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { aiLimiter, aiDailyCap } from '../middlewares/rateLimit.js';
import { matchBody, interestTextBody } from '../schemas/request.schema.js';

const router = Router();

// "คณะที่ใช่": public, no AI, no quota - top real programs (one per university) for the Step 1-3 answers
router.post('/match/programs', validate({ body: matchBody }), c.programs);
// "refresh with AI": AI picks from the next real candidates. login + AI quota like the other AI features
router.post('/match/programs/ai', requireAuth, validate({ body: matchBody }), aiLimiter, aiDailyCap, c.programsAi);
// Step 1 free text -> interest keys (AI)
router.post('/match/interests', requireAuth, validate({ body: interestTextBody }), aiLimiter, aiDailyCap, c.interests);

export default router;
