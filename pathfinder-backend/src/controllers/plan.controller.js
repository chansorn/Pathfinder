import * as plan from '../services/plan.service.js';
import { ok } from '../utils/response.js';

export const getState = async (req, res) => ok(res, await plan.getState(req.db, req.user.id));
export const patchState = async (req, res) => ok(res, await plan.patchState(req.db, req.user.id, req.valid.body));

export const listProgress = async (req, res) => ok(res, await plan.listProgress(req.db, req.user.id, req.valid.query));
export const addProgress = async (req, res) => {
  const out = await plan.addProgress(req.db, req.user.id, req.valid.body);
  return ok(res, out, out.created ? 201 : 200);
};

export const getMyPlan = async (req, res) => ok(res, await plan.getMyPlan(req.db, req.user.id));
export const patchItem = async (req, res) => ok(res, await plan.patchItem(req.db, req.user.id, req.valid.params.id, req.valid.body));
export const syncItems = async (req, res) => ok(res, await plan.syncItems(req.db, req.user.id, req.valid.body.items));
export const addCustomItem = async (req, res) => ok(res, await plan.addCustomItem(req.db, req.user.id, req.valid.body), 201);
export const deleteItem = async (req, res) => ok(res, await plan.deleteItem(req.db, req.user.id, req.valid.params.id));
export const resetPlan = async (req, res) => ok(res, await plan.resetPlan(req.db, req.user.id));

const sendIcs = (res, filename, body) =>
  res
    .set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
    .send(body);

export const myPlanIcs = async (req, res) => sendIcs(res, 'pathfinder-tcas-plan.ics', await plan.myPlanIcs(req.db, req.user.id));

export const tcasCalendarIcs = async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  sendIcs(res, 'tcas-calendar.ics', await plan.tcasCalendarIcs(req.valid.query));
};
