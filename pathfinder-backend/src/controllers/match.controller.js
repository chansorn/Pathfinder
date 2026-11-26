import * as match from '../services/match.service.js';
import { ok } from '../utils/response.js';

export const programs = async (req, res) => ok(res, await match.matchPrograms(req.valid.body));
export const programsAi = async (req, res) => ok(res, await match.matchProgramsAi(req.valid.body, req.lang));
export const interests = async (req, res) => ok(res, await match.analyzeInterests(req.valid.body, req.lang));
export const guidance = async (req, res) => ok(res, await match.coachGuidance(req.valid.body, req.lang));
