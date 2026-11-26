import {
  facultiesAiSchema,
  careersAiSchema,
  portfolioAiSchema,
  skillsAiSchema,
  tcasPlanAiSchema,
  highYieldAiSchema,
} from '../schemas/ai.schema.js';
import { highYieldPrompt } from '../prompts/coach.prompt.js';
import { highYieldMock } from '../mocks/index.js';
import { facultiesPrompt } from '../prompts/faculties.prompt.js';
import { careersPrompt } from '../prompts/careers.prompt.js';
import { portfolioPrompt } from '../prompts/portfolio.prompt.js';
import { skillsPrompt } from '../prompts/skills.prompt.js';
import { tcasPrompt } from '../prompts/tcas.prompt.js';
import { facultiesMock, careersMock, portfolioMock, skillsMock, tcasPlanMock } from '../mocks/index.js';
import { env } from '../config/env.js';
import { generateJson } from './ai.service.js';
import { buildStudentContext } from './student.service.js';
import { buildTcasContext } from './tcas.service.js';
import { inputHash, findCached, findLatest } from './aiCache.service.js';
import { aiOrFallback, sampleOf } from './aiFallback.js';
import { dbError } from '../utils/AppError.js';
import { log } from '../utils/log.js';

// usesTcas: feed the student's target programs from our TCAS table into the prompt
const FEATURES = {
  faculty: { schema: facultiesAiSchema, prompt: facultiesPrompt, mock: facultiesMock, usesTcas: true },
  career: { schema: careersAiSchema, prompt: careersPrompt, mock: careersMock },
  portfolio: { schema: portfolioAiSchema, prompt: portfolioPrompt, mock: portfolioMock, usesTcas: true },
  skill: { schema: skillsAiSchema, prompt: skillsPrompt, mock: skillsMock },
  // coach: which chapters to study first. no web search on purpose: tried it against real Gemini,
  // it took ~32s (over the timeout) and quoted "the mytcas blueprint" without returning any source
  high_yield: { schema: highYieldAiSchema, prompt: highYieldPrompt, mock: highYieldMock },
};

const REC_COLS = 'id, type, result, created_at';
const PLAN_COLS = 'id, target, plan, created_at';

// TCAS lookup failing shouldn't kill the whole feature, the AI just gets less to work with
export async function safeTcasContext(targets) {
  try {
    return await buildTcasContext(targets);
  } catch (err) {
    log.warn('[tcas] context lookup failed:', err?.message ?? err);
    return null;
  }
}

// what we tell the client about the data behind an answer
const dataInfo = (tcas, sources) => ({
  tcas_data: tcas ? { academic_year: tcas.academic_year, programs_found: tcas.programs.length } : null,
  web_sources: sources,
});

// faculty / career / portfolio / skill / high_yield, all saved to recommendations.
// Returns the last answer instead if nothing changed since (unless force).
// noBudget = today's AI cap is used up: cache or fallback only (see aiFallback.js)
export async function recommend(db, userId, type, input = {}, { force = false, lang = 'th', onStage = () => {}, noBudget = false } = {}) {
  const f = FEATURES[type];
  onStage('profile');
  const student = await buildStudentContext(db, userId);
  if (f.usesTcas) onStage('tcas_data');
  const tcas = f.usesTcas ? await safeTcasContext(student.target_faculties) : null;
  const webSearch = Boolean(f.webSearch && env.TCAS_WEB_SEARCH);
  // tcas is part of the hash, so importing new TCAS data invalidates old answers.
  // lang only when English, so existing Thai answers keep their hash
  const hash = inputHash({ feature: type, student, input, tcas, webSearch, ...(lang === 'en' && { lang }) });

  // out of budget: an exact cache hit is still the best answer, even when they asked for a fresh one
  if (!force || noBudget) {
    const hit = await findCached(db, { table: 'recommendations', cols: REC_COLS, userId, hash, type });
    if (hit) return { ...hit, cached: true };
  }

  // same extras on a real answer and on a sample
  const finish = (result, sources = []) => {
    if (type === 'career' && input.faculty) result.faculty = input.faculty;
    if (f.usesTcas) Object.assign(result, dataInfo(tcas, sources));
    if (f.webSearch) result.web_sources = sources;
    return result;
  };

  // which saved results answered the same question (fallback "previous")
  const sameInput = {
    career: (r) => (r.faculty ?? null) === (input.faculty ?? null),
    high_yield: (r) => r.subject === input.subject,
  }[type];

  return aiOrFallback({
    noBudget,
    lang,
    call: async () => {
      onStage('ai');
      const { result, sources } = await generateJson({
        feature: type,
        prompt: f.prompt({ student, tcas, webSearch, ...input }),
        schema: f.schema,
        mock: f.mock,
        useSearch: webSearch,
        lang,
      });
      // the subject they asked for, not the AI's rewording, so the fallback can find it again
      if (type === 'high_yield') result.subject = input.subject;
      onStage('saving');
      const { data, error } = await db
        .from('recommendations')
        .insert({ user_id: userId, type, result: finish(result, sources), input_hash: hash })
        .select(REC_COLS)
        .single();
      if (error) throw dbError(error, `save recommendation ${type}`);
      return { ...data, cached: false };
    },
    previous: () =>
      findLatest(db, { table: 'recommendations', cols: REC_COLS, userId, type, match: sameInput && ((row) => sameInput(row.result ?? {})) }),
    sample: () => ({ id: null, type, result: finish(sampleOf(f.schema, f.mock)), created_at: new Date().toISOString() }),
  });
}

export async function createTcasPlan(
  db,
  userId,
  { target_faculty, target_university },
  { force = false, lang = 'th', onStage = () => {}, noBudget = false } = {},
) {
  onStage('profile');
  const student = await buildStudentContext(db, userId);
  const target = { faculty: target_faculty, university: target_university };
  onStage('tcas_data');
  const tcas = await safeTcasContext([target]);
  // only go to the web when our own table has no admission criteria for this program
  const webSearch = env.TCAS_WEB_SEARCH && !tcas?.programs.some((p) => p.admissions.length);
  const hash = inputHash({ feature: 'tcas', student, target, tcas, webSearch, ...(lang === 'en' && { lang }) });

  if (!force || noBudget) {
    const hit = await findCached(db, { table: 'tcas_plans', cols: PLAN_COLS, userId, hash });
    if (hit) return { ...hit, cached: true };
  }

  const finish = (plan, sources = []) => {
    plan.rounds.sort((a, b) => a.round - b.round);
    return Object.assign(plan, dataInfo(tcas, sources));
  };

  return aiOrFallback({
    noBudget,
    lang,
    call: async () => {
      // with web search on this is the slow part (~45s with real Gemini)
      onStage(webSearch ? 'ai_web_search' : 'ai');
      const { result, sources } = await generateJson({
        feature: 'tcas',
        prompt: tcasPrompt({ student, targetFaculty: target_faculty, targetUniversity: target_university, tcas, webSearch }),
        schema: tcasPlanAiSchema,
        mock: tcasPlanMock,
        useSearch: webSearch,
        lang,
      });
      onStage('saving');
      const { data, error } = await db
        .from('tcas_plans')
        .insert({ user_id: userId, target, plan: finish(result, sources), input_hash: hash })
        .select(PLAN_COLS)
        .single();
      if (error) throw dbError(error, 'save tcas plan');
      return { ...data, cached: false };
    },
    // a plan for another program would be confusing - only reuse one for the same target
    previous: () =>
      findLatest(db, {
        table: 'tcas_plans',
        cols: PLAN_COLS,
        userId,
        match: (p) => p.target?.faculty === target_faculty && (p.target?.university ?? null) === (target_university ?? null),
      }),
    sample: () => ({ id: null, target, plan: finish(sampleOf(tcasPlanAiSchema, tcasPlanMock)), created_at: new Date().toISOString() }),
  });
}
