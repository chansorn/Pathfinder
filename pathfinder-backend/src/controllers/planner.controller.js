import * as planner from '../services/planner.service.js';
import * as stats from '../services/stats.service.js';
import * as groups from '../services/facultyGroups.service.js';
import { ok } from '../utils/response.js';

export const checkProgram = async (req, res) =>
  ok(res, await planner.checkProgram(req.db, req.user.id, req.valid.params.id, req.lang));
export const compare = async (req, res) => ok(res, await planner.comparePrograms(req.db, req.user.id, req.valid.query.ids, req.lang));
export const deadlines = async (req, res) => ok(res, await planner.upcomingDeadlines(req.db, req.user.id, req.valid.query));

export const simulate = async (req, res) => ok(res, await planner.simulate(req.valid.params.id, req.valid.body, req.lang));
export const documents = async (req, res) => ok(res, await planner.programDocuments(req.valid.params.id, req.lang));

export const listGroups = (req, res) => ok(res, groups.listGroups(req.lang));
export const groupPrograms = async (req, res) =>
  ok(res, await groups.popularPrograms(req.valid.params.key, req.valid.query, req.lang));
export const groupSimulate = async (req, res) =>
  ok(res, await groups.simulateGroup(req.valid.params.key, req.valid.body, req.lang));

export const listSaved = async (req, res) => ok(res, await planner.listSaved(req.db, req.user.id));
export const save = async (req, res) => ok(res, await planner.saveProgram(req.db, req.user.id, req.valid.body), 201);
export const unsave = async (req, res) => ok(res, await planner.unsaveProgram(req.db, req.user.id, req.valid.params.programId));

export const statsOverview = async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  ok(res, await stats.overview());
};
