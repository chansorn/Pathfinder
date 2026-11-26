// Tiny iCalendar (RFC 5545) writer - all-day events only, which is all TCAS dates are.

const escape = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// lines over 75 bytes get folded (CRLF + space). count bytes, not chars - Thai is 3 bytes each
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const day = (iso) => iso.replaceAll('-', '');
const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * events: [{ uid, title, start: 'YYYY-MM-DD', end?: 'YYYY-MM-DD' (inclusive), description?, url? }]
 */
export function buildIcs(name, events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PathFinder//TCAS//TH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(name)}`,
    'X-WR-TIMEZONE:Asia/Bangkok',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@pathfinder`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(e.start)}`,
      // DTEND is exclusive for all-day events
      `DTEND;VALUE=DATE:${day(nextDay(e.end ?? e.start))}`,
      `SUMMARY:${escape(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
