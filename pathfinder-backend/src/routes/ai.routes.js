import { Router } from 'express';
import * as c from '../controllers/ai.controller.js';
import { chat } from '../controllers/chat.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { aiLimiter, aiDailyCap, aiDailyCapSoft } from '../middlewares/rateLimit.js';
import {
  aiBody,
  analyzeAssessmentBody,
  careersBody,
  tcasPlanBody,
  chatBody,
  historyQuery,
} from '../schemas/request.schema.js';

const router = Router();

// no AI call, no AI quota
router.get('/assessment/questions', requireAuth, c.getQuestions);
router.get('/history', requireAuth, validate({ query: historyQuery }), c.getHistory);

// auth -> validate -> per-user limit -> app-wide daily cap
// validating first means a bad request doesn't eat quota.
// soft cap: once today's budget is gone these still answer (cache / last result / sample)
const ai = (schema) => [requireAuth, validate({ body: schema }), aiLimiter, aiDailyCapSoft];

router.post('/assessment/analyze', ...ai(analyzeAssessmentBody), c.analyzeAssessment);
router.post('/recommend/faculties', ...ai(aiBody), c.recommendFaculties);
router.post('/recommend/careers', ...ai(careersBody), c.recommendCareers);
router.post('/recommend/portfolio', ...ai(aiBody), c.recommendPortfolio);
router.post('/recommend/skills', ...ai(aiBody), c.recommendSkills);
router.post('/plan/tcas', ...ai(tcasPlanBody), c.createTcasPlan);
// chat has nothing sensible to fall back on, so it gets the hard cap (429)
router.post('/chat', requireAuth, validate({ body: chatBody }), aiLimiter, aiDailyCap, chat);

export default router;
