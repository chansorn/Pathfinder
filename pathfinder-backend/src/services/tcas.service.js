import { anonClient } from '../config/supabase.js';
import { dbError, notFound } from '../utils/AppError.js';

const PROGRAM_COLS = 'id, academic_year, university, faculty, program, campus, url, tuition_note';
const ADMISSION_COLS =
  'program_id, round, project_name, seats, min_gpax, requirements, score_weights, last_year_min_score, apply_start, apply_end, source_url, notes';

// PostgREST filter strings treat , ( ) as syntax and % _ as wildcards - strip them from user input
const clean = (s = '') => s.replace(/[,()"'\\%_*]/g, ' ').replace(/\s+/g, ' ').trim();

// "ม.เกษตรศาสตร์" / "มหาวิทยาลัยเกษตรศาสตร์" -> "เกษตรศาสตร์" so either spelling matches
const coreUniversity = (s) => clean(s).replace(/^(มหาวิทยาลัย|มหาลัย|ม\.|มรภ\.?|มทร\.?)\s*/, '');
const coreFaculty = (s) => clean(s).replace(/^(คณะ|สาขาวิชา|สาขา)\s*/, '');

// programs and calendar can be on different years (e.g. next year's calendar is out before its programs)
export async function latestYear(db = anonClient(), table = 'tcas_programs') {
  const { data, error } = await db
    .from(table)
    .select('academic_year')
    .order('academic_year', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError(error, `tcas latest year (${table})`);
  return data?.academic_year ?? null;
}

// "แพทยศาสตร์" vs "แพทยศาสตรบัณฑิต": the trailing ์ disappears once a word is followed by
// บัณฑิต etc., so match on the word without it
const matchStem = (term) => term.replace(/์$/, '');

// "วท.บ. สาขาวิชาวิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)" -> "วิทยาการคอมพิวเตอร์"
const coreProgram = (name) =>
  name
    .replace(/^หลักสูตร/, '')
    .replace(/^[ก-๙]{1,6}\.[ก-๙]{1,3}\.(\([^)]*\))?\s*/, '') // degree abbreviation, e.g. วศ.บ. / บธ.บ.(...)
    .replace(/^(สาขาวิชา|สาขา)\s*/, '')
    .replace(/\s*\(.*$/, '')
    .trim();

// higher = better match. Starting with the term beats containing it somewhere
// (so แพทยศาสตร์ ranks แพทยศาสตรบัณฑิต above ทันตแพทยศาสตรบัณฑิต)
function relevance(p, stem) {
  const prog = coreProgram(p.program);
  const fac = coreFaculty(p.faculty);
  let score = 0;
  if (prog === stem || matchStem(prog) === stem) score += 100;
  else if (prog.startsWith(stem)) score += 80;
  else if (prog.includes(stem)) score += 40 - Math.min(prog.indexOf(stem), 20);
  if (matchStem(fac) === stem) score += 30;
  else if (fac.startsWith(stem)) score += 20;
  else if (fac.includes(stem)) score += 5;
  score -= Math.min(Math.abs(prog.length - stem.length), 20) / 2; // closer length = more specific
  if (p.program.includes('(ภาษาไทย ปกติ)')) score += 3; // the "default" track first
  return score;
}

export async function searchPrograms({ q, university, year, limit = 20 }, db = anonClient()) {
  year ??= await latestYear(db);
  if (!year) return { academic_year: null, items: [] };

  let query = db.from('tcas_programs').select(PROGRAM_COLS).eq('academic_year', year);
  const term = q && coreFaculty(q);
  const stem = term && matchStem(term);
  if (stem) query = query.or(`faculty.ilike.%${stem}%,program.ilike.%${stem}%`);
  const uni = university && coreUniversity(university);
  if (uni) query = query.ilike('university', `%${uni}%`);

  // with a search term, pull a wider pool and rank it here; plain substring matching
  // in the db has no idea which hit is the best one
  const pool = stem ? Math.min(limit * 15, 300) : limit;
  const { data, error } = await query.order('university').order('faculty').limit(pool);
  if (error) throw dbError(error, 'tcas search');

  const items = stem
    ? data
        .map((p) => ({ p, s: relevance(p, stem) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map(({ p }) => p)
    : data;
  return { academic_year: year, items };
}

async function admissionsFor(db, programIds) {
  if (!programIds.length) return new Map();
  const { data, error } = await db
    .from('tcas_admissions')
    .select(ADMISSION_COLS)
    .in('program_id', programIds)
    .order('round');
  if (error) throw dbError(error, 'tcas admissions');

  const byProgram = new Map();
  for (const { program_id, ...a } of data) {
    if (!byProgram.has(program_id)) byProgram.set(program_id, []);
    byProgram.get(program_id).push(a);
  }
  return byProgram;
}

export async function getProgram(id, db = anonClient()) {
  const { data, error } = await db.from('tcas_programs').select(PROGRAM_COLS).eq('id', id).maybeSingle();
  if (error) throw dbError(error, 'tcas program');
  if (!data) throw notFound('ไม่พบหลักสูตรนี้');
  const admissions = await admissionsFor(db, [id]);
  return { ...data, admissions: admissions.get(id) ?? [] };
}

// myTCAS program code from the program page url (course.mytcas.com/programs/<code>)
export const programCode = (url) => url?.match(/course\.mytcas\.com\/programs\/([0-9A-Za-z]+)/)?.[1] ?? null;

// official round 3 min/max of past years for one program, newest first
export async function getCutoffs(program, db = anonClient()) {
  const code = programCode(program.url);
  if (!code) return [];
  const { data, error } = await db
    .from('tcas_cutoffs')
    .select('academic_year, round, detail, seats, applicants, passed, min_score, max_score, min_score_final, source_url')
    .eq('program_code', code)
    .order('academic_year', { ascending: false });
  if (error) throw dbError(error, 'tcas cutoffs');
  return data;
}

// central TCAS events (university = null) + the own dates of any universities asked for
export async function getCalendar({ year, university, universities = [] } = {}, db = anonClient()) {
  year ??= await latestYear(db, 'tcas_calendar');
  if (!year) return { academic_year: null, items: [] };
  const { data, error } = await db
    .from('tcas_calendar')
    .select('university, round, event, start_date, end_date, source_url')
    .eq('academic_year', year)
    .order('start_date');
  if (error) throw dbError(error, 'tcas calendar');

  const wanted = [university, ...universities].filter(Boolean).map(coreUniversity).filter(Boolean);
  const items = data.filter((c) => !c.university || wanted.some((w) => c.university.includes(w)));
  return { academic_year: year, items };
}

/**
 * The TCAS facts we hand to the AI for a set of { faculty, university } targets.
 * null = there's no TCAS data in the db at all.
 * Kept small on purpose (max 8 programs, long text trimmed) so the prompt doesn't balloon.
 */
const trim = (s, n) => (s && s.length > n ? `${s.slice(0, n)}...` : s);

export async function buildTcasContext(targets = [], db = anonClient()) {
  const year = await latestYear(db);
  const universities = targets.map((t) => t?.university).filter(Boolean);
  const { academic_year: calendarYear, items: calendar } = await getCalendar({ universities }, db);
  if (!year && !calendarYear) return null;

  const seen = new Map();
  if (year) {
    for (const t of targets.slice(0, 5)) {
      if (!t?.faculty) continue;
      const { items } = await searchPrograms({ q: t.faculty, university: t.university, year, limit: 5 }, db);
      for (const p of items) if (seen.size < 8) seen.set(p.id, p);
    }
  }

  const admissions = await admissionsFor(db, [...seen.keys()]);
  const programs = [...seen.values()].map(({ id, academic_year, ...p }) => ({
    ...p,
    admissions: (admissions.get(id) ?? []).map((a) => ({
      ...a,
      requirements: trim(a.requirements, 400),
      notes: trim(a.notes, 200),
    })),
  }));

  return { academic_year: year ?? calendarYear, calendar_year: calendarYear, programs, calendar };
}

// --- import (service role only) ---

const CHUNK = 200;
const chunks = (arr, size = CHUNK) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
const programKey = (p) => [p.university, p.faculty, p.program, p.campus ?? ''].join('|');

/**
 * Upserts programs for one academic year and replaces their admission rows.
 * Calendar rows are replaced per scope (central / each university in the file).
 * replace=true also removes that year's programs that aren't in this file anymore.
 */
export async function importTcasData(db, { academic_year, programs = [], calendar = [], replace = false }) {
  const fail = (error, what) => {
    throw dbError(error, `tcas import ${what}`);
  };

  const idByKey = new Map();
  const now = new Date().toISOString();
  for (const batch of chunks(programs)) {
    const rows = batch.map(({ admissions, ...p }) => ({ ...p, program_code: programCode(p.url), academic_year, updated_at: now }));
    const { data, error } = await db
      .from('tcas_programs')
      .upsert(rows, { onConflict: 'academic_year,university,faculty,program,campus' })
      .select('id, university, faculty, program, campus');
    if (error) fail(error, 'programs');
    for (const r of data) idByKey.set(programKey(r), r.id);
  }

  // replace = mark and sweep: everything in this file was just touched (updated_at = now),
  // so whatever is older belongs to programs that are gone. Deleting only those keeps program ids
  // stable across re-imports, which matters because students' saved_programs point at them.
  if (replace && programs.length) {
    const { error } = await db.from('tcas_programs').delete().eq('academic_year', academic_year).lt('updated_at', now);
    if (error) fail(error, 'remove dropped programs');
  }

  // throw away old admission rows for these programs, then insert the new ones
  const ids = [...idByKey.values()];
  for (const batch of chunks(ids, 100)) {
    const { error } = await db.from('tcas_admissions').delete().in('program_id', batch);
    if (error) fail(error, 'clear admissions');
  }
  const admissionRows = programs.flatMap((p) =>
    p.admissions.map((a) => ({ ...a, program_id: idByKey.get(programKey(p)) })),
  );
  for (const batch of chunks(admissionRows, 500)) {
    const { error } = await db.from('tcas_admissions').insert(batch);
    if (error) fail(error, 'admissions');
  }

  // only replace the calendar rows this file is about: central rows if it has any,
  // plus the rows of each university it mentions. So the central calendar and
  // per-university files can be imported separately without wiping each other.
  if (calendar.length) {
    const unis = [...new Set(calendar.map((c) => c.university).filter(Boolean))];
    if (calendar.some((c) => !c.university)) {
      const { error } = await db.from('tcas_calendar').delete().eq('academic_year', academic_year).is('university', null);
      if (error) fail(error, 'clear central calendar');
    }
    for (const batch of chunks(unis, 50)) {
      const { error } = await db.from('tcas_calendar').delete().eq('academic_year', academic_year).in('university', batch);
      if (error) fail(error, 'clear university calendar');
    }
    for (const batch of chunks(calendar, 500)) {
      const { error } = await db
        .from('tcas_calendar')
        .insert(batch.map((c) => ({ ...c, university: c.university ?? null, academic_year })));
      if (error) fail(error, 'calendar');
    }
  }

  return { academic_year, programs: ids.length, admissions: admissionRows.length, calendar: calendar.length };
}

/** replaces all cutoff rows of the given years (scripts/import-cutoffs.js) */
export async function importCutoffs(db, rows) {
  const years = [...new Set(rows.map((r) => r.academic_year))];
  for (const y of years) {
    const { error } = await db.from('tcas_cutoffs').delete().eq('academic_year', y);
    if (error) throw dbError(error, `clear cutoffs ${y}`);
  }
  for (const batch of chunks(rows, 500)) {
    const { error } = await db.from('tcas_cutoffs').insert(batch);
    if (error) throw dbError(error, 'insert cutoffs');
  }
  return { years, rows: rows.length };
}
