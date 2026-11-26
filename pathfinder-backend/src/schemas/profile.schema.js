import { z } from 'zod';
import { text, id } from './common.schema.js';

/* กำหนด grade */
const grade = z.number().min(0, 'เกรดต้องอยู่ระหว่าง 0-4').max(4, 'เกรดต้องอยู่ระหว่าง 0-4');
const tags = (label) => z.array(text(100, label)).max(30, `${label}ใส่ได้ไม่เกิน 30 รายการ`);
const year = z.union([z.number().int().min(2000).max(2700), text(20, 'ปี')]).optional();

export const updateProfileBody = z
  .strictObject({
    display_name: text(100, 'ชื่อที่แสดง'),
    school_id: id.nullable(),
    grade_level_id: id.nullable(),
    gpax: grade.nullable(),
    // { "คณิตศาสตร์": 3.5, "ภาษาอังกฤษ": 4 }
    subject_grades: z.record(text(100, 'ชื่อวิชา'), grade).refine((o) => Object.keys(o).length <= 40, 'ใส่ได้ไม่เกิน 40 วิชา'),
    interests: tags('ความสนใจ'),
    skills: tags('ทักษะ'),
    activities: z
      .array(
        z.strictObject({
          name: text(200, 'ชื่อกิจกรรม'),
          role: text(100, 'บทบาท').optional(),
          year,
          description: text(1000, 'รายละเอียด').optional(),
        }),
      )
      .max(50),
    awards: z
      .array(
        z.strictObject({
          name: text(200, 'ชื่อรางวัล'),
          level: text(100, 'ระดับรางวัล').optional(), // school / province / national ...
          year,
        }),
      )
      .max(50),
    target_faculties: z
      .array(
        z.strictObject({
          faculty: text(200, 'คณะ'),
          university: text(200, 'มหาวิทยาลัย').optional(),
        }),
      )
      .max(10),
    // profile settings page. none of these go to the AI (see student.service)
    nickname: text(50, 'ชื่อเล่น').nullable(),
    bio: z.string().trim().max(500, 'แนะนำตัวยาวได้ไม่เกิน 500 ตัวอักษร').nullable(),
    target_tcas_year: z.number().int().min(2560).max(2650).nullable(),
    avatar_icon: z.string().trim().regex(/^[a-z0-9_-]{1,30}$/, 'ไอคอนไม่ถูกต้อง').nullable(),
    avatar_frame_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'สีต้องเป็นรูปแบบ #RRGGBB').nullable(),
    avatar_bg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'สีต้องเป็นรูปแบบ #RRGGBB').nullable(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'ต้องส่งข้อมูลที่จะแก้ไขอย่างน้อย 1 อย่าง');

export const EXAM_TYPES = ['TGAT', 'TPAT', 'A-Level', 'อื่นๆ'];

export const createExamScoreBody = z
  .strictObject({
    exam_type: z.enum(EXAM_TYPES, `ประเภทสอบต้องเป็น ${EXAM_TYPES.join(', ')}`),
    subject: text(100, 'ชื่อวิชา'),
    score: z.number({ error: 'คะแนนต้องเป็นตัวเลข' }).min(0, 'คะแนนติดลบไม่ได้'),
    max_score: z.number({ error: 'คะแนนเต็มต้องเป็นตัวเลข' }).positive('คะแนนเต็มต้องมากกว่า 0'),
    taken_at: z.iso.date('วันที่สอบต้องเป็นรูปแบบ YYYY-MM-DD').nullish(),
  })
  .refine((o) => o.score <= o.max_score, { message: 'คะแนนต้องไม่เกินคะแนนเต็ม', path: ['score'] });
