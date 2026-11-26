import { dbError } from '../utils/AppError.js';

// Everything the AI gets to know about the student.
// Study data and interests only - never email, name, school or ids.
export async function buildStudentContext(db, userId) {
  const [profileRes, scoresRes, assessmentRes] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).maybeSingle(),
    db
      .from('exam_scores')
      .select('exam_type, subject, score, max_score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    db
      .from('assessments')
      .select('result')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const [res, ctx] of [
    [profileRes, 'load profile'],
    [scoresRes, 'load exam scores'],
    [assessmentRes, 'load assessment'],
  ]) {
    if (res.error) throw dbError(res.error, ctx);
  }

  const p = profileRes.data ?? {};

  let gradeLevel = null;
  if (p.grade_level_id) {
    const { data } = await db.from('grade_levels').select('name').eq('id', p.grade_level_id).maybeSingle();
    gradeLevel = data?.name ?? null;
  }

  const a = assessmentRes.data?.result;

  return {
    grade_level: gradeLevel,
    gpax: p.gpax ?? null,
    subject_grades: p.subject_grades ?? {},
    interests: p.interests ?? [],
    skills: p.skills ?? [],
    activities: p.activities ?? [],
    awards: p.awards ?? [],
    target_faculties: p.target_faculties ?? [],
    exam_scores: scoresRes.data ?? [],
    assessment: a
      ? {
          riasec_code: a.riasec_code,
          summary: a.summary,
          strengths: a.strengths,
          learning_style: a.learning_style?.primary,
          suggested_fields: a.suggested_fields,
          scores: a.scores,
        }
      : null,
  };
}
