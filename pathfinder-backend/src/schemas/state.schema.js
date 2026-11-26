import { z } from 'zod';
import { PROVINCES } from '../data/provinces.js';
import { FACULTY_KEYS } from '../data/faculties.js';

// PF_STATE from the frontend. Everything optional, PATCH merges top-level keys.
// Limits keep one user's row small (it's stored as one jsonb).
const key = z.string().trim().min(1).max(100);
const keys = (max) => z.array(key).max(max);

export const statePatchBody = z
  .strictObject({
    lang: z.enum(['th', 'en']),
    beyond_4: z.boolean(),
    custom_keywords: z.array(z.string().trim().min(1).max(50)).max(10),
    target_universities: keys(10), // chip codes like "cu", "ku" or a university name the student typed
    target_faculties: z.array(z.enum(FACULTY_KEYS)).max(3), // Step 3 "คณะที่สนใจเป็นพิเศษ"
    weekly_hours: z.number().min(0).max(80),
    liked_majors: keys(100),
    ignored_majors: keys(100),
    locked_major: key.nullable(),
    // province the student lives in (Step 3), for nearby universities
    province: z.enum(PROVINCES).nullable(),
    // Rank 1-3 for the roadmap: tcas_programs ids, in order
    target_programs: z
      .array(z.uuid('รหัสหลักสูตรไม่ถูกต้อง'))
      .max(3, 'เลือกเป้าหมายได้ไม่เกิน 3 อันดับ')
      .refine((ids) => new Set(ids).size === ids.length, 'เลือกหลักสูตรเดียวกันซ้ำในหลายอันดับไม่ได้'),
    locked_program_id: z.uuid().nullable(),
    checked_waypoints: keys(200),
    behavior: z.strictObject({
      visited_pages: keys(50).optional(),
      interactions: z
        .record(key, z.number().int().min(0).max(1_000_000))
        .refine((o) => Object.keys(o).length <= 50, 'interactions ได้ไม่เกิน 50 รายการ')
        .optional(),
      last_action: z.string().trim().max(100).nullable().optional(),
      last_action_at: z.iso.datetime().nullable().optional(),
    }),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'ต้องส่งข้อมูลอย่างน้อย 1 อย่าง');

// --- roadmap checklist ---

const itemKey = z.string().regex(/^[A-Za-z0-9:_.-]{1,100}$/, 'item id ใช้ได้เฉพาะ a-z 0-9 : _ . - ไม่เกิน 100 ตัว');
const itemFields = {
  title: z.string().trim().min(1, 'กรุณาใส่ชื่องาน').max(300),
  round: z.number().int().min(1).max(4).nullable(),
  tier: z.enum(['required', 'recommended', 'optional']),
  status: z.enum(['todo', 'done', 'dismissed']),
  due_date: z.iso.date('วันที่ต้องเป็น YYYY-MM-DD').nullable(),
  // steps / deliverables / tools / hours for the task drawer - free form, kept small
  detail: z.record(z.string().max(50), z.unknown()).refine((o) => JSON.stringify(o).length <= 5000, 'detail ใหญ่เกินไป'),
  // 'custom' = a task the student added on a device (the frontend keeps its own key for it)
  source: z.enum(['system', 'custom', 'simulator']),
};

export const itemKeyParam = z.object({ id: itemKey });

// PATCH /my-plan/items/:id - creates the item if it isn't there yet (then title is needed)
export const patchItemBody = z
  .strictObject(itemFields)
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'ต้องส่งข้อมูลที่จะแก้ไขอย่างน้อย 1 อย่าง');

// PUT /my-plan/items - push the whole localStorage checklist at once (first login on this device)
export const syncItemsBody = z.strictObject({
  items: z
    .array(z.strictObject({ id: itemKey, ...itemFields }).partial({ round: true, tier: true, status: true, due_date: true, detail: true, source: true }))
    .max(300, 'ส่งได้ครั้งละไม่เกิน 300 งาน'),
});

// POST /my-plan/items - a task the student made up
export const customItemBody = z.strictObject({
  title: itemFields.title,
  round: itemFields.round.optional(),
  tier: itemFields.tier.default('recommended'),
  due_date: itemFields.due_date.optional(),
  detail: itemFields.detail.optional(),
});

export const calendarIcsQuery = z.object({
  year: z.coerce.number().int().min(2560).max(2650).optional(),
  university: z.string().trim().max(200).optional(),
});

// --- analytics page: progress snapshots ---

export const PROGRESS_EVENTS = ['checkin', 'gpax_update', 'major_locked', 'reroute', 'waypoint_complete'];
const pct = z.number().int().min(0).max(100);

// POST /me/progress - the numbers the analytics page already computes, nothing personal
export const progressBody = z.strictObject({
  event_type: z.enum(PROGRESS_EVENTS),
  gpax: z.number().min(0).max(4).nullable(),
  readiness_pct: pct,
  weekly_hours: z.number().min(0).max(80),
  locked_major: key.nullable(),
  completed_count: z.number().int().min(0).max(500),
  total_count: z.number().int().min(0).max(500),
  round_breakdown: z.strictObject({ r1: pct, r2: pct, r3: pct, r4: pct }),
});

// GET /me/progress?days=7 - leave out for everything (newest 500)
export const progressQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});
