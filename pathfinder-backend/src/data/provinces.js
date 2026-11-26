// Thai provinces -> region, and where each university campus is.
// myTCAS gives campus names but no province, so this table fills that in:
//   1. the campus name contains a province ("เฉลิมพระเกียรติ จ.สกลนคร", "ศูนย์ลำปาง")  -> that province
//   2. a well-known campus / district name ("บางเขน", "ศรีราชา", "ศาลายา")              -> CAMPUS_ALIASES
//   3. otherwise the university's main campus                                           -> UNI_MAIN_PROVINCE
// Used by "คณะที่ใช่" to rank programs near the student's province higher.

export const PROVINCE_REGION = {
  กรุงเทพมหานคร: 'bkk',
  นนทบุรี: 'bkk', ปทุมธานี: 'bkk', สมุทรปราการ: 'bkk', นครปฐม: 'bkk', สมุทรสาคร: 'bkk',
  พระนครศรีอยุธยา: 'central', อ่างทอง: 'central', ลพบุรี: 'central', สิงห์บุรี: 'central', ชัยนาท: 'central', สระบุรี: 'central',
  นครนายก: 'central', สุพรรณบุรี: 'central', สมุทรสงคราม: 'central', นครสวรรค์: 'central', อุทัยธานี: 'central', กำแพงเพชร: 'central',
  พิจิตร: 'central', พิษณุโลก: 'central', เพชรบูรณ์: 'central', สุโขทัย: 'central',
  เชียงใหม่: 'north', เชียงราย: 'north', ลำปาง: 'north', ลำพูน: 'north', แม่ฮ่องสอน: 'north', น่าน: 'north', พะเยา: 'north', แพร่: 'north', อุตรดิตถ์: 'north',
  ตาก: 'west', กาญจนบุรี: 'west', ราชบุรี: 'west', เพชรบุรี: 'west', ประจวบคีรีขันธ์: 'west',
  ชลบุรี: 'east', ระยอง: 'east', จันทบุรี: 'east', ตราด: 'east', ฉะเชิงเทรา: 'east', ปราจีนบุรี: 'east', สระแก้ว: 'east',
  นครราชสีมา: 'northeast', บุรีรัมย์: 'northeast', สุรินทร์: 'northeast', ศรีสะเกษ: 'northeast', อุบลราชธานี: 'northeast', ยโสธร: 'northeast',
  ชัยภูมิ: 'northeast', อำนาจเจริญ: 'northeast', บึงกาฬ: 'northeast', หนองบัวลำภู: 'northeast', ขอนแก่น: 'northeast', อุดรธานี: 'northeast',
  เลย: 'northeast', หนองคาย: 'northeast', มหาสารคาม: 'northeast', ร้อยเอ็ด: 'northeast', กาฬสินธุ์: 'northeast', สกลนคร: 'northeast',
  นครพนม: 'northeast', มุกดาหาร: 'northeast',
  ชุมพร: 'south', ระนอง: 'south', สุราษฎร์ธานี: 'south', พังงา: 'south', ภูเก็ต: 'south', กระบี่: 'south', นครศรีธรรมราช: 'south',
  ตรัง: 'south', พัทลุง: 'south', สตูล: 'south', สงขลา: 'south', ปัตตานี: 'south', ยะลา: 'south', นราธิวาส: 'south',
};
export const PROVINCES = Object.keys(PROVINCE_REGION);

export const REGION_LABEL = {
  bkk: ['กรุงเทพและปริมณฑล', 'Bangkok & vicinity'], central: ['ภาคกลาง', 'Central'], north: ['ภาคเหนือ', 'North'],
  west: ['ภาคตะวันตก', 'West'], east: ['ภาคตะวันออก', 'East'], northeast: ['ภาคตะวันออกเฉียงเหนือ', 'Northeast'], south: ['ภาคใต้', 'South'],
};

// campus / district names in myTCAS -> province
const CAMPUS_ALIASES = [
  [/กรุงเทพ|บางเขน|ท่าพระจันทร์|วังท่าพระ|ประสานมิตร|บางมด|บางขุนเทียน|ลาดกระบัง|หัวหมาก|เทเวศร์|พระนครเหนือ|โชติเวช|พณิชยการพระนคร|บพิตรพิมุข|เพาะช่าง|พัฒนาการ|ร่มเกล้า|วัชรพล|จักรพงษภูวนารถ|ท่าพระ\)/, 'กรุงเทพมหานคร'],
  [/ศาลายา|กำแพงแสน|สนามจันทร์/, 'นครปฐม'],
  [/ศรีราชา|พัทยา|อีอีซี|บางพระ/, 'ชลบุรี'],
  [/รังสิต|คลองหก/, 'ปทุมธานี'],
  [/องครักษ์/, 'นครนายก'],
  [/หาดใหญ่/, 'สงขลา'],
  [/เมืองทองธานี|แจ้งวัฒนะ/, 'นนทบุรี'],
  [/สุวรรณภูมิ/, 'สมุทรปราการ'],
  [/หัวหิน|วังไกลกังวล/, 'ประจวบคีรีขันธ์'],
];

// main campus province per myTCAS university_id
const UNI_MAIN_PROVINCE = {
  '001': 'กรุงเทพมหานคร', '002': 'กรุงเทพมหานคร', '003': 'ขอนแก่น', '004': 'เชียงใหม่', '005': 'ปทุมธานี', '006': 'นครปฐม',
  '008': 'นครปฐม', '009': 'กรุงเทพมหานคร', '010': 'สงขลา', '013': 'เชียงใหม่', '014': 'กรุงเทพมหานคร', '015': 'กรุงเทพมหานคร',
  '016': 'กรุงเทพมหานคร', '017': 'นครราชสีมา', '018': 'อุบลราชธานี', '019': 'ชลบุรี', '020': 'พิษณุโลก', '021': 'มหาสารคาม',
  '022': 'สงขลา', '023': 'นครศรีธรรมราช', '024': 'เชียงราย', '025': 'นราธิวาส', '026': 'นครพนม', '027': 'พะเยา', '028': 'กาฬสินธุ์',
  '032': 'กรุงเทพมหานคร', '034': 'กรุงเทพมหานคร', '035': 'กรุงเทพมหานคร', '036': 'นครปฐม', '037': 'พระนครศรีอยุธยา',
  '051': 'ปทุมธานี', '054': 'กรุงเทพมหานคร', '056': 'กรุงเทพมหานคร', '059': 'นครปฐม', '068': 'ปทุมธานี', '102': 'กาญจนบุรี',
  '103': 'กรุงเทพมหานคร', '112': 'ปทุมธานี', '115': 'กรุงเทพมหานคร', '117': 'กรุงเทพมหานคร', '129': 'สระบุรี', '130': 'สงขลา',
  '144': 'เชียงใหม่', '146': 'กรุงเทพมหานคร', '148': 'นครราชสีมา', '150': 'กรุงเทพมหานคร', '152': 'พิษณุโลก', '153': 'ปทุมธานี',
  '164': 'สงขลา', '165': 'กรุงเทพมหานคร', '166': 'กรุงเทพมหานคร', '170': 'อุตรดิตถ์', '171': 'อุบลราชธานี', '172': 'นครสวรรค์',
  '174': 'กรุงเทพมหานคร', '177': 'กรุงเทพมหานคร', '179': 'เพชรบุรี', '180': 'กรุงเทพมหานคร', '181': 'กรุงเทพมหานคร',
  '191': 'ปทุมธานี', '192': 'กรุงเทพมหานคร', '193': 'ชลบุรี', '194': 'กรุงเทพมหานคร', '195': 'นครปฐม', '197': 'สงขลา',
  '199': 'นครราชสีมา', '216': 'กรุงเทพมหานคร', '218': 'กรุงเทพมหานคร', '265': 'กรุงเทพมหานคร', '905': 'ลำปาง', '910': 'ปทุมธานี',
  '911': 'ปทุมธานี', '916': 'นครราชสีมา', '917': 'ตาก', '918': 'นนทบุรี', '921': 'สมุทรปราการ', '922': 'นครราชสีมา',
  '923': 'กรุงเทพมหานคร', '931': 'กรุงเทพมหานคร',
};

// longest names first so "อุดรธานี" isn't caught by a shorter one inside it
const BY_LENGTH = PROVINCES.slice().sort((a, b) => b.length - a.length);

export function provinceOf(universityId, campus) {
  const c = String(campus ?? '');
  const named = BY_LENGTH.find((p) => c.includes(p));
  if (named) return named;
  const alias = CAMPUS_ALIASES.find(([re]) => re.test(c));
  if (alias) return alias[1];
  return UNI_MAIN_PROVINCE[universityId] ?? null;
}

export const regionOf = (province) => PROVINCE_REGION[province] ?? null;
