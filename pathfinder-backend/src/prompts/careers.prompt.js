import { studentBlock } from './shared.js';

export const careersPrompt = ({ student, faculty }) => `แนะนำอาชีพในอนาคตที่เหมาะกับน้อง 4-8 อาชีพ
${faculty ? `โฟกัสอาชีพที่ต่อยอดจากคณะ/สาขา: "${faculty}"` : 'พิจารณาจากความสนใจและจุดแข็งของน้องโดยรวม'}

${studentBlock(student)}

แนวทาง:
- future_trend เล่าแนวโน้มจริงของตลาดงาน รวมถึงผลกระทบจาก AI/เทคโนโลยี
- salary_range_note บอกเป็นช่วงกว้างๆ และย้ำว่าขึ้นกับประสบการณ์ องค์กร และพื้นที่
- required_skills ใส่ทั้ง hard skill และ soft skill`;
