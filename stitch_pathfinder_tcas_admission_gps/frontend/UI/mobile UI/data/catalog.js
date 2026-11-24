/* =========================================================================
 * PathFinder (Mobile Prototype) — Static Data Catalogs
 * Reference tables moved out of the logic files (values unchanged).
 *
 * Classic (non-module) script sharing the page's global scope. In the
 * single-file build all of this lived inside one IIFE; it now runs at
 * top level in the same order. Load order is fixed in index.html:
 *   data/image-assets.js > data/catalog.js > js/state-i18n.js >
 *   js/discovery-matches.js > js/roadmap.js > js/visualizers.js >
 *   js/sim-coach.js > js/auth-analytics-profile.js
 *
 * Depends on : (none — pure literals)
 * Provides   : INTEREST_KEYWORD_MAP, MAJOR_SCORING, ROADMAP_CATALOG, PF_MY_PLAN_META, TCAS70_CENTRAL_ROUNDS, PF_INTEREST_ROUND_WORK, ROUND_GUIDE_TEMPLATES
 * ========================================================================= */

/* Interest keyword map (AI interest matcher, Page 2) */
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

/* Major scoring weights (Page 3 matches) */
var MAJOR_SCORING = {
  '1': { base: 81, unis: ['cu', 'kmutt'], interests: ['tech-ai', 'product-ux', 'robotics', 'data-research'], key: 'Computer Eng' },
  '2': { base: 81, unis: ['tu'], interests: ['tech-ai', 'product-ux', 'media', 'game-interactive', 'business'], key: 'Creative Tech' },
  '3': { base: 73, unis: ['kmutt', 'cu'], interests: ['product-ux', 'arch-design', 'media', 'robotics'], key: 'Industrial Design' },
  '4': { base: 70, unis: ['cu', 'tu'], interests: ['business', 'finance-quant', 'tech-ai', 'data-research', 'law-policy', 'global-lang'], key: 'Digital Business' },
  '5': { base: 69, unis: ['cu', 'kmitl'], interests: ['tech-ai', 'robotics', 'data-research', 'healthcare', 'bio-env'], key: 'Information Engineering' },
  '6': { base: 68, unis: ['mu', 'swu', 'su'], interests: ['media', 'game-interactive', 'product-ux', 'arch-design', 'psych-edtech', 'global-lang'], key: 'Interactive' }
};

/* Roadmap catalog: majors, rounds & waypoints (Page 4) */
var ROADMAP_CATALOG = {
  '1': {
    titleTh: 'วิศวกรรมคอมพิวเตอร์ & ออกแบบผลิตภัณฑ์',
    titleEn: 'Computer Engineering & Product Design',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: '3 Case Studies', titleTh: 'รวบรวม 3 โปรเจกต์ต้นแบบ (Case Studies)', titleEn: 'Curate 3 Prototype Case Studies', descTh: 'แสดงการตั้งโจทย์ปัญหา ภาพร่าง wireframe และผลทดสอบผู้ใช้', descEn: 'Show problem framing, wireframe iterations & user testing', defaultChecked: true },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: '10-Page PDF', titleTh: 'ร่าง Statement of Purpose & Portfolio 10 หน้า', titleEn: 'Draft 10-Page Statement of Purpose & Portfolio', descTh: 'หน้า 1 ปก • หน้า 2 SOP • หน้า 3–8 โปรเจกต์ • หน้า 9 Beyond 4.00', descEn: 'Cover • SOP • Case Studies • Beyond 4.00 • Why This Major', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'GPAX ≥ 3.50', titleTh: 'ตรวจสอบสิทธิ์โควตาพื้นที่และโควตาโรงเรียน', titleEn: 'Verify Regional & School Quota', descTh: 'เช็กเกณฑ์ GPAX >= 3.50 และหน่วยกิตคณิต-วิทย์', descEn: 'Confirm GPAX >= 3.50 & math/science credits', defaultChecked: true }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT + TPAT3', titleTh: 'ฝึกทำข้อสอบจับเวลา TGAT1–3 และ TPAT3', titleEn: 'TGAT1–3 & TPAT3 Timed Practice', descTh: 'แบ่งเวลาอ่านตามแผนรายสัปดาห์ พร้อมสรุปจุดอ่อน', descEn: 'Follow your weekly study cadence with error logs', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: 'mytcas.com', titleTh: 'บันทึกวันเปิดรับตรงอิสระสำรองไว้', titleEn: 'Keep Direct Admission Backup Dates', descTh: 'ติดตามที่นั่งว่างของคณะบน mytcas.com ช่วงปลายพ.ค.', descEn: 'Monitor open faculty seats on mytcas.com in late May', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Open-Source UI Component Kit', titleEn: '1. Open-Source UI Component Kit', descTh: 'เผยแพร่ UI Component 12 ชิ้นบน GitHub', descEn: 'Publish 12 accessible components on GitHub' },
      { titleTh: '2. บทความทดสอบการใช้งาน', titleEn: '2. Applied Usability Mini-Paper', descTh: 'ทดสอบเครื่องมือกับเพื่อน 15 คน', descEn: 'Test a study tool with 15 peers' }
    ]
  },
  '2': {
    titleTh: 'เทคโนโลยีสร้างสรรค์ & นวัตกรรมดิจิทัล',
    titleEn: 'Creative Technology & Innovation',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'SIIT / Design', titleTh: 'สร้าง Interactive Web Demo 1 ชิ้น', titleEn: 'Ship 1 Live Interactive Web Demo', descTh: 'ใส่ลิงก์เดโม + QR Code ในหน้าแรกของ Portfolio', descEn: 'Include a live URL & QR code in your portfolio', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'English Pitch', titleTh: 'ซ้อมสัมภาษณ์ Pitch ไอเดีย 3 นาที', titleEn: 'Rehearse 3-Min English Idea Pitch', descTh: 'เล่าปัญหาและจุดเด่นต้นแบบอย่างกระชับ', descEn: 'Summarize problem and prototype edge crisply', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'GPAX ≥ 3.00', titleTh: 'เตรียมเอกสารรับรองโครงการนวัตกรรม', titleEn: 'Prepare Innovation Project Endorsement', descTh: 'รวบรวมเกียรติบัตร Hackathon หรือโครงงาน', descEn: 'Compile hackathon or science project certificates', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT + คณิต1', titleTh: 'ทำโจทย์ TGAT + คณิตศาสตร์ประยุกต์ 1', titleEn: 'TGAT + Applied Math 1 Drills', descTh: 'เน้นพาร์ทการคิดอย่างมีเหตุผลและฟังก์ชัน', descEn: 'Focus on logical reasoning and functions', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: 'SIIT Direct', titleTh: 'เช็กวันเปิดรับรอบ Direct ของ SIIT', titleEn: 'Track SIIT Direct Round Dates', descTh: 'เตรียมผลภาษาอังกฤษหรือสอบวัดระดับสำรอง', descEn: 'Prepare English score or placement test slot', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Hackathon MVP + Pitch Deck', titleEn: '1. Hackathon MVP + Pitch Deck', descTh: 'พัฒนาต้นแบบใน 48 ชม. พร้อมสไลด์ทดสอบ', descEn: 'Build a 48-hr prototype with validation slides' },
      { titleTh: '2. Interactive Web Experiment', titleEn: '2. Interactive Web Experiment', descTh: 'เผยแพร่ micro-interaction บนเว็บให้ลองเล่นได้', descEn: 'Publish a playful web micro-interaction' }
    ]
  },
  '3': {
    titleTh: 'ออกแบบอุตสาหกรรม & UX',
    titleEn: 'Industrial Design & UX',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'Sketchbook', titleTh: 'คัดภาพสเก็ตช์มือ + Wireframe 10 แผ่น', titleEn: 'Curate 10 Hand Sketches & Wireframes', descTh: 'โชว์กระบวนการคิดตั้งแต่ปัญหาจริงถึงรูปทรง', descEn: 'Show ideation from real friction to form', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: '3D / Figma', titleTh: 'ปั้นโมเดล 3D หรือ Figma Prototype 2 ชิ้น', titleEn: 'Build 2 3D or Figma Prototypes', descTh: 'แนบภาพถ่ายโมเดลจริงหรือวิดีโอการใช้งาน', descEn: 'Attach mockup photos or prototype recordings', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'Drawing Test', titleTh: 'เช็กวันสอบวาดเส้นรอบโควตา', titleEn: 'Check Quota Drawing Test Dates', descTh: 'ซ้อมวาด Perspective ภายใน 90 นาที', descEn: 'Practice 90-minute perspective drills', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT + TPAT4', titleTh: 'ลุยข้อสอบ TPAT4 ความถนัดดีไซน์', titleEn: 'TPAT4 Design Aptitude Practice', descTh: 'ฝึกมิติสัมพันธ์และองค์ประกอบศิลป์', descEn: 'Drill spatial reasoning and visual composition', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: '8-Page PDF', titleTh: 'อัปเดต Portfolio 8 หน้าสำหรับรอบ 4', titleEn: 'Prepare 8-Page Round 4 Portfolio', descTh: 'เตรียมไฟล์ PDF < 10MB พร้อมยื่นทันที', descEn: 'Keep an under-10MB PDF ready for Round 4', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. สมุดภาพร่างแก้ปัญหา', titleEn: '1. Daily Friction Sketchbook', descTh: '15 ไอเดียออกแบบแก้ปัญหาในโรงเรียน', descEn: '15 design sketches solving campus pain points' },
      { titleTh: '2. ต้นแบบ 3D/Figma ที่ทดสอบแล้ว', titleEn: '2. Tested 3D/Figma Mockup', descTh: 'เปรียบเทียบก่อน-หลังปรับแก้จากฟีดแบ็ก', descEn: 'Before/after iterations from peer feedback' }
    ]
  },
  '4': {
    titleTh: 'ธุรกิจดิจิทัล & Data',
    titleEn: 'Digital Business & Data',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'Data Story', titleTh: 'ทำโครงงานวิเคราะห์ข้อมูลจริง 1 ชุด', titleEn: 'Complete 1 Real-World Data Case Study', descTh: 'สรุปกราฟและข้อเสนอแนะเชิงธุรกิจใน 2 หน้า', descEn: 'Summarize charts and business insights cleanly', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Product Case', titleTh: 'เขียนบทวิเคราะห์ Product Strategy 1 ชิ้น', titleEn: 'Write 1 Product Growth Teardown', descTh: 'วิเคราะห์โมเดลรายได้และการเติบโตของแอป', descEn: 'Analyze revenue model and retention loops', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'GPAX ≥ 3.25', titleTh: 'ตรวจสอบโควตาแข่งแผนธุรกิจ', titleEn: 'Verify Business Competition Quota', descTh: 'รวบรวมผลงานประกวดหรือกิจกรรมชมรม', descEn: 'Gather competition or club leadership records', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT + คณิต2', titleTh: 'ฝึก TGAT + คณิตศาสตร์ประยุกต์ 2', titleEn: 'TGAT + Applied Math 2 Practice', descTh: 'เน้นสถิติและความน่าจะเป็น', descEn: 'Focus on statistics and probability', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: '~80 ที่นั่ง', titleTh: 'เช็กเกณฑ์รอบ 3–4 จุฬาฯ / ธรรมศาสตร์', titleEn: 'Compare CU & TU Round 3–4 Seats', descTh: 'เตรียมคะแนน TGAT/คณิต2 ยื่นสำรอง', descEn: 'Keep TGAT/Math 2 ready for late openings', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Real-World Dataset Case Study', titleEn: '1. Real-World Dataset Case Study', descTh: 'วิเคราะห์ข้อมูลเปิดภาครัฐหรือร้านค้าโรงเรียน', descEn: 'Analyze open public or school store metrics' },
      { titleTh: '2. Product Growth Teardown Deck', titleEn: '2. Product Growth Teardown Deck', descTh: 'สไลด์ 6 หน้าวิเคราะห์ UX + Funnel', descEn: '6-slide UX and conversion funnel teardown' }
    ]
  },
  '5': {
    titleTh: 'วิศวกรรมสารสนเทศ (ISE)',
    titleEn: 'Information Engineering',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'SAT / IELTS', titleTh: 'เช็กเป้าหมายคะแนน SAT Math & IELTS', titleEn: 'Set Target SAT Math & IELTS Scores', descTh: 'วางแผนรอบสอบให้ทันยื่น Early Admission', descEn: 'Schedule test dates ahead of Early Admission', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'English Port', titleTh: 'จัดทำ Portfolio ภาษาอังกฤษ + SOP', titleEn: 'Assemble English Portfolio & SOP', descTh: 'เน้นโปรเจกต์ซอฟต์แวร์และ IoT', descEn: 'Highlight software and IoT builds', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'Transcript', titleTh: 'ขอใบรับรองผลการเรียนฉบับภาษาอังกฤษ', titleEn: 'Request English Academic Transcript', descTh: 'ติดต่อฝ่ายทะเบียนล่วงหน้า 2 สัปดาห์', descEn: 'Request sealed transcript 2 weeks early', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'Mock SAT', titleTh: 'ทบทวน Mock SAT Math + Physics', titleEn: 'Timed Mock SAT Math & Physics', descTh: 'ปิดจุดอ่อนคำศัพท์คณิตภาษาอังกฤษ', descEn: 'Sharpen English math terminology', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: 'Direct Inter', titleTh: 'เช็กรอบรับตรงหลักสูตรนานาชาติ', titleEn: 'Monitor International Direct Rounds', descTh: 'ติดตามประกาศรับเพิ่มของ ISE', descEn: 'Check late seat announcements for ISE', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. English Technical Blog & GitHub', titleEn: '1. English Technical Blog & GitHub', descTh: 'เขียนสรุปโปรเจกต์โค้ดภาษาอังกฤษ 2 บทความ', descEn: 'Publish 2 English engineering write-ups' },
      { titleTh: '2. IoT / Automation Mini-Project', titleEn: '2. IoT / Automation Mini-Project', descTh: 'สร้างโปรเจกต์เซนเซอร์หรือสคริปต์ช่วยงาน', descEn: 'Build a small sensor or automation script' }
    ]
  },
  '6': {
    titleTh: 'สื่ออินเทอร์แอกทีฟ & เกม',
    titleEn: 'Interactive & Game Design',
    rounds: {
      r1: [
        { dateTh: 'ต.ค.–พ.ย.', dateEn: 'Oct–Nov', tag: 'Playable Demo', titleTh: 'สร้างมินิเกมที่เล่นได้จริง 1 ชิ้น', titleEn: 'Ship 1 Playable Mini-Game', descTh: 'อัปโหลดขึ้น itch.io พร้อมคลิป 45 วิ', descEn: 'Publish on itch.io with a 45s clip', defaultChecked: false },
        { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Art & GDD', titleTh: 'แนบ Game Design Doc + Concept Art', titleEn: 'Include Game Design Doc & Art', descTh: 'อธิบายระบบเกมและภาพร่างตัวละคร', descEn: 'Explain core loop and character sketches', defaultChecked: false }
      ],
      r2: [
        { dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: 'Game Jam', titleTh: 'รวบรวมผลงาน Game Jam / สื่อสร้างสรรค์', titleEn: 'Compile Game Jam & Media Awards', descTh: 'ระบุบทบาทในทีมอย่างชัดเจน', descEn: 'Document your exact team role', defaultChecked: false }
      ],
      r3: [
        { dateTh: 'เม.ย.–พ.ค.', dateEn: 'Apr–May', tag: 'TGAT', titleTh: 'ฝึก TGAT1–3 และเล่าเรื่องเชิงภาพ', titleEn: 'TGAT1–3 & Visual Storytelling', descTh: 'เตรียมคะแนนสอบกลางควบคู่พอร์ต', descEn: 'Balance TGAT prep with portfolio polish', defaultChecked: false }
      ],
      r4: [
        { dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: 'MU / SWU / SU', titleTh: 'เช็กรับตรงสายสื่อดิจิทัล มหิดล/มศว/ศิลปากร', titleEn: 'Track Media Direct Rounds (MU/SWU/SU)', descTh: 'เตรียม Showreel 1 นาทีสำหรับรอบรับตรง', descEn: 'Keep a 1-min showreel ready', defaultChecked: false }
      ]
    },
    beyond: [
      { titleTh: '1. Playable Game Jam Prototype', titleEn: '1. Playable Game Jam Prototype', descTh: 'เข้าร่วม Game Jam และปล่อยเดโม', descEn: 'Join a Game Jam and publish a build' },
      { titleTh: '2. Motion & Shader Reel (60 วิ)', titleEn: '2. 60-Second Motion & Shader Reel', descTh: 'รวมช็อตแอนิเมชันและเอฟเฟกต์ที่ทำเอง', descEn: 'Compile self-made motion & shader clips' }
    ]
  }
};

/* /api/my-plan meta: university, exams & deadlines per major */
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

/* TCAS70 central calendar */
var TCAS70_CENTRAL_ROUNDS = [
  { id: 'r1', titleTh: 'รอบ 1 Portfolio', titleEn: 'Round 1 Portfolio', applyTh: 'ต.ค. – ม.ค.', applyEn: 'Oct – Jan', announceTh: '6 ก.พ. 70', announceEn: 'Feb 6', confirmTh: '6–7 ก.พ. 70', confirmEn: 'Feb 6–7', sourceTh: 'ทางการ', sourceEn: 'Official', tone: 'official' },
  { id: 'r2', titleTh: 'รอบ 2 Quota', titleEn: 'Round 2 Quota', applyTh: 'ก.พ. – เม.ย.', applyEn: 'Feb – Apr', announceTh: '2 พ.ค. 70', announceEn: 'May 2', confirmTh: '2–3 พ.ค. 70', confirmEn: 'May 2–3', sourceTh: 'ทางการ', sourceEn: 'Official', tone: 'official' },
  { id: 'r3', titleTh: 'รอบ 3 Admission', titleEn: 'Round 3 Admission', applyTh: '6–12 พ.ค. 70', applyEn: 'May 6–12', announceTh: '20 พ.ค. 70', announceEn: 'May 20', confirmTh: '20–21 พ.ค. 70', confirmEn: 'May 20–21', sourceTh: 'ตรวจสอบแล้ว', sourceEn: 'Verified', tone: 'verified' },
  { id: 'r4', titleTh: 'รอบ 4 Direct Admission', titleEn: 'Round 4 Direct', applyTh: '27 พ.ค. – มิ.ย.', applyEn: 'May 27 – Jun', announceTh: '6 มิ.ย. 70', announceEn: 'Jun 6', confirmTh: '6–7 มิ.ย. 70', confirmEn: 'Jun 6–7', sourceTh: 'AI ค้นหา', sourceEn: 'AI Found', tone: 'ai' }
];

/* Interest-based per-round work templates */
var PF_INTEREST_ROUND_WORK = {
  'tech-ai': {
    labelTh: 'AI & Tech', labelEn: 'AI & Tech',
    r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'AI Project', titleTh: 'สร้างโปรเจกต์ AI / LLM Mini-App พร้อมลิงก์เดโม', titleEn: 'Build 1 AI / LLM Mini-App with Live Demo Link', descTh: 'ใช้ API หรือโมเดลจำแนกข้อมูลจริง แนบ Architecture Diagram และ QR Code ในพอร์ต', descEn: 'Ship a working AI mini-app with architecture diagram and QR code in your portfolio', deliverableTh: 'ลิงก์ GitHub + วิดีโอเดโม 60 วิ', deliverableEn: 'GitHub Repo + 60s Demo Video', estHours: 4, stepsTh: ['เลือกโจทย์ปัญหาใกล้ตัว 1 เรื่อง', 'สร้างต้นแบบด้วย Python / Web + เชื่อม API', 'เขียน README อธิบายผลลัพธ์'], stepsEn: ['Pick 1 student pain point', 'Build a working web/Python prototype', 'Document results in README'], toolsTh: 'GitHub • Google Colab • Vercel', toolsEn: 'GitHub • Google Colab • Vercel' },
    r3: { dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'คณิต1 + TPAT3', titleTh: 'ติวเข้มพีชคณิตเชิงเส้น สถิติ และตรรกศาสตร์สำหรับสาย AI', titleEn: 'Drill Linear Algebra, Stats & Logic for AI Tracks', descTh: 'เก็บคะแนนพาร์ทที่ออกสอบบ่อยใน TPAT3 และคณิตศาสตร์ประยุกต์ 1', descEn: 'Target high-yield TPAT3 logic and Applied Math 1 statistics sections', deliverableTh: 'สมุดสรุป Error Log 30 ข้อ', deliverableEn: '30-Question Error Log', estHours: 3, stepsTh: ['ทำชุดข้อสอบเก่า 2 ปีย้อนหลังแบบจับเวลา', 'จดข้อผิดพลาดแยกตามบท'], stepsEn: ['Solve 2 past papers timed', 'Log missed questions by topic'], toolsTh: 'ข้อสอบเก่า TPAT3 • คณิต1', toolsEn: 'Past TPAT3 & Math 1 Papers' }
  },
  'product-ux': {
    labelTh: 'Product & UX', labelEn: 'Product & UX',
    r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'UX Case Study', titleTh: 'ทำ UX Research + Prototype 1 ชิ้นพร้อมผลทดสอบผู้ใช้', titleEn: 'Publish 1 UX Case Study with Usability Test Results', descTh: 'สัมภาษณ์เพื่อน 5–8 คน สรุป Pain Point และเปรียบเทียบ Wireframe ก่อน-หลังปรับแก้', descEn: 'Interview 5–8 peers, synthesize pain points, and show before/after wireframes', deliverableTh: 'Figma Prototype + สรุป 2 หน้า', deliverableEn: 'Figma Prototype + 2-Page Summary', estHours: 3, stepsTh: ['กำหนดสมมติฐานและสัมภาษณ์ผู้ใช้ 5 คน', 'ออกแบบ Prototype ใน Figma'], stepsEn: ['Interview 5 users', 'Build Interactive Figma Prototype'], toolsTh: 'Figma • FigJam • Google Forms', toolsEn: 'Figma • FigJam • Google Forms' },
    r2: { dateTh: 'ก.พ.', dateEn: 'Feb', tag: 'Design Quota', titleTh: 'รวบรวมผลงานประกวดออกแบบหรือ Hackathon เพื่อยื่นรอบโควตา', titleEn: 'Compile Designathon / Hackathon Artifacts for Quota', descTh: 'จัดหมวดหมู่บทบาทของคุณในทีม (Research, UI System, Prototyping)', descEn: 'Highlight your specific role in team design challenges', deliverableTh: 'แฟ้มเกียรติบัตร + คำอธิบายบทบาท', deliverableEn: 'Certificate Pack + Role Breakdown', estHours: 2, stepsTh: ['รวมเกียรติบัตรเป็น PDF', 'เขียนสรุปบทบาท 3 บรรทัดต่อกิจกรรม'], stepsEn: ['Merge certificates into PDF', 'Write 3-line role summary'], toolsTh: 'Google Drive • Figma', toolsEn: 'Google Drive • Figma' }
  },
  'data-biz': { labelTh: 'Data & Business', labelEn: 'Data & Business', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Data Dashboard', titleTh: 'สร้าง Dashboard วิเคราะห์ข้อมูลจริง 1 ชุด', titleEn: 'Build 1 Real-World Data Dashboard', descTh: 'เล่าเรื่องจากตัวเลขพร้อมข้อเสนอแนะเชิงธุรกิจ', descEn: 'Turn public or school data into clear charts', deliverableTh: 'Dashboard + Insight 1 หน้า', deliverableEn: 'Dashboard + 1-Page Memo', estHours: 3, stepsTh: ['เลือกชุดข้อมูลเปิด', 'สร้างกราฟ 3 มุมมอง'], stepsEn: ['Pick public dataset', 'Build 3 charts'], toolsTh: 'Looker Studio • Sheets', toolsEn: 'Looker Studio • Sheets' }, r3: { dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'TGAT + คณิต2', titleTh: 'ฝึกโจทย์ความน่าจะเป็น สถิติ และ TGAT2', titleEn: 'Practice Probability, Stats & TGAT2', descTh: 'เพิ่มความเร็วการอ่านกราฟและตารางให้ทำทันเวลา', descEn: 'Boost speed on chart reading drills', deliverableTh: 'ชุดฝึก 4 ชุด', deliverableEn: '4 Timed Sets', estHours: 3 } },
  'med-health': { labelTh: 'แพทย์ & สุขภาพ', labelEn: 'Medicine & Health', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Medical Port', titleTh: 'บันทึกชั่วโมงอาสา/ค่ายสายสุขภาพและบทเรียนจริยธรรมแพทย์', titleEn: 'Log Health Volunteering & Ethics Reflections', descTh: 'เขียน Reflection เชิงลึกจากการดูแลผู้ป่วยหรือชุมชน', descEn: 'Reflect on patient empathy and community health', deliverableTh: 'Reflection 3 หน้า', deliverableEn: '3-Page Reflection', estHours: 3 }, r3: { dateTh: 'มี.ค.–เม.ย.', dateEn: 'Mar–Apr', tag: 'TPAT1 กสพท', titleTh: 'ซ้อมพาร์ทเชาวน์ จริยธรรม และเชื่อมโยง TPAT1', titleEn: 'Drill TPAT1 IQ, Ethics & Reading Links', descTh: 'รักษามาตรฐาน TPAT1 คู่กับ A-Level ชีววิทยา-เคมี', descEn: 'Balance TPAT1 drills with A-Level Bio & Chem', deliverableTh: 'ผล Mock TPAT1 ≥ 21/30', deliverableEn: 'Mock TPAT1 ≥ 21/30', estHours: 4 } },
  'bio-life': { labelTh: 'Bio & Life Sci', labelEn: 'Bio & Life Sci', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Bio Lab', titleTh: 'สรุปโครงงานทดลองชีววิทยา/สอวน. พร้อมภาพผลแล็บ', titleEn: 'Document Biology Lab Project', descTh: 'แสดงสมมติฐานและกราฟวิเคราะห์ผลทดลอง', descEn: 'Present hypothesis and lab data charts', deliverableTh: 'รายงาน 4 หน้า', deliverableEn: '4-Page Brief', estHours: 3 } },
  'chem-lab': { labelTh: 'เคมี & วัสดุ', labelEn: 'Chemistry & Materials', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Chem Lab', titleTh: 'รวบรวมรายงานแล็บเคมีวิเคราะห์/วัสดุศาสตร์ 2 ชิ้น', titleEn: 'Compile 2 Analytical Chem Lab Reports', descTh: 'เน้นความปลอดภัยและการคำนวณปริมาณสารสัมพันธ์', descEn: 'Highlight lab safety and stoichiometry', deliverableTh: 'Lab Report 2 ฉบับ', deliverableEn: '2 Lab Reports', estHours: 2 } },
  'physics-eng': { labelTh: 'ฟิสิกส์ & วิศวะ', labelEn: 'Physics & Eng', r3: { dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'TPAT3 + ฟิสิกส์', titleTh: 'ตะลุยโจทย์กลศาสตร์ ไฟฟ้า และ TPAT3', titleEn: 'Master Mechanics, Circuits & TPAT3', descTh: 'เก็บคะแนนพาร์ทคำนวณและมิติสัมพันธ์', descEn: 'Lock in physics & spatial aptitude', deliverableTh: 'ชุดฝึก TPAT3 3 ชุด', deliverableEn: '3 TPAT3 Sets', estHours: 4 } },
  'space-aero': { labelTh: 'การบิน & อวกาศ', labelEn: 'Aero & Space', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Aero Mini-Build', titleTh: 'สร้างโครงงานจำลองการบินหรือวิเคราะห์ข้อมูลดาวเทียม', titleEn: 'Ship 1 Aero / Satellite Mini-Project', descTh: 'คำนวณแรงยก-แรงต้านด้วย Python/Excel', descEn: 'Model lift/drag or orbital telemetry', deliverableTh: 'รายงาน + กราฟ', deliverableEn: 'Report + Plots', estHours: 3 } },
  'robotics-mech': { labelTh: 'หุ่นยนต์ & เมคคา', labelEn: 'Robotics & Mech', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Hardware Demo', titleTh: 'บันทึกวิดีโอหุ่นยนต์/Arduino + ผังวงจร', titleEn: 'Record Robotics/Arduino Demo + Schematic', descTh: 'โชว์ระบบเซนเซอร์และโค้ดควบคุม', descEn: 'Show sensor feedback loop and wiring', deliverableTh: 'คลิป 45 วิ + ผังวงจร', deliverableEn: '45s Clip + Schematic', estHours: 4 } },
  'env-climate': { labelTh: 'สิ่งแวดล้อม', labelEn: 'Environment', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Sustainability', titleTh: 'สรุปโครงการรักษ์โลกพร้อมตัวเลขวัดผล', titleEn: 'Quantify 1 Sustainability Project', descTh: 'วัดผลเป็นตัวเลขจริง เช่น ขยะที่ลดได้', descEn: 'Measure real kg/month impact', deliverableTh: 'Impact Sheet 2 หน้า', deliverableEn: '2-Page Sheet', estHours: 2 } },
  'arch-spatial': { labelTh: 'สถาปัตย์ & พื้นที่', labelEn: 'Architecture', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Sketch & Model', titleTh: 'รวมภาพสเก็ตช์ Perspective 8 แผ่น + โมเดล 1 ชิ้น', titleEn: 'Curate 8 Sketches + 1 Scale Model', descTh: 'ถ่ายภาพโมเดลด้วยแสงธรรมชาติ', descEn: 'Shoot scale model in natural light', deliverableTh: 'Sketchbook PDF', deliverableEn: 'Sketchbook PDF', estHours: 4 } },
  'media-game': { labelTh: 'สื่อ & เกม', labelEn: 'Media & Game', r1: { dateTh: 'พ.ย.', dateEn: 'Nov', tag: 'Showreel', titleTh: 'ตัดต่อ Showreel ผลงานสื่อ/เกม 60 วินาที', titleEn: 'Cut a 60s Media / Game Showreel', descTh: 'ขึ้นช็อตเด่นใน 5 วินาทีแรก', descEn: 'Lead with your strongest 5s hook', deliverableTh: 'วิดีโอ Showreel + QR', deliverableEn: 'Showreel + QR', estHours: 3 } },
  'law-policy': { labelTh: 'นิติ & นโยบาย', labelEn: 'Law & Policy', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Policy Brief', titleTh: 'เขียนบทความวิเคราะห์กฎหมาย/นโยบาย 800 คำ', titleEn: 'Write 800-Word Policy Brief', descTh: 'อ้างอิงมาตราหรือสถิติจริง', descEn: 'Cite statutes or public data', deliverableTh: 'Policy Brief 2 หน้า', deliverableEn: '2-Page Brief', estHours: 3 } },
  'edu-psych': { labelTh: 'ครุศาสตร์ & จิตวิทยา', labelEn: 'Edu & Psych', r1: { dateTh: 'ธ.ค.', dateEn: 'Dec', tag: 'Teaching Log', titleTh: 'บันทึกแผนการสอน/กิจกรรมแนะแนว 2 ครั้ง', titleEn: 'Document 2 Peer Lesson Plans', descTh: 'แนบฟีดแบ็กจากผู้เรียน', descEn: 'Include learner feedback', deliverableTh: 'Lesson Plan + Feedback', deliverableEn: 'Lesson Plan + Feedback', estHours: 2 } }
};

/* Round guide templates (Waypoint drawer) */
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
