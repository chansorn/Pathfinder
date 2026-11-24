/* =========================================================================
 * PathFinder — Static Data Catalogs
 * Interest keywords, major scoring, roadmap catalog, /api/my-plan meta, TCAS70 central calendar, interest round work & round guide templates.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js
 *
 * Depends on : (none)
 * Provides   : INTEREST_KEYWORD_MAP, MAJOR_SCORING, ROADMAP_CATALOG, PF_MY_PLAN_META, TCAS70_CENTRAL_ROUNDS, PF_INTEREST_ROUND_WORK, ROUND_GUIDE_TEMPLATES
 * ========================================================================= */

var INTEREST_KEYWORD_MAP = [
  { key: 'tech-ai', th: 'เทคโนโลยี & AI', en: 'Technology & AI', words: ['ai', 'code', 'coding', 'program', 'software', 'app', 'web', 'tech', 'computer', 'cyber', 'cloud', 'เขียนโปรแกรม', 'โค้ด', 'คอมพิวเตอร์', 'ซอฟต์แวร์', 'เว็บ', 'แอป', 'เทคโนโลยี', 'เอไอ', 'หุ่นยนต์'] },
  { key: 'product-ux', th: 'ออกแบบผลิตภัณฑ์ & UX', en: 'Product & UX Design', words: ['ux', 'ui', 'design', 'product', 'figma', 'prototype', 'ออกแบบ', 'ดีไซน์', 'ผลิตภัณฑ์', 'ผู้ใช้'] },
  { key: 'healthcare', th: 'สุขภาพและการแพทย์', en: 'Healthcare & Medicine', words: ['med', 'doctor', 'health', 'nurse', 'pharma', 'dent', 'vet', 'anatomy', 'หมอ', 'แพทย์', 'พยาบาล', 'เภสัช', 'ทันตะ', 'สุขภาพ', 'รักษา'] },
  { key: 'business', th: 'ธุรกิจและเศรษฐศาสตร์', en: 'Business & Economics', words: ['business', 'startup', 'market', 'econ', 'management', 'brand', 'ธุรกิจ', 'การตลาด', 'บริหาร', 'สตาร์ทอัพ', 'เศรษฐศาสตร์', 'ขาย'] },
  { key: 'robotics', th: 'วิศวกรรมและหุ่นยนต์', en: 'Engineering & Robotics', words: ['robot', 'engineer', 'hardware', 'iot', 'mech', 'electric', 'drone', 'วิศวะ', 'วิศวกรรม', 'หุ่นยนต์', 'ไฟฟ้า', 'เครื่องกล', 'โดรน'] },
  { key: 'media', th: 'สื่อ ภาพยนตร์ & เล่าเรื่อง', en: 'Media, Film & Storytelling', words: ['video', 'film', 'edit', 'youtube', 'tiktok', 'content', 'photo', 'music', 'story', 'นิเทศ', 'ตัดต่อ', 'วิดีโอ', 'หนัง', 'ภาพยนตร์', 'สื่อ', 'ถ่ายภาพ', 'ดนตรี', 'คอนเทนต์'] },
  { key: 'data-research', th: 'ข้อมูลและงานวิจัย', en: 'Data & Quant Research', words: ['data', 'stat', 'math', 'research', 'science', 'physics', 'chem', 'ข้อมูล', 'สถิติ', 'คณิต', 'วิจัย', 'วิทยาศาสตร์', 'เคมี', 'ฟิสิกส์'] },
  { key: 'law-policy', th: 'กฎหมายและนโยบาย', en: 'Law & Public Policy', words: ['law', 'policy', 'politic', 'gov', 'legal', 'judge', 'นิติ', 'กฎหมาย', 'รัฐศาสตร์', 'การเมือง', 'นโยบาย', 'ทนาย'] },
  { key: 'arch-design', th: 'สถาปัตยกรรมและเมือง', en: 'Architecture & Urban Design', words: ['arch', 'interior', 'building', 'urban', '3d', 'สถาปัตย์', 'สถาปัตยกรรม', 'ตกแต่งภายใน', 'ออกแบบอาคาร'] },
  { key: 'bio-env', th: 'ชีววิทยาและสิ่งแวดล้อม', en: 'Bio & Sustainability', words: ['bio', 'env', 'green', 'climate', 'agri', 'food', 'ชีวะ', 'ชีววิทยา', 'สิ่งแวดล้อม', 'อาหาร', 'เกษตร', 'โลกร้อน'] },
  { key: 'psych-edtech', th: 'จิตวิทยาและการศึกษา', en: 'Psychology & EdTech', words: ['psych', 'mind', 'teach', 'edu', 'mental', 'counsel', 'จิตวิทยา', 'ครู', 'สอน', 'การศึกษา', 'ให้คำปรึกษา'] },
  { key: 'global-lang', th: 'ภาษาและกิจการระหว่างประเทศ', en: 'Global & Languages', words: ['lang', 'eng', 'japan', 'china', 'korean', 'inter', 'diplomat', 'travel', 'ภาษา', 'อังกฤษ', 'จีน', 'ญี่ปุ่น', 'เกาหลี', 'ทูต', 'อักษร', 'ท่องเที่ยว'] },
  { key: 'game-interactive', th: 'เกมและอินเทอร์แอคทีฟ', en: 'Game & Interactive Media', words: ['game', 'unity', 'unreal', 'esport', 'animation', 'vr', 'ar', 'เกม', 'แอนิเมชัน', 'สร้างเกม'] },
  { key: 'finance-quant', th: 'การเงินและการลงทุน', en: 'Finance & Investing', words: ['finance', 'invest', 'stock', 'crypto', 'bank', 'fintech', 'account', 'การเงิน', 'ลงทุน', 'หุ้น', 'บัญชี', 'ธนาคาร'] }
];

var MAJOR_SCORING = {
  '1': { base: 81, unis: ['cu', 'kmutt'], interests: ['tech-ai', 'product-ux', 'robotics', 'data-research'], key: 'Computer Eng' },
  '2': { base: 81, unis: ['tu'], interests: ['tech-ai', 'product-ux', 'media', 'game-interactive', 'business'], key: 'Creative Tech' },
  '3': { base: 73, unis: ['kmutt', 'cu'], interests: ['product-ux', 'arch-design', 'media', 'robotics'], key: 'Industrial Design' },
  '4': { base: 70, unis: ['cu', 'tu'], interests: ['business', 'finance-quant', 'tech-ai', 'data-research', 'law-policy', 'global-lang'], key: 'Digital Business' },
  '5': { base: 69, unis: ['cu', 'kmitl'], interests: ['tech-ai', 'robotics', 'data-research', 'healthcare', 'bio-env'], key: 'Information Engineering' },
  '6': { base: 68, unis: ['mu', 'swu', 'su'], interests: ['media', 'game-interactive', 'product-ux', 'arch-design', 'psych-edtech', 'global-lang'], key: 'Interactive' }
};

var ROADMAP_CATALOG = {
  '1': {
    titleTh: 'วิศวกรรมคอมพิวเตอร์ & ออกแบบผลิตภัณฑ์',
    titleEn: 'Computer Engineering & Product Design',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: '3 Case Studies', titleTh: 'รวบรวม 3 โปรเจกต์ต้นแบบ (Case Studies)', titleEn: 'Curate 3 Interactive Prototype Case Studies', descTh: 'แสดงการตั้งโจทย์ปัญหา ภาพร่าง wireframe และผลทดสอบผู้ใช้จริง 10–15 คน', descEn: 'Show problem framing, wireframe iterations, and user testing notes from 10–15 peers', defaultChecked: true },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Portfolio PDF (10p)', titleTh: 'ร่าง Statement of Purpose & Portfolio PDF 10 หน้า', titleEn: 'Draft 10-Page Statement of Purpose & Portfolio PDF', descTh: 'หน้า 1 ปก • หน้า 2 SOP • หน้า 3–8 3 โปรเจกต์ • หน้า 9 Beyond 4.00 • หน้า 10 เหตุผลที่เลือกคณะ', descEn: 'Page 1 Cover • Page 2 SOP • Pages 3–8 Case Studies • Page 9 Beyond 4.00 • Page 10 Why This Major', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'GPAX ≥ 3.50', titleTh: 'ตรวจสอบสิทธิ์โควตาพื้นที่และโควตาโรงเรียน', titleEn: 'Verify Regional & School Quota Eligibility', descTh: 'เช็กเกณฑ์ GPAX >= 3.50 หน่วยกิตกลุ่มสาระคณิต-วิทย์ และหนังสือรับรองจากฝ่ายแนะแนว', descEn: 'Confirm GPAX >= 3.50, math/science credits, and school counselor endorsement', defaultChecked: true }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT 20% • TPAT3 40%', titleTh: 'ฝึกทำข้อสอบจับเวลา TGAT1–3 และ TPAT3', titleEn: 'TGAT1–3 & TPAT3 Timed Practice', descTh: 'แบ่งเวลาอ่านตามแผนรายสัปดาห์ พร้อมสรุปจุดอ่อนรายบท', descEn: 'Follow your weekly study cadence with structured error logs', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.–มิ.ย.', dateEn: 'Late May–Jun', tag: 'mytcas.com', titleTh: 'บันทึกวันเปิดรับตรงอิสระสำรองไว้', titleEn: 'Keep Direct Admission Backup Dates Ready', descTh: 'ติดตามที่นั่งว่างของคณะบน mytcas.com ช่วงปลายพฤษภาคม พร้อมเตรียมไฟล์ Portfolio อัปเดตล่าสุด', descEn: 'Monitor open faculty seats on mytcas.com in late May with updated portfolio PDF', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Open-Source UI Component Kit', titleEn: '1. Open-Source UI Component Kit', descTh: 'เผยแพร่ UI Component 12 ชิ้นบน GitHub', descEn: 'Publish 12 accessible components on GitHub' },
      { titleTh: '2. บทความทดสอบการใช้งาน', titleEn: '2. Applied Usability Mini-Paper', descTh: 'ทดสอบเครื่องมือกับเพื่อน 15 คน', descEn: 'Test a study tool with 15 peers' },
      { titleTh: '3. เวิร์กชอปดีไซน์ข้ามโรงเรียน', titleEn: '3. Cross-School Design Workshop', descTh: 'สอน Figma + โค้ดเบื้องต้นให้น้อง ม.3–ม.4', descEn: 'Co-lead a 1-day Figma + coding intro' }
    ]
  },
  '2': {
    titleTh: 'เทคโนโลยีสร้างสรรค์ & นวัตกรรมดิจิทัล',
    titleEn: 'Creative Technology & Innovation',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'SIIT / Design', titleTh: 'สร้าง Interactive Web Demo 1 ชิ้นที่ใช้งานได้จริง', titleEn: 'Ship 1 Live Interactive Web Demo', descTh: 'ใส่ลิงก์เดโม + QR Code และวิดีโอสาธิต 60 วินาทีไว้ในหน้าแรกของ Portfolio', descEn: 'Include a live URL, QR code, and 60-second walkthrough video in your portfolio', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'English Pitch', titleTh: 'ซ้อมสัมภาษณ์ Pitch ไอเดียเป็นภาษาอังกฤษ 3 นาที', titleEn: 'Rehearse 3-Minute English Idea Pitch', descTh: 'เล่าปัญหา กลุ่มเป้าหมาย และความต่างของต้นแบบอย่างกระชับ', descEn: 'Summarize problem, users, and prototype differentiation crisply', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'GPAX ≥ 3.00', titleTh: 'เตรียมเอกสารรับรองโครงการนวัตกรรมระดับโรงเรียน', titleEn: 'Prepare School Innovation Project Endorsement', descTh: 'รวบรวมเกียรติบัตร Hackathon หรือโครงงานวิทยาศาสตร์ที่เคยเข้าร่วม', descEn: 'Compile hackathon or science fair certificates with advisor sign-off', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT 40 • คณิต1 30', titleTh: 'ทำโจทย์ TGAT + คณิตศาสตร์ประยุกต์ 1 จับเวลา', titleEn: 'TGAT + Applied Math 1 Timed Drills', descTh: 'เน้นพาร์ทการคิดอย่างมีเหตุผลและสมการเชิงฟังก์ชัน', descEn: 'Focus on logical reasoning and functional problem solving', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.–มิ.ย.', dateEn: 'Late May–Jun', tag: 'SIIT Direct', titleTh: 'เช็กวันเปิดรับรอบ Direct ของ SIIT / หลักสูตรนานาชาติ', titleEn: 'Track SIIT & International Direct Round Dates', descTh: 'เตรียมผลภาษาอังกฤษหรือยื่นสอบวัดระดับของมหาวิทยาลัยสำรอง', descEn: 'Prepare English proficiency score or university placement test slot', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Hackathon MVP + Pitch Deck', titleEn: '1. Hackathon MVP + Pitch Deck', descTh: 'พัฒนาต้นแบบใน 48 ชม. พร้อมสไลด์สรุปผลทดสอบ', descEn: 'Build a 48-hr prototype with user validation slides' },
      { titleTh: '2. Interactive Web Experiment', titleEn: '2. Interactive Web Experiment', descTh: 'ทดลองสร้าง micro-interaction บนเว็บที่เปิดให้คนลองเล่นได้', descEn: 'Publish a playful web micro-interaction experiment' },
      { titleTh: '3. บันทึกสัมภาษณ์ผู้ใช้สตาร์ทอัป', titleEn: '3. Startup User Discovery Log', descTh: 'สรุป insight จากการสัมภาษณ์เพื่อน/ครู 12 คน', descEn: 'Synthesize insights from 12 student/teacher interviews' }
    ]
  },
  '3': {
    titleTh: 'ออกแบบอุตสาหกรรม & UX',
    titleEn: 'Industrial Design & UX',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'Sketchbook', titleTh: 'คัดเลือกภาพสเก็ตช์มือ + Wireframe 10 แผ่น', titleEn: 'Curate 10 Hand Sketches & Wireframe Sheets', descTh: 'โชว์กระบวนการคิดตั้งแต่ปัญหาจริงจนถึงรูปทรงและ flow การใช้งาน', descEn: 'Show ideation from real-world friction to physical form and UI flow', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: '3D / Figma', titleTh: 'ปั้นโมเดล 3D หรือ Figma Prototype 2 ชิ้น', titleEn: 'Build 2 3D or Figma Interactive Prototypes', descTh: 'แนบภาพถ่ายโมเดลจริงหรือวิดีโอการกดใช้งานต้นแบบ', descEn: 'Attach studio photos of mockups or interactive prototype recordings', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'Drawing Test', titleTh: 'เช็กวันสอบวาดเส้น/ออกแบบของรอบโควตา', titleEn: 'Check Quota Practical Drawing Test Dates', descTh: 'ซ้อมวาด Perspective และ Product Rendering ภายใน 90 นาที', descEn: 'Practice 90-minute perspective and product rendering drills', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT 50 • TPAT4 50', titleTh: 'ลุยข้อสอบ TPAT4 ความถนัดสถาปัตย์ & ดีไซน์', titleEn: 'TPAT4 Design & Spatial Aptitude Practice', descTh: 'ฝึกมิติสัมพันธ์ องค์ประกอบศิลป์ และแนวคิดการออกแบบเพื่อความยั่งยืน', descEn: 'Drill spatial reasoning, visual composition, and sustainable design', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.–มิ.ย.', dateEn: 'Late May–Jun', tag: 'Portfolio Update', titleTh: 'อัปเดต Portfolio เวอร์ชันกระชับ 8 หน้าสำหรับรอบ 4', titleEn: 'Prepare 8-Page Condensed Round 4 Portfolio', descTh: 'เตรียมไฟล์ PDF ขนาดไม่เกิน 10MB พร้อมยื่นทันทีเมื่อเปิดรอบรับตรง', descEn: 'Keep an under-10MB PDF ready for rapid Round 4 submission', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. สมุดภาพร่างแก้ปัญหาชีวิตประจำวัน', titleEn: '1. Daily Friction Sketchbook', descTh: 'รวบรวม 15 ไอเดียออกแบบแก้ปัญหาในโรงเรียน', descEn: 'Document 15 design sketches solving campus pain points' },
      { titleTh: '2. ต้นแบบ 3D/Figma ที่ทดสอบกับผู้ใช้', titleEn: '2. Tested 3D/Figma Mockup', descTh: 'เปรียบเทียบก่อน-หลังปรับแก้จากฟีดแบ็กเพื่อน', descEn: 'Show before/after iterations from peer usability feedback' },
      { titleTh: '3. การศึกษาการยศาสตร์ (Ergonomics)', titleEn: '3. Mini Ergonomics Field Study', descTh: 'วัดขนาดและวิเคราะห์ท่าทางใช้งานอุปกรณ์การเรียน', descEn: 'Measure and analyze posture for student desk tools' }
    ]
  },
  '4': {
    titleTh: 'ธุรกิจดิจิทัล & Data',
    titleEn: 'Digital Business & Data',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'Data Story', titleTh: 'ทำโครงงานวิเคราะห์ข้อมูลจริง 1 ชุด (Excel / Python)', titleEn: 'Complete 1 Real-World Data Case Study', descTh: 'สรุปกราฟและข้อเสนอแนะเชิงธุรกิจที่อ่านเข้าใจง่ายใน 2 หน้า', descEn: 'Summarize charts and actionable business insights in 2 clean pages', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Business Case', titleTh: 'เขียนบทวิเคราะห์ Product Strategy แอปที่ใช้บ่อย', titleEn: 'Write 1 Product Growth Teardown Deck', descTh: 'วิเคราะห์โมเดลรายได้และวิธีเพิ่มผู้ใช้ของผลิตภัณฑ์ดิจิทัล', descEn: 'Analyze revenue model and retention loops of a digital product', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'GPAX ≥ 3.25', titleTh: 'ตรวจสอบโควตาการแข่งขันแผนธุรกิจ/เศรษฐศาสตร์', titleEn: 'Verify Business Case Competition Quota Criteria', descTh: 'รวบรวมผลงานประกวดแผนธุรกิจหรือกิจกรรมชมรม', descEn: 'Gather business case competition or school club leadership records', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT + คณิต2', titleTh: 'ฝึกทำข้อสอบ TGAT + คณิตศาสตร์ประยุกต์ 2', titleEn: 'TGAT + Applied Math 2 Timed Practice', descTh: 'เน้นสถิติ ความน่าจะเป็น และการตีความกราฟข้อมูล', descEn: 'Focus on statistics, probability, and data chart interpretation', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.–มิ.ย.', dateEn: 'Late May–Jun', tag: '~80 ที่นั่ง', titleTh: 'เปรียบเทียบเกณฑ์รอบ 3–4 จุฬาฯ และธรรมศาสตร์', titleEn: 'Compare Round 3–4 Seat Openings (CU & TU)', descTh: 'เตรียมคะแนน TGAT/คณิต2 เพื่อยื่นสำรองหากมีการเปิดรับเพิ่มเติม', descEn: 'Keep TGAT/Math 2 scores ready for late seat openings', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Real-World Dataset Case Study', titleEn: '1. Real-World Dataset Case Study', descTh: 'วิเคราะห์ข้อมูลเปิดภาครัฐหรือข้อมูลร้านค้าโรงเรียน', descEn: 'Analyze an open public dataset or school store metrics' },
      { titleTh: '2. Product Growth Teardown Deck', titleEn: '2. Product Growth Teardown Deck', descTh: 'สไลด์ 6 หน้าวิเคราะห์ UX + Funnel ของแอปดัง', descEn: '6-slide UX and conversion funnel teardown' },
      { titleTh: '3. ระบบจัดการงานชมรมอัตโนมัติ', titleEn: '3. School Club Ops Automation', descTh: 'ใช้ Notion / Sheets ลดเวลาทำงานซ้ำซ้อนของชมรม', descEn: 'Build a Notion/Sheets tracker cutting club admin time' }
    ]
  },
  '5': {
    titleTh: 'วิศวกรรมสารสนเทศ (ISE)',
    titleEn: 'Information Engineering',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'SAT / IELTS', titleTh: 'เช็กเป้าหมายคะแนน SAT Math & IELTS / TOEFL', titleEn: 'Set Target SAT Math & IELTS / TOEFL Scores', descTh: 'วางแผนรอบสอบภาษาอังกฤษและคณิตศาสตร์ให้ทันยื่น Early Admission', descEn: 'Schedule English and math test dates ahead of Early Admission', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'English Port', titleTh: 'จัดทำ Portfolio ภาษาอังกฤษ + SOP 500 คำ', titleEn: 'Assemble English Portfolio & 500-Word SOP', descTh: 'เน้นโปรเจกต์ซอฟต์แวร์/IoT และทักษะการทำงานเป็นทีม', descEn: 'Highlight software/IoT builds and collaborative leadership', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'Early / Quota', titleTh: 'เตรียมเอกสารรับรองผลการเรียนฉบับภาษาอังกฤษ', titleEn: 'Request Official English Academic Transcript', descTh: 'ติดต่อฝ่ายทะเบียนโรงเรียนล่วงหน้า 2 สัปดาห์', descEn: 'Request sealed English transcript from registrar 2 weeks early', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'CU-TEP / SAT', titleTh: 'ทบทวนข้อสอบ Mock SAT Math + Physics (ถ้ามี)', titleEn: 'Timed Mock SAT Math & Physics Drills', descTh: 'ปิดจุดอ่อนคำศัพท์คณิตศาสตร์ภาษาอังกฤษและโจทย์ปัญหา', descEn: 'Sharpen English math terminology and word-problem speed', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.–มิ.ย.', dateEn: 'Late May–Jun', tag: 'Direct Inter', titleTh: 'ติดตามรอบรับตรงหลักสูตรนานาชาติช่วงปลายปี', titleEn: 'Monitor Late International Direct Rounds', descTh: 'เช็กประกาศรับเพิ่มของ ISE และคณะวิศวกรรมศาสตร์นานาชาติ', descEn: 'Check late seat announcements for ISE and partner inter programs', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. English Technical Blog & GitHub', titleEn: '1. English Technical Blog & GitHub', descTh: 'เขียนสรุปโปรเจกต์โค้ดเป็นภาษาอังกฤษ 2 บทความ', descEn: 'Publish 2 clear English engineering write-ups on GitHub' },
      { titleTh: '2. IoT / Automation Mini-Project', titleEn: '2. IoT / Automation Mini-Project', descTh: 'สร้างโปรเจกต์เซนเซอร์หรือสคริปต์ช่วยงานในบ้าน', descEn: 'Build a small sensor or home-automation script' },
      { titleTh: '3. บันทึกฝึกสอบ SAT/IELTS รายสัปดาห์', titleEn: '3. SAT/IELTS Sprint Error Log', descTh: 'ติดตามคะแนนพัฒนาการทุก 2 สัปดาห์', descEn: 'Track bi-weekly mock score gains systematically' }
    ]
  },
  '6': {
    titleTh: 'สื่ออินเทอร์แอกทีฟ & เกม',
    titleEn: 'Interactive & Game Design',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'Playable Demo', titleTh: 'สร้างมินิเกมหรือสื่อโต้ตอบที่เล่นได้จริง 1 ชิ้น', titleEn: 'Ship 1 Playable Mini-Game or Interactive Piece', descTh: 'อัปโหลดขึ้น itch.io หรือเว็บ พร้อมบันทึกคลิปเกมเพลย์ 45 วินาที', descEn: 'Publish on itch.io or web with a crisp 45-second gameplay clip', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Art & GDD', titleTh: 'แนบ Game Design Doc + Concept Art ใน Portfolio', titleEn: 'Include Game Design Doc & Concept Art', descTh: 'อธิบายระบบเกม กติกา และภาพร่างตัวละคร/ฉากอย่างเป็นระบบ', descEn: 'Explain core loop, mechanics, and character/environment sketches', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'Media Quota', titleTh: 'รวบรวมผลงานประกวดสื่อสร้างสรรค์/Game Jam', titleEn: 'Compile Game Jam & Creative Media Awards', descTh: 'แนบลิงก์ผลงานทีมและบทบาทที่คุณรับผิดชอบชัดเจน', descEn: 'Document team jam entries and your exact role in production', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT + ภาษา', titleTh: 'ฝึก TGAT1–3 และทักษะเล่าเรื่องเชิงภาพ', titleEn: 'TGAT1–3 & Visual Storytelling Prep', descTh: 'เตรียมพร้อมทั้งคะแนนสอบกลางและพอร์ตสื่อสร้างสรรค์', descEn: 'Balance standardized TGAT prep with creative portfolio polish', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.–มิ.ย.', dateEn: 'Late May–Jun', tag: 'MU / SWU / SU', titleTh: 'เช็กเปิดรับตรงสายสื่อดิจิทัล มหิดล / มศว / ศิลปากร', titleEn: 'Track Digital Media Direct Rounds (MU/SWU/SU)', descTh: 'เตรียมไฟล์ Showreel 1 นาทีสำหรับยื่นรอบรับตรงอิสระ', descEn: 'Keep a 1-minute showreel ready for late direct admissions', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Playable Game Jam Prototype', titleEn: '1. Playable Game Jam Prototype', descTh: 'เข้าร่วม Game Jam ออนไลน์และปล่อยเดโมให้คนเล่น', descEn: 'Join an online Game Jam and publish a playable build' },
      { titleTh: '2. Motion & Shader Reel (60 วิ)', titleEn: '2. 60-Second Motion & Shader Reel', descTh: 'รวมช็อตแอนิเมชันและเอฟเฟกต์ที่ทำเอง', descEn: 'Compile your best self-made motion and shader clips' },
      { titleTh: '3. เอกสารออกแบบด่าน (Level Design)', titleEn: '3. Narrative Level Design Doc', descTh: 'วิเคราะห์จังหวะการเล่นและอารมณ์ผู้เล่นใน 1 ด่าน', descEn: 'Map player pacing and emotional beats for 1 level' }
    ]
  }
};

var PF_MY_PLAN_META = {
  '1': {
    uniTh: 'จุฬาลงกรณ์มหาวิทยาลัย', uniEn: 'Chulalongkorn University',
    gpax: 'GPAX ≥ 3.50', weights: 'TGAT 20% • TPAT3 40% • คณิต1 40%',
    docsTh: 'Portfolio 10 หน้า + 3 โครงงาน', docsEn: '10-page Portfolio + 3 Projects',
    recommendedRounds: ['r1', 'r3'], unavailableRounds: ['r4'],
    warningsTh: ['รอบ 1 Portfolio ใกล้ปิดรับสมัครใน 21 วัน — ควรล็อกไฟล์ PDF 10 หน้าให้เสร็จสัปดาห์นี้'],
    warningsEn: ['Round 1 Portfolio closes in 21 days — finalize your 10-page PDF this week'],
    exams: [
      { id: 'tgat', name: 'TGAT1–3', dateTh: '7 ธ.ค.', dateEn: 'Dec 7', target: 75, current: 66 },
      { id: 'tpat3', name: 'TPAT3', dateTh: '14 ธ.ค.', dateEn: 'Dec 14', target: 72, current: 61 },
      { id: 'alevel-math1', name: 'A-Level คณิต 1', dateTh: '8 มี.ค.', dateEn: 'Mar 8', target: 65, current: 54 }
    ]
  },
  '2': {
    uniTh: 'มหาวิทยาลัยธรรมศาสตร์', uniEn: 'Thammasat University',
    gpax: 'GPAX ≥ 3.25', weights: 'TGAT 35% • A-Level คณิต 35% • อังกฤษ 30%',
    docsTh: 'GitHub Repo + SOP 1 หน้า', docsEn: 'GitHub Repo + 1-page SOP',
    recommendedRounds: ['r1', 'r3'], unavailableRounds: [],
    warningsTh: ['คะแนน A-Level อังกฤษปัจจุบันยังห่างจากเป้า 8 คะแนน'],
    warningsEn: ['Current A-Level English is 8 points below target'],
    exams: [
      { id: 'tgat', name: 'TGAT1–3', dateTh: '7 ธ.ค.', dateEn: 'Dec 7', target: 74, current: 66 },
      { id: 'alevel-eng', name: 'A-Level อังกฤษ', dateTh: '9 มี.ค.', dateEn: 'Mar 9', target: 72, current: 64 }
    ]
  },
  '3': {
    uniTh: 'มจธ. (KMUTT)', uniEn: 'KMUTT',
    gpax: 'GPAX ≥ 3.00', weights: 'TGAT 30% • TPAT4 40% • คณิต2 30%',
    docsTh: 'Figma Case Study + Sketchbook', docsEn: 'Figma Case Study + Sketchbook',
    recommendedRounds: ['r1', 'r2'], unavailableRounds: ['r4'],
    warningsTh: [], warningsEn: [],
    exams: [
      { id: 'tgat', name: 'TGAT1–3', dateTh: '7 ธ.ค.', dateEn: 'Dec 7', target: 70, current: 66 },
      { id: 'tpat4', name: 'TPAT4 สถาปัตย์', dateTh: '15 ธ.ค.', dateEn: 'Dec 15', target: 75, current: 68 }
    ]
  }
};

var TCAS70_CENTRAL_ROUNDS = [
  { id: 'r1', titleTh: 'รอบ 1 Portfolio', titleEn: 'Round 1 Portfolio', applyTh: 'ต.ค. – ม.ค.', applyEn: 'Oct – Jan', announceTh: '6 ก.พ. 70', announceEn: 'Feb 6', confirmTh: '6–7 ก.พ. 70', confirmEn: 'Feb 6–7', sourceTh: 'ทางการ', sourceEn: 'Official', tone: 'official' },
  { id: 'r2', titleTh: 'รอบ 2 Quota', titleEn: 'Round 2 Quota', applyTh: 'ก.พ. – เม.ย.', applyEn: 'Feb – Apr', announceTh: '2 พ.ค. 70', announceEn: 'May 2', confirmTh: '2–3 พ.ค. 70', confirmEn: 'May 2–3', sourceTh: 'ทางการ', sourceEn: 'Official', tone: 'official' },
  { id: 'r3', titleTh: 'รอบ 3 Admission', titleEn: 'Round 3 Admission', applyTh: '6–12 พ.ค. 70', applyEn: 'May 6–12', announceTh: '20 พ.ค. 70', announceEn: 'May 20', confirmTh: '20–21 พ.ค. 70', confirmEn: 'May 20–21', sourceTh: 'ตรวจสอบแล้ว', sourceEn: 'Verified', tone: 'verified' },
  { id: 'r4', titleTh: 'รอบ 4 Direct Admission', titleEn: 'Round 4 Direct', applyTh: '27 พ.ค. – มิ.ย.', applyEn: 'May 27 – Jun', announceTh: '6 มิ.ย. 70', announceEn: 'Jun 6', confirmTh: '6–7 มิ.ย. 70', confirmEn: 'Jun 6–7', sourceTh: 'AI ค้นหา', sourceEn: 'AI Found', tone: 'ai' }
];

var PF_INTEREST_ROUND_WORK = {
  'tech-ai': {
    labelTh: 'AI & Tech', labelEn: 'AI & Tech',
    r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'AI Project', titleTh: 'สร้างโปรเจกต์ AI / LLM Mini-App พร้อมลิงก์เดโม', titleEn: 'Build 1 AI / LLM Mini-App with Live Demo Link', descTh: 'ใช้ API หรือโมเดลจำแนกข้อมูลจริง แนบ Architecture Diagram และ QR Code ในพอร์ต', descEn: 'Ship a working AI mini-app with architecture diagram and QR code in your portfolio', deliverableTh: 'ลิงก์ GitHub + วิดีโอเดโม 60 วิ', deliverableEn: 'GitHub Repo + 60s Demo Video', estHours: 4, stepsTh: ['เลือกโจทย์ปัญหาใกล้ตัว 1 เรื่อง (เช่น สรุปชีทสอบหรือตรวจคำศัพท์)', 'สร้างต้นแบบด้วย Python / Web + เชื่อม API', 'เขียน README อธิบายผลลัพธ์และข้อจำกัดอย่างตรงไปตรงมา'], stepsEn: ['Pick 1 student pain point to solve', 'Build a working web or Python prototype', 'Document results and edge cases in README'], toolsTh: 'GitHub • Google Colab • Vercel / HuggingFace Spaces', toolsEn: 'GitHub • Google Colab • Vercel / HuggingFace Spaces' },
    r3: { dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'คณิต1 + TPAT3', titleTh: 'ติวเข้มพีชคณิตเชิงเส้น สถิติ และตรรกศาสตร์สำหรับสาย AI', titleEn: 'Drill Linear Algebra, Stats & Logic for AI Tracks', descTh: 'เก็บคะแนนพาร์ทที่ออกสอบบ่อยใน TPAT3 และคณิตศาสตร์ประยุกต์ 1', descEn: 'Target high-yield TPAT3 logic and Applied Math 1 statistics sections', deliverableTh: 'สมุดสรุป Error Log 30 ข้อ', deliverableEn: '30-Question Error Log', estHours: 3, stepsTh: ['ทำชุดข้อสอบเก่า 2 ปีย้อนหลังแบบจับเวลา', 'จดข้อผิดพลาดแยกตามบทที่เสียคะแนน', 'ทวนซ้ำเฉพาะบทที่ทำผิดภายใน 48 ชม.'], stepsEn: ['Solve 2 past papers under timed conditions', 'Tag missed questions by topic', 'Review weak topics within 48 hours'], toolsTh: 'ข้อสอบเก่า TPAT3 • คณิต1 (สสวท.)', toolsEn: 'Past TPAT3 & Applied Math 1 Papers' }
  },
  'product-ux': {
    labelTh: 'Product & UX', labelEn: 'Product & UX',
    r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'UX Case Study', titleTh: 'ทำ UX Research + Prototype 1 ชิ้นพร้อมผลทดสอบผู้ใช้', titleEn: 'Publish 1 UX Case Study with Usability Test Results', descTh: 'สัมภาษณ์เพื่อน 5–8 คน สรุป Pain Point และเปรียบเทียบ Wireframe ก่อน-หลังปรับแก้', descEn: 'Interview 5–8 peers, synthesize pain points, and show before/after wireframes', deliverableTh: 'Figma Prototype + สรุป 2 หน้า', deliverableEn: 'Figma Prototype + 2-Page Summary', estHours: 3, stepsTh: ['กำหนดสมมติฐานและสัมภาษณ์ผู้ใช้ 5 คน', 'ออกแบบ User Flow และ Interactive Prototype ใน Figma', 'สรุป Insight ที่ปรับปรุงจริงเป็นภาพเปรียบเทียบ'], stepsEn: ['Define hypothesis and interview 5 users', 'Build User Flow & Interactive Figma Prototype', 'Show before/after design improvements'], toolsTh: 'Figma • FigJam • Maze / Google Forms', toolsEn: 'Figma • FigJam • Maze / Google Forms' },
    r2: { dateTh: 'ก.พ.', dateEn: 'Feb', tag: 'Design Quota', titleTh: 'รวบรวมผลงานประกวดออกแบบหรือ Hackathon เพื่อยื่นรอบโควตา', titleEn: 'Compile Designathon / Hackathon Artifacts for Quota', descTh: 'จัดหมวดหมู่บทบาทของคุณในทีม (Research, UI System, Prototyping)', descEn: 'Clearly highlight your specific role in team design challenges', deliverableTh: 'แฟ้มเกียรติบัตร + คำอธิบายบทบาท', deliverableEn: 'Certificate Pack + Role Breakdown', estHours: 2, stepsTh: ['รวบรวมไฟล์เกียรติบัตรทั้งหมดเป็น PDF', 'เขียนสรุปบทบาท 3 บรรทัดต่อ 1 กิจกรรม', 'ขอครูที่ปรึกษาลงนามรับรอง'], stepsEn: ['Merge certificates into 1 PDF', 'Write a 3-line role summary per event', 'Get advisor endorsement'], toolsTh: 'Google Drive • Canva / Figma', toolsEn: 'Google Drive • Canva / Figma' }
  },
  'data-biz': {
    labelTh: 'Data & Business', labelEn: 'Data & Business',
    r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Data Dashboard', titleTh: 'สร้าง Dashboard วิเคราะห์ข้อมูลจริง 1 ชุด (Looker / Excel / Python)', titleEn: 'Build 1 Real-World Data Dashboard & Insight Memo', descTh: 'เล่าเรื่องจากตัวเลขพร้อมข้อเสนอแนะเชิงธุรกิจที่วัดผลได้จริง', descEn: 'Turn public or school data into clear charts and business recommendations', deliverableTh: 'Interactive Dashboard + Insight 1 หน้า', deliverableEn: 'Interactive Dashboard + 1-Page Memo', estHours: 3, stepsTh: ['เลือกชุดข้อมูลเปิด (เช่น ข้อมูลการท่องเที่ยวหรือร้านค้าโรงเรียน)', 'ทำความสะอาดข้อมูลและสร้างกราฟ 3 มุมมอง', 'เขียนข้อสรุป 3 ข้อสำหรับผู้ตัดสินใจ'], stepsEn: ['Pick a clean public dataset', 'Build 3 complementary visualizations', 'Write 3 actionable business takeaways'], toolsTh: 'Looker Studio • Excel / Sheets • Python', toolsEn: 'Looker Studio • Excel / Sheets • Python' },
    r3: { dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'TGAT + คณิต2', titleTh: 'ฝึกโจทย์ความน่าจะเป็น สถิติ และการตีความข้อมูล TGAT2', titleEn: 'Practice Probability, Stats & TGAT2 Data Interpretation', descTh: 'เพิ่มความเร็วการอ่านกราฟและตารางให้ทำทันเวลาในห้องสอบ', descEn: 'Boost speed on chart reading and applied math probability drills', deliverableTh: 'ชุดฝึก 4 ชุด (จับเวลา 60 นาที)', deliverableEn: '4 Timed Practice Sets', estHours: 3, stepsTh: ['จับเวลาทำพาร์ทอนุกรมและกราฟ', 'สรุปสูตรสถิติที่ใช้บ่อย 1 แผ่น', 'ทบทวนข้อที่คำนวณพลาด'], stepsEn: ['Time-box chart and sequence drills', 'Create a 1-page stats formula sheet', 'Review calculation slips'], toolsTh: 'TGAT2 Mock • คณิต2 A-Level', toolsEn: 'TGAT2 Mock • A-Level Math 2' }
  },
  'med-health': {
    labelTh: 'แพทย์ & สุขภาพ', labelEn: 'Medicine & Health',
    r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Medical Port', titleTh: 'บันทึกชั่วโมงอาสา/ค่ายสายสุขภาพและบทเรียนจริยธรรมแพทย์', titleEn: 'Log Health Volunteering & Medical Ethics Reflections', descTh: 'เขียน Reflection เชิงลึกว่าได้เรียนรู้อะไรจากการดูแลผู้ป่วยหรือชุมชน', descEn: 'Write deep reflections on patient empathy and community health work', deliverableTh: 'Portfolio Reflection 3 หน้า + ใบรับรอง', deliverableEn: '3-Page Reflection + Certificates', estHours: 3, stepsTh: ['รวบรวมภาพและใบรับรองกิจกรรมจิตอาสาโรงพยาบาล/ชุมชน', 'เขียน Reflection 3 ประเด็น: สิ่งที่เห็น ความท้าทาย และมุมมองจริยธรรม', 'ตรวจความถูกต้องของคำศัพท์ทางการแพทย์'], stepsEn: ['Gather hospital/community volunteer certificates', 'Reflect on observations, challenges, and ethics', 'Verify medical terminology accuracy'], toolsTh: 'Google Docs • แฟ้มรับรองจิตอาสา', toolsEn: 'Google Docs • Volunteer Log' },
    r3: { dateTh: 'มี.ค.–เม.ย.', dateEn: 'Mar–Apr', tag: 'TPAT1 กสพท', titleTh: 'ซ้อมพาร์ทเชาวน์ปัญญา จริยธรรมแพทย์ และความเชื่อมโยง TPAT1', titleEn: 'Drill TPAT1 IQ, Medical Ethics & Reading Links', descTh: 'รักษามาตรฐานคะแนน TPAT1 คู่กับ A-Level ชีววิทยา-เคมี-ฟิสิกส์', descEn: 'Balance TPAT1 drills with A-Level Bio, Chem, and Physics', deliverableTh: 'ผล Mock TPAT1 ≥ 21/30', deliverableEn: 'Mock TPAT1 ≥ 21/30', estHours: 4, stepsTh: ['ทำข้อสอบเชื่อมโยง 5 บทความต่อสัปดาห์', 'ฝึกวิเคราะห์กรณีศึกษาจริยธรรมแพทย์ 10 เคส', 'ทบทวนชีววิทยาระบบร่างกาย'], stepsEn: ['Solve 5 reading-link passages weekly', 'Review 10 medical ethics case studies', 'Revise human physiology in Bio'], toolsTh: 'Mock TPAT1 กสพท • A-Level Bio', toolsEn: 'TPAT1 Mock • A-Level Bio' }
  },
  'bio-life': { labelTh: 'Bio & Life Sci', labelEn: 'Bio & Life Sci', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Bio Lab', titleTh: 'สรุปโครงงานทดลองชีววิทยา/สอวน. พร้อมภาพผลแล็บ', titleEn: 'Document Biology Lab Project & POSN Reflections', descTh: 'แสดงสมมติฐาน ตัวแปรควบคุม และกราฟวิเคราะห์ผลทดลอง', descEn: 'Present hypothesis, control variables, and lab data charts', deliverableTh: 'รายงานโครงงาน 4 หน้า', deliverableEn: '4-Page Lab Brief', estHours: 3, stepsTh: ['สรุปสมมติฐานและวิธีทดลองเป็นแผนภาพ', 'ใส่กราฟผลลัพธ์พร้อมค่าความคลาดเคลื่อน', 'เขียนข้อจำกัดและแนวทางต่อยอด'], stepsEn: ['Diagram hypothesis and lab method', 'Plot results with error bars', 'Note limitations and next steps'], toolsTh: 'Lab Notebook • Sheets', toolsEn: 'Lab Notebook • Sheets' } },
  'chem-lab': { labelTh: 'เคมี & วัสดุ', labelEn: 'Chemistry & Materials', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Chem Lab', titleTh: 'รวบรวมรายงานแล็บเคมีวิเคราะห์/วัสดุศาสตร์ 2 ชิ้น', titleEn: 'Compile 2 Analytical Chemistry / Materials Lab Reports', descTh: 'เน้นความปลอดภัยในห้องปฏิบัติการและการคำนวณปริมาณสารสัมพันธ์', descEn: 'Highlight lab safety protocol and stoichiometry precision', deliverableTh: 'Lab Report PDF 2 ฉบับ', deliverableEn: '2 Lab Report PDFs', estHours: 2, stepsTh: ['คัดเลือกแล็บที่มีผลทดลองชัดเจนที่สุด 2 ชิ้น', 'ตรวจสมการเคมีและหน่วยวัดให้ครบถ้วน'], stepsEn: ['Select 2 clearest lab experiments', 'Verify equations and SI units'], toolsTh: 'ChemDraw / Google Docs', toolsEn: 'ChemDraw / Google Docs' } },
  'physics-eng': { labelTh: 'ฟิสิกส์ & วิศวะ', labelEn: 'Physics & Eng', r3: { dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'TPAT3 + ฟิสิกส์', titleTh: 'ตะลุยโจทย์กลศาสตร์ ไฟฟ้า และความถนัดวิศวกรรม TPAT3', titleEn: 'Master Mechanics, Circuits & TPAT3 Engineering Drills', descTh: 'เก็บคะแนนพาร์ทคำนวณฟิสิกส์และมิติสัมพันธ์ทางวิศวกรรม', descEn: 'Lock in high-yield physics calculations and spatial aptitude', deliverableTh: 'ชุดฝึก TPAT3 3 ชุด', deliverableEn: '3 TPAT3 Timed Sets', estHours: 4, stepsTh: ['ทวนสูตรกลศาสตร์และไฟฟ้ากระแสตรง', 'ฝึกทำโจทย์แบบวาด Free-Body Diagram ทุกข้อ'], stepsEn: ['Revise mechanics & DC circuits', 'Draw Free-Body Diagrams for every problem'], toolsTh: 'TPAT3 Past Papers • A-Level Physics', toolsEn: 'TPAT3 Past Papers • A-Level Physics' } },
  'space-aero': { labelTh: 'การบิน & อวกาศ', labelEn: 'Aero & Space', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Aero Mini-Build', titleTh: 'สร้างโครงงานจำลองการบิน/จรวดน้ำ หรือวิเคราะห์ข้อมูลดาวเทียม', titleEn: 'Ship 1 Aerodynamics / Satellite Data Mini-Project', descTh: 'คำนวณแรงยก-แรงต้านหรือพล็อตวงโคจรด้วย Python/Excel', descEn: 'Model lift/drag or plot orbital telemetry in Python/Excel', deliverableTh: 'รายงานการทดลอง + กราฟ', deliverableEn: 'Experiment Report + Plots', estHours: 3, stepsTh: ['ออกแบบการทดลองหรือดึงข้อมูล NASA Open Data', 'สรุปผลการคำนวณเป็นกราฟ'], stepsEn: ['Design test or pull NASA Open Data', 'Summarize calculations visually'], toolsTh: 'NASA Open Data • Python', toolsEn: 'NASA Open Data • Python' } },
  'robotics-mech': { labelTh: 'หุ่นยนต์ & เมคคา', labelEn: 'Robotics & Mech', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Hardware Demo', titleTh: 'บันทึกวิดีโอหุ่นยนต์/Arduino + ผังวงจรและโค้ดควบคุม', titleEn: 'Record Robotics/Arduino Demo + Schematic & Code', descTh: 'โชว์ระบบเซนเซอร์ การแก้ปัญหาหน้างาน และผังการต่อวงจร', descEn: 'Show sensor feedback loop, troubleshooting, and wiring diagram', deliverableTh: 'คลิป 45 วิ + ผังวงจร', deliverableEn: '45s Demo Clip + Schematic', estHours: 4, stepsTh: ['ถ่ายคลิปทดสอบการทำงานจริงแบบชัดเจน', 'วาดผังวงจรด้วย Tinkercad/Fritzing'], stepsEn: ['Film a clean hardware test run', 'Draw circuit schematic in Tinkercad'], toolsTh: 'Arduino IDE • Tinkercad', toolsEn: 'Arduino IDE • Tinkercad' } },
  'env-climate': { labelTh: 'สิ่งแวดล้อม', labelEn: 'Environment', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Sustainability', titleTh: 'สรุปโครงการรักษ์โลก/ลดคาร์บอนในโรงเรียนพร้อมตัวเลขวัดผล', titleEn: 'Quantify 1 Campus Sustainability / Carbon Project', descTh: 'วัดผลเป็นตัวเลขจริง เช่น ปริมาณขยะที่ลดได้ (กก./เดือน)', descEn: 'Measure real impact such as kg of waste diverted per month', deliverableTh: 'Impact Sheet 2 หน้า', deliverableEn: '2-Page Impact Sheet', estHours: 2, stepsTh: ['เก็บข้อมูลก่อน-หลังทำกิจกรรม 2 สัปดาห์', 'คำนวณผลลดคาร์บอนอย่างง่าย'], stepsEn: ['Collect 2-week before/after metrics', 'Calculate estimated CO2 reduction'], toolsTh: 'Google Sheets • Canva', toolsEn: 'Google Sheets • Canva' } },
  'arch-spatial': { labelTh: 'สถาปัตย์ & พื้นที่', labelEn: 'Architecture', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Sketch & Model', titleTh: 'รวมภาพสเก็ตช์ Perspective 8 แผ่น + โมเดลกระดาษ 1 ชิ้น', titleEn: 'Curate 8 Perspective Sketches + 1 Scale Model', descTh: 'ถ่ายภาพโมเดลด้วยแสงธรรมชาติเพื่อโชว์สัดส่วนและเงา', descEn: 'Photograph your scale model in natural light to show massing', deliverableTh: 'Sketchbook Scan PDF', deliverableEn: 'Scanned Sketchbook PDF', estHours: 4, stepsTh: ['สแกนภาพร่างด้วยความละเอียดสูง 300dpi', 'ถ่ายภาพโมเดลจาก 3 มุมมอง'], stepsEn: ['Scan sketches at 300dpi', 'Shoot model from 3 clean angles'], toolsTh: 'SketchUp • กล้อง/สแกนเนอร์', toolsEn: 'SketchUp • Camera/Scanner' } },
  'media-game': { labelTh: 'สื่อ & เกม', labelEn: 'Media & Game', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Showreel', titleTh: 'ตัดต่อ Showreel ผลงานสื่อ/เกมความยาว 60 วินาที', titleEn: 'Cut a 60-Second Interactive Media / Game Showreel', descTh: 'ขึ้นช็อตที่โดดเด่นที่สุดใน 5 วินาทีแรก พร้อมระบุเครื่องมือที่ใช้', descEn: 'Lead with your strongest 5-second hook and list tools used', deliverableTh: 'วิดีโอ Showreel + QR Code', deliverableEn: 'Showreel Video + QR Code', estHours: 3, stepsTh: ['คัดคลิปผลงานเด่น 4–6 ช็อต', 'ใส่คำอธิบายบทบาทมุมล่าง'], stepsEn: ['Pick 4–6 strongest clips', 'Add concise role captions'], toolsTh: 'Unity / Blender / Premiere', toolsEn: 'Unity / Blender / Premiere' } },
  'law-policy': { labelTh: 'นิติ & นโยบาย', labelEn: 'Law & Policy', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Policy Brief', titleTh: 'เขียนบทความวิเคราะห์ประเด็นกฎหมาย/นโยบายสาธารณะ 800 คำ', titleEn: 'Write an 800-Word Public Policy / Legal Analysis Brief', descTh: 'อ้างอิงมาตราหรือข้อมูลสถิติจริง พร้อมข้อเสนอเชิงนโยบาย', descEn: 'Cite statutes or public data with clear policy recommendations', deliverableTh: 'Policy Brief PDF 2 หน้า', deliverableEn: '2-Page Policy Brief PDF', estHours: 3, stepsTh: ['เลือก 1 ประเด็นสังคมที่สนใจ', 'เปรียบเทียบข้อดี-ข้อเสียของมาตรการปัจจุบัน'], stepsEn: ['Choose 1 current policy issue', 'Weigh pros and cons of existing rules'], toolsTh: 'Google Docs • ฐานข้อมูลกฎหมาย', toolsEn: 'Google Docs • Legal Database' } },
  'edu-psych': { labelTh: 'ครุศาสตร์ & จิตวิทยา', labelEn: 'Edu & Psych', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Teaching Log', titleTh: 'บันทึกแผนการสอนหรือกิจกรรมแนะแนวเพื่อน/น้อง 2 ครั้ง', titleEn: 'Document 2 Peer Tutoring or Workshop Lesson Plans', descTh: 'แนบฟีดแบ็กจากผู้เรียนและการปรับปรุงวิธีสื่อสาร', descEn: 'Include learner feedback and how you adapted your teaching', deliverableTh: 'Lesson Plan + Feedback Summary', deliverableEn: 'Lesson Plan + Feedback', estHours: 2, stepsTh: ['ออกแบบกิจกรรม 30 นาทีพร้อมสื่อประกอบ', 'เก็บแบบสอบถามสั้นหลังจบกิจกรรม'], stepsEn: ['Design a 30-min lesson with slides', 'Collect short post-session feedback'], toolsTh: 'Canva • Google Forms', toolsEn: 'Canva • Google Forms' } }
};

var ROUND_GUIDE_TEMPLATES = {
  r1: {
    roundTh: 'รอบ 1 Portfolio', roundEn: 'Round 1 Portfolio',
    stepsTh: ['สรุปโจทย์ปัญหาและเป้าหมายของชิ้นงานให้ชัดเจนภายใน 3 บรรทัด', 'รวบรวมภาพร่างกระบวนการทำ (Wireframe / Prototype / Code) พร้อมผลทดสอบจริง', 'จัดวางลงเทมเพลต PDF 10 หน้าให้สะอาด อ่านง่าย และส่งออกขนาดไม่เกิน 10MB'],
    stepsEn: ['Frame the core problem and project outcome in 3 crisp lines', 'Attach process artifacts (wireframes, code, or user test notes)', 'Lay out in a clean 10-page PDF and export under 10MB'],
    toolsTh: 'Figma, GitHub, Canva / Google Slides, และเกณฑ์รอบ 1 บน mytcas.com',
    toolsEn: 'Figma, GitHub, Canva / Google Slides, and official Round 1 criteria on mytcas.com'
  },
  r2: {
    roundTh: 'รอบ 2 Quota', roundEn: 'Round 2 Quota',
    stepsTh: ['ตรวจสอบเกรดเฉลี่ยสะสม (GPAX) และหน่วยกิตรายวิชาบังคับล่าสุด', 'ติดต่อครูแนะแนวเพื่อขอหนังสือรับรองสิทธิ์โควตาโรงเรียน/พื้นที่', 'บันทึกวันเปิด-ปิดรับสมัครและค่าธรรมเนียมลงปฏิทินล่วงหน้า 2 สัปดาห์'],
    stepsEn: ['Verify latest cumulative GPAX and required subject credits', 'Request school counselor endorsement for regional/school quota', 'Calendar application deadlines and fee windows 2 weeks ahead'],
    toolsTh: 'ระบบทะเบียนโรงเรียน, ประกาศรับสมัครมหาวิทยาลัย, และ mytcas.com',
    toolsEn: 'School registrar portal, university admissions page, and mytcas.com'
  },
  r3: {
    roundTh: 'รอบ 3 Admission', roundEn: 'Round 3 Admission',
    stepsTh: ['จับเวลาทำข้อสอบเก่า 1 ชุดเต็มโดยไม่เปิดเฉลยระหว่างทำ', 'จดบันทึกข้อที่ผิดแยกตามบทเรียนเพื่อทบทวนซ้ำในสุดสัปดาห์', 'เปรียบเทียบคะแนนจำลองกับคะแนนต่ำสุด-สูงสุดย้อนหลัง 3 ปีของคณะ'],
    stepsEn: ['Complete 1 full past paper under strict exam timing', 'Log missed questions by topic for weekend targeted review', 'Benchmark mock scores against 3-year min/max cutoffs'],
    toolsTh: 'คลังข้อสอบ ทปอ. (mytcas.com), สมุดบันทึกจุดอ่อน (Error Log), และเครื่องคำนวณคะแนน',
    toolsEn: 'TCAS past papers (mytcas.com), weekly Error Log, and score simulator'
  },
  r4: {
    roundTh: 'รอบ 4 รับตรง', roundEn: 'Round 4 Direct',
    stepsTh: ['เตรียมไฟล์ Portfolio ฉบับอัปเดตและใบแสดงผลคะแนนสอบไว้ในโฟลเดอร์เดียว', 'ติดตามประกาศที่นั่งว่างรายวันหลังประกาศผลรอบ 3', 'ยื่นเอกสารภายใน 48 ชั่วโมงแรกเมื่อระบบเปิดรับ'],
    stepsEn: ['Keep updated portfolio PDF and score reports in one ready folder', 'Monitor daily open seat announcements right after Round 3 results', 'Submit documents within the first 48 hours of opening'],
    toolsTh: 'mytcas.com (หน้าค้นหาหลักสูตรที่เปิดรับรอบ 4) และประกาศตรงของคณะ',
    toolsEn: 'mytcas.com Round 4 seat finder and direct faculty announcements'
  }
};
