import { anonClient } from '../config/supabase.js';
import { FACULTY_GROUPS, facultyHits } from '../data/faculties.js';
import { isTest } from '../config/env.js';
import { dbError } from '../utils/AppError.js';
import { latestYear, programCode } from './tcas.service.js';
import { generateJson } from './ai.service.js';
import { matchPicksAiSchema, interestsAiSchema, coachGuidanceAiSchema } from '../schemas/ai.schema.js';
import { log } from '../utils/log.js';
import { provinceOf, regionOf, REGION_LABEL } from '../data/provinces.js';

// "คณะที่ใช่": the 5 real programs (one per university) that fit the student's Step 1-3 answers best.
//
// Everything comes from the myTCAS data we imported - nothing is made up:
//   tcas_programs   which programs exist this year
//   tcas_admissions per-round projects: min GPAX, score weights, closing dates
//   tcas_cutoffs    last year's applicants / seats / lowest score (official ทปอ. stats)
// The whole set is small (~5k programs), so it is loaded once, cached, and matched in memory.
//
// Score (0-100) = interests 50 + target university 15 + GPAX 15 + Beyond 4.00 10 + weekly hours 10.
// Every point comes with a reason the card shows, so the % can always be explained.

// interest key (frontend Step 1 bubbles) -> words that appear in real program / faculty names
export const INTEREST_FIELDS = {
  'tech-ai': {
    th: 'เทคโนโลยี & AI', en: 'Technology & AI',
    program: ['วิศวกรรมคอมพิวเตอร์', 'วิทยาการคอมพิวเตอร์', 'วิศวกรรมซอฟต์แวร์', 'เทคโนโลยีสารสนเทศ', 'ปัญญาประดิษฐ์', 'ความมั่นคงปลอดภัยไซเบอร์', 'วิทยาการข้อมูล', 'คอมพิวเตอร์'],
    faculty: ['เทคโนโลยีสารสนเทศ'],
  },
  'product-ux': {
    th: 'ออกแบบผลิตภัณฑ์ & UX', en: 'Product & UX Design',
    program: ['ออกแบบผลิตภัณฑ์', 'ออกแบบอุตสาหกรรม', 'ออกแบบประสบการณ์', 'ออกแบบปฏิสัมพันธ์', 'ออกแบบดิจิทัล', 'การออกแบบ'],
    faculty: ['ออกแบบ', 'มัณฑนศิลป์'],
  },
  healthcare: {
    th: 'สุขภาพและการแพทย์', en: 'Healthcare & Medicine',
    program: ['แพทยศาสตร', 'พยาบาลศาสตร', 'เภสัชศาสตร', 'ทันตแพทยศาสตร', 'สาธารณสุข', 'กายภาพบำบัด', 'เทคนิคการแพทย์', 'สัตวแพทยศาสตร', 'รังสีเทคนิค'],
    faculty: ['แพทยศาสตร์', 'พยาบาลศาสตร์', 'สหเวชศาสตร์', 'สาธารณสุขศาสตร์', 'เภสัชศาสตร์'],
  },
  business: {
    th: 'ธุรกิจและเศรษฐศาสตร์', en: 'Business & Economics',
    program: ['บริหารธุรกิจ', 'เศรษฐศาสตร', 'การตลาด', 'การจัดการ', 'ธุรกิจ'],
    faculty: ['บริหารธุรกิจ', 'พาณิชยศาสตร์', 'เศรษฐศาสตร์', 'วิทยาการจัดการ'],
  },
  robotics: {
    th: 'วิศวกรรมและหุ่นยนต์', en: 'Engineering & Robotics',
    program: ['วิศวกรรมหุ่นยนต์', 'หุ่นยนต์', 'วิศวกรรมเมคคาทรอนิกส์', 'วิศวกรรมเครื่องกล', 'วิศวกรรมไฟฟ้า', 'วิศวกรรมอิเล็กทรอนิกส์', 'วิศวกรรมระบบควบคุม', 'วิศวกรรมการบิน', 'วิศวกรรมอุตสาหการ'],
    faculty: ['วิศวกรรมศาสตร์'],
  },
  media: {
    th: 'สื่อ ภาพยนตร์ & เล่าเรื่อง', en: 'Media, Film & Storytelling',
    program: ['นิเทศศาสตร', 'วารสารศาสตร', 'ภาพยนตร์', 'สื่อสารมวลชน', 'การสื่อสาร', 'ภาพถ่าย', 'การประพันธ์'],
    faculty: ['นิเทศศาสตร์', 'วารสารศาสตร์'],
  },
  'data-research': {
    th: 'ข้อมูลและงานวิจัย', en: 'Data & Quant Research',
    program: ['วิทยาการข้อมูล', 'สถิติ', 'คณิตศาสตร', 'ฟิสิกส์', 'เคมี', 'วิทยาศาสตร์ข้อมูล', 'การวิเคราะห์ข้อมูล'],
    faculty: ['วิทยาศาสตร์'],
  },
  'law-policy': {
    th: 'กฎหมายและนโยบาย', en: 'Law & Public Policy',
    program: ['นิติศาสตร', 'รัฐศาสตร', 'รัฐประศาสนศาสตร', 'การเมือง', 'นโยบายสาธารณะ', 'การปกครอง'],
    faculty: ['นิติศาสตร์', 'รัฐศาสตร์'],
  },
  'arch-design': {
    th: 'สถาปัตยกรรมและเมือง', en: 'Architecture & Urban Design',
    program: ['สถาปัตยกรรม', 'ผังเมือง', 'การวางแผนภาคและเมือง', 'ออกแบบภายใน', 'ภูมิสถาปัตยกรรม'],
    faculty: ['สถาปัตยกรรม'],
  },
  'bio-env': {
    th: 'ชีววิทยาและสิ่งแวดล้อม', en: 'Bio & Sustainability',
    program: ['ชีววิทยา', 'เทคโนโลยีชีวภาพ', 'สิ่งแวดล้อม', 'วิทยาศาสตร์การอาหาร', 'เทคโนโลยีการอาหาร', 'เกษตร', 'ประมง', 'ป่าไม้'],
    faculty: ['เกษตร', 'สิ่งแวดล้อม', 'ประมง', 'วนศาสตร์', 'อุตสาหกรรมเกษตร'],
  },
  'psych-edtech': {
    th: 'จิตวิทยาและการศึกษา', en: 'Psychology & EdTech',
    program: ['จิตวิทยา', 'ครุศาสตร', 'ศึกษาศาสตร', 'เทคโนโลยีการศึกษา', 'การศึกษา'],
    faculty: ['ครุศาสตร์', 'ศึกษาศาสตร์', 'จิตวิทยา'],
  },
  'global-lang': {
    th: 'ภาษาและกิจการระหว่างประเทศ', en: 'Global & Languages',
    program: ['ภาษาอังกฤษ', 'ภาษาจีน', 'ภาษาญี่ปุ่น', 'ภาษาเกาหลี', 'ภาษาฝรั่งเศส', 'ภาษาเยอรมัน', 'ความสัมพันธ์ระหว่างประเทศ', 'อักษรศาสตร'],
    faculty: ['อักษรศาสตร์', 'มนุษยศาสตร์', 'ศิลปศาสตร์'],
  },
  'game-interactive': {
    th: 'เกมและอินเทอร์แอคทีฟ', en: 'Game & Interactive Media',
    program: ['เกม', 'แอนิเมชัน', 'มัลติมีเดีย', 'อินเทอร์แอคทีฟ', 'สื่อดิจิทัล', 'ดิจิทัลอาร์ต'],
    faculty: [],
  },
  'finance-quant': {
    th: 'การเงินและการลงทุน', en: 'Finance & Investing',
    program: ['การเงิน', 'บัญชี', 'การธนาคาร', 'ประกันภัย', 'เทคโนโลยีทางการเงิน'],
    faculty: ['บัญชี'],
  },
};
export const INTEREST_KEYS = Object.keys(INTEREST_FIELDS);

// frontend Step 3 chip codes -> how the university is written in myTCAS data
export const UNI_CODES = {
  cu: 'จุฬาลงกรณ์', kmutt: 'พระจอมเกล้าธนบุรี', tu: 'ธรรมศาสตร์', mu: 'มหิดล', ku: 'เกษตรศาสตร์',
  kmitl: 'พระจอมเกล้าเจ้าคุณทหารลาดกระบัง', cmu: 'เชียงใหม่', kku: 'ขอนแก่น', su: 'ศิลปากร', swu: 'ศรีนครินทรวิโรฒ',
};

// main public universities (myTCAS university_id): ranked a little higher, as the booth asked
// CU, KU, KKU, CMU, TU, MU, SU, SWU, PSU, KMUTT, KMUTNB, KMITL, SUT, BUU, NU
export const MAIN_PUBLIC = new Set(['001', '002', '003', '004', '005', '006', '008', '009', '010', '014', '015', '016', '017', '019', '020']);
// "https://course.mytcas.com/programs/10020105300501A" -> "002" (digits 2-4 of the program code = university_id)
export const universityId = (url) => url?.match(/course\.mytcas\.com\/programs\/\d(\d{3})/)?.[1] ?? null;

// ---------- the data set (cached) ----------

const CACHE_MS = 30 * 60 * 1000;
let cached = null; // { at, promise }

// whole table in pages of 1000, continuing after the last id (keyset). Offset paging (fetchAll) made
// the last pages of the 31k-row admissions table slow enough to hit Supabase's statement timeout.
// A failed page is retried once
async function fetchByKey(filter, db, table, cols, pageSize = 1000) {
  const rows = [];
  let last = null;
  for (;;) {
    let data;
    let error;
    for (let attempt = 0; attempt < 2; attempt++) {
      let q = filter(db.from(table).select(cols)).order('id').limit(pageSize);
      if (last !== null) q = q.gt('id', last);
      ({ data, error } = await q);
      if (!error) break;
    }
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < pageSize) return { data: rows, error: null };
    last = data[data.length - 1].id;
  }
}

async function loadAll(db = anonClient()) {
  const year = await latestYear(db);
  if (!year) return { year: null, programs: [] };

  const [progs, adms, cuts] = await Promise.all([
    fetchByKey((q) => q.eq('academic_year', year), db, 'tcas_programs', 'id, university, faculty, program, campus, url, tuition_note'),
    fetchByKey((q) => q, db, 'tcas_admissions', 'id, program_id, round, project_name, seats, min_gpax, score_weights, apply_end'),
    fetchByKey((q) => q, db, 'tcas_cutoffs', 'id, program_code, academic_year, seats, applicants, min_score'),
  ]);
  for (const r of [progs, adms, cuts]) if (r.error) throw dbError(r.error, 'match data');

  const byProgram = new Map();
  for (const a of adms.data) {
    if (!byProgram.has(a.program_id)) byProgram.set(a.program_id, []);
    byProgram.get(a.program_id).push(a);
  }
  // latest year of official stats per program code (applicants / seats summed over its projects)
  const stats = new Map();
  for (const r of cuts.data) {
    const cur = stats.get(r.program_code);
    if (cur && cur.year > r.academic_year) continue;
    if (!cur || cur.year < r.academic_year) stats.set(r.program_code, { year: r.academic_year, applicants: 0, seats: 0, mins: [] });
    const s = stats.get(r.program_code);
    s.applicants += r.applicants ?? 0;
    s.seats += r.seats ?? 0;
    if (Number(r.min_score) > 0) s.mins.push(Number(r.min_score));
  }

  const programs = progs.data.map((p) => {
    const admissions = byProgram.get(p.id) ?? [];
    const s = stats.get(programCode(p.url));
    return {
      ...p,
      province: provinceOf(universityId(p.url), p.campus),
      admissions,
      last_year: s
        ? { academic_year: s.year, applicants: s.applicants, seats: s.seats, lowest_min_score: s.mins.length ? Math.min(...s.mins) : null }
        : null,
    };
  });
  return { year, programs };
}

export function matchData() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = loadAll();
  cached = { at: Date.now(), promise };
  promise.catch(() => { if (cached?.promise === promise) cached = null; });
  return promise;
}
export const resetMatchCacheForTests = () => { cached = null; };

// load in the background at server start so the first visitor doesn't wait. never throws
export function warmMatchData() {
  if (isTest) return;
  matchData().catch((err) => log.warn('[match] warm-up failed:', err?.message ?? err));
}

// ---------- scoring ----------

const today = () => new Date().toISOString().slice(0, 10);
const fmtInt = (n) => Number(n).toLocaleString('en-US');

function interestHits(p, interests) {
  const hits = [];
  for (const key of interests) {
    const f = INTEREST_FIELDS[key];
    if (!f) continue;
    if (f.program.some((w) => p.program.includes(w))) hits.push({ key, strong: true });
    else if (f.faculty.some((w) => p.faculty.includes(w))) hits.push({ key, strong: false });
  }
  return hits;
}

// Step 3 chip codes -> myTCAS university_id (exact, so "cmu" never catches ราชภัฏเชียงใหม่)
const UNI_CODE_IDS = { cu: '001', ku: '002', kku: '003', cmu: '004', tu: '005', mu: '006', su: '008', swu: '009', kmutt: '014', kmitl: '016' };
// "มหาวิทยาลัยเชียงใหม่" / "ม.บูรพา" -> "เชียงใหม่" / "บูรพา"
const uniCore = (s) => String(s).trim().replace(/^(มหาวิทยาลัย|มหาลัย|ม\.|สถาบัน)\s*/, '').trim();

// chip code -> exact university id; a typed name -> the university whose name STARTS with it
// ("เชียงใหม่" = มหาวิทยาลัยเชียงใหม่ but not มหาวิทยาลัยราชภัฏเชียงใหม่, "จุฬา" = จุฬาลงกรณ์มหาวิทยาลัย)
function uniMatch(p, targets) {
  return targets.some((t) => {
    const code = String(t).trim().toLowerCase();
    const id = UNI_CODE_IDS[code];
    if (id) {
      const pid = universityId(p.url);
      // no myTCAS code in the url (hand-entered data): fall back to the name
      return pid ? pid === id : p.university.includes(UNI_CODES[code]);
    }
    const core = uniCore(t);
    return core.length >= 2 && (uniCore(p.university).startsWith(core) || p.university === String(t).trim());
  });
}

// one program -> { score, reasons } or null when it can't be a match (no interest hit / GPAX too low)
export function scoreProgram(p, input) {
  const { interests = [], gpax = null, beyond_4 = false, target_universities = [], target_faculties = [], weekly_hours = null, province = null } = input;
  const hits = interestHits(p, interests);
  // Step 3 "คณะที่สนใจเป็นพิเศษ": a program in one of those faculties counts even without an interest hit
  const facHits = facultyHits(p.faculty, target_faculties);
  if (!hits.length && !facHits.length) return null;

  const minGpaxes = p.admissions.map((a) => a.min_gpax).filter((v) => v != null).map(Number);
  const lowestMin = minGpaxes.length ? Math.min(...minGpaxes) : null;
  // every project asks for more than the student has: not a match
  if (gpax != null && lowestMin != null && gpax < lowestMin) return null;

  const reasons = [];
  // interests (max 50). interests[0] is the main one (ความสนใจหลัก), the rest are secondary:
  //   main interest in the program name 32 / only in the faculty name 16
  //   best secondary hit 14 / 7, +4 for each further secondary hit
  // (a hit "in the program name" = the program itself is in that field)
  const [main, ...secondary] = interests;
  const mainHit = hits.find((h) => h.key === main);
  const secHits = hits.filter((h) => h.key !== main && secondary.includes(h.key));
  let score = mainHit ? (mainHit.strong ? 32 : 16) : 0;
  if (secHits.length) {
    score += secHits.some((h) => h.strong) ? 14 : 7;
    score += (secHits.length - 1) * 4;
  }
  score = Math.min(50, score);
  // the regular Thai track of a program before its special / international copies
  if (/\(ภาษาไทย ปกติ\)/.test(p.program)) score += 1;
  if (mainHit) {
    reasons.push({ th: 'ตรงความสนใจหลัก: ' + INTEREST_FIELDS[main].th, en: 'Matches your main interest: ' + INTEREST_FIELDS[main].en });
  }
  if (secHits.length) {
    const sl = secHits.map((h) => INTEREST_FIELDS[h.key]);
    reasons.push({ th: 'ตรงความสนใจรอง: ' + sl.map((l) => l.th).join(', '), en: 'Matches secondary interest(s): ' + sl.map((l) => l.en).join(', ') });
  }

  // the card shuffle in Step 2: swiped up = liked
  if ((input.liked_ids ?? []).includes(p.id)) {
    score += 15;
    reasons.push({ th: 'คุณปัดถูกใจหลักสูตรนี้ในสำรับการ์ด', en: 'You liked this program in the card shuffle' });
  }

  if (MAIN_PUBLIC.has(universityId(p.url))) {
    score += 10;
    reasons.push({ th: 'มหาวิทยาลัยรัฐหลัก', en: 'Major public university' });
  }

  // near home (the student asked for nearby universities): same province +20, both in Bangkok & vicinity +16, same region +8
  let near = null;
  if (province && p.province) {
    const mine = regionOf(province);
    if (p.province === province) near = 'province';
    else if (mine === 'bkk' && regionOf(p.province) === 'bkk') near = 'metro';
    else if (mine && mine === regionOf(p.province)) near = 'region';
    if (near === 'province' || near === 'metro') {
      score += near === 'province' ? 20 : 16;
      reasons.push(near === 'province'
        ? { th: `อยู่จังหวัดเดียวกับคุณ (${p.province})`, en: `In your province (${p.province})` }
        : { th: `อยู่ในกรุงเทพและปริมณฑล ใกล้คุณ (${p.province})`, en: `In Bangkok & vicinity, near you (${p.province})` });
    } else if (near === 'region') {
      score += 8;
      reasons.push({ th: `อยู่${REGION_LABEL[mine][0]}เหมือนคุณ (${p.province})`, en: `Same region as you: ${REGION_LABEL[mine][1]} (${p.province})` });
    }
  }

  if (facHits.length) {
    score += hits.length ? 20 : 12;
    const f = FACULTY_GROUPS[facHits[0]];
    reasons.push({ th: 'อยู่ในคณะที่คุณสนใจเป็นพิเศษ: ' + f.th, en: 'In a faculty you picked: ' + f.en });
  }

  const isTarget = uniMatch(p, target_universities);
  // a university the student picked always comes first (see ranked()), and the % shows it
  if (isTarget) {
    score += 25;
    reasons.push({ th: 'มหาวิทยาลัยที่คุณเลือกไว้ (ขึ้นก่อนเสมอ)', en: 'A university you picked (always shown first)' });
  }

  if (gpax == null) score += 10;
  else if (lowestMin == null) score += 10;
  else {
    const maxMin = Math.max(...minGpaxes);
    score += gpax >= maxMin ? 15 : 9;
    reasons.push({
      th: gpax >= maxMin ? `GPAX ${gpax.toFixed(2)} ผ่านเกณฑ์ขั้นต่ำทุกโครงการ (สูงสุด ${maxMin.toFixed(2)})` : `GPAX ${gpax.toFixed(2)} ผ่านเกณฑ์บางโครงการ (ต่ำสุด ${lowestMin.toFixed(2)})`,
      en: gpax >= maxMin ? `GPAX ${gpax.toFixed(2)} meets every project's minimum (up to ${maxMin.toFixed(2)})` : `GPAX ${gpax.toFixed(2)} meets some projects (from ${lowestMin.toFixed(2)})`,
    });
  }

  const r1 = p.admissions.filter((a) => a.round === 1);
  if (beyond_4) {
    score += r1.length ? 10 : 3;
    if (r1.length) reasons.push({ th: `เปิดรอบ 1 Portfolio ${r1.length} โครงการ เหมาะกับโหมด Beyond 4.00`, en: `${r1.length} Round 1 Portfolio project(s), a fit for Beyond 4.00` });
  } else score += 5;

  // weekly hours vs how competitive it was last year (applicants per seat)
  const ly = p.last_year;
  const ratio = ly && ly.seats > 0 ? ly.applicants / ly.seats : null;
  if (weekly_hours == null || ratio == null) score += 6;
  else if (weekly_hours >= 10) score += ratio >= 10 ? 10 : 7;
  else if (weekly_hours >= 5) score += 8;
  else score += ratio < 10 ? 10 : 4;
  if (ly && ly.applicants) {
    reasons.push({
      th: `ปี ${ly.academic_year} มีผู้สมัคร ${fmtInt(ly.applicants)} คน รับ ${fmtInt(ly.seats)} ที่ (สถิติ ทปอ.)`,
      en: `${ly.academic_year}: ${fmtInt(ly.applicants)} applicants for ${fmtInt(ly.seats)} seats (official stats)`,
    });
  }

  // the % on the card = this score out of the most this student's answers could give a program, so it
  // spreads out (it used to pile up at the 99 cap once target + near-home + main public all applied).
  // Ranking still uses the raw score.
  const maxPossible = 51 + 10 + 15 + (beyond_4 ? 10 : 5) + 10 +
    ((input.liked_ids ?? []).length ? 15 : 0) + (province ? 20 : 0) + (target_universities.length ? 25 : 0) +
    (target_faculties.length ? 20 : 0);
  const pct = Math.round(Math.max(30, Math.min(99, (score / maxPossible) * 100)));
  return { score: Math.round(score), pct, reasons, hits: hits.map((h) => h.key), lowestMin, isTarget, near, inFaculty: facHits.length > 0, facKeys: facHits };
}

// what a card shows about one program (all from the data)
function card(p, s) {
  const now = today();
  const rounds = [1, 2, 3, 4].map((round) => {
    const list = p.admissions.filter((a) => a.round === round);
    const upcoming = list.map((a) => a.apply_end).filter((d) => d && d >= now).sort()[0] ?? null;
    return { round, projects: list.length, next_apply_end: upcoming };
  });
  const withWeights = p.admissions.filter((a) => a.score_weights && Object.keys(a.score_weights).length);
  const main = withWeights.find((a) => a.round === 3) ?? withWeights[0] ?? null;
  return {
    id: p.id,
    university: p.university,
    university_id: universityId(p.url),
    main_public: MAIN_PUBLIC.has(universityId(p.url)),
    faculty: p.faculty,
    program: p.program,
    campus: p.campus,
    province: p.province,
    near_home: s.near,
    url: p.url,
    tuition_note: p.tuition_note ?? null,
    match_pct: s.pct,
    matched_interests: s.hits,
    target_university: s.isTarget,
    reasons: s.reasons,
    min_gpax: s.lowestMin,
    rounds,
    weights: main
      ? {
          round: main.round,
          parts: Object.entries(main.score_weights).map(([subject, weight]) => ({ subject, weight: Number(weight) })).sort((a, b) => b.weight - a.weight),
        }
      : null,
    last_year: p.last_year,
  };
}

// ranked candidates, best first, at most one program per university
// KU open house booth: Tech & AI + Games & Interactive (exactly these two, either one main) always gets
// KU Computer Science, Faculty of Science, Bang Khen (Thai regular) as #1. Found by name, so a re-import keeps it.
const PIN_INTERESTS = ['game-interactive', 'tech-ai'];
const isPinProgram = (p) => universityId(p.url) === '002' && /^คณะวิทยาศาสตร์$/.test(String(p.faculty).trim()) &&
  /วิทยาการคอมพิวเตอร์/.test(p.program) && /ภาษาไทย ปกติ/.test(p.program) && /บางเขน/.test(p.campus ?? '');
function pinApplies(input) {
  const keys = [...new Set(input.interests ?? [])].sort();
  return keys.length === PIN_INTERESTS.length && keys.every((k, i) => k === PIN_INTERESTS[i]);
}

// same answers, different student: programs that fit about equally well (within 6 points) are ordered by a
// per-student seed, so two students don't get the identical list. The % shown is still the real score.
function seedJitter(seed, id) {
  if (!seed) return 0;
  let h = 2166136261;
  for (const ch of seed + ':' + id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000 * 6; // 0 - 6 points
}

function ranked(programs, input) {
  // shown already (refresh) or swiped away in the card shuffle
  const exclude = new Set([...(input.exclude_ids ?? []), ...(input.skipped_ids ?? [])]);
  const scored = [];
  for (const p of programs) {
    if (exclude.has(p.id)) continue;
    const s = scoreProgram(p, input);
    if (s) scored.push({ p, s });
  }
  // best score; then programs with official stats and more applicants (better known) first
  // the student's own target universities first, then score, then better-known programs (more applicants)
  const seed = input.variety_seed;
  scored.sort((a, b) =>
    (b.s.isTarget ? 1 : 0) - (a.s.isTarget ? 1 : 0) ||
    (b.s.score + seedJitter(seed, b.p.id)) - (a.s.score + seedJitter(seed, a.p.id)) ||
    (b.p.last_year?.applicants ?? -1) - (a.p.last_year?.applicants ?? -1));
  const seen = new Set();
  const out = [];
  for (const x of scored) {
    if (seen.has(x.p.university)) continue;
    seen.add(x.p.university);
    out.push(x);
  }
  // picked faculties: each one gets at least one program in the first 5 when it has any (even if the
  // interests rank it lower), placed right after the student's target universities
  const facs = input.target_faculties ?? [];
  if (facs.length) {
    for (const k of facs) {
      if (out.slice(0, 5).some((x) => x.s.facKeys.includes(k))) continue;
      const pick = out.slice(5).find((x) => x.s.facKeys.includes(k));
      if (!pick) continue;
      const rest = out.filter((x) => x !== pick);
      // in place of the last top-5 item that isn't a target and isn't the only one of another picked faculty
      const firstFree = rest.findIndex((x) => !x.s.isTarget);
      rest.splice(firstFree === -1 ? 4 : Math.min(Math.max(firstFree, 1), 4), 0, pick);
      out.splice(0, out.length, ...rest);
    }
  }
  if (pinApplies(input)) {
    const pin = programs.find((p) => isPinProgram(p) && !exclude.has(p.id));
    const ps = pin && scoreProgram(pin, input);
    if (ps) {
      // first, in place of any other program from the same university; its % is at least the best one shown
      const rest = out.filter((x) => x.p.university !== pin.university);
      const best = Math.max(ps.pct, ...rest.slice(0, 5).map((x) => x.s.pct));
      return [{ p: pin, s: { ...ps, pct: best, isPinned: true } }, ...rest];
    }
  }
  return out;
}

// target universities the student picked that have no program for their interests (the page says so)
function targetsWithoutMatch(programs, input, shown) {
  const targets = input.target_universities ?? [];
  return targets.filter((t) => {
    const hit = (p) => uniMatch(p, [t]);
    if (shown.some((x) => hit(x.p))) return false;
    return !programs.some((p) => hit(p) && scoreProgram(p, { ...input, target_universities: [] }));
  });
}

export async function matchPrograms(input) {
  const { year, programs } = await matchData();
  const all = ranked(programs, input);
  const limit = input.limit ?? 5;
  return {
    academic_year: year,
    items: all.slice(0, limit).map(({ p, s }) => card(p, s)),
    has_more: all.length > limit,
    targets_without_match: input.exclude_ids?.length ? [] : targetsWithoutMatch(programs, input, all.slice(0, limit)),
    method: 'rules',
    note_th: 'จับคู่จากข้อมูลหลักสูตร เกณฑ์ และสถิติของ myTCAS / ทปอ. ตามคำตอบของคุณ ตรวจสอบประกาศล่าสุดที่ mytcas.com',
    note_en: 'Matched from myTCAS / official TCAS programs, criteria and stats using your answers. Check mytcas.com for the latest.',
  };
}

// refresh with AI: the AI picks 5 (different universities) out of the next 15 real candidates and says why.
// it can only choose from our list, so every card is still a real program; any problem -> rule-based picks
export async function matchProgramsAi(input, lang = 'th') {
  const { year, programs } = await matchData();
  const pool = ranked(programs, input).slice(0, 15);
  const limit = input.limit ?? 5;
  const fallback = () => ({
    academic_year: year,
    items: pool.slice(0, limit).map(({ p, s }) => card(p, s)),
    has_more: pool.length > limit,
    method: 'rules',
    ai_fallback: true,
  });
  if (pool.length <= 1) return fallback();

  const labels = (input.interests ?? []).map((k) => INTEREST_FIELDS[k]?.th).filter(Boolean);
  const list = pool
    .map(({ p, s }, i) => {
      const r1 = p.admissions.filter((a) => a.round === 1).length;
      const ly = p.last_year;
      return `${i}. ${p.university} | ${p.faculty} | ${p.program} | จังหวัด ${p.province ?? '-'} | คะแนนระบบ ${s.score} | รอบ1 ${r1} โครงการ` +
        (ly ? ` | ปี ${ly.academic_year} สมัคร ${ly.applicants} รับ ${ly.seats}` : '');
    })
    .join('\n');
  const prompt = `เลือก ${limit} หลักสูตรที่เหมาะกับนักเรียนคนนี้ที่สุดจากรายการด้านล่างเท่านั้น (ห้ามเลือกมหาวิทยาลัยซ้ำ)

นักเรียน:
- ความสนใจหลัก: ${labels[0] ?? '-'} | ความสนใจรอง: ${labels.slice(1).join(', ') || '-'} (เน้นความสนใจหลักก่อน)${input.custom_text ? `\n- เล่าเองว่า: ${String(input.custom_text).slice(0, 300)}` : ''}
- จังหวัดที่อยู่: ${input.province ?? 'ไม่ระบุ'} (ถ้ามี ให้เลือกมหาวิทยาลัยใกล้บ้านก่อนเมื่อเหมาะพอๆ กัน)
- GPAX: ${input.gpax ?? 'ไม่ระบุ'} | Beyond 4.00 (อยากทำผลงานเด่น): ${input.beyond_4 ? 'เปิด' : 'ปิด'} | อ่านหนังสือ ${input.weekly_hours ?? 'ไม่ระบุ'} ชม./สัปดาห์
- คณะที่สนใจเป็นพิเศษ: ${(input.target_faculties ?? []).map((k) => FACULTY_GROUPS[k]?.th).filter(Boolean).join(', ') || '-'}
- มหาวิทยาลัยเป้าหมาย: ${(input.target_universities ?? []).join(', ') || '-'} (นักเรียนเลือกเอง: ถ้ามีในรายการ ให้เลือกก่อนเสมอ)

รายการหลักสูตรจริงจาก myTCAS (เลขหน้าบรรทัด = index):
${list}

ให้ index ตามรายการ และเหตุผลสั้นๆ 1 ประโยคว่าทำไมเหมาะกับนักเรียนคนนี้ (อิงข้อมูลข้างบน ห้ามแต่งตัวเลขหรือเกณฑ์ใหม่)`;

  try {
    const mockPicks = pool.slice(0, limit).map((_, i) => ({ index: i, reason: 'ตัวอย่างจากโหมดทดสอบ: ตรงกับความสนใจที่เลือก' }));
    const { result } = await generateJson({ feature: 'match', prompt, schema: matchPicksAiSchema, mock: { picks: mockPicks }, lang });
    const used = new Set();
    const items = [];
    for (const pick of result.picks) {
      const x = pool[pick.index];
      if (!x || used.has(x.p.university)) continue;
      used.add(x.p.university);
      items.push({ ...card(x.p, x.s), ai_reason: pick.reason });
      if (items.length === limit) break;
    }
    // the universities the student picked stay first, even if the AI left them out
    const targets = [];
    for (const x of pool) {
      if (!x.s.isTarget || targets.some((t) => t.university === x.p.university)) continue;
      const picked = items.find((i) => i.university === x.p.university);
      targets.push(picked ?? card(x.p, x.s));
    }
    const pinned = pool.find((x) => x.s.isPinned);
    if (pinned) {
      const pc = items.find((i) => i.id === pinned.p.id) ?? card(pinned.p, pinned.s);
      targets.splice(0, targets.length, pc, ...targets.filter((t) => t.university !== pinned.p.university));
    }
    if (targets.length) {
      const rest = items.filter((i) => !targets.some((t) => t.university === i.university));
      items.splice(0, items.length, ...targets.concat(rest).slice(0, limit));
    }
    if (items.length < Math.min(limit, pool.length)) return fallback();
    return { academic_year: year, items, has_more: pool.length > limit, method: 'ai' };
  } catch (err) {
    log.warn('[match] AI pick failed, using rule-based order:', err?.code ?? err?.message ?? err);
    return fallback();
  }
}


// Step 1 "AI วิเคราะห์ความสนใจ": what the student typed -> up to 4 of our interest keys + a summary.
// The AI can only answer with keys from the list; anything else is dropped
export async function analyzeInterests({ text }, lang = 'th') {
  const catalog = INTEREST_KEYS.map((k) => `${k} = ${INTEREST_FIELDS[k].th} (${INTEREST_FIELDS[k].en})`).join('\n');
  const prompt = `นักเรียนเล่าว่าตัวเองชอบอะไร ให้จับคู่กับด้านความสนใจจากรายการนี้เท่านั้น ไม่เกิน 4 ด้าน เรียงจากตรงที่สุด
ถ้าไม่ตรงด้านไหนเลยให้ส่ง interests เป็นรายการว่าง

รายการ (key = ชื่อ):
${catalog}

สิ่งที่นักเรียนเล่า:
"""${String(text).slice(0, 500)}"""`;
  const lower = String(text).toLowerCase();
  const mockKeys = INTEREST_KEYS.filter((k) => INTEREST_FIELDS[k].program.concat(INTEREST_FIELDS[k].faculty).some((w) => lower.includes(w.toLowerCase()))).slice(0, 4);
  const { result } = await generateJson({
    feature: 'interests',
    prompt,
    schema: interestsAiSchema,
    mock: { interests: mockKeys, summary: 'ตัวอย่างจากโหมดทดสอบ: จับคู่จากคำที่พิมพ์' },
    lang,
  });
  const interests = [...new Set(result.interests.filter((k) => INTEREST_KEYS.includes(k)))].slice(0, 4);
  return { interests, summary: result.summary, method: 'ai' };
}


// ---------- AI coach "แนวทาง" (POST /api/coach/guidance) ----------
// Every refresh looks from another angle and skips programs already shown, so two students (or one student
// pressing "ขอแนวทางใหม่") get different guidance. The AI only picks from real ranked programs and may not
// invent numbers; if it fails, the same angle is written from the data (rules).
const GUIDANCE_ANGLES = [
  { key: 'safe', th: 'เน้นปลอดภัยไว้ก่อน', en: 'Play it safe',
    prompt: 'เน้นความปลอดภัย: หลักสูตรที่เกณฑ์ไม่เกินโปรไฟล์ อัตราการแข่งขัน (ผู้สมัครต่อที่นั่ง) ต่ำกว่า และมีหลายรอบให้ลอง',
    order: (x) => -(x.p.last_year?.seats && x.p.last_year?.applicants ? x.p.last_year.applicants / x.p.last_year.seats : 99) },
  { key: 'reach', th: 'ท้าทายตัวเอง', en: 'Aim high',
    prompt: 'เน้นความท้าทาย: หลักสูตรยอดนิยมที่มีผู้สมัครมาก แข่งขันสูง บอกด้วยว่าต้องเตรียมอะไรเพิ่ม',
    order: (x) => x.p.last_year?.applicants ?? 0 },
  { key: 'portfolio', th: 'เน้นรอบ 1 Portfolio', en: 'Portfolio first',
    prompt: 'เน้นรอบ 1 Portfolio: หลักสูตรที่เปิดรอบ 1 หลายโครงการ และสิ่งที่ควรใส่ในแฟ้มผลงาน',
    order: (x) => x.p.admissions.filter((a) => a.round === 1).length },
  { key: 'exam', th: 'เน้นคะแนนสอบ', en: 'Exam scores first',
    prompt: 'เน้นรอบ 3 Admission: หลักสูตรที่ใช้คะแนนสอบ (TGAT/TPAT/A-Level) และวิชาที่น้ำหนักสูง',
    order: (x) => x.p.admissions.filter((a) => a.round === 3 && a.score_weights && Object.keys(a.score_weights).length).length },
  { key: 'nearby', th: 'ใกล้บ้าน', en: 'Close to home',
    prompt: 'เน้นมหาวิทยาลัยใกล้บ้านนักเรียน (จังหวัด/ภาคเดียวกัน) ถ้าไม่ระบุจังหวัดให้เน้นมหาวิทยาลัยรัฐหลัก',
    order: (x) => (x.s.near === 'province' ? 3 : x.s.near === 'metro' ? 2 : x.s.near === 'region' ? 1 : 0) + (MAIN_PUBLIC.has(universityId(x.p.url)) ? 0.5 : 0) },
];
const angleIndex = (input) => {
  let h = 0;
  for (const ch of String(input.variety_seed ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h + (input.refresh ?? 0)) % GUIDANCE_ANGLES.length;
};

function guidanceFacts(p, s) {
  const r = [1, 2, 3, 4].map((n) => p.admissions.filter((a) => a.round === n).length);
  const ly = p.last_year;
  const w = p.admissions.find((a) => a.round === 3 && a.score_weights && Object.keys(a.score_weights).length);
  const weights = w ? Object.entries(w.score_weights).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
  return `${p.university} | ${p.faculty} | ${p.program} | จังหวัด ${p.province ?? '-'} | โครงการ รอบ1-4: ${r.join('/')}` +
    ` | GPAX ขั้นต่ำ ${s.lowestMin ?? 'ไม่ระบุ'} | น้ำหนักรอบ3: ${weights}` + (ly ? ` | ปี ${ly.academic_year} สมัคร ${ly.applicants} รับ ${ly.seats}` : '');
}

function rulesGuidance(angle, pool, lang) {
  const th = lang !== 'en';
  const picks = pool.slice(0, 3);
  const moves = {
    safe: [[ 'ใส่อันดับสำรองที่เกณฑ์ไม่สูงไว้ด้วย', 'Add safer backups', 'เลือกหลักสูตรที่ผู้สมัครต่อที่นั่งต่ำไว้ในอันดับท้ายๆ ของรอบ 3', 'Put programs with fewer applicants per seat lower in your Round 3 list' ],
            [ 'สมัครหลายรอบ', 'Use several rounds', 'ดูว่าหลักสูตรเปิดรอบ 1-2 ไหม จะได้มีโอกาสมากกว่า 1 ครั้ง', 'Check if the program also opens Round 1-2 for more chances' ]],
    reach: [[ 'วางแผนคะแนนให้เกินปีก่อน', 'Plan to beat last year', 'ดูสถิติผู้สมัคร/รับปีก่อน แล้วตั้งเป้าคะแนนให้สูงกว่าคะแนนต่ำสุด', "Look at last year's numbers and aim above the lowest admitted score" ],
             [ 'มีตัวเลือกสำรองคู่กัน', 'Pair it with a backup', 'ใส่หลักสูตรที่แข่งขันน้อยกว่าไว้อันดับถัดไปเสมอ', 'Always list a less competitive program right after it' ]],
    portfolio: [[ 'เริ่มทำแฟ้มผลงานตอนนี้', 'Start the portfolio now', 'เลือกผลงานที่เกี่ยวกับสาขา เล่าโจทย์ วิธีทำ และสิ่งที่ได้เรียนรู้', 'Pick field-related work: the problem, how you did it, what you learned' ],
                 [ 'อ่านประกาศรอบ 1 ของแต่ละโครงการ', 'Read each Round 1 announcement', 'แต่ละโครงการขอเอกสารต่างกัน และปิดรับไม่พร้อมกัน', 'Each project asks for different documents and closes on its own date' ]],
    exam: [[ 'ทุ่มเวลาให้วิชาน้ำหนักสูง', 'Focus on the heavy subjects', 'ดูน้ำหนักวิชาของหลักสูตร แล้วแบ่งเวลาอ่านตามสัดส่วนนั้น', 'Split study time by the subject weights of the program' ],
           [ 'ลองจำลองคะแนนในหน้า 5', 'Try the simulator (page 5)', 'ใส่คะแนนที่คาดว่าจะได้ เพื่อดูว่าห่างจากคะแนนต่ำสุดปีก่อนแค่ไหน', 'Enter expected scores to see the gap to last year' ]],
    nearby: [[ 'เทียบมหาวิทยาลัยใกล้บ้าน', 'Compare nearby universities', 'มหาวิทยาลัยในจังหวัด/ภาคเดียวกันมักมีโควตาพื้นที่ในรอบ 2', 'Universities in your province/region often have Round 2 area quotas' ],
             [ 'เช็กสิทธิ์โควตารอบ 2', 'Check Round 2 quota rules', 'อ่านเงื่อนไขว่าต้องเรียนหรือมีภูมิลำเนาในพื้นที่ไหน', 'Read which area you must study or live in to qualify' ]],
  }[angle.key];
  return {
    headline: th ? `มุมมอง "${angle.th}": ${picks.length} หลักสูตรจริงที่เข้ากับคำตอบของคุณ` : `"${angle.en}" view: ${picks.length} real programs that fit your answers`,
    moves: moves.map((m) => ({ title: th ? m[0] : m[1], detail: th ? m[2] : m[3] })),
    picks: picks.map((x, i) => ({ index: i, reason: (x.s.reasons[0] && (th ? x.s.reasons[0].th : x.s.reasons[0].en)) || '' })),
  };
}

export async function coachGuidance(input, lang = 'th') {
  const { year, programs } = await matchData();
  const angle = GUIDANCE_ANGLES[angleIndex(input)];
  // candidates: the student's good fits (not shown before), re-ordered for this angle
  const base = ranked(programs, { ...input, exclude_ids: [...(input.avoid_ids ?? []), ...(input.exclude_ids ?? [])] }).slice(0, 15);
  const pool = base.slice().sort((a, b) => angle.order(b) - angle.order(a)).slice(0, 10);
  if (!pool.length) {
    return { academic_year: year, angle: { key: angle.key, th: angle.th, en: angle.en }, method: 'none', headline: lang === 'en' ? 'No new programs to suggest — try other interests.' : 'ยังไม่มีหลักสูตรใหม่ให้แนะนำ ลองเพิ่มความสนใจในขั้นที่ 1', moves: [], programs: [] };
  }
  const labels = (input.interests ?? []).map((k) => INTEREST_FIELDS[k]?.th).filter(Boolean);
  const prompt = `คุณคือโค้ชแนะแนว TCAS ให้ "แนวทาง" แก่นักเรียนคนนี้จากมุมมอง: ${angle.prompt}

นักเรียน:
- ความสนใจหลัก: ${labels[0] ?? '-'} | รอง: ${labels.slice(1).join(', ') || '-'}
- GPAX: ${input.gpax ?? 'ไม่ระบุ'} | จังหวัด: ${input.province ?? 'ไม่ระบุ'} | อ่านหนังสือ ${input.weekly_hours ?? 'ไม่ระบุ'} ชม./สัปดาห์ | Beyond 4.00: ${input.beyond_4 ? 'เปิด' : 'ปิด'}
- คณะที่สนใจเป็นพิเศษ: ${(input.target_faculties ?? []).map((k) => FACULTY_GROUPS[k]?.th).filter(Boolean).join(', ') || '-'}

หลักสูตรจริงจาก myTCAS (เลขหน้าบรรทัด = index):
${pool.map((x, i) => `${i}. ${guidanceFacts(x.p, x.s)}`).join('\n')}

ตอบ: headline 1-2 ประโยค, moves 3 ข้อ (สิ่งที่ควรทำจริงในมุมมองนี้), picks 3 หลักสูตรจากรายการ (มหาวิทยาลัยไม่ซ้ำ) พร้อมเหตุผล
ใช้เฉพาะข้อมูลข้างบน ห้ามแต่งตัวเลข วันที่ หรือเกณฑ์ใหม่`;

  const finish = (g, method) => {
    const used = new Set();
    const picked = [];
    for (const k of g.picks) {
      const x = pool[k.index];
      if (!x || used.has(x.p.university)) continue;
      used.add(x.p.university);
      picked.push({ ...card(x.p, x.s), ai_reason: k.reason });
    }
    return { academic_year: year, angle: { key: angle.key, th: angle.th, en: angle.en }, method, headline: g.headline, moves: g.moves.slice(0, 4), programs: picked.slice(0, 3) };
  };
  const rules = rulesGuidance(angle, pool, lang);
  try {
    const { result } = await generateJson({ feature: 'coach_guidance', prompt, schema: coachGuidanceAiSchema, mock: rules, lang });
    const out = finish(result, 'ai');
    if (!out.programs.length) return finish(rules, 'rules');
    return out;
  } catch (err) {
    log.warn('[guidance] AI failed, writing the angle from data:', err?.code ?? err?.message ?? err);
    return { ...finish(rules, 'rules'), ai_fallback: true };
  }
}
