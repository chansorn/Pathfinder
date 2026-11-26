import { QUESTIONS, QUESTION_MAP, SCALE, DIMENSIONS } from '../data/assessmentQuestions.js';
import { assessmentAiSchema } from '../schemas/ai.schema.js';
import { assessmentPrompt } from '../prompts/assessment.prompt.js';
import { assessmentMock } from '../mocks/index.js';
import { generateJson } from './ai.service.js';
import { buildStudentContext } from './student.service.js';
import { inputHash, findCached } from './aiCache.service.js';
import { aiOrFallback, sampleOf } from './aiFallback.js';
import { badRequest, dbError } from '../utils/AppError.js';

export function getQuestions() {
  return {
    scale: SCALE,
    dimensions: DIMENSIONS,
    total: QUESTIONS.length,
    questions: QUESTIONS.map(({ id, group, text }) => ({ id, group, text })),
  };
}

// 0-100 per dimension from the average answer (1 -> 0, 5 -> 100)
export function scoreAnswers(answers) {
  const seen = new Set();
  for (const a of answers) {
    if (!QUESTION_MAP.has(a.question_id)) throw badRequest(`ไม่พบคำถามรหัส ${a.question_id}`);
    if (seen.has(a.question_id)) throw badRequest(`ตอบคำถาม ${a.question_id} ซ้ำ`);
    seen.add(a.question_id);
  }
  if (seen.size !== QUESTIONS.length) {
    throw badRequest(`กรุณาตอบให้ครบทั้ง ${QUESTIONS.length} ข้อ (ตอบแล้ว ${seen.size} ข้อ)`, 'INCOMPLETE_ANSWERS');
  }

  const sums = {};
  for (const a of answers) {
    const { group, dimension } = QUESTION_MAP.get(a.question_id);
    sums[group] ??= {};
    sums[group][dimension] ??= { total: 0, n: 0 };
    sums[group][dimension].total += a.value;
    sums[group][dimension].n += 1;
  }

  const scores = {};
  for (const [group, dims] of Object.entries(sums)) {
    scores[group] = {};
    for (const [dim, { total, n }] of Object.entries(dims)) {
      scores[group][dim] = Math.round(((total / n - 1) / 4) * 100);
    }
  }
  return scores;
}

export async function analyze(db, userId, answers, { force = false, lang = 'th', onStage = () => {}, noBudget = false } = {}) {
  const scores = scoreAnswers(answers);
  onStage('profile');
  const student = await buildStudentContext(db, userId);
  delete student.assessment; // they're redoing it, the old result is irrelevant

  // sorted so answering in a different order still hits the cache
  const sorted = [...answers].sort((a, b) => a.question_id.localeCompare(b.question_id));
  const hash = inputHash({ feature: 'assessment', student, answers: sorted, ...(lang === 'en' && { lang }) });

  if (!force || noBudget) {
    const hit = await findCached(db, { table: 'assessments', cols: 'id, result, created_at', userId, hash });
    if (hit) return { ...hit, cached: true };
  }

  const detailed = answers.map((a) => {
    const q = QUESTION_MAP.get(a.question_id);
    return { dimension: q.dimension, text: q.text, value: a.value };
  });

  return aiOrFallback({
    noBudget,
    lang,
    call: async () => {
      onStage('ai');
      const { result: ai } = await generateJson({
        feature: 'assessment',
        prompt: assessmentPrompt({ student, scores, answers: detailed }),
        schema: assessmentAiSchema,
        mock: assessmentMock,
        lang,
      });

      // our computed scores always win, the AI just interprets them
      const result = { ...ai, scores };

      const { data, error } = await db
        .from('assessments')
        .insert({ user_id: userId, answers, result, input_hash: hash })
        .select('id, result, created_at')
        .single();
      if (error) throw dbError(error, 'save assessment');
      return { ...data, cached: false };
    },
    // an older assessment was answered differently, so never show it as this one
    previous: async () => null,
    // the scores are real (computed here), only the written interpretation is the sample
    sample: () => ({ id: null, result: { ...sampleOf(assessmentAiSchema, assessmentMock), scores }, created_at: new Date().toISOString() }),
  });
}
