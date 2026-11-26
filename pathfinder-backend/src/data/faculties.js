// Step 3 "คณะที่สนใจเป็นพิเศษ": faculty groups the student can pick (optional, several).
// A program whose faculty name matches gets a boost in /api/match/programs.
// Keys are what the frontend chips (data-faculty-key) and user_state.target_faculties use.
export const FACULTY_GROUPS = {
  engineering: { th: 'วิศวกรรมศาสตร์', en: 'Engineering', re: /วิศวกรรม/ },
  science: { th: 'วิทยาศาสตร์', en: 'Science', re: /วิทยาศาสตร์(?!การกีฬา|สุขภาพ)/ },
  it: { th: 'เทคโนโลยีสารสนเทศ / ICT', en: 'IT / ICT', re: /เทคโนโลยีสารสนเทศ|สารสนเทศ|ไอซีที|ICT|ดิจิทัล/i },
  medicine: { th: 'แพทยศาสตร์', en: 'Medicine', re: /(?<!สัตว)แพทยศาสตร์/ },
  health: { th: 'สหเวช / พยาบาล / เภสัช / ทันตะ', en: 'Health sciences', re: /สหเวช|พยาบาล|เภสัช|ทันต|สาธารณสุข|เทคนิคการแพทย์|กายภาพ|สัตวแพทย/ },
  business: { th: 'บริหารธุรกิจ / บัญชี / เศรษฐศาสตร์', en: 'Business / Accounting / Economics', re: /บริหารธุรกิจ|พาณิชย|บัญชี|เศรษฐศาสตร์|การจัดการ/ },
  arts: { th: 'อักษร / มนุษยศาสตร์ / ศิลปศาสตร์', en: 'Arts / Humanities', re: /อักษร|มนุษยศาสตร์|ศิลปศาสตร์/ },
  comm: { th: 'นิเทศศาสตร์ / วารสาร', en: 'Communication Arts', re: /นิเทศ|วารสาร|สื่อสารมวลชน/ },
  law: { th: 'นิติศาสตร์', en: 'Law', re: /นิติศาสตร์/ },
  social: { th: 'รัฐศาสตร์ / สังคมศาสตร์', en: 'Political / Social sciences', re: /รัฐศาสตร์|รัฐประศาสน|สังคมศาสตร์|สังคมวิทยา/ },
  architecture: { th: 'สถาปัตยกรรมศาสตร์', en: 'Architecture', re: /สถาปัตย/ },
  fine_arts: { th: 'ศิลปกรรม / ออกแบบ / ดนตรี', en: 'Fine arts / Design / Music', re: /ศิลปกรรม|วิจิตรศิลป์|มัณฑนศิลป์|ออกแบบ|ดุริยาง|ดนตรี/ },
  education: { th: 'ครุศาสตร์ / ศึกษาศาสตร์', en: 'Education', re: /ครุศาสตร์|ศึกษาศาสตร์/ },
  agriculture: { th: 'เกษตร / อุตสาหกรรมเกษตร', en: 'Agriculture / Agro-industry', re: /เกษตร|ประมง|ป่าไม้|อุตสาหกรรมเกษตร/ },
  psychology: { th: 'จิตวิทยา', en: 'Psychology', re: /จิตวิทยา/ },
};
export const FACULTY_KEYS = Object.keys(FACULTY_GROUPS);

// the faculty groups (of the ones picked) this program's faculty belongs to
export const facultyHits = (faculty, keys = []) =>
  keys.filter((k) => FACULTY_GROUPS[k]?.re.test(String(faculty ?? '')));
