import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import aiRoutes from './ai.routes.js';
import accountRoutes from './account.routes.js';
import tcasRoutes from './tcas.routes.js';
import plannerRoutes from './planner.routes.js';
import shareRoutes from './share.routes.js';
import planRoutes from './plan.routes.js';
import coachRoutes from './coach.routes.js';
import matchRoutes from './match.routes.js';

// mounted under /api in app.js (/api/health lives there too)
const router = Router();

router.use(authRoutes);
router.use(profileRoutes);
router.use(aiRoutes);
router.use(accountRoutes);
// planner first: /tcas/compare and /tcas/deadlines must not be swallowed by /tcas/programs/:id
router.use(plannerRoutes);
// before tcas too: /tcas/calendar.ics
router.use(planRoutes);
router.use(tcasRoutes);
router.use(coachRoutes);
router.use(matchRoutes);
router.use(shareRoutes);

export default router;
