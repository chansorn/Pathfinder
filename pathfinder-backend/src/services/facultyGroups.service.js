import { anonClient } from '../config/supabase.js';
import { dbError, notFound } from '../utils/AppError.js';
import { latestYear, programCode } from './tcas.service.js';
import { simulate } from './planner.service.js';
import { zoneRule } from './scoring.js';
import { t } from '../utils/i18n.js';
import { fetchAll } from '../utils/fetchAll.js';

// The simulator's 6 big choices (Computer Eng, Medicine, BBA, Architecture & Design, Comm Arts, Law)
// mapped onto real programs. "Popular" = most applicants in last year's official round 3 stats,
// so the list comes from data, not from us picking favourites.

export const GROUPS = {
  'computer-eng': {
    th: 'วิศวกรรมคอมพิวเตอร์',
    en: 'Computer Engineering',
    or: 'program.ilike.%วิศวกรรมคอมพิวเตอร์%',
  },
  medicine: {
    th: 'แพทยศาสตร์',
    en: 'Medicine',
    or: 'program.ilike.%แพทยศาสตรบัณฑิต%',
    // vet, dentistry and emergency medicine all contain "แพทยศาสตรบัณฑิต" too
    keep: (p) => !/สัตว|ทันต|ฉุกเฉิน/.test(p.program),
    // checked against real data: round 3 medicine goes through กสพท, the ทปอ. min/max file has no
    // usable rows for it, so no ranking or zone - say so instead of showing an empty list silently
    note_th: 'แพทยศาสตร์รอบ 3 รับผ่าน กสพท สถิติคะแนนต่ำสุดไม่อยู่ในไฟล์ของ ทปอ. จึงไม่มีการจัดอันดับและโซนคะแนน กรุณาดูประกาศของ กสพท โดยตรง',
    note_en: 'Round 3 medicine admits through the Consortium of Thai Medical Schools (กสพท), whose cutoffs are not in the official TCAS file, so there is no ranking or score zone. Check the consortium’s own announcements.',
  },
  bba: {
    th: 'บริหารธุรกิจ',
    en: 'Business Administration (BBA)',
    or: 'program.ilike.%บริหารธุรกิจบัณฑิต%,program.ilike.%BBA%',
  },
  'architecture-design': {
    th: 'สถาปัตยกรรมและการออกแบบ',
    en: 'Architecture & Design',
    or: 'program.ilike.%สถาปัตยกรรม%,program.ilike.%ออกแบบ%,faculty.ilike.%สถาปัตยกรรม%,faculty.ilike.%ออกแบบ%,faculty.ilike.%มัณฑนศิลป์%',
    // "ออกแบบ" alone also hits communication arts, liberal arts and engineering majors
    keep: (p) =>
      /สถาปัตยกรรม/.test(p.program) ||
      /สถาปัตยกรรม|ออกแบบ|มัณฑนศิลป์/.test(p.faculty) ||
      (/ออกแบบ/.test(p.program) && /ศิลปกรรม|เพาะช่าง|วิจิตรศิลป์|ศิลปะ/.test(p.faculty)),
  },
  'comm-arts': {
    th: 'นิเทศศาสตร์',
    en: 'Communication Arts',
    or: 'faculty.ilike.%นิเทศศาสตร์%,program.ilike.%นิเทศศาสตร%,program.ilike.%วารสารศาสตร%,program.ilike.%สื่อสารมวลชน%',
  },
  law: {
    th: 'นิติศาสตร์',
    en: 'Law',
    or: 'program.ilike.%นิติศาสตรบัณฑิต%',
  },
};

const groupInfo = (key, lang = 'th') => {
  const g = GROUPS[key];
  const note = lang === 'en' ? g.note_en : g.note_th;
  return { key, label_th: g.th, label_en: g.en, ...(note && { note }) };
};

export const listGroups = (lang = 'th') => Object.keys(GROUPS).map((key) => groupInfo(key, lang));

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

// TCAS data only changes on import, and every visitor at the booth asks for the same 6 groups.
// Errors aren't cached (the promise is dropped), so a failed lookup is retried next time
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // `${key}|${university}` -> { at, promise }

function groupPrograms(key, { university } = {}) {
  const id = `${key}|${university ?? ''}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = loadGroupPrograms(key, { university });
  if (cache.size > 200) cache.clear(); // university is free text, don't grow forever
  cache.set(id, { at: Date.now(), promise });
  promise.catch(() => cache.delete(id));
  return promise;
}

// all programs of a group (latest year) + last year's round 3 stats, most applicants first
async function loadGroupPrograms(key, { university } = {}, db = anonClient()) {
  const g = GROUPS[key];
  if (!g) throw notFound('ไม่พบกลุ่มคณะนี้');
  const year = await latestYear(db);
  if (!year) return { year: null, programs: [] };

  // paged: Supabase stops at 1000 rows without saying so
  const { data, error } = await fetchAll(() => {
    let q = db.from('tcas_programs').select('id, university, faculty, program, campus, url').eq('academic_year', year).or(g.or);
    if (university) q = q.ilike('university', `%${university.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    return q.order('id');
  });
  if (error) throw dbError(error, `faculty group ${key}`);
  const programs = g.keep ? data.filter(g.keep) : data;

  // latest cutoff year per program code: applicants summed over its projects
  const codes = [...new Set(programs.map((p) => programCode(p.url)).filter(Boolean))];
  const stats = new Map();
  for (const batch of chunk(codes, 200)) {
    // 200 codes x 3 years x several projects is well over 1000 rows -> paged too
    const { data: rows, error: cErr } = await fetchAll(() =>
      db
        .from('tcas_cutoffs')
        .select('id, program_code, academic_year, seats, applicants, min_score')
        .in('program_code', batch)
        .order('id'),
    );
    if (cErr) throw dbError(cErr, 'faculty group cutoffs');
    for (const r of rows) {
      const cur = stats.get(r.program_code);
      if (cur && cur.year > r.academic_year) continue;
      if (!cur || cur.year < r.academic_year) {
        stats.set(r.program_code, { year: r.academic_year, applicants: 0, seats: 0, mins: [] });
      }
      const s = stats.get(r.program_code);
      s.applicants += r.applicants ?? 0;
      s.seats += r.seats ?? 0;
      if (Number(r.min_score) > 0) s.mins.push(Number(r.min_score));
    }
  }

  const items = programs.map((p) => {
    const s = stats.get(programCode(p.url));
    return {
      id: p.id,
      university: p.university,
      faculty: p.faculty,
      program: p.program,
      campus: p.campus,
      last_year: s
        ? {
            academic_year: s.year,
            applicants: s.applicants,
            seats: s.seats,
            // lowest project cutoff of the program; per project see /simulate
            lowest_min_score: s.mins.length ? Math.min(...s.mins) : null,
          }
        : null,
    };
  });
  // programs with stats first, most applicants first
  items.sort((a, b) => (b.last_year?.applicants ?? -1) - (a.last_year?.applicants ?? -1));

  // majors that share one official code (e.g. Chula BBA) share one stats row - show them once,
  // the rest go into other_program_ids so the frontend can still offer them
  const byCode = new Map();
  const out = [];
  for (const it of items) {
    const code = programCode(programs.find((p) => p.id === it.id).url);
    const first = code && byCode.get(code);
    if (first) {
      first.other_program_ids.push(it.id);
      continue;
    }
    const row = { ...it, other_program_ids: [] };
    if (code) byCode.set(code, row);
    out.push(row);
  }
  return { year, programs: out };
}

export async function popularPrograms(key, { limit = 10, university } = {}, lang = 'th') {
  const { year, programs } = await groupPrograms(key, { university });
  return {
    group: groupInfo(key, lang),
    academic_year: year,
    total_programs: programs.length,
    items: programs.slice(0, limit),
    ranking: t(lang, 'group_ranking'),
  };
}

const ZONE_ORDER = { safe: 0, target: 1, reach: 2 };

// one set of scores against the group's top programs
export async function simulateGroup(key, { scores, gpax, limit = 10, university }, lang = 'th') {
  const { programs } = await groupPrograms(key, { university });
  const top = programs.slice(0, limit);
  const results = await Promise.all(top.map((p) => simulate(p.id, { scores, gpax }, lang)));

  const items = results.map((r, i) => ({
    program: { id: top[i].id, university: top[i].university, program: top[i].program, campus: top[i].campus },
    last_year: top[i].last_year,
    best: r.best,
    // still useful when there's no zone: how far along the score is
    best_score: r.admissions.reduce((m, a) => Math.max(m, a.score?.weighted_score ?? a.score?.partial_score ?? 0), 0),
    missing: [...new Set(r.admissions.flatMap((a) => a.score?.missing?.map((x) => x.subject) ?? []))],
  }));
  items.sort(
    (a, b) =>
      (ZONE_ORDER[a.best?.zone.zone] ?? 3) - (ZONE_ORDER[b.best?.zone.zone] ?? 3) ||
      (b.best?.zone.buffer ?? -999) - (a.best?.zone.buffer ?? -999),
  );

  const count = (z) => items.filter((i) => i.best?.zone.zone === z).length;
  return {
    group: groupInfo(key, lang),
    summary: { safe: count('safe'), target: count('target'), reach: count('reach'), no_data: items.filter((i) => !i.best).length },
    items,
    zone_rule: zoneRule(lang),
    verify_note: t(lang, 'cutoff_verify'),
  };
}
