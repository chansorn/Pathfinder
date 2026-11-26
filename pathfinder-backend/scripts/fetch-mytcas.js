// Build a TCAS import file from the public JSON that course.mytcas.com itself loads.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas';
const PROGRAM_PAGE = (id) => `https://course.mytcas.com/programs/${id}`;

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const year = Number(arg('year'));
const roundUnis = (arg('rounds', '') || '').split(',').filter(Boolean);
const out = arg('out', `tcas-data/tcas${String(year).slice(-2)}.json`);
if (!year) {
  console.error('usage: node scripts/fetch-mytcas.js --year 2570 [--rounds 002] [--out file.json]');
  process.exit(1);
}

const getJson = async (url) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 403 || res.status === 404) return null; // no data for this program
    if (attempt === 3) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
};

// score keys used by myTCAS to readable names
const A_LEVEL = {
  61: 'A-Level คณิตศาสตร์ประยุกต์ 1', 62: 'A-Level คณิตศาสตร์ประยุกต์ 2', 63: 'A-Level วิทยาศาสตร์ประยุกต์',
  64: 'A-Level ฟิสิกส์', 65: 'A-Level เคมี', 66: 'A-Level ชีววิทยา', 70: 'A-Level สังคมศึกษา',
  81: 'A-Level ภาษาไทย', 82: 'A-Level ภาษาอังกฤษ', 83: 'A-Level ภาษาฝรั่งเศส', 84: 'A-Level ภาษาเยอรมัน',
  85: 'A-Level ภาษาญี่ปุ่น', 86: 'A-Level ภาษาเกาหลี', 87: 'A-Level ภาษาจีน', 88: 'A-Level ภาษาบาลี', 89: 'A-Level ภาษาสเปน',
};
const NAMED = {
  tgat: 'TGAT', tgat1: 'TGAT1 การสื่อสารภาษาอังกฤษ', tgat2: 'TGAT2 การคิดอย่างมีเหตุผล', tgat3: 'TGAT3 สมรรถนะการทำงาน',
  tpat1: 'TPAT1 กสพท.', tpat2: 'TPAT2 ศิลปกรรมศาสตร์', tpat21: 'TPAT2 ทัศนศิลป์', tpat22: 'TPAT2 ดนตรี',
  tpat23: 'TPAT2 นาฏศิลป์', tpat3: 'TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์', tpat4: 'TPAT4 สถาปัตยกรรมศาสตร์',
  tpat5: 'TPAT5 ครุศาสตร์ ศึกษาศาสตร์', gpax: 'GPAX', portfolio: 'Portfolio', interview: 'สัมภาษณ์',
};
const scoreName = (key) => {
  const a = key.match(/^a_lv_(\d+)$/);
  if (a) return A_LEVEL[a[1]] ?? `A-Level (${a[1]})`;
  const v = key.match(/^vnet_(\d+)$/);
  if (v) return `V-NET (${v[1]})`;
  return NAMED[key] ?? key;
};

const BOILERPLATE = /ในกรณีที่มีผู้สมัครจำนวนมาก[\s\S]*$/;

function toAdmission(r, programId) {
  const round = Number(String(r.type ?? '').split('_')[0]);
  if (!(round >= 1 && round <= 4)) return null;

  const weights = Object.fromEntries(
    Object.entries(r.scores ?? {})
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([k, v]) => [scoreName(k), v]),
  );

  const notes = [];
  let minGpax = null;
  for (const [k, v] of Object.entries(r.score_conditions ?? {})) {
    if (typeof v !== 'number') continue;
    const key = k.replace(/^min_/, '');
    if (key === 'gpax') minGpax = v;
    else notes.push(v > 1 ? `${scoreName(key)} ขั้นต่ำ ${v}` : `ต้องมีคะแนน ${scoreName(key)}`);
  }
  if (r.min_total_score) notes.push(`คะแนนรวมขั้นต่ำ ${r.min_total_score}`);

  const criteria = r.folio?.criteria?.replace(BOILERPLATE, '').trim();
  const requirements = [criteria, notes.length ? notes.join(', ') : null].filter(Boolean).join('\n') || null;

  // round 1 portfolio deadline (myTCAS has no open date, only the close)
  const applyEnd = isoDay(r.folio?.closed_date);
  const extra = [r.condition, r.interview_date && `สัมภาษณ์: ${r.interview_date}${r.interview_time ? ` ${r.interview_time}` : ''}`]
    .filter(Boolean)
    .join(' | ');

  return {
    round,
    project_name: String(r.project_name_th ?? 'ไม่ระบุชื่อโครงการ').slice(0, 300),
    seats: Number.isInteger(r.receive_student_number) ? r.receive_student_number : null,
    // myTCAS has the odd -1 / 99 in here, treat anything outside 0-4 as "not set"
    min_gpax: minGpax !== null && minGpax >= 0 && minGpax <= 4 ? minGpax : null,
    requirements: requirements?.slice(0, 5000) ?? null,
    score_weights: Object.keys(weights).length ? weights : null,
    last_year_min_score: null,
    apply_start: null,
    apply_end: applyEnd,
    source_url: PROGRAM_PAGE(programId),
    notes: extra ? extra.slice(0, 2000) : null,
  };
}

// "2026-10-14T00:00:00.000Z" -> "2026-10-14"
// dates outside the cycle (TCAS of Thai year Y runs ~Jun of Y-544 to Jul of Y-543) are typos, drop them
function isoDay(s) {
  if (!s) return null;
  const d = String(s).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const from = `${year - 544}-06-01`;
  const to = `${year - 543}-07-31`;
  return d >= from && d <= to ? d : null;
}

const courses = await getJson(`${BASE}/courses.json`);
console.log(`courses.json: ${courses.length} programs`);

// one entry per program, names made unique (same degree name exists as ปกติ/พิเศษ/major variants)
const programs = [];
const seen = new Set();
for (const c of courses) {
  let name = c.program_name_th;
  if (c.major_name_th) name += ` วิชาเอก${c.major_name_th}`;
  if (c.program_type_name_th) name += ` (${c.program_type_name_th})`;
  // myTCAS uses "0" / "-" for "no partner"
  const partner = String(c.program_partners_inter_name ?? '').trim();
  if (partner && partner !== '0' && partner !== '-') name += ` ร่วมกับ ${partner}`;
  const key = [c.university_name_th, c.faculty_name_th, name, c.campus_name_th].join('|');
  if (seen.has(key)) name += ` [${c.program_id}]`;
  seen.add([c.university_name_th, c.faculty_name_th, name, c.campus_name_th].join('|'));

  programs.push({
    _id: c.program_id,
    _uni: c.university_id,
    university: c.university_name_th,
    faculty: c.faculty_name_th,
    program: name.slice(0, 300),
    campus: c.campus_name_th ?? '',
    url: PROGRAM_PAGE(c.program_id),
    tuition_note: c.cost && c.cost !== '-' ? String(c.cost).slice(0, 500) : null,
    admissions: [],
  });
}

// per-round criteria, a few requests at a time
const targets = programs.filter((p) => roundUnis.includes('all') || roundUnis.includes(p._uni));
console.log(`fetching round data for ${targets.length} programs (${roundUnis.join(', ') || 'none'})`);
let done = 0;
const worker = async (queue) => {
  for (let p = queue.shift(); p; p = queue.shift()) {
    const rounds = await getJson(`${BASE}/rounds/${p._id}.json`);
    p.admissions = (rounds ?? []).map((r) => toAdmission(r, p._id)).filter(Boolean).slice(0, 50);
    if (++done % 25 === 0) console.log(`  ${done}/${targets.length}`);
    await new Promise((r) => setTimeout(r, 150)); // be gentle
  }
};
const queue = [...targets];
await Promise.all(Array.from({ length: 4 }, () => worker(queue)));

// per university: span of round 1 portfolio deadlines across all its projects
const byUni = new Map();
for (const p of targets) {
  for (const a of p.admissions) {
    if (a.round !== 1 || !a.apply_end) continue;
    const u = byUni.get(p.university) ?? { id: p._uni, min: a.apply_end, max: a.apply_end, n: 0 };
    if (a.apply_end < u.min) u.min = a.apply_end;
    if (a.apply_end > u.max) u.max = a.apply_end;
    u.n++;
    byUni.set(p.university, u);
  }
}
const calendar = [...byUni].map(([university, u]) => ({
  university,
  round: 1,
  event:
    u.min === u.max
      ? `รอบ 1 Portfolio ปิดรับสมัคร/ส่งแฟ้มผลงาน (${u.n} โครงการ)`
      : `รอบ 1 Portfolio ปิดรับสมัคร/ส่งแฟ้มผลงาน แล้วแต่โครงการ ตั้งแต่ ${u.min} ถึง ${u.max} (${u.n} โครงการ ดูวันของแต่ละหลักสูตร)`,
  start_date: u.min,
  end_date: u.max === u.min ? null : u.max,
  source_url: `https://course.mytcas.com/universities/${u.id}`,
}));

const file = {
  academic_year: year,
  source_note: `course.mytcas.com (courses.json + rounds/*.json), fetched ${new Date().toISOString()}`,
  programs: programs.map(({ _id, _uni, ...p }) => p),
  calendar,
};
await writeFile(out, JSON.stringify(file, null, 1));
const admissions = file.programs.reduce((n, p) => n + p.admissions.length, 0);
console.log(`wrote ${out}: ${file.programs.length} programs, ${admissions} admission rows, ${calendar.length} university calendar rows`);
