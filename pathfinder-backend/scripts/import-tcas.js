// Load TCAS data from a JSON file into Supabase.
//
//   npm run tcas:import -- tcas-data/tcas69.json
//   npm run tcas:import -- tcas-data/tcas69.json --replace   (wipe that academic year first)
//
// File format: see tcas-data/template.json and the README.
import { readFile } from 'node:fs/promises';
import { tcasImportSchema } from '../src/schemas/tcas.schema.js';
import { importTcasData } from '../src/services/tcas.service.js';
import { serviceClient } from '../src/config/supabase.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const replace = args.includes('--replace');

if (!file) {
  console.error('usage: npm run tcas:import -- <file.json> [--replace]');
  process.exit(1);
}

let json;
try {
  json = JSON.parse(await readFile(file, 'utf8'));
} catch (err) {
  console.error(`can't read ${file}: ${err.message}`);
  process.exit(1);
}

const parsed = tcasImportSchema.safeParse(json);
if (!parsed.success) {
  console.error(`${file} has problems:`);
  for (const i of parsed.error.issues.slice(0, 20)) console.error(`  ${i.path.join('.') || '(root)'}: ${i.message}`);
  if (parsed.error.issues.length > 20) console.error(`  ...and ${parsed.error.issues.length - 20} more`);
  process.exit(1);
}

try {
  const res = await importTcasData(serviceClient(), { ...parsed.data, replace });
  console.log(
    `imported TCAS${String(res.academic_year).slice(-2)}: ${res.programs} programs, ${res.admissions} admission rows, ${res.calendar} calendar entries${replace ? ' (year replaced)' : ''}`,
  );
} catch (err) {
  console.error('import failed:', err.message);
  process.exit(1);
}
