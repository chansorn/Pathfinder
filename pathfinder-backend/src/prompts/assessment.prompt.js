import { studentBlock } from './shared.js';

export const assessmentPrompt = ({ student, scores, answers }) => `น้องเพิ่งทำแบบทดสอบความสนใจ/ความถนัดเสร็จ ช่วยวิเคราะห์บุคลิกภาพ จุดแข็ง และสไตล์การเรียนรู้

คะแนนที่ระบบคำนวณแล้ว (0-100 ยิ่งสูงยิ่งตรง) ใช้ตามนี้เลย ห้ามคำนวณใหม่:
\`\`\`json
${JSON.stringify(scores, null, 2)}
\`\`\`

คำตอบรายข้อ (1 = ไม่ตรงเลย, 5 = ตรงมาก):
${answers.map((a) => `- [${a.dimension}] ${a.text}: ${a.value}`).join('\n')}

${studentBlock(student)}

แนวทาง:
- riasec_code ให้เรียงจาก 3 กลุ่มที่คะแนน RIASEC สูงสุด
- top_types ใส่ 2-3 กลุ่มเด่น
- learning_style ให้อิงคะแนน learning_style ประกอบกับคำตอบ
- เขียนให้น้องอ่านแล้วรู้จักตัวเองมากขึ้น และรู้ว่าจะไปต่อยังไง`;
