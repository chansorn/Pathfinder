import * as assessmentService from '../services/assessment.service.js';
import * as recommendService from '../services/recommend.service.js';
import * as historyService from '../services/history.service.js';
import { ok } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { errorMessage } from '../utils/i18n.js';
import { log } from '../utils/log.js';
import { wantsStream, openSse } from '../utils/sse.js';
import { reportError } from '../config/sentry.js';
import { env } from '../config/env.js';

const HEARTBEAT_MS = 5000;

/**
 * Runs one AI feature. work(onStage) returns { ..., cached }.
 *
 * JSON (default): 201 for a fresh AI answer, 200 for a cached one.
 * SSE ("Accept: text/event-stream"), so a 45s wait doesn't look frozen:
 *   event: progress { stage, elapsed_ms }   stages: started, profile, tcas_data, ai, saving, working (heartbeat)
 *   event: done     { status: 200 | 201, data }
 *   event: error    { status, code, message, request_id }
 * Either way res.locals.aiCached tells the rate limiters not to count a cached answer.
 * If the client goes away mid-way the work still finishes and is saved, so a retry is a cache hit.
 */
// cached answers cost nothing: tell aiLimiter (reads aiCached on finish) and give the daily slot back now
function markCached(res, data) {
  res.locals.aiCached = data.cached;
  if (data.cached) res.locals.releaseAiQuota?.();
}

// requestTimeout can't help once SSE headers are out, so the stream needs its own limit
// (same as requestTimeout gives AI routes). Otherwise a hung DB call = heartbeats forever
const STREAM_LIMIT_MS = env.GEMINI_TIMEOUT_MS * 2 + 10_000;

function withLimit(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AppError(500, 'REQUEST_TIMEOUT', 'ระบบใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runAi(req, res, work) {
  if (!wantsStream(req)) {
    const data = await work(() => {});
    markCached(res, data);
    return ok(res, data, data.cached ? 200 : 201);
  }

  const sse = openSse(res);
  const started = Date.now();
  const progress = (stage) => sse.send('progress', { stage, elapsed_ms: Date.now() - started });
  progress('started');
  const beat = setInterval(() => progress('working'), HEARTBEAT_MS);
  // client gone: stop the heartbeat now (the work itself still finishes and is saved)
  res.on('close', () => clearInterval(beat));
  try {
    const data = await withLimit(work(progress), STREAM_LIMIT_MS);
    markCached(res, data);
    sse.send('done', { status: data.cached ? 200 : 201, data });
  } catch (err) {
    const e = err instanceof AppError ? err : new AppError(500, 'INTERNAL_ERROR', 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง');
    if (e.status >= 500) {
      log.error(`[ai] ${req.method} ${req.path} (stream) ->`, err?.code ?? '', err?.message ?? err);
      reportError(err, req);
    }
    sse.send('error', { status: e.status, code: e.code, message: errorMessage(req.lang, e.code, e.message), request_id: req.id });
  } finally {
    clearInterval(beat);
    sse.end();
  }
}

const opts = (req, onStage, force) => ({ force, lang: req.lang, onStage, noBudget: req.res.locals.aiNoBudget === true });

export const getQuestions = (req, res) => ok(res, assessmentService.getQuestions());

export const analyzeAssessment = (req, res) => {
  const { answers, force } = req.valid.body;
  return runAi(req, res, (onStage) => assessmentService.analyze(req.db, req.user.id, answers, opts(req, onStage, force)));
};

export const recommendFaculties = (req, res) =>
  runAi(req, res, (onStage) => recommendService.recommend(req.db, req.user.id, 'faculty', {}, opts(req, onStage, req.valid.body.force)));

export const recommendCareers = (req, res) => {
  const { faculty, force } = req.valid.body;
  // only add faculty to the input when it's set, so "no faculty" always hashes the same
  const input = faculty ? { faculty } : {};
  return runAi(req, res, (onStage) => recommendService.recommend(req.db, req.user.id, 'career', input, opts(req, onStage, force)));
};

export const recommendPortfolio = (req, res) =>
  runAi(req, res, (onStage) => recommendService.recommend(req.db, req.user.id, 'portfolio', {}, opts(req, onStage, req.valid.body.force)));

export const recommendSkills = (req, res) =>
  runAi(req, res, (onStage) => recommendService.recommend(req.db, req.user.id, 'skill', {}, opts(req, onStage, req.valid.body.force)));

export const highYield = (req, res) => {
  const { force, ...input } = req.valid.body;
  return runAi(req, res, (onStage) => recommendService.recommend(req.db, req.user.id, 'high_yield', input, opts(req, onStage, force)));
};

export const createTcasPlan = (req, res) => {
  const { force, ...target } = req.valid.body;
  return runAi(req, res, (onStage) => recommendService.createTcasPlan(req.db, req.user.id, target, opts(req, onStage, force)));
};

export const getHistory = async (req, res) =>
  ok(res, await historyService.getHistory(req.db, req.user.id, req.valid.query));
