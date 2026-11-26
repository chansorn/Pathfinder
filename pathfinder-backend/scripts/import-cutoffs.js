// Official round 3 (Admission) max/min scores from mytcas.com/stat -> tcas_cutoffs.
//
//   npm run tcas:cutoffs                      download TCAS67-69 and load them into Supabase
//   npm run tcas:cutoffs -- --out cutoffs.json   only write the parsed rows to a file
//   npm run tcas:cutoffs -- --file 2569=./TCAS69.xlsx   use a file you already downloaded
//
// Each year's rows are replaced as a whole. The xlsx headers differ a bit between years,
// so columns are found by header text, not by position.
import { readFile, writeFile } from 'node:fs/promises';
import { readFirstSheet } from './lib/xlsx.js';

const SOURCES = {
  2569: 'https://assets.mytcas.com/69/TCAS69-R3-MinMax-10June26.xlsx',
  2568: 'https://assets.mytcas.com/68/T68-stat-r3_2-maxmin-24May25.xlsx',
  2567: 'https://assets.mytcas.com/67/TCAS67_maxmin.xlsx',
};

// first header found wins
const COLUMNS = {
  university: ['สถาบัน'],
  code: ['รหัสหลักสูตร'],
  faculty: ['คณะ'],
  program: ['หลักสูตร'],
  detail: ['รายละเอียด'],
  major: ['สาขา/วิชาเอก'],
  seats: ['รับ'],
  applicants: ['สมัคร'],
  passed: ['ผ่าน', 'ผ่าน ประมวลผลครั้งที่ 1', 'ผ่าน(รอบ1)'],
  max_score: ['คะแนนสูงสุด', 'คะแนนสูงสุด ประมวลผลครั้งที่ 1'],
  min_score: ['คะแนนต่ำสุด', 'คะแนนต่ำสุด ประมวลผลครั้งที่ 1'],
  min_score_final: ['คะแนนต่ำสุด DS', 'คะแนนต่ำสุด ประมวลผลครั้งที่ 2', 'คะแนนต่ำสุด หลังประมวลผลรอบ 2'],
};

const clean = (v) => {
  const s = (v ?? '').replace(/\s+/g, ' ').trim();
  return s && s !== '0' && s !== '-' ? s : null;
};
const int = (v) => (/^\d+$/.test(v ?? '') ? Number(v) : null);
const score = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10000) / 10000 : null;
};

export function parseCutoffSheet(rows, academicYear, sourceUrl) {
  const header = rows[0] ?? {};
  const colOf = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    for (const name of names) {
      const col = Object.keys(header).find((k) => header[k]?.trim() === name);
      if (col) {
        colOf[field] = col;
        break;
      }
    }
  }
  for (const required of ['university', 'code', 'min_score']) {
    if (!colOf[required]) throw new Error(`${academicYear}: no "${COLUMNS[required][0]}" column`);
  }

  const get = (row, field) => (colOf[field] ? row[colOf[field]] : undefined);
  return rows
    .slice(1)
    .filter((r) => /^[0-9A-Za-z]{10,20}$/.test(get(r, 'code') ?? ''))
    .map((r) => ({
      academic_year: academicYear,
      round: 3,
      program_code: get(r, 'code'),
      university: clean(get(r, 'university')) ?? '',
      faculty: clean(get(r, 'faculty')),
      program: clean(get(r, 'program')),
      // 69 has a project text per row, older years only the major
      detail: clean(get(r, 'detail')) ?? clean(get(r, 'major')),
      seats: int(get(r, 'seats')),
      applicants: int(get(r, 'applicants')),
      passed: int(get(r, 'passed')),
      min_score: score(get(r, 'min_score')),
      max_score: score(get(r, 'max_score')),
      min_score_final: score(get(r, 'min_score_final')),
      source_url: sourceUrl,
    }));
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : null;
  const localFiles = new Map(
    args
      .filter((_, i) => args[i - 1] === '--file')
      .map((a) => a.split('='))
      .map(([y, f]) => [Number(y), f]),
  );

  const all = [];
  for (const [year, url] of Object.entries(SOURCES)) {
    const y = Number(year);
    let buf;
    if (localFiles.has(y)) {
      buf = await readFile(localFiles.get(y));
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      buf = Buffer.from(await res.arrayBuffer());
    }
    const rows = parseCutoffSheet(readFirstSheet(buf), y, url);
    console.log(`TCAS${String(y).slice(-2)}: ${rows.length} rows, ${rows.filter((r) => r.min_score > 0).length} with a min score`);
    all.push(...rows);
  }

  if (out) {
    await writeFile(out, JSON.stringify(all, null, 1));
    console.log(`wrote ${all.length} rows to ${out}`);
    return;
  }

  const { serviceClient } = await import('../src/config/supabase.js');
  const { importCutoffs } = await import('../src/services/tcas.service.js');
  const res = await importCutoffs(serviceClient(), all);
  console.log(`imported ${res.rows} cutoff rows for ${res.years.join(', ')}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/import-cutoffs.js')) {
  main().catch((err) => {
    console.error('import failed:', err.message);
    process.exit(1);
  });
}
