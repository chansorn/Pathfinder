import { Router } from 'express';
import { highYield } from '../controllers/ai.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { aiLimiter, aiDailyCapSoft } from '../middlewares/rateLimit.js';
import { highYieldBody, guidanceBody } from '../schemas/request.schema.js';
import { guidance } from '../controllers/match.controller.js';

const router = Router();

// AI coach: top chapters to study per hour. same quota rules as the other AI endpoints
router.post('/coach/high-yield', requireAuth, validate({ body: highYieldBody }), aiLimiter, aiDailyCapSoft, highYield);
// AI coach "แนวทาง": every refresh = another angle + programs not shown before (real myTCAS programs only)
router.post('/coach/guidance', requireAuth, validate({ body: guidanceBody }), aiLimiter, aiDailyCapSoft, guidance);

export default router;
