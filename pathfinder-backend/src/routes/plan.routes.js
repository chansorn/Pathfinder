import { Router } from 'express';
import * as c from '../controllers/plan.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import {
  statePatchBody,
  itemKeyParam,
  patchItemBody,
  syncItemsBody,
  customItemBody,
  calendarIcsQuery,
  progressBody,
  progressQuery,
} from '../schemas/state.schema.js';

const router = Router();

// app state synced from localStorage
router.get('/me/state', requireAuth, c.getState);
router.patch('/me/state', requireAuth, validate({ body: statePatchBody }), c.patchState);

// analytics page trend chart
router.get('/me/progress', requireAuth, validate({ query: progressQuery }), c.listProgress);
router.post('/me/progress', requireAuth, validate({ body: progressBody }), c.addProgress);

// roadmap
router.get('/my-plan', requireAuth, c.getMyPlan);
router.get('/my-plan/calendar.ics', requireAuth, c.myPlanIcs);
router.post('/my-plan/reset', requireAuth, c.resetPlan);
router.put('/my-plan/items', requireAuth, validate({ body: syncItemsBody }), c.syncItems);
router.post('/my-plan/items', requireAuth, validate({ body: customItemBody }), c.addCustomItem);
router.patch('/my-plan/items/:id', requireAuth, validate({ params: itemKeyParam, body: patchItemBody }), c.patchItem);
router.delete('/my-plan/items/:id', requireAuth, validate({ params: itemKeyParam }), c.deleteItem);

// public central calendar as a file (add ?university= for that university's dates too)
router.get('/tcas/calendar.ics', validate({ query: calendarIcsQuery }), c.tcasCalendarIcs);

export default router;
