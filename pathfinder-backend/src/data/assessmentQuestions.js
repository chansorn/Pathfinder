// 30-question interest/aptitude quiz, answered 1-5 (not me at all -> very me)
//   RIASEC (Holland codes)  18 = 3 per type
//   aptitude                 8 = 2 per area
//   learning style (VARK)    4 = 1 each
// Scoring happens server side in services/assessment.service.js, the AI only interprets it.

export const SCALE = [
  { value: 1, label: 'ไม่ตรงเลย' },
  { value: 2, label: 'ไม่ค่อยตรง' },
  { value: 3, label: 'เฉยๆ' },
  { value: 4, label: 'ค่อนข้างตรง' },
  { value: 5, label: 'ตรงมาก' },
];

export const DIMENSIONS = {
  riasec: {
    R: 'Realistic - นักปฏิบัติ ชอบลงมือทำ',
    I: 'Investigative - นักคิดวิเคราะห์',
    A: 'Artistic - นักสร้างสรรค์',
    S: 'Social - นักช่วยเหลือ',
    E: 'Enterprising - นักบริหาร/ผู้นำ',
    C: 'Conventional - นักจัดระบบ',
  },
  aptitude: {
    linguistic: 'ภาษาและการสื่อสาร',
    logical: 'ตรรกะและตัวเลข',
    spatial: 'มิติสัมพันธ์และการมองภาพ',
    interpersonal: 'การเข้าใจผู้อื่นและทำงานเป็นทีม',
  },
  learning_style: {
    visual: 'เรียนรู้ผ่านภาพ',
    auditory: 'เรียนรู้ผ่านการฟัง',
    reading_writing: 'เรียนรู้ผ่านการอ่าน/เขียน',
    kinesthetic: 'เรียนรู้ผ่านการลงมือทำ',
  },
};

export const QUESTIONS = [
  // Realistic
  { id: 'R1', group: 'riasec', dimension: 'R', text: 'ชอบซ่อม ประกอบ หรือแกะของดูว่าข้างในทำงานยังไง' },
  { id: 'R2', group: 'riasec', dimension: 'R', text: 'ชอบงานที่ได้ใช้มือหรือเครื่องมือมากกว่านั่งคิดอย่างเดียว' },
  { id: 'R3', group: 'riasec', dimension: 'R', text: 'สนุกกับกิจกรรมกลางแจ้ง เช่น ปลูกต้นไม้ เข้าค่าย หรือเล่นกีฬา' },
  // Investigative
  { id: 'I1', group: 'riasec', dimension: 'I', text: 'ชอบตั้งคำถามว่า "ทำไม" แล้วหาคำตอบเอง' },
  { id: 'I2', group: 'riasec', dimension: 'I', text: 'สนุกกับการทดลองวิทยาศาสตร์หรือแก้โจทย์ยากๆ' },
  { id: 'I3', group: 'riasec', dimension: 'I', text: 'ชอบอ่านหรือดูคลิปเรื่องเทคโนโลยี ธรรมชาติ หรือความรู้ใหม่ๆ' },
  // Artistic
  { id: 'A1', group: 'riasec', dimension: 'A', text: 'ชอบวาดรูป ออกแบบ ถ่ายรูป หรือทำงานศิลปะ' },
  { id: 'A2', group: 'riasec', dimension: 'A', text: 'ชอบเขียนเรื่อง แต่งเพลง หรือแสดงออกในแบบของตัวเอง' },
  { id: 'A3', group: 'riasec', dimension: 'A', text: 'ไม่ชอบทำตามแบบเดิมๆ ชอบคิดวิธีใหม่ที่ไม่เหมือนใคร' },
  // Social
  { id: 'S1', group: 'riasec', dimension: 'S', text: 'เพื่อนชอบมาปรึกษาเรื่องต่างๆ และเรารับฟังได้ดี' },
  { id: 'S2', group: 'riasec', dimension: 'S', text: 'อยากทำงานที่ได้ช่วยเหลือหรือดูแลคนอื่น' },
  { id: 'S3', group: 'riasec', dimension: 'S', text: 'ชอบสอนการบ้านหรืออธิบายเรื่องยากให้เพื่อนเข้าใจ' },
  // Enterprising
  { id: 'E1', group: 'riasec', dimension: 'E', text: 'ชอบเป็นผู้นำ วางแผน และแบ่งงานในกลุ่ม' },
  { id: 'E2', group: 'riasec', dimension: 'E', text: 'สนใจเรื่องขายของ ทำธุรกิจ หรือการตลาด' },
  { id: 'E3', group: 'riasec', dimension: 'E', text: 'พูดโน้มน้าวคนอื่นให้เห็นด้วยกับเราได้' },
  // Conventional
  { id: 'C1', group: 'riasec', dimension: 'C', text: 'ชอบจัดของ จดโน้ต หรือทำตารางให้เป็นระเบียบ' },
  { id: 'C2', group: 'riasec', dimension: 'C', text: 'ทำงานละเอียด ตรวจทานความถูกต้องก่อนส่งเสมอ' },
  { id: 'C3', group: 'riasec', dimension: 'C', text: 'ชอบงานที่มีขั้นตอนและกฎชัดเจน' },

  // aptitude
  { id: 'AP1', group: 'aptitude', dimension: 'linguistic', text: 'เรียนภาษาได้เร็ว จำคำศัพท์ได้ง่าย' },
  { id: 'AP2', group: 'aptitude', dimension: 'linguistic', text: 'เขียนเรียงความหรือเล่าเรื่องให้คนอื่นเข้าใจได้ดี' },
  { id: 'AP3', group: 'aptitude', dimension: 'logical', text: 'คิดเลขในใจได้ไวและชอบโจทย์ตรรกะ' },
  { id: 'AP4', group: 'aptitude', dimension: 'logical', text: 'เห็นรูปแบบหรือความสัมพันธ์ของข้อมูลได้เร็ว' },
  { id: 'AP5', group: 'aptitude', dimension: 'spatial', text: 'นึกภาพสามมิติหรือหมุนรูปทรงในหัวได้' },
  { id: 'AP6', group: 'aptitude', dimension: 'spatial', text: 'อ่านแผนที่หรือจำเส้นทางได้ดี' },
  { id: 'AP7', group: 'aptitude', dimension: 'interpersonal', text: 'รู้ได้ว่าเพื่อนรู้สึกยังไงแม้เขาไม่พูด' },
  { id: 'AP8', group: 'aptitude', dimension: 'interpersonal', text: 'ทำงานกลุ่มแล้วช่วยให้ทุกคนเข้ากันได้' },

  // learning style
  { id: 'L1', group: 'learning_style', dimension: 'visual', text: 'จำได้ดีเมื่อเห็นเป็นภาพ แผนผัง หรือ mind map' },
  { id: 'L2', group: 'learning_style', dimension: 'auditory', text: 'ฟังครูอธิบายหรือฟังพอดแคสต์แล้วเข้าใจกว่าอ่านเอง' },
  { id: 'L3', group: 'learning_style', dimension: 'reading_writing', text: 'ต้องจดสรุปด้วยตัวเองถึงจะจำได้' },
  { id: 'L4', group: 'learning_style', dimension: 'kinesthetic', text: 'เข้าใจเร็วที่สุดเมื่อได้ลองทำจริง' },
];

export const QUESTION_MAP = new Map(QUESTIONS.map((q) => [q.id, q]));
