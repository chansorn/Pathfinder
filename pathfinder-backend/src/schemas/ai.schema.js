import { z } from 'zod';

// What each AI feature has to return.
// Used twice: converted into Gemini's responseSchema (utils/geminiSchema.js), then to validate the answer.
// Keep every field required - no optional/nullable/union. Gemini fills everything in
// and the conversion stays dead simple.
// The .describe() text is sent to Gemini as field hints, so it's in Thai on purpose.

const str = (description) => z.string().min(1).describe(description);
const list = (description, min = 1, max = 10) => z.array(z.string().min(1)).min(min).max(max).describe(description);
const score = (description) => z.number().int().min(0).max(100).describe(description);
const verifyNote = z
  .string()
  .min(1)
  .describe('เตือนให้ตรวจสอบวันสอบ วันรับสมัคร เกณฑ์คะแนน และสัดส่วนคะแนนจาก mytcas.com และเว็บไซต์มหาวิทยาลัยทุกครั้ง');

// --- assessment ---
export const RIASEC_TYPES = ['R', 'I', 'A', 'S', 'E', 'C'];

export const assessmentAiSchema = z.object({
  summary: str('สรุปภาพรวมตัวตนของน้อง 2-4 ประโยค'),
  riasec_code: z.string().regex(/^[RIASEC]{3}$/).describe('รหัส Holland 3 ตัวอักษร เรียงจากคะแนนสูงสุด เช่น IAS'),
  top_types: z
    .array(
      z.object({
        type: z.enum(RIASEC_TYPES),
        name_th: str('ชื่อกลุ่มภาษาไทย เช่น นักคิดวิเคราะห์'),
        description: str('อธิบายว่ากลุ่มนี้หมายถึงอะไรในตัวน้อง'),
      }),
    )
    .min(2)
    .max(3),
  personality_traits: list('ลักษณะบุคลิกภาพเด่น', 3, 6),
  strengths: list('จุดแข็ง', 3, 6),
  areas_to_develop: list('สิ่งที่ควรพัฒนา พูดแบบให้กำลังใจ', 2, 5),
  learning_style: z.object({
    primary: str('สไตล์การเรียนรู้หลัก เช่น เรียนรู้ผ่านการลงมือทำ'),
    description: str('อธิบายสไตล์นี้'),
    study_tips: list('เทคนิคอ่านหนังสือที่เข้ากับสไตล์นี้', 3, 6),
  }),
  suggested_fields: list('สายการเรียน/กลุ่มสาขาที่น่าจะเหมาะ', 3, 6),
  encouragement: str('ข้อความให้กำลังใจปิดท้าย'),
});

// --- faculties ---
export const facultiesAiSchema = z.object({
  recommendations: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(8).describe('อันดับ 1 = เหมาะที่สุด'),
        faculty: str('ชื่อคณะ/สาขา'),
        university_examples: list('ตัวอย่างมหาวิทยาลัยในไทยที่เปิดคณะนี้', 1, 5),
        match_score: score('ความเหมาะสม 0-100'),
        reasons: list('เหตุผลที่เหมาะ อิงจากข้อมูลของน้อง', 2, 5),
        related_careers: list('อาชีพที่เกี่ยวข้อง', 2, 6),
        key_subjects: list('วิชาที่สำคัญสำหรับคณะนี้', 2, 6),
        gap_to_close: list('สิ่งที่น้องยังขาดและควรเตรียมเพิ่ม', 1, 5),
      }),
    )
    .min(5)
    .max(8),
  verify_note: verifyNote,
});

// --- careers ---
export const careersAiSchema = z.object({
  careers: z
    .array(
      z.object({
        career: str('ชื่ออาชีพ'),
        description: str('อาชีพนี้ทำอะไร'),
        future_trend: str('แนวโน้มในอนาคต 5-10 ปี'),
        salary_range_note: str('ช่วงรายได้โดยประมาณแบบกว้างๆ พร้อมบอกว่าแตกต่างตามประสบการณ์/องค์กร'),
        required_skills: list('ทักษะที่ต้องมี', 3, 8),
        match_score: score('ความเหมาะสม 0-100'),
      }),
    )
    .min(4)
    .max(8),
  verify_note: verifyNote,
});

// --- TCAS plan ---
export const tcasPlanAiSchema = z.object({
  overview: str('สรุปกลยุทธ์ภาพรวม'),
  rounds: z
    .array(
      z.object({
        round: z.number().int().min(1).max(4),
        name: str('เช่น รอบ 1 Portfolio'),
        suitability: z.enum(['สูง', 'กลาง', 'ต่ำ']).describe('รอบนี้เหมาะกับน้องแค่ไหน'),
        strategy: str('กลยุทธ์ในรอบนี้'),
        requirements: list('สิ่งที่มักต้องใช้ในรอบนี้ (ให้น้องเช็คเกณฑ์จริงเอง)', 1, 8),
        tips: list('เคล็ดลับ', 1, 6),
      }),
    )
    .length(4),
  timeline: z
    .array(
      z.object({
        period: str('ช่วงเวลาแบบรายเดือน เช่น พ.ค.-มิ.ย. (ม.5) ห้ามระบุวันที่แน่นอน'),
        focus: str('เป้าหมายหลักของช่วงนี้'),
        tasks: list('สิ่งที่ต้องทำ', 1, 8),
      }),
    )
    .min(4)
    .max(18),
  score_targets: z
    .array(
      z.object({
        exam: z.enum(['TGAT', 'TPAT', 'A-Level', 'อื่นๆ']),
        subject: str('ชื่อวิชา/พาร์ต'),
        target_score: z.number().min(0).describe('คะแนนเป้าหมายส่วนตัวของน้อง ไม่ใช่คะแนนต่ำสุดของคณะ'),
        max_score: z.number().positive(),
        priority: z.enum(['สูง', 'กลาง', 'ต่ำ']),
        reason: str('ทำไมวิชานี้สำคัญ'),
      }),
    )
    .min(1)
    .max(15),
  specific_subjects: z
    .array(z.object({ subject: str('วิชาเฉพาะ/ความถนัดเฉพาะ'), note: str('คำแนะนำในการเตรียม') }))
    .max(8),
  checklist: z
    .array(z.object({ item: str('สิ่งที่ต้องทำ/เตรียม'), category: z.enum(['เอกสาร', 'สอบ', 'พอร์ต', 'ทักษะ', 'อื่นๆ']) }))
    .min(5)
    .max(25),
  verify_note: verifyNote,
});

// --- portfolio ---
export const portfolioAiSchema = z.object({
  student_level_note: str('ประเมินสั้นๆ ว่าน้องอยู่ระดับไหน และไอเดียชุดนี้ออกแบบมาเพื่ออะไร'),
  ideas: z
    .array(
      z.object({
        title: str('ชื่อผลงาน/กิจกรรม'),
        description: str('รายละเอียด'),
        difficulty: z.enum(['ง่าย', 'ปานกลาง', 'ยาก']),
        duration: str('ระยะเวลาโดยประมาณ เช่น 2-4 สัปดาห์'),
        skills_gained: list('ทักษะที่ได้', 1, 6),
        how_to_start: list('ขั้นตอนเริ่มต้นที่ทำได้ทันที', 2, 6),
      }),
    )
    .min(5)
    .max(8),
  portfolio_tips: list('เคล็ดลับการจัดพอร์ต', 3, 8),
});

// --- skills ---
export const skillsAiSchema = z.object({
  skills: z
    .array(
      z.object({
        skill: str('ชื่อทักษะ'),
        category: z.enum(['hard skill', 'soft skill']),
        why_important: str('ทำไมสำคัญกับเป้าหมายของน้อง'),
        priority: z.number().int().min(1).max(10).describe('ลำดับที่ควรเริ่ม 1 = เริ่มก่อน'),
        resources: z
          .array(
            z.object({
              name: str('ชื่อแหล่งเรียนรู้/แพลตฟอร์ม ไม่ต้องใส่ URL'),
              type: z.enum(['คอร์สออนไลน์', 'หนังสือ', 'วิดีโอ', 'แอป', 'กิจกรรม', 'อื่นๆ']),
              cost: z.enum(['ฟรี', 'มีค่าใช้จ่าย', 'มีทั้งฟรีและเสียเงิน']),
            }),
          )
          .min(1)
          .max(5),
        how_to_practice: list('วิธีฝึก', 1, 5),
        estimated_time: str('เวลาที่ใช้โดยประมาณ'),
      }),
    )
    .min(3)
    .max(8),
  learning_path: z
    .array(
      z.object({
        step: z.number().int().min(1),
        title: str('ชื่อขั้น'),
        skills: list('ทักษะในขั้นนี้', 1, 5),
        duration: str('ระยะเวลา'),
      }),
    )
    .min(2)
    .max(6),
});

// --- coach: high-yield chapters ---
export const highYieldAiSchema = z.object({
  subject: str('วิชาที่วิเคราะห์'),
  chapters: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(5),
        chapter: str('ชื่อบท/หัวข้อ'),
        why_high_yield: str('ทำไมคุ้มเวลา อ้างอิงผังข้อสอบหรือแนวข้อสอบปีก่อนถ้ามี'),
        exam_weight_note: str('สัดส่วน/จำนวนข้อโดยประมาณ ถ้าไม่มีแหล่งอ้างอิงให้เขียนว่า "ไม่มีข้อมูลทางการ"'),
        study_hours: z.number().min(1).max(100).describe('ชั่วโมงที่ควรใช้โดยประมาณ'),
        how_to_study: list('วิธีอ่าน/ฝึก', 1, 5),
        practice_resources: list('แหล่งฝึก เช่น ข้อสอบเก่า ตัวอย่างข้อสอบ mytcas.com/blueprint', 1, 4),
      }),
    )
    .min(3)
    .max(5),
  weekly_plan: list('แผนรายสัปดาห์ตามชั่วโมงที่น้องมี', 1, 8),
  quick_prompts: list('คำถามสั้นๆ ที่น้องกดถามโค้ชต่อได้', 2, 5),
  verify_note: verifyNote,
});

// --- "คณะที่ใช่" refresh: AI picks from our real candidate list (by index), never invents programs ---
export const matchPicksAiSchema = z.object({
  picks: z
    .array(
      z.object({
        index: z.number().int().min(0).max(30).describe('เลขบรรทัดของหลักสูตรในรายการที่ให้'),
        reason: str('เหตุผล 1 ประโยคว่าทำไมเหมาะกับนักเรียนคนนี้'),
      }),
    )
    .min(1)
    .max(8),
});

// --- AI coach "แนวทาง": a headline, 3 concrete moves, 3 programs picked from the given real list ---
export const coachGuidanceAiSchema = z.object({
  headline: str('สรุปแนวทาง 1-2 ประโยค ตามมุมมองที่กำหนด'),
  moves: z
    .array(
      z.object({
        title: str('สิ่งที่ควรทำ สั้นๆ'),
        detail: str('ทำอย่างไร 1-2 ประโยค อิงข้อมูลที่ให้เท่านั้น'),
      }),
    )
    .min(2)
    .max(4),
  picks: z
    .array(
      z.object({
        index: z.number().int().min(0).max(30).describe('เลขบรรทัดของหลักสูตรในรายการที่ให้'),
        reason: str('ทำไมหลักสูตรนี้เข้ากับมุมมองนี้ 1 ประโยค'),
      }),
    )
    .min(1)
    .max(3),
});

// --- Step 1 "AI วิเคราะห์ความสนใจ": free text -> our interest keys + a short summary ---
export const interestsAiSchema = z.object({
  interests: z.array(z.string().min(1)).min(0).max(4).describe('key ความสนใจจากรายการที่ให้เท่านั้น เรียงจากตรงที่สุด'),
  summary: str('สรุปสั้นๆ 1-2 ประโยคว่านักเรียนสนใจอะไร และทำไมจับคู่กับด้านเหล่านี้'),
});
