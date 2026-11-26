import { studentBlock, tcasBlock } from './shared.js';

export const tcasPrompt = ({ student, targetFaculty, targetUniversity, tcas, webSearch }) => `วางแผนเข้า "${targetFaculty}" ที่ "${targetUniversity}" ผ่านระบบ TCAS ให้น้อง

${studentBlock(student)}

${tcasBlock(tcas, { webSearch })}

ต้องมี:
- rounds ครบ 4 รอบ เรียง 1-4: รอบ 1 Portfolio, รอบ 2 Quota, รอบ 3 Admission, รอบ 4 Direct Admission
  บอกว่าแต่ละรอบเหมาะกับน้องแค่ไหนและควรเตรียมยังไง
  ถ้ามีข้อมูลโครงการ/จำนวนรับ/GPAX ขั้นต่ำ/สัดส่วนคะแนนของหลักสูตรนี้ ให้ใส่ใน requirements พร้อมบอกปีการศึกษา
- timeline รายเดือน/ช่วงเดือน ตั้งแต่ตอนนี้ (ดูจากระดับชั้นของน้อง) จนถึงช่วงประกาศผล
  ถ้ามีปฏิทิน TCAS ให้ใช้วันที่จากปฏิทินนั้นได้ ถ้าไม่มีให้ใช้ชื่อเดือนแบบกว้างๆ
- score_targets เป้าคะแนนส่วนตัว TGAT / TPAT / A-Level ทีละวิชา
  ถ้ามี score_weights ให้เลือกวิชาตามนั้นและจัด priority ตามน้ำหนัก
  ถ้ามี last_year_min_score ให้ตั้ง target_score ให้สูงกว่าพอสมควร และบอกใน reason ว่าอิงคะแนนต่ำสุดปีก่อน
- specific_subjects วิชาเฉพาะ/ความถนัดเฉพาะที่คณะนี้ใช้ (ถ้าไม่มีให้ส่ง array ว่าง)
- checklist สิ่งที่ต้องเตรียม

ตัวเลขที่ไม่ได้มาจากข้อมูลข้างบนหรือผลค้นหาเว็บ ห้ามใส่ verify_note ต้องเตือนให้เช็กเกณฑ์ปีล่าสุดจาก mytcas.com และเว็บไซต์มหาวิทยาลัยเสมอ`;
