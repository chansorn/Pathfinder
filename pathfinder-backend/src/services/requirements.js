// Turns tcas_admissions.requirements (myTCAS folio.criteria + conditions, free text) into
// something a "Recommended Docs" card can show. Pure, no db.
//
// Only reports what the text actually says: every document comes with the line it was found in
// (evidence), and nothing is added that the text doesn't mention.

// weight patterns seen in real data: "สัดส่วน 25.00", "= 80%", "ร้อยละ 40", "(30%)", "... 10%" at the end.
// a bare "(1.1 และ 1.2)" is a clause reference, not a weight - parentheses need the % sign
const WEIGHT = /(?:สัดส่วน(ย่อย)?\s*|=\s*|ร้อยละ\s*)(\d+(?:\.\d+)?)\s*%?|\(\s*()(\d+(?:\.\d+)?)\s*%\s*\)|\s()(\d+(?:\.\d+)?)\s*%\s*$/;
const weightOf = (m) => Number(m[2] ?? m[4] ?? m[6]);
const URL_RE = /https?:\/\/[^\s)]+/g;

const DOC_TYPES = [
  { type: 'portfolio', th: 'แฟ้มสะสมผลงาน (Portfolio)', en: 'Portfolio', re: /แฟ้ม|portfolio|โครงงาน|ผลงาน/i },
  { type: 'interview', th: 'เตรียมสอบสัมภาษณ์', en: 'Interview preparation', re: /สัมภาษณ์|interview/i },
  { type: 'transcript', th: 'ผลการเรียน (ปพ.1 / GPAX)', en: 'Transcript (GPAX)', re: /GPAX|ผลการเรียน|ปพ\.?\s?1|\bgpa\d{2}\b/i },
  { type: 'english_test', th: 'ผลสอบภาษาอังกฤษ', en: 'English test result', re: /IELTS|TOEFL|TOEIC|CEFR|Duolingo|\bDET\b|คะแนนภาษาอังกฤษ|ความสามารถในการใช้ภาษาอังกฤษ/i },
  { type: 'certificates', th: 'เกียรติบัตร / รางวัล', en: 'Certificates & awards', re: /เกียรติบัตร|รางวัล|ประกาศนียบัตร|โอลิมปิก|olympiad|สอวน|การแข่งขัน/i },
  { type: 'recommendation', th: 'หนังสือรับรอง / จดหมายแนะนำ', en: 'Recommendation letter', re: /recommendation|หนังสือรับรอง|จดหมายแนะนำ/i },
  { type: 'essay', th: 'เรียงความ / Statement', en: 'Essay / statement', re: /เรียงความ|essay|statement of purpose|personal statement|แรงจูงใจ|เหตุผลในการเลือก|ทำไมถึงเลือก/i },
  { type: 'sport', th: 'หลักฐานผลงานด้านกีฬา', en: 'Sports achievements', re: /นักกีฬา|ทีมชาติ|ด้านกีฬา/i },
  { type: 'health', th: 'ใบรับรองแพทย์ / ผลตรวจร่างกาย', en: 'Medical certificate', re: /ใบรับรองแพทย์|ตรวจร่างกาย|ตาบอดสี/i },
  { type: 'talent_test', th: 'สอบปฏิบัติ / ทดสอบความสามารถ', en: 'Practical / talent test', re: /สอบปฏิบัติ|ทดสอบความสามารถ|audition|ทดสอบทักษะ/i },
];

const clean = (s) =>
  s
    .replace(URL_RE, '')
    .replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, '') // "1." / "3.1"
    .replace(/[:=]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

// "แฟ้มสะสมผลงาน ร้อยละ 40 การสัมภาษณ์ ร้อยละ 60" -> two items
function splitInline(line) {
  const parts = [...line.matchAll(/(.+?)(?:ร้อยละ|=)\s*(\d+(?:\.\d+)?)\s*%?/g)];
  if (parts.length < 2) return null;
  return parts.map((m) => ({ item: clean(m[1]), weight: Number(m[2]), sub: false })).filter((p) => p.item);
}

export function parseRequirements(text) {
  if (!text) return { criteria: [], conditions: [], documents: [], links: [], notes: [] };

  const criteria = [];
  const conditions = [];
  const notes = [];
  const links = [...new Set(text.match(URL_RE) ?? [])];

  for (const raw of text.split(/\n+/)) {
    // urls are collected above; "?id=1775" must not read as a weight
    const line = raw.replace(URL_RE, '').trim();
    if (!line) continue;

    // generated condition lines: "gpa22 ขั้นต่ำ 3, TGAT ขั้นต่ำ 5" / "ต้องมีคะแนน TGAT1 ..."
    if (/ขั้นต่ำ\s*\d|^ต้องมีคะแนน/.test(line)) {
      conditions.push(...line.split(/,\s*/).map((s) => s.trim()).filter(Boolean));
      continue;
    }

    const inline = splitInline(line);
    if (inline) {
      criteria.push(...inline);
      continue;
    }

    const w = line.match(WEIGHT);
    if (w) {
      const item = clean(line.slice(0, w.index));
      if (item) {
        criteria.push({ item, weight: weightOf(w), sub: Boolean(w[1]) || /^\d+\.\d+/.test(line) });
        continue;
      }
    }
    const note = clean(line);
    if (note) notes.push(note);
  }

  // documents: scan criteria items first (strongest), then notes; one entry per type
  const documents = [];
  const sources = [...criteria.map((c) => c.item), ...notes, ...conditions];
  for (const d of DOC_TYPES) {
    const hit = sources.find((s) => d.re.test(s));
    if (hit) {
      const weight = criteria.find((c) => !c.sub && c.item === hit)?.weight ?? null;
      documents.push({ type: d.type, label_th: d.th, label_en: d.en, weight, evidence: hit });
    }
  }

  return { criteria, conditions, documents, links, notes };
}

// one card per round: documents across all its projects, with how many projects ask for each
export function docsForRound(admissions) {
  const byType = new Map();
  for (const a of admissions) {
    for (const d of parseRequirements(a.requirements).documents) {
      const cur = byType.get(d.type) ?? { ...d, projects: 0, evidence: d.evidence };
      cur.projects++;
      byType.set(d.type, cur);
    }
  }
  return [...byType.values()].sort((a, b) => b.projects - a.projects).map(({ weight, ...d }) => d);
}
