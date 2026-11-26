import { z } from 'zod';
import { text } from './common.schema.js';
import { PROVINCES } from '../data/provinces.js';
import { FACULTY_KEYS } from '../data/faculties.js';

// GET /api/schools?q=&province=&limit=
export const schoolsQuery = z.object({
  q: z.string().trim().max(100, 'คำค้นยาวได้ไม่เกิน 100 ตัวอักษร').optional(),
  province: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// request bodies for the AI + history endpoints

// true = skip the cache and ask the AI again
const force = z.boolean({ error: 'force ต้องเป็น true หรือ false เท่านั้น' }).optional();

// for endpoints that otherwise take no body
export const aiBody = z.strictObject({ force }).default({});

export const analyzeAssessmentBody = z.strictObject({
  force,
  // [{ question_id: "R1", value: 1-5 }, ...]
  answers: z
    .array(
      z.strictObject({
        question_id: z.string().min(1).max(20),
        value: z.number().int().min(1, 'คำตอบต้องอยู่ระหว่าง 1-5').max(5, 'คำตอบต้องอยู่ระหว่าง 1-5'),
      }),
    )
    .min(1, 'กรุณาตอบแบบทดสอบก่อน')
    .max(100),
});

export const careersBody = z
  .strictObject({
    faculty: text(200, 'ชื่อคณะ').optional(),
    force,
  })
  .default({});

export const tcasPlanBody = z.strictObject({
  target_faculty: text(200, 'คณะเป้าหมาย'),
  target_university: text(200, 'มหาวิทยาลัยเป้าหมาย'),
  force,
});

// what the student is looking at right now (floating coach / page 6). study data only
const chatContext = z.strictObject({
  page: z.string().trim().max(40).optional(), // e.g. "roadmap", "simulator"
  program_id: z.uuid('รหัสหลักสูตรไม่ถูกต้อง').optional(), // active / locked major
  simulated_score: z.number().min(0).max(100).optional(),
  gap_subjects: z
    .array(z.strictObject({ subject: z.string().trim().min(1).max(100), gap: z.number().min(-100).max(100) }))
    .max(10)
    .optional(),
  roadmap: z
    .strictObject({
      done: z.number().int().min(0).max(1000),
      total: z.number().int().min(0).max(1000),
      next_tasks: z.array(z.string().trim().min(1).max(200)).max(5).optional(),
    })
    .optional(),
});

export const chatBody = z.strictObject({
  message: text(2000, 'ข้อความ'),
  context: chatContext.optional(),
});

// POST /api/coach/high-yield
export const highYieldBody = z.strictObject({
  subject: text(100, 'วิชา'), // "A-Level ฟิสิกส์", "TPAT3"
  current_score: z.number().min(0).max(100).optional(),
  target_score: z.number().min(0).max(100).optional(),
  weekly_hours: z.number().min(1).max(80).optional(),
  force,
});

export const HISTORY_TYPES = ['faculty', 'career', 'portfolio', 'skill', 'high_yield', 'tcas', 'assessment', 'chat'];

// chat isn't here - it's wiped all at once via DELETE /api/chat/messages
const DELETABLE = HISTORY_TYPES.filter((t) => t !== 'chat');
export const historyItemParams = z.object({
  type: z.enum(DELETABLE, `type ต้องเป็น ${DELETABLE.join(', ')}`),
  id: z.uuid('รหัสอ้างอิงไม่ถูกต้อง'),
});

export const historyQuery = z.object({
  type: z.enum(HISTORY_TYPES, `type ต้องเป็น ${HISTORY_TYPES.join(', ')}`).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// POST /api/match/programs (+ /ai): the Step 1-3 answers. Only what the student actually set is sent
export const matchBody = z.strictObject({
  interests: z.array(z.string().trim().min(1).max(40)).min(1, 'เลือกความสนใจอย่างน้อย 1 ด้าน').max(4, 'เลือกความสนใจได้ไม่เกิน 4 ด้าน'), // [0] = ความสนใจหลัก
  custom_text: z.string().trim().max(500).optional(),
  gpax: z.number().min(0).max(4).nullable().optional(),
  beyond_4: z.boolean().optional(),
  target_universities: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  // Step 3 "คณะที่สนใจเป็นพิเศษ" (src/data/faculties.js keys)
  target_faculties: z.array(z.enum(FACULTY_KEYS, 'คณะไม่ถูกต้อง')).max(3, 'เลือกคณะได้ไม่เกิน 3 คณะ').optional(),
  weekly_hours: z.number().min(0).max(80).nullable().optional(),
  // where the student lives: programs nearby rank higher
  province: z.enum(PROVINCES, 'จังหวัดไม่ถูกต้อง').nullable().optional(),
  // Step 2 card shuffle: swiped up (liked, ranked higher) / swiped down (not shown again)
  liked_ids: z.array(z.uuid()).max(100).optional(),
  skipped_ids: z.array(z.uuid()).max(100).optional(),
  // programs already shown: "refresh" asks for the next best ones
  exclude_ids: z.array(z.uuid()).max(60).optional(),
  limit: z.number().int().min(1).max(8).optional(),
  // per-student random seed (kept in the browser): two students with the same answers get a different
  // order among programs that fit equally well. Not personal data.
  variety_seed: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'variety_seed ไม่ถูกต้อง').optional(),
});

// POST /api/coach/guidance: the AI coach's "แนวทาง" card. Same answers as the matcher, plus what was
// already shown (so "ขอแนวทางใหม่" brings something different) and how many times it was refreshed
export const guidanceBody = matchBody.extend({
  avoid_ids: z.array(z.uuid()).max(40).optional(),
  refresh: z.number().int().min(0).max(1000).optional(),
});

// POST /api/match/interests: what the student typed in Step 1
export const interestTextBody = z.strictObject({
  text: z.string().trim().min(2, 'พิมพ์สิ่งที่สนใจอย่างน้อย 2 ตัวอักษร').max(500, 'ยาวได้ไม่เกิน 500 ตัวอักษร'),
});
