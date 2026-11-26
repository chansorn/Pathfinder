import { Router } from 'express';
import * as c from '../controllers/tcas.controller.js';
import { validate } from '../middlewares/validate.js';
import { uuidParam } from '../schemas/common.schema.js';
import { tcasProgramsQuery, tcasCalendarQuery } from '../schemas/tcas.schema.js';

// public reference data, no login needed
const router = Router();

router.get('/tcas/programs', validate({ query: tcasProgramsQuery }), c.searchPrograms);
router.get('/tcas/programs/:id', validate({ params: uuidParam }), c.getProgram);
router.get('/tcas/calendar', validate({ query: tcasCalendarQuery }), c.getCalendar);

export default router;
