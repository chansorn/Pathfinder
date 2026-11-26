// student data appended as JSON. study info + interests only, no name/email/school
export const studentBlock = (student) =>
  `ข้อมูลของน้อง (JSON):\n\`\`\`json\n${JSON.stringify(student, null, 2)}\n\`\`\``;

/**
 * TCAS facts from our own db (see tcas.service buildTcasContext) + whether web search is on.
 * The wording here matters: it's what lets the model quote real numbers instead of hedging.
 */
export function tcasBlock(tcas, { webSearch = false } = {}) {
  const parts = [];

  if (!tcas) {
    parts.push('ระบบยังไม่มีข้อมูล TCAS ในฐานข้อมูล');
  } else {
    const { academic_year, calendar_year, programs, calendar } = tcas;
    parts.push(
      `ข้อมูล TCAS จากฐานข้อมูลของระบบ (ปีการศึกษา ${academic_year}) เชื่อถือได้ ใช้ตัวเลขจากตรงนี้ได้ โดยบอกว่าเป็นข้อมูลปี ${academic_year}:`,
    );
    parts.push(
      programs.length
        ? `หลักสูตรที่เกี่ยวข้อง:\n\`\`\`json\n${JSON.stringify(programs, null, 2)}\n\`\`\``
        : 'ไม่พบหลักสูตรที่ตรงกับเป้าหมายของน้องในฐานข้อมูล',
    );
    if (programs.length && !programs.some((p) => p.admissions.length)) {
      parts.push('หลักสูตรเหล่านี้ยังไม่มีข้อมูลเกณฑ์รายรอบในฐานข้อมูล (มีแค่ชื่อหลักสูตรและค่าเทอม)');
    }
    if (calendar.length) {
      parts.push(`ปฏิทิน TCAS (ปีการศึกษา ${calendar_year ?? academic_year}):\n\`\`\`json\n${JSON.stringify(calendar, null, 2)}\n\`\`\``);
    }
  }

  parts.push(
    webSearch
      ? 'สิ่งที่ฐานข้อมูลไม่มี ให้ค้นจากเว็บ (เน้น mytcas.com และเว็บไซต์ทางการของมหาวิทยาลัย) และใช้เฉพาะข้อมูลของปีการศึกษาล่าสุด'
      : 'สิ่งที่ฐานข้อมูลไม่มี ห้ามเดาตัวเลข ให้แนะนำน้องไปเช็กที่ mytcas.com',
  );
  return parts.join('\n\n');
}
