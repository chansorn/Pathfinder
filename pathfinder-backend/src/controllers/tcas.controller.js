import * as tcasService from '../services/tcas.service.js';
import { ok } from '../utils/response.js';

export const searchPrograms = async (req, res) => ok(res, await tcasService.searchPrograms(req.valid.query));
export const getProgram = async (req, res) => ok(res, await tcasService.getProgram(req.valid.params.id));
export const getCalendar = async (req, res) => ok(res, await tcasService.getCalendar(req.valid.query));
