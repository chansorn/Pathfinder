import { dbError, notFound, badRequest } from '../utils/AppError.js';
import { bangkokDay, addDays } from '../utils/date.js';
import { getProgram, searchPrograms, getCalendar, getCutoffs } from './tcas.service.js';
import {
  buildScoreMap,
  computeScore,
  checkEligibility,
  gapToLastYear,
  matchCutoffs,
  scoreZone,
  zoneRule,
} from './scoring.js';
import { parseRequirements, docsForRound } from './requirements.js';
import { t } from '../utils/i18n.js';

// Everything that combines TCAS data with one student's own data:
// score/eligibility check, compare, saved programs, upcoming deadlines.

async function loadStudent(db, userId) {
  const [profile, scores] = await Promise.all([
    db.from('profiles').select('gpax, target_faculties').eq('id', userId).maybeSingle(),
    db.from('exam_scores').select('exam_type, subject, score, max_score').eq('user_id', userId),
  ]);
  if (profile.error) throw dbError(profile.error, 'planner profile');
  if (scores.error) throw dbError(scores.error, 'planner scores');
  const gpax = profile.data?.gpax ?? null;
  return {
    gpax,
    targets: profile.data?.target_faculties ?? [],
    scoreMap: buildScoreMap(scores.data, gpax),
    examCount: scores.data.length,
  };
}

// cutoff table missing / empty shouldn't break the check, it just has no history
async function safeCutoffs(program) {
  try {
    return await getCutoffs(program);
  } catch {
    return [];
  }
}

function checkAdmissions(program, student, today, cutoffs = [], lang = 'th') {
  return program.admissions.map((a) => {
    const score = computeScore(a.score_weights, student.scoreMap, lang);
    // official cutoffs only exist for round 3 (Admission)
    const history = a.round === 3 ? matchCutoffs(a, cutoffs) : [];
    const lastYearMin = history[0]?.min_score ?? a.last_year_min_score;
    return {
      round: a.round,
      project_name: a.project_name,
      seats: a.seats,
      min_gpax: a.min_gpax,
      apply_end: a.apply_end,
      source_url: a.source_url,
      score,
      gap_to_last_year: gapToLastYear(score?.weighted_score, lastYearMin),
      last_year_min_score: lastYearMin ?? null,
      cutoff_history: history,
      zone: scoreZone(score?.weighted_score, history),
      // portfolio criteria / documents pulled out of the requirements text
      requirements_parsed: parseRequirements(a.requirements),
      eligibility: checkEligibility(a, { gpax: student.gpax, score, today, lang }),
    };
  });
}

const summarize = (checks) => ({
  eligible: checks.filter((c) => c.eligibility.status === 'eligible').length,
  total: checks.length,
  // best fully-known weighted score across the program's projects
  best_score: checks.reduce((m, c) => (c.score?.weighted_score != null && c.score.weighted_score > (m ?? -1) ? c.score.weighted_score : m), null),
});

// 1 + 2: your weighted score and eligibility for every project of one program
export async function checkProgram(db, userId, programId, lang = 'th') {
  const [program, student] = await Promise.all([getProgram(programId), loadStudent(db, userId)]);
  const admissions = checkAdmissions(program, student, bangkokDay(), await safeCutoffs(program), lang);
  return {
    program: { ...program, admissions: undefined },
    student: { gpax: student.gpax, exam_scores: student.examCount },
    admissions,
    summary: summarize(admissions),
    zone_rule: zoneRule(lang),
  };
}

/**
 * Score simulator: same math as /check but with scores the student is just trying out.
 * Nothing is saved and no login is needed. Only projects with score weights are returned.
 */
export async function simulate(programId, { scores, gpax = null }, lang = 'th') {
  const program = await getProgram(programId);
  const student = { gpax, scoreMap: buildScoreMap(scores, gpax) };
  const cutoffs = await safeCutoffs(program);
  const admissions = checkAdmissions(
    { ...program, admissions: program.admissions.filter((a) => a.score_weights && Object.keys(a.score_weights).length) },
    student,
    bangkokDay(),
    cutoffs,
    lang,
  );

  // the one to highlight: a round 3 project with history, best zone first
  const rank = { safe: 3, target: 2, reach: 1 };
  const best = admissions
    .filter((a) => a.zone)
    .sort((x, y) => rank[y.zone.zone] - rank[x.zone.zone] || (y.score?.weighted_score ?? 0) - (x.score?.weighted_score ?? 0))[0];

  return {
    program: { ...program, admissions: undefined },
    admissions,
    best: best ? { project_name: best.project_name, round: best.round, score: best.score, zone: best.zone } : null,
    zone_rule: zoneRule(lang),
    verify_note: t(lang, 'cutoff_verify'),
  };
}

// "Recommended Docs": per round, what the projects ask for (public, no login)
export async function programDocuments(programId, lang = 'th') {
  const program = await getProgram(programId);
  return {
    program: { ...program, admissions: undefined },
    rounds: [1, 2, 3, 4].map((round) => {
      const projects = program.admissions.filter((a) => a.round === round);
      return {
        round,
        recommended_docs: docsForRound(projects),
        projects: projects.map((a) => ({
          project_name: a.project_name,
          apply_end: a.apply_end,
          source_url: a.source_url,
          ...parseRequirements(a.requirements),
        })),
      };
    }),
    note: t(lang, 'docs_note'),
  };
}

// 4: side by side, 2-4 programs
export async function comparePrograms(db, userId, ids, lang = 'th') {
  const unique = [...new Set(ids)];
  if (unique.length < 2) throw badRequest('เลือกหลักสูตรอย่างน้อย 2 หลักสูตรเพื่อเปรียบเทียบ');
  const [student, ...programs] = await Promise.all([loadStudent(db, userId), ...unique.map((id) => getProgram(id))]);
  const today = bangkokDay();
  const cutoffs = await Promise.all(programs.map(safeCutoffs));
  return {
    student: { gpax: student.gpax, exam_scores: student.examCount },
    programs: programs.map((p, i) => {
      const admissions = checkAdmissions(p, student, today, cutoffs[i], lang);
      return { ...p, admissions, summary: summarize(admissions) };
    }),
    zone_rule: zoneRule(lang),
  };
}

// --- saved programs (4) ---

export async function listSaved(db, userId) {
  const { data, error } = await db
    .from('saved_programs')
    .select('program_id, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw dbError(error, 'list saved programs');
  if (!data.length) return [];

  const { data: programs, error: pErr } = await db
    .from('tcas_programs')
    .select('id, academic_year, university, faculty, program, campus, tuition_note, url')
    .in('id', data.map((s) => s.program_id));
  if (pErr) throw dbError(pErr, 'saved program details');
  const byId = new Map(programs.map((p) => [p.id, p]));
  // a program can disappear after a re-import with --replace; keep the row but say so
  return data.map((s) => ({ ...s, program: byId.get(s.program_id) ?? null }));
}

export async function saveProgram(db, userId, { program_id, note }) {
  await getProgram(program_id); // 404 if it doesn't exist
  const { data, error } = await db
    .from('saved_programs')
    .upsert({ user_id: userId, program_id, note: note ?? null }, { onConflict: 'user_id,program_id' })
    .select('program_id, note, created_at')
    .single();
  if (error) throw dbError(error, 'save program');
  return data;
}

export async function unsaveProgram(db, userId, programId) {
  const { data, error } = await db
    .from('saved_programs')
    .delete()
    .eq('user_id', userId)
    .eq('program_id', programId)
    .select('program_id');
  if (error) throw dbError(error, 'unsave program');
  if (!data.length) throw notFound('ไม่พบหลักสูตรนี้ในรายการที่บันทึกไว้');
  return { program_id: programId };
}

// --- upcoming deadlines (3) ---

// target programs from the profile + saved programs + calendar dates, within the next `days`
export async function upcomingDeadlines(db, userId, { days }) {
  const today = bangkokDay();
  const until = addDays(today, days);
  const student = await loadStudent(db, userId);

  const programIds = new Set();
  const universities = new Set();
  for (const t of student.targets.slice(0, 5)) {
    if (t?.university) universities.add(t.university);
    if (!t?.faculty) continue;
    const { items } = await searchPrograms({ q: t.faculty, university: t.university, limit: 3 });
    items.forEach((p) => programIds.add(p.id));
  }
  const saved = await listSaved(db, userId);
  for (const s of saved) {
    if (!s.program) continue;
    programIds.add(s.program_id);
    universities.add(s.program.university);
  }

  const items = [];
  if (programIds.size) {
    const { data: adm, error } = await db
      .from('tcas_admissions')
      .select('program_id, round, project_name, apply_end, source_url')
      .in('program_id', [...programIds])
      .gte('apply_end', today)
      .lte('apply_end', until)
      .order('apply_end');
    if (error) throw dbError(error, 'deadlines');

    const { data: progs, error: pErr } = await db
      .from('tcas_programs')
      .select('id, university, program, campus')
      .in('id', [...programIds]);
    if (pErr) throw dbError(pErr, 'deadline programs');
    const byId = new Map(progs.map((p) => [p.id, p]));

    for (const a of adm) {
      const p = byId.get(a.program_id);
      items.push({
        date: a.apply_end,
        kind: 'project_deadline',
        title: `ปิดรับสมัคร ${a.project_name}`,
        round: a.round,
        university: p?.university ?? null,
        program: p?.program ?? null,
        campus: p?.campus ?? null,
        program_id: a.program_id,
        source_url: a.source_url,
      });
    }
  }

  // calendar rows overlapping the window: central ones + the student's universities
  const { items: calendar } = await getCalendar({ universities: [...universities] });
  for (const c of calendar) {
    const end = c.end_date ?? c.start_date;
    if (end < today || c.start_date > until) continue;
    items.push({
      date: c.start_date < today ? today : c.start_date,
      kind: 'calendar',
      title: c.event,
      round: c.round,
      university: c.university,
      start_date: c.start_date,
      end_date: c.end_date,
      source_url: c.source_url,
    });
  }

  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { from: today, to: until, items };
}
