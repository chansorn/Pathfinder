// Just enough of a .xlsx reader for the myTCAS stat files - first sheet, values only.
// An xlsx is a zip of XML files; node's zlib handles the deflate part, so no extra dependency.
import { inflateRawSync } from 'node:zlib';

function unzip(buf) {
  // find the "end of central directory" record (scan back from the end)
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    files.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }

  return (name) => {
    const f = files.get(name);
    if (!f) return null;
    const start = f.local + 30 + buf.readUInt16LE(f.local + 26) + buf.readUInt16LE(f.local + 28);
    const raw = buf.subarray(start, start + f.size);
    return (f.method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
  };
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const textOf = (xml) => decode([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/** rows of the first sheet as [{ A: 'value', B: ... }] (column letters as keys) */
export function readFirstSheet(buf) {
  const read = unzip(buf);
  const sharedXml = read('xl/sharedStrings.xml');
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  const sheet = read('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('no sheet1 in workbook');

  const rows = [];
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, inner = ''] = c;
      if (/t="inlineStr"/.test(attrs)) {
        row[col] = textOf(inner);
        continue;
      }
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (v == null) continue;
      row[col] = /t="s"/.test(attrs) ? shared[Number(v)] : decode(v);
    }
    rows.push(row);
  }
  return rows;
}
