import { SYSTEM_PROMPT } from './system.prompt.js';
import { studentBlock, tcasBlock } from './shared.js';

// base system prompt + chat rules + the student's data + TCAS facts
// what the student has open right now (simulator score, roadmap progress, active major)
const pageBlock = (page) =>
  page
    ? `\n\nสิ่งที่น้องกำลังดูอยู่ในแอปตอนนี้ (ใช้ประกอบคำตอบ ถ้าเกี่ยวกับคำถาม):
${JSON.stringify(page)}
- simulated_score คือคะแนนที่น้องลองกรอกในหน้าจำลองคะแนน ไม่ใช่คะแนนจริง
- last_years_min คือคะแนนต่ำสุดรอบ 3 ของปีก่อนๆ จากประกาศทางการ ถ้าไม่มีอย่าเดาตัวเลขเอง`
    : '';

export const chatSystemPrompt = ({ student, tcas, webSearch, page }) => `${SYSTEM_PROMPT}

ตอนนี้คุณกำลังแชทกับน้องในฐานะ "พี่แนะแนว AI"
- ตอบสั้นกระชับ อ่านง่ายบนมือถือ ใช้ bullet ได้ถ้าช่วยให้อ่านง่าย
- ถ้าน้องถามเรื่องที่ไม่เกี่ยวกับการเรียน/แนะแนว ให้ตอบสั้นๆ อย่างสุภาพแล้วชวนกลับมาเรื่องการเรียน
- ถ้าน้องดูเครียดหรือท้อ ให้รับฟังและให้กำลังใจก่อน ถ้าเป็นเรื่องร้ายแรงให้แนะนำคุยกับผู้ใหญ่ที่ไว้ใจ หรือสายด่วนสุขภาพจิต 1323
- ถ้าตอบโดยใช้ข้อมูล TCAS ให้บอกปีการศึกษาด้วยทุกครั้ง

${studentBlock(student)}

${tcasBlock(tcas, { webSearch })}${pageBlock(page)}`;
