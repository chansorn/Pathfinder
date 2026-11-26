// Pure scoring/eligibility logic - no db, no AI, easy to test.
//
// Admission weights come from myTCAS with readable keys ("TPAT3 วิทยาศาสตร์ ...", "A-Level ฟิสิกส์"),
// while students type exam_scores by hand ("TPAT3", "คณิต 1", ...). Both sides get mapped to a
// short code (TGAT1, TPAT3, A61, GPAX ...) and matched on that.

import { t } from '../utils/i18n.js';

// A-Level subject codes, most specific first
const A_LEVEL = [
  ['A61', /คณิต[^2]*1|math\s*1|\b61\b/i],
  ['A62', /คณิต[^1]*2|math\s*2|\b62\b/i],
  ['A63', /วิทยาศาสตร์ประยุกต์|applied\s*sci|\b63\b/i],
  ['A64', /ฟิสิกส์|physics|\b64\b/i],
  ['A65', /เคมี|chem|\b65\b/i],
  ['A66', /ชีว|bio|\b66\b/i],
  ['A70', /สังคม|social|\b70\b/i],
  ['A81', /ภาษาไทย|thai|\b81\b/i],
  ['A82', /อังกฤษ|english|\b82\b/i],
  ['A83', /ฝรั่งเศส|french/i],
  ['A84', /เยอรมัน|german/i],
  ['A85', /ญี่ปุ่น|japanese/i],
  ['A86', /เกาหลี|korean/i],
  ['A87', /จีน|chinese/i],
  ['A88', /บาลี|pali/i],
  ['A89', /สเปน|spanish/i],
];
const aLevelCode = (text) => A_LEVEL.find(([, re]) => re.test(text))?.[0] ?? null;

const NOT_PRECOMPUTABLE = new Set(['PORTFOLIO', 'INTERVIEW']);

// key from tcas_admissions.score_weights -> code
export function weightCode(key) {
  let m;
  if ((m = key.match(/^TGAT\s*(\d)?/i))) return m[1] ? `TGAT${m[1]}` : 'TGAT';
  if ((m = key.match(/^TPAT\s*(\d)/i))) return `TPAT${m[1]}`;
  if (/^A-Level/i.test(key)) return aLevelCode(key) ?? `OTHER:${key}`;
  if (/^GPAX/i.test(key)) return 'GPAX';
  if (/^V-NET/i.test(key)) return 'VNET';
  if (/portfolio|แฟ้ม/i.test(key)) return 'PORTFOLIO';
  if (/สัมภาษณ์|interview/i.test(key)) return 'INTERVIEW';
  return `OTHER:${key}`;
}

// one row from exam_scores -> code
export function examCode({ exam_type, subject = '' }) {
  let m;
  if (exam_type === 'TGAT') {
    if ((m = subject.match(/TGAT\s*([123])/i))) return `TGAT${m[1]}`;
    if (/อังกฤษ|english/i.test(subject)) return 'TGAT1';
    if (/เหตุผล|reason/i.test(subject)) return 'TGAT2';
    if (/สมรรถนะ|competenc/i.test(subject)) return 'TGAT3';
    return 'TGAT';
  }
  if (exam_type === 'TPAT') {
    if ((m = subject.match(/TPAT\s*(\d)/i))) return `TPAT${m[1]}`;
    if (/กสพท|แพทย์/.test(subject)) return 'TPAT1';
    if (/ศิลป/.test(subject)) return 'TPAT2';
    if (/วิทยาศาสตร์|วิศวกรรม|เทคโนโลยี/.test(subject)) return 'TPAT3';
    if (/สถาปัตย/.test(subject)) return 'TPAT4';
    if (/ครุ|ศึกษาศาสตร์/.test(subject)) return 'TPAT5';
    return `OTHER:TPAT ${subject}`;
  }
  if (exam_type === 'A-Level') return aLevelCode(subject) ?? `OTHER:A-Level ${subject}`;
  return `OTHER:${subject}`;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Student's scores as code -> percent (0-100).
 * If the same code was entered twice, the best one wins (students retake exams).
 * TGAT total is filled in from TGAT1-3 when only the parts were entered.
 */
export function buildScoreMap(examScores = [], gpax = null) {
  const map = new Map();
  for (const s of examScores) {
    if (!(s.max_score > 0)) continue;
    const code = examCode(s);
    const pct = (Number(s.score) * 100) / Number(s.max_score); // multiply first, avoids 55.00000000000001
    if (!map.has(code) || map.get(code) < pct) map.set(code, pct);
  }
  if (!map.has('TGAT') && ['TGAT1', 'TGAT2', 'TGAT3'].every((c) => map.has(c))) {
    map.set('TGAT', (map.get('TGAT1') + map.get('TGAT2') + map.get('TGAT3')) / 3);
  }
  if (gpax != null) map.set('GPAX', (Number(gpax) / 4) * 100);
  return map;
}

/**
 * Weighted score for one admission's score_weights.
 * weighted_score is only set when every part is known; partial_score / max_possible
 * show where the student stands so far.
 */
export function computeScore(weights, scoreMap, lang = 'th') {
  if (!weights || !Object.keys(weights).length) return null;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (!total) return null;

  const parts = Object.entries(weights).map(([key, weight]) => {
    const code = weightCode(key);
    const pct = scoreMap.get(code);
    return {
      subject: key,
      weight,
      your_percent: pct == null ? null : round2(pct),
      contributes: pct == null ? null : round2((weight * pct) / total),
      precomputable: !NOT_PRECOMPUTABLE.has(code) && !code.startsWith('OTHER:'),
    };
  });

  const known = parts.filter((p) => p.your_percent != null);
  const partial = known.reduce((s, p) => s + p.contributes, 0);
  const missingWeight = parts.filter((p) => p.your_percent == null).reduce((s, p) => s + p.weight, 0);
  const complete = known.length === parts.length;

  return {
    weighted_score: complete ? round2(partial) : null,
    partial_score: round2(partial),
    max_possible: round2(partial + (missingWeight / total) * 100),
    parts,
    missing: parts
      .filter((p) => p.your_percent == null)
      .map((p) => ({
        subject: p.subject,
        weight: p.weight,
        precomputable: p.precomputable,
        reason: t(lang, p.precomputable ? 'missing_subject' : 'not_precomputable'),
      })),
  };
}

const STATUS_RANK = { not_eligible: 0, closed: 1, missing_scores: 2, check_requirements: 3, eligible: 4 };

/**
 * Can the student apply to this admission project?
 * status: eligible | missing_scores | check_requirements | closed | not_eligible
 * (worst reason wins). This only checks what we have data for - GPAX and exam scores.
 */
export function checkEligibility(admission, { gpax, score, today, lang = 'th' }) {
  const reasons = [];
  // same reasons as data, so the frontend can render them itself in any language
  const reason_codes = [];
  let status = 'eligible';
  const worse = (s) => {
    if (STATUS_RANK[s] < STATUS_RANK[status]) status = s;
  };
  const add = (code, params = {}) => {
    reasons.push(t(lang, code, params));
    reason_codes.push({ code, params });
  };

  if (admission.apply_end && today && admission.apply_end < today) {
    worse('closed');
    add('closed', { date: admission.apply_end });
  }

  if (admission.min_gpax != null) {
    if (gpax == null) {
      worse('check_requirements');
      add('gpax_missing', { min: admission.min_gpax });
    } else if (Number(gpax) < Number(admission.min_gpax)) {
      worse('not_eligible');
      add('gpax_low', { gpax, min: admission.min_gpax });
    }
  }

  const missingExams = score?.missing.filter((m) => m.precomputable) ?? [];
  if (missingExams.length) {
    worse('missing_scores');
    add('missing_scores', { subjects: missingExams.map((m) => m.subject).join(', ') });
  }

  // "ต้องมีคะแนน X" lines are just the exam list we already checked above - only flag real extra conditions
  const extra = (admission.requirements ?? '').replace(/ต้องมีคะแนน[^,\n]*/g, '').replace(/[,\s]/g, '');
  if (extra) {
    worse('check_requirements');
    add('extra_requirements');
  }

  return { status, reasons, reason_codes };
}

export function gapToLastYear(weighted, lastYearMin) {
  if (weighted == null || lastYearMin == null) return null;
  return round2(weighted - Number(lastYearMin));
}

// --- last years' cutoffs (tcas_cutoffs) ---

const norm = (s = '') =>
  s
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .toLowerCase();

/**
 * Pick the cutoff rows that belong to one admission project, one per year.
 * myTCAS uses the same text for the project in both files, so an exact (whitespace-insensitive)
 * match on detail is the strong signal. If a year has just one row for the whole program,
 * that row is used too, but marked "program" since the project may have been split since.
 * Anything else stays unmatched - better no number than the wrong one.
 */
export function matchCutoffs(admission, cutoffs = []) {
  const byYear = new Map();
  for (const c of cutoffs) byYear.set(c.academic_year, [...(byYear.get(c.academic_year) ?? []), c]);

  const target = norm(admission.project_name);
  const out = [];
  for (const [year, rows] of byYear) {
    const exact = rows.find((r) => r.detail && norm(r.detail) === target);
    const row = exact ?? (rows.length === 1 ? rows[0] : null);
    // min 0 = nobody got in that year, there's no cutoff to compare against
    if (!row || !(Number(row.min_score) > 0)) continue;
    out.push({
      academic_year: year,
      min_score: Number(row.min_score),
      max_score: row.max_score == null ? null : Number(row.max_score),
      min_score_final: row.min_score_final == null ? null : Number(row.min_score_final),
      seats: row.seats,
      applicants: row.applicants,
      passed: row.passed,
      match: exact ? 'project' : 'program',
      detail: row.detail ?? null,
      source_url: row.source_url,
    });
  }
  return out.sort((a, b) => b.academic_year - a.academic_year);
}

export const zoneRule = (lang = 'th') => t(lang, 'zone_rule');

/**
 * Where a score sits against past cutoffs. history = matchCutoffs() output (latest first).
 * Not a probability - just a zone + where the score falls inside last year's admitted range.
 */
export function scoreZone(score, history = []) {
  if (score == null || !history.length) return null;
  const latest = history[0];
  const mins = history.map((h) => h.min_score);
  const buffer = round2(score - latest.min_score);

  let zone = 'reach';
  if (score >= Math.max(...mins) + 3) zone = 'safe';
  else if (buffer >= -2) zone = 'target';

  // 0 = at last year's minimum, 100 = at the top score. outside the range gets clamped
  const span = latest.max_score != null ? latest.max_score - latest.min_score : null;
  const position = span > 0 ? Math.max(0, Math.min(100, Math.round(((score - latest.min_score) / span) * 100))) : null;

  return {
    zone,
    buffer,
    compared_to_year: latest.academic_year,
    position_in_last_year_range: position,
    years_of_data: history.length,
    trend: history.length >= 2 ? round2(history[0].min_score - history[history.length - 1].min_score) : null,
  };
}
