import { z } from 'zod';
import { EXAM_TYPES } from './profile.schema.js';

const str = (max) => z.string().trim().min(1).max(max);
const optText = (max) => z.string().trim().max(max).nullish();
const url = z.url().max(2000).nullish();

// --- import file (scripts/import-tcas.js) ---

const admission = z.strictObject({
  round: z.number().int().min(1).max(4),
  project_name: str(300),
  seats: z.number().int().min(0).nullish(),
  min_gpax: z.number().min(0).max(4).nullish(),
  requirements: optText(5000),
  // { "TGAT": 20, "TPAT3": 30 } - percent weight per exam/subject
  score_weights: z.record(str(100), z.number().min(0).max(100)).nullish(),
  last_year_min_score: z.number().min(0).nullish(),
  apply_start: z.iso.date().nullish(),
  apply_end: z.iso.date().nullish(),
  source_url: url,
  notes: optText(2000),
});

const program = z.strictObject({
  university: str(200),
  faculty: str(200),
  program: str(300),
  campus: z.string().trim().max(200).default(''),
  url,
  tuition_note: optText(500),
  admissions: z.array(admission).max(50).default([]),
});

const calendarItem = z.strictObject({
  // null/missing = central TCAS event, otherwise that university's own date
  university: z.string().trim().min(1).max(200).nullish(),
  round: z.number().int().min(1).max(4).nullish(),
  event: str(300),
  start_date: z.iso.date(),
  end_date: z.iso.date().nullish(),
  source_url: url,
});

export const tcasImportSchema = z.strictObject({
  academic_year: z.number().int().min(2560).max(2650), // Thai year
  source_note: z.string().max(500).optional(),
  programs: z.array(program).max(20000).default([]),
  calendar: z.array(calendarItem).max(500).default([]),
});

// --- public endpoints ---

const year = z.coerce.number().int().min(2560).max(2650).optional();

export const tcasProgramsQuery = z.object({
  q: z.string().trim().max(100).optional(), // matches faculty or program
  university: z.string().trim().max(200).optional(),
  year,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/tcas/compare?ids=a,b,c
export const compareQuery = z.object({
  ids: z
    .string({ error: 'ส่ง ids ของหลักสูตรที่จะเปรียบเทียบ คั่นด้วย ,' })
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.uuid('รหัสหลักสูตรไม่ถูกต้อง')).min(2, 'เลือกอย่างน้อย 2 หลักสูตร').max(4, 'เปรียบเทียบได้ครั้งละไม่เกิน 4 หลักสูตร')),
});

export const deadlinesQuery = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
});

export const saveProgramBody = z.strictObject({
  program_id: z.uuid('รหัสหลักสูตรไม่ถูกต้อง'),
  note: z.string().trim().max(500).optional(),
});

export const programIdParam = z.object({
  programId: z.uuid('รหัสหลักสูตรไม่ถูกต้อง'),
});

// POST /api/tcas/programs/:id/simulate - scores the student is trying out (nothing saved)
export const simulateBody = z.strictObject({
  scores: z
    .array(
      z
        .strictObject({
          exam_type: z.enum(EXAM_TYPES, `ประเภทสอบต้องเป็น ${EXAM_TYPES.join(', ')}`),
          subject: z.string().trim().max(100).default(''),
          score: z.number({ error: 'คะแนนต้องเป็นตัวเลข' }).min(0, 'คะแนนติดลบไม่ได้'),
          max_score: z.number().positive('คะแนนเต็มต้องมากกว่า 0').default(100),
        })
        .refine((s) => s.score <= s.max_score, { message: 'คะแนนต้องไม่เกินคะแนนเต็ม', path: ['score'] }),
    )
    .max(30, 'ใส่คะแนนได้ไม่เกิน 30 วิชา'),
  gpax: z.number().min(0).max(4).nullish(),
});

const GROUP_KEYS = ['computer-eng', 'medicine', 'bba', 'architecture-design', 'comm-arts', 'law'];
export const groupParam = z.object({ key: z.enum(GROUP_KEYS, `กลุ่มคณะต้องเป็น ${GROUP_KEYS.join(', ')}`) });

export const groupProgramsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  university: z.string().trim().max(200).optional(),
});

export const groupSimulateBody = simulateBody.extend({
  limit: z.number().int().min(1).max(15).default(10),
  university: z.string().trim().max(200).optional(),
});

export const tcasCalendarQuery = z.object({
  year,
  // returns central events + this university's own dates
  university: z.string().trim().max(200).optional(),
});
