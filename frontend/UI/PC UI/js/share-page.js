/* PathFinder — shared result page (share.html?t=<token>): GET /share/:token, rendered as text only.
 * A file, not an inline <script>, so the page works under the backend's Content-Security-Policy. */
(function () {
  var KIND = {
    tcas: 'แผน TCAS', assessment: 'ผลแบบประเมินความถนัด', faculty: 'คณะที่แนะนำ', career: 'อาชีพที่แนะนำ',
    portfolio: 'ไอเดีย Portfolio', skill: 'แผนพัฒนาทักษะ', high_yield: 'บทที่ควรอ่านก่อน'
  };
  // keys that are plumbing, not content
  var SKIP = { id: 1, type: 1, kind: 1, created_at: 1, shared_at: 1, expires_at: 1, verify_note: 1, input_hash: 1, web_sources: 1, tcas_data: 1, cached: 1, fallback: 1 };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  // Thai headings for the keys AI results use most; anything else falls back to the key itself
  var LABEL = {
    subject: 'วิชา', chapters: 'บทที่ควรอ่าน', rank: 'อันดับ', chapter: 'บท', why_high_yield: 'ทำไมควรอ่านก่อน',
    exam_weight_note: 'สัดส่วนในข้อสอบ', study_hours: 'ชั่วโมงอ่านโดยประมาณ', how_to_study: 'วิธีอ่าน',
    practice_resources: 'แหล่งฝึก', summary: 'สรุป', reason: 'เหตุผล', reasons: 'เหตุผล', steps: 'ขั้นตอน',
    tips: 'คำแนะนำ', strengths: 'จุดแข็ง', weaknesses: 'จุดที่ควรพัฒนา', recommendations: 'คำแนะนำ',
    faculty: 'คณะ', university: 'มหาวิทยาลัย', program: 'หลักสูตร', round: 'รอบ', rounds: 'รอบ',
    careers: 'อาชีพ', skills: 'ทักษะ', resources: 'แหล่งเรียนรู้', timeline: 'ไทม์ไลน์', ideas: 'ไอเดีย'
  };
  function label(key) { return LABEL[key] || String(key).replace(/_/g, ' '); }

  // any JSON -> headings, lists and text (textContent only)
  function render(value, parent, depth) {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      if (value.every(function (v) { return typeof v !== 'object' || v === null; })) {
        var ul = el('ul');
        value.forEach(function (v) { ul.appendChild(el('li', '', String(v))); });
        parent.appendChild(ul);
      } else {
        value.forEach(function (v) {
          var card = el('div', 'card');
          render(v, card, depth + 1);
          parent.appendChild(card);
        });
      }
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        if (SKIP[k]) return;
        var v = value[k];
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
        if (typeof v === 'object') {
          parent.appendChild(el(depth === 0 ? 'h2' : 'p', depth === 0 ? '' : 'k', label(k)));
          render(v, parent, depth + 1);
        } else {
          var p = el('p');
          p.appendChild(el('span', 'k', label(k) + ': '));
          p.appendChild(document.createTextNode(String(v)));
          parent.appendChild(p);
        }
      });
      return;
    }
    parent.appendChild(el('p', '', String(value)));
  }

  var token = new URLSearchParams(location.search).get('t') || '';
  var titleEl = document.getElementById('title');
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) {
    titleEl.textContent = 'ลิงก์ไม่ถูกต้อง';
    return;
  }
  PF_API.request('/share/' + encodeURIComponent(token), { auth: false }).then(function (d) {
    titleEl.textContent = KIND[d.kind] || 'ผลที่แชร์';
    if (d.target && d.target.faculty) titleEl.textContent += ': ' + d.target.faculty + (d.target.university ? ' • ' + d.target.university : '');
    var when = function (iso) { return iso ? new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : ''; };
    document.getElementById('meta').textContent = 'สร้างเมื่อ ' + when(d.created_at) + (d.expires_at ? ' • ลิงก์หมดอายุ ' + when(d.expires_at) : '');
    var body = d.result || d.plan || d.interpretation || d;
    render(body, document.getElementById('content'), 0);
    if (d.verify_note) {
      var v = document.getElementById('verify');
      v.textContent = d.verify_note;
      v.hidden = false;
    }
  }).catch(function (err) {
    titleEl.textContent = err.status === 404 ? 'ลิงก์นี้หมดอายุหรือถูกยกเลิกแล้ว' : PF_API.errorText(err);
  });
})();
