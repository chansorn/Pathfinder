/* =========================================================================
 * PathFinder — TCAS Roadmap (Page 4)
 * Section 4.5: /api/my-plan with local fallback, personalized per-round tasks, central calendar, Waypoint & Full Plan drawers, reroute modal.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js
 *
 * Depends on : data/catalog.js, js/state-i18n.js, js/discovery-matches.js
 * Provides   : PF_PLAN_STORAGE_KEY, PF_PLAN_LOCAL, savePlanLocal, renderRoadmap, openWaypointDrawer, closeWaypointDrawer, activateRmTab, updateProgress, buildPersonalizedRoundTasks
 * ========================================================================= */

/* =========================================================================
 * TCAS ROADMAP CONTROLLER (/api/my-plan + Guest localStorage + Full Plan)
 * ========================================================================= */
/* [JS 4.5] Page 4 Engine: TCAS Roadmap (/api/my-plan, Personalized Tasks, Drawers) */
var PF_PLAN_STORAGE_KEY = 'pf_my_plan_v1';
var PF_PLAN_LOCAL = (function () {
  try {
    var raw = localStorage.getItem(PF_PLAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { hiddenOptional: {}, customItems: [], viewMode: 'personal', loadedOnce: false };
  } catch (e) { return { hiddenOptional: {}, customItems: [], viewMode: 'personal', loadedOnce: false }; }
})();
// text that can come from the student (custom tasks, keywords) or contain quotes -> safe in HTML/attributes
function rmEsc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// account the roadmap was last hydrated for (not persisted: every login / reload checks the server again)
var rmHydratedFor = null;

function savePlanLocal() {
  try { localStorage.setItem(PF_PLAN_STORAGE_KEY, JSON.stringify(PF_PLAN_LOCAL)); } catch (e) {}
}

// central TCAS calendar from GET /tcas/calendar (js/roadmap-real.js)
function renderCentralCalendar() {
  if (window.PF_RM_REAL) window.PF_RM_REAL.central();
}

function updateProgress() {
  var checks = document.querySelectorAll('#rm-personal-view [data-waypoint-check]');
  var done = 0;
  checks.forEach(function (c) {
    var key = c.getAttribute('data-wp-key');
    if (key) PF_STATE.checkedWaypoints[key] = !!c.checked;
    if (c.checked) done++;
  });
  var total = checks.length;
  var pct = total ? Math.round((done / total) * 100) : 0;
  var pctEl = document.getElementById('readiness-pct');
  var barEl = document.getElementById('readiness-bar');
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';

  var footerEl = document.getElementById('rm-progress-footer');
  if (footerEl) {
    var paceTh = pct >= 40 ? 'จังหวะกำลังดี' : (pct >= 20 ? 'เริ่มช้า' : 'เร่งด่วน');
    var paceEn = pct >= 40 ? 'Good pace' : (pct >= 20 ? 'Starting slow' : 'Urgent');
    footerEl.textContent = currentLang === 'th'
      ? ('ทำเสร็จแล้ว ' + done + ' จาก ' + total + ' เป้าหมาย • ' + paceTh)
      : ('Completed ' + done + ' of ' + total + ' goals • ' + paceEn);
  }

  ['r1', 'r2', 'r3', 'r4'].forEach(function (r) {
    var panel = document.querySelector('[data-rm-panel="' + r + '"]');
    var badge = document.querySelector('[data-rm-count="' + r + '"]');
    if (!panel || !badge) return;
    var rChecks = panel.querySelectorAll('[data-waypoint-check]');
    var rDone = 0;
    rChecks.forEach(function (c) { if (c.checked) rDone++; });
    badge.textContent = rDone + '/' + rChecks.length;
  });
}

// apply / results / confirm dates of one round, from the real calendar (js/roadmap-real.js)
function renderRoundDatesBar(roundId) {
  if (window.PF_RM_REAL) window.PF_RM_REAL.datesBar(roundId);
}

/* Interest & Website-Behavior Personalized Round Work Generator */

function buildPersonalizedRoundTasks(id, r, data) {
  // the locked real program's tasks (myTCAS projects, documents, exam weights, official dates) when loaded;
  // the sample tasks below only show while it loads or if it can't be loaded
  var real = window.PF_RM_REAL && typeof window.PF_RM_REAL.tasksFor === 'function' ? window.PF_RM_REAL.tasksFor(id, r) : null;
  var baseTasks = real || (data.rounds[r] || []).map(function (t, idx) {
    return Object.assign({}, t, {
      _idx: idx,
      _key: id + '-' + r + '-' + idx,
      tier: t.tier || (idx === 0 ? 'required' : 'recommended'),
      overdue: !!t.overdue,
      sourceKind: 'core'
    });
  });

  var extraTasks = [];
  // 1) Tasks generated from user's selected interests (Page 2)
  var interests = Array.isArray(PF_STATE.interests) ? PF_STATE.interests : [];
  interests.slice(0, 3).forEach(function (ik) {
    var iw = PF_INTEREST_ROUND_WORK[ik];
    if (iw && iw[r]) {
      var tpl = iw[r];
      extraTasks.push(Object.assign({}, tpl, {
        _idx: 100 + extraTasks.length,
        _key: id + '-' + r + '-int-' + ik,
        tier: 'recommended',
        sourceKind: 'interest',
        sourceLabelTh: 'จากความสนใจ: ' + iw.labelTh,
        sourceLabelEn: 'Interest: ' + iw.labelEn
      }));
    }
  });

  // Custom interest keyword from Page 2
  var customKw = (PF_STATE.customInterestText || '').trim();
  if (customKw && r === 'r1') {
    extraTasks.push({
      _idx: 150,
      _key: id + '-r1-customkw',
      tier: 'recommended',
      sourceKind: 'interest',
      sourceLabelTh: 'ความสนใจที่พิมพ์เอง',
      sourceLabelEn: 'Custom Interest',
      dateTh: 'ธ.ค.', dateEn: 'Dec', tag: customKw.slice(0, 18),
      titleTh: 'เชื่อมโยงความสนใจ "' + customKw + '" เข้ากับโปรเจกต์ใน Portfolio',
      titleEn: 'Connect "' + customKw + '" into a Portfolio Mini-Project',
      descTh: 'อธิบายว่าความถนัดเฉพาะตัวนี้ช่วยแก้ปัญหาในสาขาเป้าหมายอย่างไร',
      descEn: 'Show how this unique interest solves a real problem in your target field',
      deliverableTh: 'หน้าสรุปโปรเจกต์ 1–2 หน้า', deliverableEn: '1–2 Page Project Feature', estHours: 2,
      stepsTh: ['นิยามโจทย์ที่เชื่อม ' + customKw + ' กับคณะเป้าหมาย', 'ใส่ภาพตัวอย่างงานหรือแนวคิดต้นแบบ 1 ชิ้น'],
      stepsEn: ['Frame a problem connecting ' + customKw + ' to your target major', 'Add 1 concrete prototype or visual artifact'],
      toolsTh: 'Portfolio PDF • Figma / Canva', toolsEn: 'Portfolio PDF • Figma / Canva'
    });
  }

  // 2) Tasks generated from user's website behavior (visited Simulator, GPAX, Target Unis, Liked Majors, Beyond 4.00)
  var visited = (PF_STATE.behavior && PF_STATE.behavior.visitedPages) || [];
  if (visited.indexOf('5') !== -1 && r === 'r3') {
    extraTasks.push({
      _idx: 201,
      _key: id + '-r3-beh-sim',
      tier: 'required',
      sourceKind: 'behavior',
      sourceLabelTh: 'จากพฤติกรรม: จำลองคะแนน',
      sourceLabelEn: 'Activity: Score Simulator',
      dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'Score Gap Plan',
      titleTh: 'ปิดช่องว่างคะแนนสอบตามผลจำลองหน้า Score Simulator (+4 คะแนน)',
      titleEn: 'Close Your Simulated Score Gap (+4 pts in Top-Weight Exam)',
      descTh: 'คุณได้ทดลองคำนวณคะแนนแล้ว — โฟกัสวิชาที่น้ำหนัก 30–40% เพื่อดันโซนปลอดภัย',
      descEn: 'Based on your Score Simulator check, focus on your 30–40% weight subject first',
      deliverableTh: 'ตารางเก็บคะแนนรายสัปดาห์ 4 สัปดาห์', deliverableEn: '4-Week Score Gain Tracker', estHours: 4,
      stepsTh: ['เปิดหน้า Score Simulator เพื่อเช็กวิชาที่เพิ่ม 1 คะแนนแล้วคุ้มสุด', 'จัดเวลาฝึกเพิ่มสัปดาห์ละ 2 ชม. ในวิชานั้น', 'อัปเดตคะแนนจำลองทุกวันอาทิตย์'],
      stepsEn: ['Check highest-leverage subject in Score Simulator', 'Add 2 focused practice hours weekly', 'Update simulated score every Sunday'],
      toolsTh: 'PathFinder Score Simulator • AI Coach', toolsEn: 'PathFinder Score Simulator • AI Coach'
    });
  }

  if (PF_STATE.gpaxSet && PF_STATE.gpax < 3.50 && r === 'r2') {
    extraTasks.push({
      _idx: 202,
      _key: id + '-r2-beh-gpax',
      tier: 'required',
      sourceKind: 'behavior',
      sourceLabelTh: 'ปรับตาม GPAX ' + PF_STATE.gpax.toFixed(2),
      sourceLabelEn: 'Tailored to GPAX ' + PF_STATE.gpax.toFixed(2),
      dateTh: 'ก.พ.', dateEn: 'Feb', tag: 'GPAX Strategy',
      titleTh: 'คัดกรองเกณฑ์โควตาที่รับ GPAX ≥ ' + Math.max(2.75, PF_STATE.gpax - 0.25).toFixed(2) + ' + วางแผนดึงเกรดเทอมนี้',
      titleEn: 'Filter Quota Options Matching GPAX ' + PF_STATE.gpax.toFixed(2) + ' & Boost Current Term',
      descTh: 'จัดลำดับทางเลือกที่ไม่ติดเพดาน GPAX สูงเกินไป พร้อมเก็บคะแนนเก็บทุกวิชาหลัก',
      descEn: 'Prioritize eligible quota tracks while raising current-term GPAX',
      deliverableTh: 'รายชื่อโครงการที่ GPAX ผ่านเกณฑ์', deliverableEn: 'Eligible Quota Shortlist', estHours: 2,
      stepsTh: ['เช็กเกณฑ์ GPAX ขั้นต่ำ 5 เทอมของแต่ละโครงการ', 'เก็บคะแนนงานกลุ่มและสอบกลางภาคให้เต็ม'],
      stepsEn: ['Verify 5-semester minimum GPAX rules', 'Lock in coursework and midterm scores'],
      toolsTh: 'mytcas.com • ใบ ปพ.1 ชั่วคราว', toolsEn: 'mytcas.com • Interim Transcript'
    });
  }

  if (PF_STATE.targetUnis && PF_STATE.targetUnis.length > 0 && r === 'r2') {
    var uniStr = PF_STATE.targetUnis.slice(0, 3).map(function (u) { return u.toUpperCase(); }).join(' / ');
    extraTasks.push({
      _idx: 203,
      _key: id + '-r2-beh-unis',
      tier: 'recommended',
      sourceKind: 'behavior',
      sourceLabelTh: 'มหาวิทยาลัยที่เลือก: ' + uniStr,
      sourceLabelEn: 'Target Unis: ' + uniStr,
      dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: uniStr,
      titleTh: 'เทียบกำหนดการและเกณฑ์เฉพาะของ ' + uniStr + ' ในรอบ Quota',
      titleEn: 'Compare Quota Deadlines & Criteria for ' + uniStr,
      descTh: 'ตรวจสอบเอกสารรับรองภูมิลำเนา/โรงเรียน และวันสอบสัมภาษณ์ไม่ให้ชนกัน',
      descEn: 'Check regional/school quota documents and ensure interview dates do not clash',
      deliverableTh: 'ตารางเทียบวันรับสมัคร ' + uniStr, deliverableEn: uniStr + ' Quota Comparison Sheet', estHours: 1,
      stepsTh: ['เปิดประกาศรับสมัครรอบ 2 ของแต่ละมหาวิทยาลัย', 'ลงวันเปิด-ปิดรับสมัครใน Google Calendar'],
      stepsEn: ['Review official Round 2 announcements', 'Add all deadlines to Google Calendar'],
      toolsTh: 'ระบบรับสมัครมหาวิทยาลัย • Calendar .ics', toolsEn: 'University Portals • Calendar .ics'
    });
  }

  if (PF_STATE.beyond400 && r === 'r1') {
    extraTasks.push({
      _idx: 204,
      _key: id + '-r1-beh-beyond',
      tier: 'optional',
      sourceKind: 'behavior',
      sourceLabelTh: 'เปิดโหมด Beyond 4.00',
      sourceLabelEn: 'Beyond 4.00 Mode',
      dateTh: 'เสริม', dateEn: 'Bonus', tag: 'Beyond 4.00',
      titleTh: 'จัดทำหน้า "Beyond 4.00 Impact" แสดงผลงานนอกห้องเรียนที่วัดผลได้',
      titleEn: 'Add a Measurable "Beyond 4.00 Impact" Page to Your Portfolio',
      descTh: 'รวมผลงาน Open-Source, ค่าย, หรือการแก้ปัญหาชุมชนพร้อมตัวเลขผลลัพธ์',
      descEn: 'Showcase open-source, camp leadership, or community impact with metrics',
      deliverableTh: 'หน้า Portfolio พิเศษ 1 หน้า', deliverableEn: '1 Dedicated Impact Page', estHours: 2,
      stepsTh: ['เลือก 1–2 กิจกรรมนอกห้องเรียนที่ภูมิใจที่สุด', 'สรุปผลลัพธ์เป็นตัวเลข (เช่น ผู้ใช้งาน 50 คน)'],
      stepsEn: ['Pick 1–2 standout extracurricular builds', 'Quantify outcomes clearly'],
      toolsTh: 'GitHub • Canva / Figma', toolsEn: 'GitHub • Canva / Figma'
    });
  }

  if (r === 'r4') {
    extraTasks.push({
      _idx: 205,
      _key: id + '-r4-beh-backup',
      tier: 'recommended',
      sourceKind: 'behavior',
      sourceLabelTh: 'แผนสำรองรอบ 4',
      sourceLabelEn: 'Round 4 Safety Net',
      dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: 'Backup Checklist',
      titleTh: 'เตรียมชุดเอกสารด่วน (PDF ≤ 10MB + คะแนน TGAT/A-Level) สำหรับยื่นภายใน 48 ชม.',
      titleEn: 'Keep Fast-Track Packet (PDF ≤ 10MB + Scores) Ready for 48-Hr Submission',
      descTh: 'รอบรับตรงอิสระเปิดรับสั้นมาก — เตรียมไฟล์ให้พร้อมส่งทันทีเมื่อเห็นที่นั่งว่าง',
      descEn: 'Direct admission windows close fast — keep files ready for instant upload',
      deliverableTh: 'โฟลเดอร์ Ready-to-Submit', deliverableEn: 'Ready-to-Submit Folder', estHours: 1,
      stepsTh: ['บีบอัดไฟล์ Portfolio ไม่เกิน 10MB', 'เช็กไฟล์ ปพ.1 และผลคะแนน TGAT/A-Level ในโฟลเดอร์เดียว'],
      stepsEn: ['Compress Portfolio PDF under 10MB', 'Keep transcript and score PDFs in 1 folder'],
      toolsTh: 'mytcas.com • PDF Compressor', toolsEn: 'mytcas.com • PDF Compressor'
    });
  }

  if (real) {
    // with real tasks: keep the advice (interests, Beyond 4.00, own keyword) without made-up months or numbers,
    // drop the sample behaviour tasks the real list already covers (dates, GPAX rules, Round 4)
    extraTasks = extraTasks
      .filter(function (t) { return t.sourceKind === 'interest' || /-r1-beh-beyond$/.test(t._key); })
      .map(function (t) { return Object.assign({}, t, { dateTh: 'แนะนำ', dateEn: 'Suggested', estHours: null }); });
  }
  var customForRound = (PF_PLAN_LOCAL.customItems || []).filter(function (ci) { return ci.round === r && ci.majorId === id; });
  return baseTasks.concat(extraTasks, customForRound);
}

// one checkbox -> the account's checklist (PATCH /my-plan/items/:key creates it on first use)
function syncWaypoint(c) {
  if (!window.PF_SYNC || !c) return;
  var card = c.closest ? c.closest('[data-wp-card]') : null;
  window.PF_SYNC.planItem(c.getAttribute('data-wp-key'), !!c.checked, {
    title: c.getAttribute('aria-label'),
    round: card ? card.getAttribute('data-wp-round') : null
  });
}

function renderRoadmap(majorId) {
  var id = String(majorId || PF_STATE.lockedMajorId || '');
  var hasTarget = !!id && !!ROADMAP_CATALOG[id];
  var emptyCta = document.getElementById('rm-empty-cta');
  var centralCal = document.getElementById('rm-central-calendar');
  var personalView = document.getElementById('rm-personal-view');
  var viewToggle = document.getElementById('rm-view-toggle');

  renderCentralCalendar();

  if (!hasTarget) {
    if (emptyCta) emptyCta.classList.remove('hidden');
    if (centralCal) centralCal.classList.remove('hidden');
    if (personalView) personalView.classList.add('hidden');
    if (viewToggle) viewToggle.classList.add('hidden');
    return;
  }

  PF_STATE.lockedMajorId = id;
  if (emptyCta) emptyCta.classList.add('hidden');
  if (viewToggle) viewToggle.classList.remove('hidden');
  var showCal = PF_PLAN_LOCAL.viewMode === 'calendar';
  if (centralCal) centralCal.classList.toggle('hidden', !showCal);
  if (personalView) personalView.classList.toggle('hidden', showCal);

  // Sync view toggle buttons
  document.querySelectorAll('[data-rm-view]').forEach(function (vb) {
    var active = vb.getAttribute('data-rm-view') === (showCal ? 'calendar' : 'personal');
    vb.setAttribute('aria-selected', active ? 'true' : 'false');
    vb.classList.toggle('bg-primary', active);
    vb.classList.toggle('text-on-primary', active);
    vb.classList.toggle('text-on-surface-variant', !active);
  });

  var data = ROADMAP_CATALOG[id] || ROADMAP_CATALOG['1'];

  // Rank switcher: อันดับ 1 = the locked program, อันดับ 2 = the backup (first saved/heart program,
  // else the next best match on Page 3). Switching swaps the real program this roadmap is built from;
  // each program keeps its own checklist. The account still syncs only the locked one (js/sync.js).
  var rankBox = document.getElementById('rm-rank-switcher');
  if (rankBox) {
    var shownId = (PF_STATE.rmPrograms || {})[id] || (window.PF_RM_REAL ? window.PF_RM_REAL.programId(id) : null);
    var firstId = (PF_STATE.lockedProgram && PF_STATE.lockedProgram.id) || PF_STATE.rmRank1Id || shownId;
    var backup = (PF_STATE.savedPrograms || []).find(function (p) { return p && p.id && p.id !== firstId; }) ||
      ((window.PF_MATCHES && window.PF_MATCHES.items) ? window.PF_MATCHES.items() : []).find(function (c) { return c.id !== firstId; }) || null;
    if (firstId && shownId !== (backup && backup.id)) PF_STATE.rmRank1Id = firstId; // remember rank 1 while rank 2 is shown
    var ranks = firstId && backup ? [{ id: firstId }, { id: backup.id, card: backup }] : [];
    rankBox.classList.toggle('hidden', ranks.length < 2);
    var label = function (c) { return c ? c.university + ' • ' + c.program : ''; };
    rankBox.innerHTML = ranks.map(function (r, rIdx) {
      var active = r.id === shownId || (rIdx === 0 && shownId !== ranks[1].id);
      var cls = active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50';
      var tip = rIdx === 0 ? (PF_STATE.lockedProgram ? label(PF_STATE.lockedProgram) : '') : label(r.card);
      return '<button type="button" data-rm-rank-program="' + rmEsc(r.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '" title="' + rmEsc(tip) + '" class="px-2.5 py-0.5 rounded-full border font-label text-xs font-medium ' + cls + '">' +
        (currentLang === 'th' ? 'อันดับ ' : 'Rank ') + (rIdx + 1) +
        (rIdx === 1 ? '<span class="font-normal opacity-80">' + (currentLang === 'th' ? ' • สำรอง' : ' • backup') + '</span>' : '') +
      '</button>';
    }).join('');
    rankBox.querySelectorAll('[data-rm-rank-program]').forEach(function (rb) {
      rb.addEventListener('click', function () {
        PF_STATE.rmPrograms = PF_STATE.rmPrograms || {};
        PF_STATE.rmPrograms[id] = rb.getAttribute('data-rm-rank-program');
        if (typeof window.savePFState === 'function') window.savePFState();
        renderRoadmap(id);
        if (typeof window.PF_REFRESH_BADGES === 'function') window.PF_REFRESH_BADGES();
      });
    });
  }

  // Personalization summary chips (Interests + Website Activity)
  var chipsBox = document.getElementById('rm-personalization-chips');
  if (chipsBox) {
    var chips = [];
    (PF_STATE.interests || []).forEach(function (ik) {
      var iw = PF_INTEREST_ROUND_WORK[ik];
      if (iw) {
        chips.push('<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-[11px] font-medium">' + (currentLang === 'th' ? iw.labelTh : iw.labelEn) + '</span>');
      }
    });
    if ((PF_STATE.customInterestText || '').trim()) {
      chips.push('<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-[11px] font-medium">' + rmEsc(PF_STATE.customInterestText.trim()) + '</span>');
    }
    var gradeTxt = pfGradeLabel();
    chips.push('<span class="px-2 py-0.5 rounded-full bg-surface-container-low border border-outline-variant font-metric text-[11px] text-on-surface-variant">' + pfGradePrefix() + 'GPAX ' + pfGpaxText() + ' • ' + pfHoursText() + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk') + '</span>');
    var visitedPages = (PF_STATE.behavior && PF_STATE.behavior.visitedPages) || [];
    if (visitedPages.indexOf('5') !== -1) {
      chips.push('<span class="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-[11px]">' + (currentLang === 'th' ? 'เชื่อมผลจำลองคะแนนแล้ว' : 'Score Simulator Synced') + '</span>');
    }
    chipsBox.innerHTML = chips.join('');
  }

  var titleEl = document.getElementById('roadmap-major-title');
  if (titleEl) {
    titleEl.setAttribute('data-th', data.titleTh);
    titleEl.setAttribute('data-en', data.titleEn);
    titleEl.textContent = currentLang === 'th' ? data.titleTh : data.titleEn;
  }

  var paceEl = document.getElementById('roadmap-pace-subtitle');
  if (paceEl) {
    var h = PF_STATE.weeklyHours;
    var paceTh = h < 5 ? 'แผน ' + h + ' ชม./สัปดาห์ • ค่อยเป็นค่อยไป' : (h <= 10 ? 'แผน ' + h + ' ชม./สัปดาห์ • เตรียมตัวแบบไม่กดดัน' : 'แผน ' + h + ' ชม./สัปดาห์ • เร่งสปีดเข้มข้น');
    var paceEn = h < 5 ? 'Light ' + h + ' hrs/week • Gentle pace' : (h <= 10 ? 'Steady ' + h + ' hrs/week • Low-stress pace' : 'Intensive ' + h + ' hrs/week • Sprint pace');
    if (!PF_STATE.hoursSet) { paceTh = 'ยังไม่ได้กำหนดชั่วโมงอ่านต่อสัปดาห์'; paceEn = 'Weekly hours not set yet'; }
    paceEl.setAttribute('data-th', paceTh);
    paceEl.setAttribute('data-en', paceEn);
    paceEl.textContent = currentLang === 'th' ? paceTh : paceEn;
  }

  // uni, GPAX, weights, docs, countdown, warnings, round availability, exams, timeline, dates:
  // real myTCAS data for the program planned for this major (js/roadmap-real.js)
  if (window.PF_RM_REAL) window.PF_RM_REAL.render(id);

  window.PF_RENDERED_TASKS = window.PF_RENDERED_TASKS || {};

  ['r1', 'r2', 'r3', 'r4'].forEach(function (r) {
    var panel = document.querySelector('[data-rm-panel="' + r + '"]');
    if (!panel) return;
    var allTasks = buildPersonalizedRoundTasks(id, r, data);
    window.PF_RENDERED_TASKS[r] = allTasks;

    var firstUncheckedKey = null;
    allTasks.forEach(function (t) {
      var chk = PF_STATE.checkedWaypoints.hasOwnProperty(t._key) ? PF_STATE.checkedWaypoints[t._key] : !!t.defaultChecked;
      if (!chk && !firstUncheckedKey && t.tier !== 'optional') firstUncheckedKey = t._key;
    });

    function buildCard(t) {
      var isChecked = PF_STATE.checkedWaypoints.hasOwnProperty(t._key) ? PF_STATE.checkedWaypoints[t._key] : !!t.defaultChecked;
      var isNext = !isChecked && t._key === firstUncheckedKey;
      var isOverdue = !isChecked && t.overdue;
      var cardTone = isChecked
        ? 'bg-secondary-container/45 border-secondary'
        : (isOverdue ? 'bg-red-50/40 border-red-400' : (isNext ? 'bg-tertiary-container/45 border-tertiary' : 'bg-surface-container-lowest border-outline-variant'));
      var dashed = t.tier === 'optional' ? ' border-dashed' : '';
      var sourceBadge = t.sourceLabelTh
        ? '<span class="px-2 py-0.5 rounded-full ' + (t.sourceKind === 'behavior' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary/10 text-primary') + ' font-label text-[11px] font-medium">' + (currentLang === 'th' ? t.sourceLabelTh : (t.sourceLabelEn || t.sourceLabelTh)) + '</span>'
        : '';
      var tierChip = t.tier === 'recommended' && !t.sourceLabelTh
        ? '<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-[11px]">' + (currentLang === 'th' ? 'แนะนำ' : 'Recommended') + '</span>'
        : (t.tier === 'optional' ? '<button type="button" data-dismiss-opt="' + t._key + '" class="px-2 py-0.5 rounded-full bg-surface-container-low hover:bg-surface-container-high font-label text-[11px] text-on-surface-variant">' + (currentLang === 'th' ? 'ไม่สนใจ' : 'Dismiss') + '</button>' : '');
      var deliv = currentLang === 'th' ? (t.deliverableTh || '') : (t.deliverableEn || '');
      var hrs = t.estHours ? ('~' + t.estHours + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk')) : '';
      var metaLine = (deliv || hrs)
        ? '<div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-label text-[11px] text-on-surface-variant">' +
            (deliv ? '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[13px] text-primary" aria-hidden="true">task_alt</span>' + deliv + '</span>' : '') +
            (hrs ? '<span class="inline-flex items-center gap-1 font-metric"><span class="material-symbols-outlined text-[13px]" aria-hidden="true">schedule</span>' + hrs + '</span>' : '') +
          '</div>'
        : '';
      return '<article data-wp-card data-wp-round="' + r + '" data-wp-idx="' + t._idx + '" data-wp-key="' + rmEsc(t._key) + '" class="p-gutter-md rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-gutter-md ' + cardTone + dashed + '">' +
        '<div class="flex items-start gap-gutter-sm flex-1 min-w-0">' +
          '<input type="checkbox" ' + (isChecked ? 'checked ' : '') + 'data-waypoint-check data-wp-key="' + rmEsc(t._key) + '" aria-label="' + rmEsc(t.titleEn || t.titleTh) + '" class="mt-1 w-5 h-5 rounded-sm text-primary shrink-0 cursor-pointer" />' +
          '<div class="flex flex-col gap-1 min-w-0">' +
            '<div class="flex flex-wrap items-center gap-gutter-xs">' +
              '<span class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm">' + (currentLang === 'th' ? (t.dateTh || 'กำหนดเอง') : (t.dateEn || 'Custom')) + '</span>' +
              '<span class="px-gutter-sm py-0.5 rounded-full bg-surface-container-low font-label text-label-sm text-on-surface-variant">' + rmEsc(t.tag || 'Custom') + '</span>' +
              sourceBadge +
              tierChip +
            '</div>' +
            '<span class="font-title text-title-md text-on-surface break-words">' + rmEsc(currentLang === 'th' ? t.titleTh : (t.titleEn || t.titleTh)) + '</span>' +
            '<span class="font-body text-body-md text-on-surface-variant break-words">' + rmEsc(currentLang === 'th' ? (t.descTh || '') : (t.descEn || '')) + '</span>' +
            metaLine +
          '</div>' +
        '</div>' +
        '<span class="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 mt-1" aria-hidden="true">chevron_right</span>' +
      '</article>';
    }

    var mainHtml = allTasks.filter(function (t) { return t.tier !== 'optional'; }).map(buildCard).join('');
    var optTasks = allTasks.filter(function (t) { return t.tier === 'optional' && !PF_PLAN_LOCAL.hiddenOptional[t._key]; });
    if (r === 'r1' && optTasks.length === 0 && !PF_PLAN_LOCAL.hiddenOptional[id + '-r1-opt0']) {
      optTasks = [{ _idx: 99, _key: id + '-r1-opt0', tier: 'optional', dateTh: 'เสริม', dateEn: 'Bonus', tag: 'Optional', titleTh: 'เข้าร่วมแข่งขัน/Hackathon ระดับประเทศเพื่อเพิ่มพอร์ต', titleEn: 'Join a national competition or Hackathon for bonus portfolio edge', descTh: 'ไม่บังคับ แต่ช่วยเพิ่มน้ำหนักรอบ Portfolio ได้ชัดเจน', descEn: 'Optional, but strengthens your Portfolio impact' }];
      window.PF_RENDERED_TASKS[r] = allTasks.concat(optTasks);
    }
    var optHtml = optTasks.length
      ? '<details class="rounded-xl bg-surface-container-low/60 border border-dashed border-outline-variant p-gutter-sm">' +
          '<summary class="cursor-pointer font-label text-label-md font-medium text-on-surface-variant select-none">' + (currentLang === 'th' ? 'เพิ่มความโดดเด่น (ไม่บังคับ)' : 'Stand Out More (Optional)') + ' (' + optTasks.length + ')</summary>' +
          '<div class="flex flex-col gap-gutter-sm pt-gutter-sm">' + optTasks.map(buildCard).join('') + '</div>' +
        '</details>'
      : '';

    panel.innerHTML = mainHtml + optHtml;
  });

  var beyondList = document.getElementById('beyond-edge-list');
  if (beyondList) {
    // real: what this program's projects ask for besides grades (myTCAS); before a program loads, the catalog
    // ideas are shown but labelled as general ideas, not as this program's requirements
    var real = window.PF_RM_REAL && typeof window.PF_RM_REAL.beyond === 'function' ? window.PF_RM_REAL.beyond(id) : null;
    var beyondItems = real ? real.items : (data.beyond || []);
    var li = function (th, en, cls) {
      return '<span data-th="' + rmEsc(th) + '" data-en="' + rmEsc(en) + '" class="' + cls + '">' + rmEsc(currentLang === 'th' ? th : en) + '</span>';
    };
    var note = real
      ? (real.items.length
          ? li('จากประกาศ myTCAS ของ ' + real.program.program + ' • ' + real.program.university, 'From myTCAS announcements: ' + real.program.program + ' • ' + real.program.university, 'font-label text-label-sm text-on-tertiary-container')
          : li('ประกาศของหลักสูตรนี้ไม่ได้ขอเอกสารเสริม (ผลงาน/เกียรติบัตร/ภาษา) • เน้นคะแนนสอบเป็นหลัก', "This program's announcements ask for no extra documents (portfolio/awards/language) • exam scores matter most", 'font-label text-label-sm text-on-tertiary-container'))
      : li('ไอเดียทั่วไป • เลือกหลักสูตรเพื่อดูสิ่งที่หลักสูตรนั้นขอจริง', 'General ideas • pick a program to see what it really asks for', 'font-label text-label-sm text-on-tertiary-container');
    beyondList.innerHTML = '<li>' + note + '</li>' + beyondItems.map(function (item) {
      return '<li class="p-gutter-sm rounded-lg bg-surface-container-lowest flex flex-col gap-0.5">' +
        li(item.titleTh, item.titleEn, 'font-title text-title-md text-on-surface') +
        li(item.descTh, item.descEn, 'font-body text-body-md text-on-surface-variant') +
      '</li>';
    }).join('');
  }

  document.querySelectorAll('#rm-personal-view [data-waypoint-check]').forEach(function (c) {
    c.addEventListener('change', function () {
      var wpKey = c.getAttribute('data-wp-key');
      updateProgress();
      // PATCH /api/my-plan/items/:id when logged in (no-op for guests, localStorage keeps it)
      syncWaypoint(c);
      if (typeof window.savePFState === 'function') window.savePFState();
    });
  });

  document.querySelectorAll('[data-dismiss-opt]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      PF_PLAN_LOCAL.hiddenOptional[btn.getAttribute('data-dismiss-opt')] = true;
      savePlanLocal();
      renderRoadmap(id);
    });
  });

  document.querySelectorAll('[data-wp-card]').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target && (e.target.closest('input[type="checkbox"]') || e.target.closest('[data-dismiss-opt]'))) return;
      openWaypointDrawer(card.getAttribute('data-wp-round'), Number(card.getAttribute('data-wp-idx')));
    });
  });
  updateProgress();
}
window.renderRoadmap = renderRoadmap;

// Wire Full Plan Drawer, View Toggle, .ics Download, Google Calendar & GET /api/my-plan
(function wireRoadmapEnhancements() {
  var drawer = document.getElementById('rm-full-plan-drawer');
  var listEl = document.getElementById('rm-full-plan-list');
  var gcalLink = document.getElementById('rm-gcal-link');

  function populateFullPlan() {
    if (!listEl) return;
    var id = String(PF_STATE.lockedMajorId || '1');
    var data = ROADMAP_CATALOG[id] || ROADMAP_CATALOG['1'];
    listEl.innerHTML = ['r1', 'r2', 'r3', 'r4'].map(function (r) {
      // same list as the round panels (real program tasks once loaded)
      var tasks = buildPersonalizedRoundTasks(id, r, data);
      return '<div class="flex flex-col gap-1.5">' +
        '<h3 class="font-label text-label-md font-semibold text-primary">' + r.toUpperCase() + '</h3>' +
        tasks.map(function (t, idx) {
          var key = t._key || (id + '-' + r + '-' + idx);
          var chk = PF_STATE.checkedWaypoints.hasOwnProperty(key) ? PF_STATE.checkedWaypoints[key] : !!t.defaultChecked;
          return '<div class="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between gap-2 text-sm">' +
            '<span>' + (chk ? '✅ ' : '⬜ ') + rmEsc(currentLang === 'th' ? t.titleTh : (t.titleEn || t.titleTh)) + '</span>' +
            '<span class="text-xs text-on-surface-variant shrink-0">' + (currentLang === 'th' ? (t.dateTh || 'กำหนดเอง') : (t.dateEn || 'Custom')) + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('');

    if (gcalLink) {
      var text = encodeURIComponent('PathFinder TCAS70: ' + (data.titleTh || 'Roadmap'));
      // no fixed date: the student picks it in Google Calendar (real round dates are in the .ics)
      gcalLink.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + text +
        '&details=' + encodeURIComponent('ตรวจสอบวันที่ทางการที่ mytcas.com');
    }
  }

  function openFullPlan() {
    populateFullPlan();
    if (drawer) drawer.classList.remove('hidden');
  }
  function closeFullPlan() {
    if (drawer) drawer.classList.add('hidden');
  }

  var openBtn = document.getElementById('open-full-plan-btn');
  if (openBtn) openBtn.addEventListener('click', openFullPlan);
  document.querySelectorAll('[data-open-full-plan]').forEach(function (b) { b.addEventListener('click', openFullPlan); });
  var closeBtn = document.getElementById('close-full-plan-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeFullPlan);
  var backdrop = document.getElementById('full-plan-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeFullPlan);

  var icsBtn = document.getElementById('rm-download-ics-btn');
  if (icsBtn) {
    // logged in: GET /my-plan/calendar.ics (targets' real round dates + checklist due dates)
    // guest: the public central TCAS calendar
    icsBtn.addEventListener('click', async function () {
      var loggedIn = !!(window.PF_AUTH && window.PF_AUTH.getCurrentUser());
      icsBtn.disabled = true;
      try {
        var blob = await PF_API.request(loggedIn ? '/my-plan/calendar.ics' : '/tcas/calendar.ics', { auth: loggedIn });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = loggedIn ? 'pathfinder-tcas-plan.ics' : 'tcas-calendar.ics';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      } catch (err) {
        if (window.PF_AUTH) { var msg = PF_API.errorText(err); window.PF_AUTH.showToast(msg, msg); }
      } finally {
        icsBtn.disabled = false;
      }
    });
  }

  var customForm = document.getElementById('rm-add-custom-form');
  if (customForm) {
    customForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('rm-custom-title');
      var rnd = document.getElementById('rm-custom-round');
      var title = (inp && inp.value || '').trim();
      if (!title) return;
      var round = rnd ? rnd.value : 'r1';
      var id = String(PF_STATE.lockedMajorId || '1');
      PF_PLAN_LOCAL.customItems.push({
        _idx: Date.now(),
        _key: id + '-' + round + '-custom-' + Date.now(),
        majorId: id,
        round: round,
        tier: 'required',
        dateTh: 'กำหนดเอง',
        dateEn: 'Custom',
        tag: 'My Task',
        titleTh: title,
        titleEn: title,
        descTh: 'เพิ่มโดยนักเรียน',
        descEn: 'Added by student',
        defaultChecked: false
      });
      savePlanLocal();
      var added = PF_PLAN_LOCAL.customItems[PF_PLAN_LOCAL.customItems.length - 1];
      if (window.PF_SYNC) window.PF_SYNC.planItem(added._key, false, { title: title, round: round, tier: 'required', source: 'custom' });
      if (inp) inp.value = '';
      renderRoadmap(id);
      populateFullPlan();
    });
  }

  document.querySelectorAll('[data-rm-view]').forEach(function (vb) {
    vb.addEventListener('click', function () {
      PF_PLAN_LOCAL.viewMode = vb.getAttribute('data-rm-view');
      savePlanLocal();
      renderRoadmap(PF_STATE.lockedMajorId);
    });
  });

  document.querySelectorAll('[data-rm-tab]').forEach(function (tb) {
    tb.addEventListener('click', function () {
      if (tb.disabled) return;
      var r = tb.getAttribute('data-rm-tab');
      PF_STATE.activeRound = r;
      renderRoundDatesBar(r);
    });
  });

  // Hydrate from GET /api/my-plan on Page 4 entry with skeleton
  document.querySelectorAll('[data-nav-page="roadmap"], [data-go-page="4"]').forEach(function (nav) {
    nav.addEventListener('click', function () {
      var sk = document.getElementById('rm-skeleton');
      var pv = document.getElementById('rm-personal-view');
      var user = window.PF_AUTH && window.PF_AUTH.getCurrentUser();
      var loggedIn = !!user;
      var uid = loggedIn ? String(user.userId || user.email || 'me') : null;
      // guests: once per device. logged in: once per account per page load (a later login re-checks)
      if (sk && pv && (loggedIn ? rmHydratedFor !== uid : !PF_PLAN_LOCAL.loadedOnce)) {
        if (loggedIn) rmHydratedFor = uid;
        sk.classList.remove('hidden');
        pv.classList.add('hidden');
        (loggedIn ? PF_API.request('/my-plan', { auth: true }) : Promise.resolve(null)).then(function (plan) {
          // items the account marked done/todo win over this device's ticks
          (plan && plan.items || []).forEach(function (it) {
            if (it.status === 'done') PF_STATE.checkedWaypoints[it.id] = true;
            else if (it.status === 'todo' && PF_STATE.checkedWaypoints[it.id]) PF_STATE.checkedWaypoints[it.id] = false;
          });
        }).catch(function () {}).finally(function () {
          PF_PLAN_LOCAL.loadedOnce = true;
          sk.classList.add('hidden');
          renderRoadmap(PF_STATE.lockedMajorId);
        });
      }
    });
  });

  // 9. Auto-inject Roadmap context when opening AI Coach from Page 4
  var floatBtn = document.getElementById('floating-ai-coach-btn');
  if (floatBtn) {
    floatBtn.addEventListener('click', function () {
      var p4 = document.querySelector('[data-page-view="4"]');
      if (!p4 || p4.classList.contains('hidden')) return;
      var title = (document.getElementById('roadmap-major-title')?.textContent || '').trim();
      var footer = (document.getElementById('rm-progress-footer')?.textContent || '').trim();
      var coachInput = document.getElementById('floating-ai-coach-input');
      if (coachInput && !coachInput.value) {
        coachInput.placeholder = (currentLang === 'th' ? 'ถามเรื่อง ' : 'Ask about ') + title + ' (' + footer + ')';
      }
    });
  }
})();


var activeDrawerWpKey = null;
var wpDrawer = document.getElementById('waypoint-drawer');

function closeWaypointDrawer() {
  if (wpDrawer) wpDrawer.classList.add('hidden');
  activeDrawerWpKey = null;
}

function syncDrawerToggleBtn(isChecked) {
  var btn = document.getElementById('wp-drawer-toggle-btn');
  var lbl = document.getElementById('wp-drawer-toggle-label');
  if (!btn || !lbl) return;
  lbl.textContent = isChecked
    ? (currentLang === 'th' ? 'เสร็จแล้ว • คลิกเพื่อยกเลิก' : 'Completed • Click to Undo')
    : (currentLang === 'th' ? 'ทำเครื่องหมายว่าเสร็จแล้ว' : 'Mark Complete');
  btn.classList.toggle('bg-secondary', isChecked);
  btn.classList.toggle('text-on-secondary', isChecked);
  btn.classList.toggle('bg-primary', !isChecked);
  btn.classList.toggle('text-on-primary', !isChecked);
}

function openWaypointDrawer(roundKey, idx) {
  if (!wpDrawer) return;
  var id = String(PF_STATE.lockedMajorId || '1');
  var data = ROADMAP_CATALOG[id] || ROADMAP_CATALOG['1'];
  var renderedList = (window.PF_RENDERED_TASKS && window.PF_RENDERED_TASKS[roundKey]) || [];
  var task = renderedList.find(function (t) { return Number(t._idx) === Number(idx); }) || (data.rounds[roundKey] || [])[idx];
  if (!task) return;

  var wpKey = task._key || (id + '-' + roundKey + '-' + idx);
  activeDrawerWpKey = wpKey;
  var guide = ROUND_GUIDE_TEMPLATES[roundKey] || ROUND_GUIDE_TEMPLATES.r1;
  // only a task that states its own hours shows them (no guessed hours for real myTCAS tasks)
  var estHrs = task.estHours || null;

  document.getElementById('wp-drawer-round').textContent = (currentLang === 'th' ? guide.roundTh : guide.roundEn) + (task.sourceLabelTh ? (' • ' + (currentLang === 'th' ? task.sourceLabelTh : (task.sourceLabelEn || task.sourceLabelTh))) : '');
  document.getElementById('wp-drawer-date').textContent = currentLang === 'th' ? (task.dateTh || 'กำหนดเอง') : (task.dateEn || 'Custom');
  document.getElementById('wp-drawer-hours').textContent = estHrs ? '~' + estHrs + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk') : '—';
  document.getElementById('wp-drawer-title').textContent = currentLang === 'th' ? task.titleTh : (task.titleEn || task.titleTh);
  var deliv = currentLang === 'th' ? (task.deliverableTh || '') : (task.deliverableEn || '');
  document.getElementById('wp-drawer-desc').textContent = (currentLang === 'th' ? (task.descTh || '') : (task.descEn || '')) + (deliv ? ((currentLang === 'th' ? ' • ผลลัพธ์: ' : ' • Deliverable: ') + deliv) : '');

  var steps = currentLang === 'th' ? (task.stepsTh || guide.stepsTh) : (task.stepsEn || guide.stepsEn);
  document.getElementById('wp-drawer-steps').innerHTML = steps.map(function (s) {
    return '<li>' + s + '</li>';
  }).join('');
  document.getElementById('wp-drawer-tools').textContent = currentLang === 'th' ? (task.toolsTh || guide.toolsTh) : (task.toolsEn || guide.toolsEn);

  var checkbox = document.querySelector('[data-waypoint-check][data-wp-key="' + wpKey + '"]');
  syncDrawerToggleBtn(checkbox ? checkbox.checked : false);
  wpDrawer.classList.remove('hidden');
}
window.openWaypointDrawer = openWaypointDrawer;

if (document.getElementById('wp-drawer-close')) {
  document.getElementById('wp-drawer-close').addEventListener('click', closeWaypointDrawer);
}
if (document.getElementById('wp-drawer-backdrop')) {
  document.getElementById('wp-drawer-backdrop').addEventListener('click', closeWaypointDrawer);
}
if (document.getElementById('wp-drawer-toggle-btn')) {
  document.getElementById('wp-drawer-toggle-btn').addEventListener('click', function () {
    if (!activeDrawerWpKey) return;
    var checkbox = document.querySelector('[data-waypoint-check][data-wp-key="' + activeDrawerWpKey + '"]');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      updateProgress();
      syncWaypoint(checkbox);
      if (typeof window.savePFState === 'function') window.savePFState();
      syncDrawerToggleBtn(checkbox.checked);
      if (PF_STATE.rerouteMode === 'missed') {
        renderRoadmap(PF_STATE.lockedMajorId);
      }
    }
  });
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeWaypointDrawer();
    var m = document.getElementById('reroute-modal');
    if (m) m.classList.add('hidden');
  }
});

/* Major Matches -> Lock & Jump to Page 4 with chosen major */
document.querySelectorAll('[data-lock-btn]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var id = btn.getAttribute('data-lock-btn');
    PF_STATE.lockedMajorId = id;
    document.querySelectorAll('[data-destination-card]').forEach(function (c) {
      var sel = c.getAttribute('data-destination-card') === id;
      c.classList.toggle('border-2', sel);
      c.classList.toggle('border-primary', sel);
      c.classList.toggle('border', !sel);
      c.classList.toggle('border-outline-variant', !sel);
    });
    document.querySelectorAll('[data-lock-btn]').forEach(function (b) {
      var sel = b.getAttribute('data-lock-btn') === id;
      b.classList.toggle('bg-primary', sel);
      b.classList.toggle('text-on-primary', sel);
      b.classList.toggle('bg-surface-container-low', !sel);
      b.classList.toggle('text-on-surface', !sel);
      b.classList.toggle('border', !sel);
      b.classList.toggle('border-outline-variant', !sel);
    });

    var match = btn.getAttribute('data-match');
    // interest-fit score from the discovery page (computed from the student's own answers)
    PF_STATE.lockedMatchPct = match || null;
    var badgeEl = document.getElementById('roadmap-match-badge');
    if (badgeEl) {
      badgeEl.textContent = (currentLang === 'th' ? 'ตรงกัน ' : '') + match + (currentLang === 'en' ? ' Match' : '');
    }
    renderRoadmap(id);

    var MAJOR_TO_SIM_FACULTY = { '1': 'comp-eng', '2': 'comm-arts', '3': 'arch-ux', '4': 'bba', '5': 'comp-eng', '6': 'comm-arts' };
    PF_STATE.simFacultyKey = MAJOR_TO_SIM_FACULTY[id] || 'comp-eng';
    if (typeof renderScoreSim === 'function') renderScoreSim();

    setTimeout(function () { goToPage('4'); }, 220);
  });
});

/* Roadmap Tabs + Progress + Reroute Modal */
function activateRmTab(target) {
  document.querySelectorAll('[data-rm-tab]').forEach(function (t) {
    var active = t.getAttribute('data-rm-tab') === target;
    t.setAttribute('aria-selected', active ? 'true' : 'false');
    t.classList.toggle('bg-primary', active);
    t.classList.toggle('text-on-primary', active);
    t.classList.toggle('text-on-surface-variant', !active);
  });
  document.querySelectorAll('[data-rm-panel]').forEach(function (p) {
    p.classList.toggle('hidden', p.getAttribute('data-rm-panel') !== target);
  });
}
document.querySelectorAll('[data-rm-tab]').forEach(function (tab) {
  tab.addEventListener('click', function () {
    activateRmTab(tab.getAttribute('data-rm-tab'));
  });
});

renderRoadmap(PF_STATE.lockedMajorId);

var selectedRerouteKey = 'missed';
document.querySelectorAll('[data-reroute-option]').forEach(function (opt) {
  opt.addEventListener('click', function () {
    selectedRerouteKey = opt.getAttribute('data-reroute-key') || 'missed';
    document.querySelectorAll('[data-reroute-option]').forEach(function (o) {
      var active = o === opt;
      o.classList.toggle('border-primary', active);
      o.classList.toggle('bg-surface-container-low', active);
      o.classList.toggle('border-outline-variant', !active);
      o.classList.toggle('bg-surface', !active);
    });
  });
});

var rerouteBanner = document.getElementById('roadmap-reroute-banner');
var rerouteBannerText = document.getElementById('roadmap-reroute-text');
if (document.getElementById('dismiss-reroute-banner')) {
  document.getElementById('dismiss-reroute-banner').addEventListener('click', function () {
    if (rerouteBanner) rerouteBanner.classList.add('hidden');
  });
}

var modal = document.getElementById('reroute-modal');
document.getElementById('open-reroute-btn').addEventListener('click', function () { modal.classList.remove('hidden'); });
document.getElementById('close-reroute-btn').addEventListener('click', function () { modal.classList.add('hidden'); });
document.getElementById('apply-reroute-btn').addEventListener('click', function () {
  modal.classList.add('hidden');
  if (selectedRerouteKey === 'missed') {
    PF_STATE.rerouteMode = 'missed';
    renderRoadmap(PF_STATE.lockedMajorId);
    if (rerouteBanner && rerouteBannerText) {
      var bTh = 'ปรับแผนฟื้นตัว 2 สัปดาห์แล้ว • ติดป้าย "เร่งด่วน (Catch-up)" ในงานที่ยังไม่เสร็จ';
      var bEn = '2-week recovery applied • Incomplete high-impact tasks tagged Catch-up.';
      rerouteBannerText.setAttribute('data-th', bTh);
      rerouteBannerText.setAttribute('data-en', bEn);
      rerouteBannerText.textContent = currentLang === 'th' ? bTh : bEn;
      rerouteBanner.classList.remove('hidden');
    }
  } else if (selectedRerouteKey === 'hours') {
    PF_STATE.rerouteMode = 'hours';
    PF_STATE.weeklyHours = 4;
    PF_STATE.hoursSet = true;
    if (hoursSlider) hoursSlider.value = '4';
    renderHoursPace();
    renderSummaryStrip();
    renderRoadmap(PF_STATE.lockedMajorId);
    activateRmTab('r1');
    if (rerouteBanner && rerouteBannerText) {
      var hTh = 'ปรับเวลาเป็น 4 ชม./สัปดาห์แล้ว • แนะนำโฟกัสรอบ 1 Portfolio และรอบ 3 ที่ให้ผลตอบแทนสูงสุด';
      var hEn = 'Adjusted pace to 4 hrs/week • Prioritizing highest-ROI Round 1 & Round 3 tasks.';
      rerouteBannerText.setAttribute('data-th', hTh);
      rerouteBannerText.setAttribute('data-en', hEn);
      rerouteBannerText.textContent = currentLang === 'th' ? hTh : hEn;
      rerouteBanner.classList.remove('hidden');
    }
  } else if (selectedRerouteKey === 'switch') {
    PF_STATE.rerouteMode = 'switch';
    goToPage('3');
  }
});
