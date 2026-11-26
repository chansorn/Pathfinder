import { Router } from 'express';
import * as c from '../controllers/planner.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { uuidParam } from '../schemas/common.schema.js';
import {
  compareQuery,
  deadlinesQuery,
  saveProgramBody,
  programIdParam,
  simulateBody,
  groupParam,
  groupProgramsQuery,
  groupSimulateBody,
} from '../schemas/tcas.schema.js';

// TCAS data x the student's own scores - no AI involved, so no AI quota
const router = Router();

router.get('/tcas/programs/:id/check', requireAuth, validate({ params: uuidParam }), c.checkProgram);
// simulator's "pick a faculty" mode, public
router.get('/tcas/faculty-groups', c.listGroups);
router.get('/tcas/faculty-groups/:key/programs', validate({ params: groupParam, query: groupProgramsQuery }), c.groupPrograms);
router.post('/tcas/faculty-groups/:key/simulate', validate({ params: groupParam, body: groupSimulateBody }), c.groupSimulate);

router.get('/tcas/programs/:id/documents', validate({ params: uuidParam }), c.documents);
// public: lets students play with scores before logging in
router.post('/tcas/programs/:id/simulate', validate({ params: uuidParam, body: simulateBody }), c.simulate);
router.get('/tcas/compare', requireAuth, validate({ query: compareQuery }), c.compare);
router.get('/tcas/deadlines', requireAuth, validate({ query: deadlinesQuery }), c.deadlines);

router.get('/saved-programs', requireAuth, c.listSaved);
router.post('/saved-programs', requireAuth, validate({ body: saveProgramBody }), c.save);
router.delete('/saved-programs/:programId', requireAuth, validate({ params: programIdParam }), c.unsave);

// public, anonymous aggregates for the open house screen
router.get('/stats/overview', c.statsOverview);

export default router;
