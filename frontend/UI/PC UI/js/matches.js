/* =========================================================================
 * PathFinder — PF_MATCHES: Page 3 "คณะที่ใช่"
 *
 *   PF_MATCHES.load()     fetch the 5 best real programs for the current Step 1-3 answers (skips if unchanged)
 *   PF_MATCHES.refresh()  new results: AI pick when signed in, otherwise the next best from the rules
 *   PF_MATCHES.lock(id)   lock that program -> Page 4 TCAS plan for it
 *
 * Backend: POST /api/match/programs (public, no AI) · POST /api/match/programs/ai (login + AI quota)
 * Every card is a real myTCAS program; numbers come from the API, all text is escaped.
 * Load after js/api.js, js/state-i18n.js and js/discovery-matches.js.
 * ========================================================================= */
var PF_MATCHES = window.PF_MATCHES = (function () {
  var grid = document.getElementById('matches-grid');
  var statusEl = document.getElementById('matches-status');
  var noteEl = document.getElementById('matches-note');
  var refreshBtn = document.getElementById('matches-refresh-btn');

  var items = [];
  var shown = []; // every program id shown since the answers last changed (refresh skips them)
  var lastSig = null;
  var filter = 'all';
  var seq = 0;

  // hex colour blended with the card background (#FDFBF7): amount 0 = background, 1 = the colour
  function mix(hex, amount) {
    var c = parseInt(hex.slice(1), 16), bg = [0xFD, 0xFB, 0xF7];
    var rgb = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map(function (v, i) { return Math.round(bg[i] + (v - bg[i]) * amount); });
    return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  // university colours (myTCAS university_id) for the card border: CU pink, KU green, CMU purple, ...
  var UNI_COLORS = {
    '001': '#DE5C8E', // จุฬาฯ ชมพู
    '002': '#006664', // เกษตรศาสตร์ เขียว
    '003': '#A9442B', // ขอนแก่น สีอิฐ
    '004': '#6C3A93', // เชียงใหม่ ม่วง
    '005': '#C8102E', // ธรรมศาสตร์ แดง
    '006': '#1E3C78', // มหิดล น้ำเงิน
    '008': '#2A9D8F', // ศิลปากร เขียว
    '009': '#B5122B', // มศว แดง
    '010': '#0B3D91', // สงขลานครินทร์ น้ำเงิน
    '013': '#2E7D32', // แม่โจ้ เขียว
    '014': '#F37021', // มจธ. ส้ม
    '015': '#9E1B32', // มจพ. แดงเลือดหมู
    '016': '#E35205', // สจล. แสด
    '017': '#E8A317', // สุรนารี ทอง
    '019': '#C9A227', // บูรพา ทอง
    '020': '#E06F1F'  // นเรศวร แสด
  };

  // Step 3 chip codes -> how myTCAS writes the university (for the logo)
  var UNI_CODES = { cu: 'จุฬาลงกรณ์', kmutt: 'พระจอมเกล้าธนบุรี', tu: 'ธรรมศาสตร์', mu: 'มหิดล', ku: 'เกษตรศาสตร์', kmitl: 'พระจอมเกล้าเจ้าคุณทหารลาดกระบัง', cmu: 'เชียงใหม่', kku: 'ขอนแก่น', su: 'ศิลปากร', swu: 'ศรีนครินทรวิโรฒ' };

  function T(th, en) { return currentLang === 'th' ? th : en; }
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
  }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function setStatus(t) { if (statusEl) statusEl.textContent = t || ''; }
  function signedIn() { return !!(window.PF_AUTH && window.PF_AUTH.getCurrentUser()); }

  // only what the student actually set (same rule as the sync)
  function body() {
    var b = {
      interests: (PF_STATE.interests || []).slice(0, 4),
      beyond_4: !!PF_STATE.beyond400,
      target_universities: (PF_STATE.targetUnis || []).concat(PF_STATE.otherUnis || []).slice(0, 10)
    };
    if ((PF_STATE.targetFaculties || []).length) b.target_faculties = PF_STATE.targetFaculties.slice(0, 3);
    b.variety_seed = pfVarietySeed(); // same answers, different student -> not the identical list
    if (PF_STATE.province) b.province = PF_STATE.province;
    // Step 2 card shuffle: liked programs rank higher, skipped ones are left out
    var isId = function (v) { return /^[0-9a-f-]{36}$/i.test(String(v || '')); };
    var liked = (PF_STATE.acceptedMajors || []).filter(isId).slice(-100);
    var skipped = (PF_STATE.ignoredMajors || []).filter(isId).slice(-100);
    if (liked.length) b.liked_ids = liked;
    if (skipped.length) b.skipped_ids = skipped;
    if (PF_STATE.gpaxSet) b.gpax = Math.min(4, Math.max(0, Number(PF_STATE.gpax)));
    if (PF_STATE.hoursSet) b.weekly_hours = Math.min(80, Math.max(0, Number(PF_STATE.weeklyHours)));
    if ((PF_STATE.customInterestText || '').trim()) b.custom_text = String(PF_STATE.customInterestText).trim().slice(0, 500);
    return b;
  }

  // every university's logo is saved in img/logos/<myTCAS university_id>.png (from myTCAS);
  // a missing file falls back to the letter badge (see the error listener in render)
  function logoFor(c) {
    if (c.university_id && /^\d{3}$/.test(c.university_id)) return 'img/logos/' + c.university_id + '.png';
    var code = Object.keys(UNI_CODES).find(function (k) { return c.university.indexOf(UNI_CODES[k]) !== -1; });
    var img = code && document.querySelector('[data-uni-preload="' + code + '"]');
    return img ? img.getAttribute('src') : null;
  }

  // "วท.บ. สาขาวิชาวิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)" -> "วิทยาการคอมพิวเตอร์" + track "(ภาษาไทย ปกติ)"
  function splitProgram(name) {
    var track = (/\(([^()]*(?:ภาษา|นานาชาติ|พิเศษ|ปกติ)[^()]*)\)\s*$/.exec(name) || [])[1] || '';
    var core = name.replace(/\s*\([^()]*(?:ภาษา|นานาชาติ|พิเศษ|ปกติ)[^()]*\)\s*$/, '')
      .replace(/^หลักสูตร/, '')
      .replace(/^[ก-๙]{1,6}\.[ก-๙]{1,3}\.\s*/, '') // degree abbreviation: วท.บ. / วศ.บ.
      .replace(/^[ก-๙]+บัณฑิต\s*/, '') // full degree name: วิศวกรรมศาสตรบัณฑิต
      .replace(/^\([ก-๙]{1,6}\.[ก-๙.]{1,4}\)\s*/, '') // "(กศ.บ.) ..."
      .replace(/^(สาขาวิชา|สาขา)\s*/, '')
      .replace(/วิชาเอก\s*วิชาเอก/g, 'วิชาเอก') // myTCAS sometimes repeats the word
      .trim()
      .replace(/^\(([^()]+)\)$/, '$1'); // "วิทยาศาสตรบัณฑิต (สถิติและวิทยาการข้อมูล)" -> "สถิติและวิทยาการข้อมูล"
    return { core: core || name, track: track };
  }
  function shortSubject(s) { return pfSubjectLabel(s); }

  function cardHtml(c) {
    var name = splitProgram(c.program);
    var logo = logoFor(c);
    var locked = PF_STATE.lockedProgram && PF_STATE.lockedProgram.id === c.id;
    var rounds = c.rounds.map(function (r) {
      var on = r.projects > 0;
      return '<span class="px-2 py-0.5 rounded-full font-metric text-[11px] ' +
        (on ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface-variant/60 line-through') +
        '" title="' + esc(on ? T('รอบ ' + r.round + ': ' + r.projects + ' โครงการ', 'Round ' + r.round + ': ' + r.projects + ' project(s)') : T('ไม่เปิดรอบนี้', 'No projects')) + '">R' + r.round + (on ? ' ×' + r.projects : '') + '</span>';
    }).join('');
    var next = c.rounds.map(function (r) { return r.next_apply_end ? { round: r.round, d: r.next_apply_end } : null; }).filter(Boolean)
      .sort(function (a, b) { return a.d < b.d ? -1 : 1; })[0];
    var weights = c.weights
      ? c.weights.parts.slice(0, 3).map(function (p) { return esc(shortSubject(p.subject)) + ' ' + p.weight + '%'; }).join(' • ') + ' <span class="text-on-surface-variant">(' + T('รอบ ', 'R') + c.weights.round + ')</span>'
      : '<span class="text-on-surface-variant">' + T('myTCAS ไม่ได้ระบุ', 'Not listed on myTCAS') + '</span>';
    var ly = c.last_year;
    var lastYear = ly
      ? T('สมัคร ', '') + num(ly.applicants) + T(' • รับ ', ' applied • ') + num(ly.seats) + T('', ' seats') + (ly.lowest_min_score != null ? T(' • ต่ำสุด ', ' • lowest ') + Number(ly.lowest_min_score).toFixed(2) : '')
      : T('ยังไม่มีสถิติ', 'No stats yet');
    var reasons = (c.reasons || []).map(function (r) {
      return '<li class="flex items-start gap-1.5"><span class="material-symbols-outlined text-[15px] text-primary mt-0.5" aria-hidden="true">check</span><span>' + esc(T(r.th, r.en)) + '</span></li>';
    }).join('');

    // themed like the university: soft border, thick top edge and a faint tint of its colour
    var uniColor = UNI_COLORS[c.university_id] || '#6B9080';
    var themeStyle = 'border-color:' + mix(uniColor, 0.55) + ';border-top:4px solid ' + uniColor + ';' +
      'background:linear-gradient(155deg,' + mix(uniColor, 0.08) + ' 0%,#FDFBF7 62%,' + mix(uniColor, 0.05) + ' 100%);' +
      (locked ? 'box-shadow:0 0 0 3px ' + mix(uniColor, 0.35) + ';' : '');
    // "% ตรงกัน" as a thin bar in the university's colour (fills once when new results arrive)
    var pctBar = '<div class="h-1 w-full rounded-full bg-surface-container overflow-hidden" aria-hidden="true"><div data-pct-bar class="h-full rounded-full" style="width:' + Math.max(0, Math.min(100, Number(c.match_pct) || 0)) + '%;background:' + uniColor + ';"></div></div>';
    return '<article data-match-card="' + esc(c.id) + '" class="relative flex flex-col gap-gutter-md p-gutter-lg rounded-xl border shadow-sm" style="' + themeStyle + '">' +
      '<header class="flex items-start justify-between gap-gutter-sm">' +
        '<div class="flex flex-wrap items-center gap-1.5">' +
          '<span class="inline-flex items-center gap-1 px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-md tabular-nums"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">check_circle</span>' + T('ตรงกัน ', '') + c.match_pct + '%' + T('', ' match') + '</span>' +
          (c.main_public ? '<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label text-[11px]">' + T('มหาวิทยาลัยรัฐหลัก', 'Major public university') + '</span>' : '') +
          (c.target_university ? '<span class="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-[11px]">' + T('มหาวิทยาลัยที่คุณเลือก', 'Your pick') + '</span>' : '') +
        '</div>' +
        '<span class="relative w-12 h-12 shrink-0">' +
          '<span class="absolute inset-0 rounded-full bg-primary text-on-primary flex items-center justify-center font-title" aria-hidden="true">' + esc(c.university.replace(/^(มหาวิทยาลัย|สถาบัน)/, '').charAt(0)) + '</span>' +
          (logo ? '<img data-match-logo src="' + esc(logo) + '" alt="' + esc(c.university) + '" loading="lazy" class="absolute inset-0 w-12 h-12 rounded-full object-contain bg-white border border-outline-variant p-0.5">' : '') +
        '</span>' +
      '</header>' + pctBar +
      // what is recommended, spelled out: university -> faculty -> program (สาขา)
      '<div class="flex flex-col gap-1.5">' +
        '<p class="font-title text-title-md text-on-surface">' + esc(c.university) + (c.campus ? ' <span class="font-label text-label-md text-on-surface-variant">(' + esc(c.campus) + ')</span>' : '') + '</p>' +
        (c.province ? '<p class="inline-flex items-center gap-1 font-label text-label-sm ' + (c.near_home === 'province' || c.near_home === 'metro' ? 'text-primary font-semibold' : 'text-on-surface-variant') + '"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">location_on</span>' + esc(c.province) +
          (c.near_home === 'province' || c.near_home === 'metro' ? ' • ' + T('ใกล้บ้าน', 'Near you') : (c.near_home === 'region' ? ' • ' + T('ภาคเดียวกัน', 'Same region') : '')) + '</p>' : '') +
        '<dl class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-label text-label-md">' +
          '<dt class="text-on-surface-variant">' + T('คณะ', 'Faculty') + '</dt>' +
          '<dd class="text-on-surface">' + esc(c.faculty) + '</dd>' +
          '<dt class="text-on-surface-variant">' + T('สาขา', 'Program') + '</dt>' +
          '<dd><h2 class="font-title text-title-lg text-primary leading-snug line-clamp-3" title="' + esc(c.program) + '">' + esc(name.core) + '</h2>' +
            (name.track ? '<span class="text-on-surface-variant">' + esc(name.track) + '</span>' : '') + '</dd>' +
        '</dl>' +
      '</div>' +
      '<dl class="grid grid-cols-2 gap-2 text-label-sm">' +
        '<div class="p-2 rounded-lg bg-surface-container-low"><dt class="font-label text-on-surface-variant">' + T('เกณฑ์ GPAX', 'Min GPAX') + '</dt><dd class="font-metric text-on-surface">' + (c.min_gpax != null ? '≥ ' + Number(c.min_gpax).toFixed(2) : T('ไม่ระบุ', 'Not set')) + '</dd></div>' +
        '<div class="p-2 rounded-lg bg-surface-container-low"><dt class="font-label text-on-surface-variant">' + T('รอบที่เปิด (โครงการ)', 'Rounds (projects)') + '</dt><dd class="flex flex-wrap gap-1 mt-0.5">' + rounds + '</dd></div>' +
        '<div class="p-2 rounded-lg bg-surface-container-low col-span-2"><dt class="font-label text-on-surface-variant">' + T('ค่าน้ำหนักคะแนน', 'Score weights') + '</dt><dd class="font-metric text-on-surface">' + weights + '</dd></div>' +
        '<div class="p-2 rounded-lg bg-surface-container-low col-span-2"><dt class="font-label text-on-surface-variant">' + (ly ? T('สถิติปี ', 'Stats ') + ly.academic_year + T(' (ทปอ.)', ' (official)') : T('สถิติปีก่อน', 'Last year')) + '</dt><dd class="font-metric text-on-surface">' + lastYear + '</dd></div>' +
      '</dl>' +
      (next ? '<p class="font-label text-label-sm text-tertiary-text">' + T('ปิดรับใกล้สุด: รอบ ', 'Next deadline: Round ') + next.round + ' • ' + esc(fmtDate(next.d)) + '</p>' : '') +
      (c.ai_reason ? '<p class="flex items-start gap-1.5 p-2 rounded-lg bg-primary/5 font-body text-body-sm text-on-surface"><span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">auto_awesome</span><span>' + esc(c.ai_reason) + '</span></p>' : '') +
      '<ul class="flex flex-col gap-1 font-body text-body-sm text-on-surface-variant">' + reasons + '</ul>' +
      '<div class="mt-auto flex flex-wrap items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-outline-variant/60">' +
        (/^https:\/\/course\.mytcas\.com\//.test(c.url || '') ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-label text-label-sm text-primary hover:underline">' + T('รายละเอียดที่ myTCAS', 'Details on myTCAS') + '<span class="material-symbols-outlined text-[14px]" aria-hidden="true">open_in_new</span></a>' : '<span></span>') +
        '<span class="inline-flex items-center gap-gutter-xs">' +
        '<button type="button" data-match-save="' + esc(c.id) + '" aria-pressed="' + (isSaved(c.id) ? 'true' : 'false') + '" aria-label="' + esc(isSaved(c.id) ? T('เอาออกจากที่บันทึก', 'Remove from saved') : T('บันทึกหลักสูตรนี้', 'Save this program')) + '" class="w-9 h-9 rounded-full flex items-center justify-center border ' + (isSaved(c.id) ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-primary border-outline-variant hover:border-primary') + '">' +
          '<span class="material-symbols-outlined text-[18px]" style="font-variation-settings:\'FILL\' ' + (isSaved(c.id) ? 1 : 0) + ';" aria-hidden="true">favorite</span></button>' +
        '<button type="button" data-match-lock="' + esc(c.id) + '" class="inline-flex items-center gap-1 px-gutter-md py-2 rounded-full font-label text-label-md ' + (locked ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface border border-outline-variant hover:border-primary') + '">' +
          '<span class="material-symbols-outlined text-[16px]" aria-hidden="true">' + (locked ? 'lock' : 'lock_open') + '</span>' + (locked ? T('ล็อกแล้ว • ดูแผน', 'Locked • view plan') : T('ล็อกเส้นทางนี้', 'Lock this path')) +
        '</button></span>' +
      '</div>' +
    '</article>';
  }

  // ---- "เส้นทางอื่นๆ ที่คุณอาจสนใจ": ranks 6-10 for the same answers (the top 5 excluded) ----
  var moreItems = [];
  var moreSeq = 0;
  var moreBox = document.getElementById('matches-more');
  var moreGrid = document.getElementById('matches-more-grid');
  function moreCardHtml(c) {
    var name = splitProgram(c.program);
    var logo = logoFor(c);
    var locked = PF_STATE.lockedProgram && PF_STATE.lockedProgram.id === c.id;
    var uniColor = UNI_COLORS[c.university_id] || '#6B9080';
    var tag = c.target_university ? [T('มหาวิทยาลัยที่คุณเลือก', 'Your pick'), 'bg-tertiary-container text-on-tertiary-container']
      : (c.near_home === 'province' || c.near_home === 'metro') ? [T('ใกล้บ้าน', 'Near you'), 'bg-secondary-container text-on-secondary-container']
      : c.main_public ? [T('รัฐหลัก', 'Major public'), 'bg-primary/10 text-primary'] : null;
    var open = c.rounds.filter(function (r) { return r.projects > 0; }).map(function (r) { return r.round; });
    var w = c.weights ? c.weights.parts.slice(0, 2).map(function (p) { return shortSubject(p.subject) + ' ' + p.weight + '%'; }).join(' + ') : null;
    var facts = [
      open.length ? T('เปิดรอบ ', 'Rounds ') + open.join(', ') : T('ยังไม่มีโครงการ', 'No projects yet'),
      c.min_gpax != null ? 'GPAX ≥ ' + Number(c.min_gpax).toFixed(2) : null,
      w
    ].filter(Boolean).join(' • ');
    return '<article data-more-card="' + esc(c.id) + '" class="flex flex-col gap-gutter-xs p-gutter-md rounded-xl border bg-surface-container-lowest" style="border-color:' + mix(uniColor, 0.5) + ';border-top:3px solid ' + uniColor + ';">' +
      '<div class="flex items-start justify-between gap-2">' +
        '<div class="flex flex-wrap items-center gap-1">' +
          '<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + T('ตรงกัน ', '') + c.match_pct + '%</span>' +
          (tag ? '<span class="px-2 py-0.5 rounded-full font-label text-[11px] ' + tag[1] + '">' + esc(tag[0]) + '</span>' : '') +
        '</div>' +
        '<span class="relative w-9 h-9 shrink-0">' +
          '<span class="absolute inset-0 rounded-full bg-primary text-on-primary flex items-center justify-center font-title text-label-md" aria-hidden="true">' + esc(c.university.replace(/^(มหาวิทยาลัย|สถาบัน)/, '').charAt(0)) + '</span>' +
          (logo ? '<img data-match-logo src="' + esc(logo) + '" alt="' + esc(c.university) + '" loading="lazy" class="absolute inset-0 w-9 h-9 rounded-full object-contain bg-white border border-outline-variant p-0.5">' : '') +
        '</span>' +
      '</div>' +
      '<h3 class="font-title text-title-md text-on-surface leading-snug line-clamp-2" title="' + esc(c.program) + '">' + esc(name.core) + '</h3>' +
      '<p class="font-label text-label-sm text-on-surface-variant line-clamp-2">' + esc(c.university) + (c.campus ? ' (' + esc(c.campus) + ')' : '') + ' • ' + esc(c.faculty) + '</p>' +
      '<p class="p-2 rounded-lg bg-surface-container-low font-label text-[11px] text-on-surface-variant">' + esc(facts) + '</p>' +
      '<button type="button" data-more-lock="' + esc(c.id) + '" class="mt-auto inline-flex items-center justify-center gap-1 px-gutter-sm py-1.5 rounded-full font-label text-label-sm ' + (locked ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface border border-outline-variant hover:border-primary') + '">' +
        '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">' + (locked ? 'lock' : 'lock_open') + '</span>' + (locked ? T('ล็อกแล้ว • ดูแผน', 'Locked • view plan') : T('ล็อกเส้นทางนี้', 'Lock this path')) +
        '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span></button>' +
    '</article>';
  }
  function renderMore() {
    if (!moreBox || !moreGrid) return;
    moreBox.classList.toggle('hidden', !moreItems.length);
    if (!moreItems.length) return;
    var cnt = document.getElementById('matches-more-count');
    if (cnt) cnt.textContent = T('อีก ' + moreItems.length + ' ตัวเลือก', moreItems.length + ' more');
    moreGrid.innerHTML = moreItems.map(moreCardHtml).join('');
  }
  async function loadMore() {
    var my = ++moreSeq;
    if (!items.length) { moreItems = []; renderMore(); return; }
    // the next pages often repeat a top-5 university with another program: keep paging (max 4 calls)
    // until there are 5 universities not already in the top 5
    var unis = items.map(function (c) { return c.university; });
    var exclude = items.map(function (c) { return c.id; });
    var found = [];
    try {
      for (var page = 0; page < 4 && found.length < 5; page++) {
        var b = body();
        b.exclude_ids = exclude.concat(b.exclude_ids || []).slice(0, 60);
        b.limit = 8;
        var data = await PF_API.request('/match/programs', { method: 'POST', body: b, timeoutMs: 30000 });
        if (my !== moreSeq) return;
        var got = data.items || [];
        got.forEach(function (c) {
          exclude.push(c.id);
          if (unis.indexOf(c.university) === -1 && found.length < 5) { unis.push(c.university); found.push(c); }
        });
        if (!data.has_more || !got.length || exclude.length >= 60) break;
      }
      moreItems = found;
      renderMore();
      if (moreGrid && window.pfMotion) {
        moreGrid.querySelectorAll('[data-more-card]').forEach(function (el, i) { el.style.animationDelay = (i * 45) + 'ms'; el.classList.add('pf-rise'); });
      }
    } catch (e) {
      if (my !== moreSeq) return;
      moreItems = []; renderMore();
    }
  }
  if (moreGrid) {
    moreGrid.addEventListener('error', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-match-logo')) e.target.remove();
    }, true);
    moreGrid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-more-lock]') : null;
      if (!b) return;
      var id = b.getAttribute('data-more-lock');
      var c = moreItems.find(function (x) { return x.id === id; });
      if (c) lock(id, c);
    });
  }

  // ---- Card Shuffle view of the 5 results (follows Step 2 "รูปแบบการแสดงผลลัพธ์" = Card Shuffle) ----
  // one card at a time: drag up / "ถูกใจ" = save it (heart) and go on, drag down / "ถัดไป" = next.
  var deckIndex = 0;
  function view() { return PF_STATE.baselineMode === 'shuffle' ? 'deck' : 'grid'; }
  function syncViewButtons() {
    document.querySelectorAll('[data-match-view]').forEach(function (b) {
      var on = b.getAttribute('data-match-view') === view();
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('bg-primary', on);
      b.classList.toggle('text-on-primary', on);
      b.classList.toggle('text-on-surface-variant', !on);
    });
  }
  function renderDeck(list) {
    grid.className = 'flex flex-col items-center gap-gutter-md';
    if (deckIndex >= list.length) {
      grid.innerHTML = '<div class="w-full max-w-xl p-gutter-xl rounded-xl bg-surface-container-low border border-outline-variant flex flex-col items-center gap-gutter-sm text-center">' +
        '<span class="material-symbols-outlined text-[32px] text-primary" aria-hidden="true">style</span>' +
        '<p class="font-body text-body-md text-on-surface">' + T('ดูครบทั้ง ' + list.length + ' อันดับแล้ว • ที่กดถูกใจอยู่ในหลักสูตรที่บันทึกไว้ด้านล่าง', 'You have seen all ' + list.length + ' • liked ones are in Saved programs below') + '</p>' +
        '<div class="flex flex-wrap justify-center gap-gutter-xs">' +
          '<button type="button" data-p3deck="restart" class="px-gutter-md py-2 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-md">' + T('ดูอีกรอบ', 'See again') + '</button>' +
          '<button type="button" data-p3deck="more" class="px-gutter-md py-2 rounded-full bg-primary text-on-primary font-label text-label-md">' + T('หาผลลัพธ์ใหม่', 'Find new matches') + '</button>' +
        '</div></div>';
      return;
    }
    var c = list[deckIndex];
    grid.innerHTML =
      '<p class="font-label text-label-md text-on-surface-variant">' + T('อันดับ ', 'Match ') + (deckIndex + 1) + ' / ' + list.length + ' • ' + T('ลากขึ้น = ถูกใจ (บันทึก) • ลากลง = ถัดไป', 'drag ↑ like (save) • drag ↓ next') + '</p>' +
      '<div id="p3-deck-card" class="w-full max-w-xl touch-none select-none transition-transform duration-200">' + cardHtml(c) + '</div>' +
      '<div class="flex items-center gap-gutter-sm">' +
        '<button type="button" data-p3deck="prev" class="w-10 h-10 rounded-full border border-outline-variant bg-surface-container-lowest flex items-center justify-center disabled:opacity-40"' + (deckIndex === 0 ? ' disabled' : '') + ' aria-label="' + T('ก่อนหน้า', 'Previous') + '"><span class="material-symbols-outlined text-[20px]" aria-hidden="true">undo</span></button>' +
        '<button type="button" data-p3deck="next" class="inline-flex items-center gap-1 px-gutter-lg py-2 rounded-full bg-tertiary-container text-on-tertiary-container border border-outline-variant font-label text-label-md"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_downward</span>' + T('ถัดไป', 'Next') + '</button>' +
        '<button type="button" data-p3deck="like" class="inline-flex items-center gap-1 px-gutter-lg py-2 rounded-full bg-primary text-on-primary font-label text-label-md"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">favorite</span>' + T('ถูกใจ', 'Like') + '</button>' +
      '</div>';
    attachP3Drag(c);
    if (deckEnter && window.pfMotion) window.pfMotion(document.getElementById('p3-deck-card'), 'pf-deck-in');
    deckEnter = false;
  }
  var deckEnter = false;
  function deckStep(dir) {
    var card = document.getElementById('p3-deck-card');
    var list = filtered();
    var c = list[deckIndex];
    if (card) { card.style.transition = 'transform 180ms ease-in, opacity 180ms ease-in'; card.style.transform = 'translateY(' + (dir === 'like' ? '-120%' : '120%') + ')'; card.style.opacity = '0'; }
    setTimeout(function () {
      deckIndex++;
      deckEnter = true; // the next card moves up into place (renderDeck)
      // saving re-renders, so do it after moving on (keeps the fly-away animation)
      if (dir === 'like' && c && !isSaved(c.id)) toggleSave(c.id);
      else render();
    }, 180);
  }
  function attachP3Drag() {
    var card = document.getElementById('p3-deck-card');
    if (!card) return;
    var startY = 0, dy = 0, dragging = false;
    card.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a, button')) return;
      dragging = true; startY = e.clientY; dy = 0;
      card.style.transition = 'none';
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dy = e.clientY - startY;
      card.style.transform = 'translateY(' + Math.max(-160, Math.min(160, dy)) + 'px) rotate(' + (dy * 0.02) + 'deg)';
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      card.style.transition = '';
      if (dy < -80) deckStep('like');
      else if (dy > 80) deckStep('next');
      else card.style.transform = '';
    }
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }
  function filtered() {
    return items.filter(function (c) {
      if (filter === 'target') return c.target_university;
      if (filter === 'portfolio') return c.rounds[0] && c.rounds[0].projects > 0;
      return true;
    });
  }

  function render() {
    if (!grid) return;
    renderMore(); // lock state / language follow the main list
    var list = filtered();
    syncViewButtons();
    if (!items.length) return;
    if (view() === 'deck' && list.length) { renderDeck(list); return; }
    grid.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter-lg';
    grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<p class="md:col-span-2 xl:col-span-3 p-gutter-lg rounded-xl bg-surface-container-low font-body text-body-md text-on-surface-variant">' +
          T('ไม่มีผลลัพธ์ในตัวกรองนี้ ลองกด "ทั้งหมด"', 'Nothing in this filter. Try "All".') + '</p>';
    // new results (not a heart / lock re-render): cards come in by rank, bars fill (css/transitions.css 2.10)
    var sig = list.map(function (c) { return c.id; }).join(',');
    if (sig !== lastGridSig) {
      grid.querySelectorAll('[data-match-card]').forEach(function (el, i) {
        el.style.animationDelay = (i * 45) + 'ms';
        el.classList.add('pf-rise');
        var bar = el.querySelector('[data-pct-bar]');
        if (bar) { bar.style.animationDelay = (220 + i * 45) + 'ms'; bar.classList.add('pf-bar-grow'); }
      });
    }
    lastGridSig = sig;
    if (justLocked) {
      var ic = grid.querySelector('[data-match-lock="' + justLocked + '"] .material-symbols-outlined');
      if (ic && window.pfMotion) window.pfMotion(ic, 'pf-lock-shut');
      justLocked = null;
    }
  }
  var lastGridSig = '';
  var justLocked = null;

  function emptyState(th, en, withButton) {
    if (!grid) return;
    items = [];
    grid.innerHTML = '<div class="md:col-span-2 xl:col-span-3 p-gutter-xl rounded-xl bg-surface-container-low flex flex-col items-center gap-gutter-sm text-center">' +
      '<span class="material-symbols-outlined text-[32px] text-primary" aria-hidden="true">travel_explore</span>' +
      '<p class="font-body text-body-md text-on-surface max-w-md">' + esc(T(th, en)) + '</p>' +
      (withButton ? '<button type="button" data-go-page="2" class="px-gutter-lg py-2 rounded-full bg-primary text-on-primary font-label text-label-md">' + T('ไปกรอกความสนใจ', 'Fill in your interests') + '</button>' : '') +
    '</div>';
  }

  function skeleton() {
    if (!grid) return;
    grid.innerHTML = [0, 1, 2, 3, 4].map(function () {
      return '<div class="h-80 rounded-xl bg-surface-container-low animate-pulse" aria-hidden="true"></div>';
    }).join('');
  }

  async function fetchMatches(opts) {
    var my = ++seq;
    var b = body();
    if (!b.interests.length) {
      emptyState('เลือกความสนใจในขั้นที่ 1 ก่อน แล้วระบบจะจับคู่มหาวิทยาลัยและสาขาจริงจาก myTCAS ให้', 'Pick your interests in Step 1 first and we will match real myTCAS programs for you.', true);
      setStatus('');
      return;
    }
    var useAi = opts && opts.ai && signedIn();
    if (opts && opts.exclude) b.exclude_ids = shown.slice(-60);
    if (!opts || !opts.keep) skeleton();
    if (refreshBtn) refreshBtn.disabled = true;
    setStatus(useAi ? T('AI กำลังเลือกผลลัพธ์ใหม่…', 'AI is picking new matches…') : T('กำลังจับคู่จากข้อมูล myTCAS…', 'Matching against myTCAS data…'));
    try {
      var data = await PF_API.request(useAi ? '/match/programs/ai' : '/match/programs', { method: 'POST', auth: useAi ? true : undefined, body: b, timeoutMs: useAi ? 90000 : 30000 });
      if (my !== seq) return;
      if (!data.items.length) {
        if (opts && opts.exclude) {
          setStatus(T('ไม่มีผลลัพธ์ใหม่แล้ว เริ่มจากอันดับแรกอีกครั้ง', 'No more new matches, starting over from the top'));
          shown = [];
          return fetchMatches({ keep: true });
        }
        emptyState('ยังไม่พบหลักสูตรที่ตรงกับความสนใจและ GPAX ที่เลือก ลองเพิ่มความสนใจหรือแก้ GPAX ในขั้นที่ 1-2', 'No program fits these interests and GPAX yet. Try adding interests or adjusting GPAX.', true);
        setStatus('');
        return;
      }
      items = data.items;
      deckIndex = 0;
      // picked universities with no program for these interests: say so instead of silently leaving them out
      var missing = (data.targets_without_match || []).map(function (t) {
        var chip = document.querySelector('[data-uni-key="' + String(t).toLowerCase() + '"]');
        return chip ? chip.textContent.trim() : String(t);
      });
      var missingEl = document.getElementById('matches-missing');
      if (missingEl) {
        missingEl.classList.toggle('hidden', !missing.length);
        missingEl.textContent = missing.length
          ? T('ยังไม่พบสาขาที่ตรงกับความสนใจของคุณใน: ' + missing.join(', ') + ' • ลองเพิ่มความสนใจในขั้นที่ 1 หรือตรวจชื่อมหาวิทยาลัยที่พิมพ์',
              'No program matching your interests at: ' + missing.join(', ') + ' • try adding interests in Step 1 or check the typed name')
          : '';
      }
      items.forEach(function (c) { if (shown.indexOf(c.id) === -1) shown.push(c.id); });
      render();
      loadMore();
      if (window.PF_HERO) window.PF_HERO.refresh();
      var msg = '';
      if (data.method === 'ai') msg = T('AI เลือกให้จากหลักสูตรจริงที่ตรงกับคุณ', 'AI picked these from real programs that fit you');
      else if (data.ai_fallback) msg = T('AI ไม่ว่างตอนนี้ แสดงอันดับถัดไปจากระบบแทน', 'AI is unavailable right now, showing the next best instead');
      else if (opts && opts.exclude && !signedIn()) msg = T('แสดงอันดับถัดไป • เข้าสู่ระบบเพื่อให้ AI ช่วยเลือก', 'Showing the next best • sign in to let AI pick');
      setStatus(msg);
      if (noteEl) noteEl.textContent = T(
        'ข้อมูลหลักสูตร เกณฑ์ และสถิติ: myTCAS / ทปอ. ปีการศึกษา ' + (data.academic_year || '') + ' • % ความตรงคิดจากคำตอบของคุณ ไม่ใช่โอกาสติด • ตรวจสอบประกาศล่าสุดที่ mytcas.com',
        'Programs, criteria and stats: myTCAS / official TCAS ' + (data.academic_year || '') + ' • the match % comes from your answers, not a chance of admission • check mytcas.com for the latest'
      );
    } catch (err) {
      if (my !== seq) return;
      if (!items.length) emptyState(PF_API.errorText(err), PF_API.errorText(err), false);
      setStatus(PF_API.errorText(err));
    } finally {
      if (my === seq && refreshBtn) refreshBtn.disabled = false;
    }
  }

  function load() {
    renderSaved();
    syncSaved();
    var sig = JSON.stringify(body());
    if (sig === lastSig && items.length) { render(); return; }
    lastSig = sig;
    shown = [];
    fetchMatches();
  }

  function refresh() {
    lastSig = JSON.stringify(body());
    fetchMatches({ ai: true, exclude: true });
  }

  // the interest bubbles each catalog roadmap template was written for (Page 4 task list until real tasks load)
  var TEMPLATE_OF_INTEREST = { 'tech-ai': '1', robotics: '5', 'data-research': '5', 'product-ux': '3', 'arch-design': '3', business: '4', 'finance-quant': '4', 'law-policy': '4', media: '6', 'game-interactive': '6', 'global-lang': '2', 'psych-edtech': '2', healthcare: '5', 'bio-env': '5' };
  var SIM_GROUP_RULES = [
    [/แพทยศาสตรบัณฑิต/, 'med'], [/วิศวกรรมคอมพิวเตอร์/, 'comp-eng'], [/บริหารธุรกิจ|BBA/, 'bba'],
    [/สถาปัตยกรรม|ออกแบบ/, 'arch-ux'], [/นิเทศ|วารสาร|สื่อสารมวลชน/, 'comm-arts'], [/นิติศาสตร/, 'law']
  ];

  // ---- 8. saved programs (heart). Signed in: /api/saved-programs; guest: this device until they sign in ----
  var savedSyncedFor = null;
  var savedList = document.getElementById('saved-programs-list');
  function saved() { return Array.isArray(PF_STATE.savedPrograms) ? PF_STATE.savedPrograms : (PF_STATE.savedPrograms = []); }
  function isSaved(id) { return saved().some(function (x) { return x.id === id; }); }
  function persist() { if (typeof window.savePFState === 'function') window.savePFState(); }

  function renderSaved() {
    var box = document.getElementById('saved-programs');
    if (!box || !savedList) return;
    var list = saved();
    box.classList.toggle('hidden', !list.length);
    var note = document.getElementById('saved-programs-note');
    if (note) note.textContent = signedIn() ? T('เก็บไว้ในบัญชี', 'Kept in your account') : T('เก็บไว้ในเครื่องนี้ • เข้าสู่ระบบเพื่อเก็บในบัญชี', 'On this device • sign in to keep it in your account');
    savedList.innerHTML = list.map(function (x) {
      return '<li class="flex flex-wrap items-center gap-gutter-sm p-2.5 rounded-lg bg-surface-container-low border border-outline-variant">' +
        '<span class="flex flex-col min-w-0 flex-1">' +
          '<span class="font-label text-label-md text-on-surface truncate">' + esc(x.university) + '</span>' +
          '<span class="font-label text-label-sm text-on-surface-variant truncate" title="' + esc(x.program) + '">' + esc(splitProgram(x.program || '').core) + '</span>' +
        '</span>' +
        '<button type="button" data-saved-lock="' + esc(x.id) + '" class="px-gutter-sm py-1 rounded-full bg-primary text-on-primary font-label text-label-sm">' + T('ล็อกเส้นทาง', 'Lock path') + '</button>' +
        '<button type="button" data-saved-remove="' + esc(x.id) + '" class="px-gutter-sm py-1 rounded-full border border-outline-variant font-label text-label-sm text-on-surface-variant hover:text-on-surface">' + T('เอาออก', 'Remove') + '</button>' +
      '</li>';
    }).join('');
  }

  async function toggleSave(id) {
    var c = items.find(function (x) { return x.id === id; }) || saved().find(function (x) { return x.id === id; });
    if (!c) return;
    var on = !isSaved(id);
    if (on) saved().unshift({ id: c.id, university: c.university, faculty: c.faculty, program: c.program, campus: c.campus || null });
    else PF_STATE.savedPrograms = saved().filter(function (x) { return x.id !== id; });
    PF_STATE.savedPrograms = saved().slice(0, 50);
    persist();
    render();
    renderSaved();
    if (window.PF_AUTH) window.PF_AUTH.showToast(on ? 'บันทึกหลักสูตรแล้ว' : 'เอาออกจากที่บันทึกแล้ว', on ? 'Program saved' : 'Removed from saved');
    if (!signedIn()) return;
    try {
      if (on) await PF_API.request('/saved-programs', { method: 'POST', auth: true, body: { program_id: id } });
      else await PF_API.request('/saved-programs/' + encodeURIComponent(id), { method: 'DELETE', auth: true });
    } catch (err) {
      if (window.PF_AUTH) window.PF_AUTH.showToast(PF_API.errorText(err), PF_API.errorText(err));
    }
  }

  // first time we see this account: its saved list + whatever was saved on this device as a guest
  async function syncSaved() {
    var user = window.PF_AUTH && window.PF_AUTH.getCurrentUser();
    var uid = user ? String(user.userId || '') : null;
    if (!uid || savedSyncedFor === uid) return;
    savedSyncedFor = uid;
    try {
      var server = await PF_API.request('/saved-programs', { auth: true });
      var rows = Array.isArray(server) ? server : (server && server.items) || [];
      var serverIds = rows.map(function (r) { return r.program_id; });
      var localOnly = saved().filter(function (x) { return serverIds.indexOf(x.id) === -1; });
      var merged = rows.filter(function (r) { return r.program; }).map(function (r) {
        return { id: r.program_id, university: r.program.university, faculty: r.program.faculty, program: r.program.program, campus: r.program.campus || null };
      });
      PF_STATE.savedPrograms = localOnly.concat(merged).slice(0, 50);
      persist();
      for (var i = 0; i < localOnly.length; i++) {
        await PF_API.request('/saved-programs', { method: 'POST', auth: true, body: { program_id: localOnly[i].id } }).catch(function () {});
      }
    } catch (e) { savedSyncedFor = null; }
    render();
    renderSaved();
  }

  // given: a card from elsewhere (AI coach guidance) that isn't in this page's list
  function lock(id, given) {
    var c = items.find(function (x) { return x.id === id; }) || saved().find(function (x) { return x.id === id; }) || given;
    if (!c) return;
    var majorId = TEMPLATE_OF_INTEREST[(c.matched_interests || [])[0] || (PF_STATE.interests || [])[0]] || '1';
    PF_STATE.lockedProgram = { id: c.id, university: c.university, faculty: c.faculty, program: c.program, campus: c.campus || null };
    PF_STATE.rmRank1Id = c.id;
    PF_STATE.lockedMajorId = majorId;
    PF_STATE.rmPrograms = PF_STATE.rmPrograms || {};
    PF_STATE.rmPrograms[majorId] = c.id;
    PF_STATE.lockedMatchPct = c.match_pct ? c.match_pct + '%' : null;
    var rule = SIM_GROUP_RULES.find(function (r) { return r[0].test(c.program); });
    if (rule) { PF_STATE.simFacultyKey = rule[1]; PF_STATE.simProgramId = c.id; }
    if (typeof window.savePFState === 'function') window.savePFState();
    if (window.PF_SYNC) window.PF_SYNC.schedule();
    justLocked = c.id; // the shackle shuts on the re-rendered button
    render();
    if (window.PF_HERO) window.PF_HERO.refresh();
    if (typeof window.renderRoadmap === 'function') window.renderRoadmap(majorId);
    setTimeout(function () { goToPage('4'); }, window.pfReducedMotion && window.pfReducedMotion() ? 0 : 420);
  }

  if (grid) {
    grid.addEventListener('error', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-match-logo')) e.target.remove();
    }, true);
    grid.addEventListener('click', function (e) {
      var sv = e.target.closest ? e.target.closest('[data-match-save]') : null;
      if (sv) { toggleSave(sv.getAttribute('data-match-save')); return; }
      var b = e.target.closest ? e.target.closest('[data-match-lock]') : null;
      if (b) lock(b.getAttribute('data-match-lock'));
    });
  }
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);
  if (grid) {
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-p3deck]') : null;
      if (!b) return;
      var a = b.getAttribute('data-p3deck');
      if (a === 'like' || a === 'next') deckStep(a);
      else if (a === 'prev') { deckIndex = Math.max(0, deckIndex - 1); render(); }
      else if (a === 'restart') { deckIndex = 0; render(); }
      else if (a === 'more') refresh();
    });
  }
  document.querySelectorAll('[data-match-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      PF_STATE.baselineMode = b.getAttribute('data-match-view') === 'deck' ? 'shuffle' : 'university';
      deckIndex = 0;
      // the same choice drives the Step 2 preview: keep its buttons in step
      if (window.PF_DECK && typeof window.PF_DECK.setMode === 'function') window.PF_DECK.setMode(PF_STATE.baselineMode);
      if (typeof window.savePFState === 'function') window.savePFState();
      render();
    });
  });
  if (savedList) {
    savedList.addEventListener('click', function (e) {
      var l = e.target.closest('[data-saved-lock]');
      if (l) { lock(l.getAttribute('data-saved-lock')); return; }
      var r = e.target.closest('[data-saved-remove]');
      if (r) toggleSave(r.getAttribute('data-saved-remove'));
    });
  }
  document.querySelectorAll('[data-match-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.getAttribute('data-match-filter');
      document.querySelectorAll('[data-match-filter]').forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle('bg-primary', on);
        b.classList.toggle('text-on-primary', on);
        b.classList.toggle('bg-surface-container-low', !on);
        b.classList.toggle('text-on-surface', !on);
      });
      render();
    });
  });

  return { load: load, refresh: refresh, lock: lock, render: render, items: function () { return items.slice(); }, requestBody: function () { return body(); } };
})();
