/* =========================================================================
 * PathFinder (Mobile Prototype) — TCAS Roadmap (Page 4)
 * Section 4.5: /api/my-plan with local fallback, personalized per-round tasks, central calendar, Waypoint & Full Plan drawers, lock-major & reroute modal.
 *
 * Classic (non-module) script sharing the page's global scope. In the
 * single-file build all of this lived inside one IIFE; it now runs at
 * top level in the same order. Load order is fixed in index.html:
 *   data/image-assets.js > data/catalog.js > js/state-i18n.js >
 *   js/discovery-matches.js > js/roadmap.js > js/visualizers.js >
 *   js/sim-coach.js > js/auth-analytics-profile.js
 *
 * Depends on : data/catalog.js, js/state-i18n.js, js/discovery-matches.js
 * Provides   : PF_PLAN_STORAGE_KEY, PF_PLAN_LOCAL, savePlanLocal, renderCentralCalendar, updateProgress, buildPersonalizedRoundTasks, renderRoadmap, openWaypointDrawer, closeWaypointDrawer, activateRmTab
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
function savePlanLocal() {
  try { localStorage.setItem(PF_PLAN_STORAGE_KEY, JSON.stringify(PF_PLAN_LOCAL)); } catch (e) {}
}

function renderCentralCalendar() {
  var grid = document.getElementById('rm-central-calendar-grid');
  if (!grid) return;
  grid.innerHTML = TCAS70_CENTRAL_ROUNDS.map(function (rd) {
    var badgeCls = rd.tone === 'official' ? 'bg-secondary-container text-on-secondary-container' : (rd.tone === 'verified' ? 'bg-primary text-on-primary' : 'bg-tertiary-container text-on-tertiary-container');
    return '<article class="p-gutter-sm rounded-xl bg-surface-container-low border border-outline-variant flex flex-col gap-1.5">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="font-title text-title-md text-on-surface">' + (currentLang === 'th' ? rd.titleTh : rd.titleEn) + '</span>' +
        '<span class="px-2.5 py-0.5 rounded-full font-label text-label-sm ' + badgeCls + '">' + (currentLang === 'th' ? rd.sourceTh : rd.sourceEn) + '</span>' +
      '</div>' +
      '<div class="grid grid-cols-3 gap-2 pt-1 text-xs font-label text-on-surface-variant">' +
        '<div><span class="block opacity-75">' + (currentLang === 'th' ? 'รับสมัคร' : 'Apply') + '</span><strong class="text-on-surface">' + (currentLang === 'th' ? rd.applyTh : rd.applyEn) + '</strong></div>' +
        '<div><span class="block opacity-75">' + (currentLang === 'th' ? 'ประกาศผล' : 'Results') + '</span><strong class="text-on-surface">' + (currentLang === 'th' ? rd.announceTh : rd.announceEn) + '</strong></div>' +
        '<div><span class="block opacity-75">' + (currentLang === 'th' ? 'ยืนยันสิทธิ์' : 'Confirm') + '</span><strong class="text-on-surface">' + (currentLang === 'th' ? rd.confirmTh : rd.confirmEn) + '</strong></div>' +
      '</div>' +
    '</article>';
  }).join('');
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

function renderRoundDatesBar(roundId) {
  var bar = document.getElementById('rm-round-dates-bar');
  if (!bar) return;
  var rd = TCAS70_CENTRAL_ROUNDS.find(function (x) { return x.id === roundId; }) || TCAS70_CENTRAL_ROUNDS[0];
  var badgeCls = rd.tone === 'official' ? 'bg-secondary-container text-on-secondary-container' : (rd.tone === 'verified' ? 'bg-primary text-on-primary' : 'bg-tertiary-container text-on-tertiary-container');
  bar.innerHTML =
    '<div class="flex flex-wrap items-center gap-2 text-xs font-label text-on-surface-variant">' +
      '<span>' + (currentLang === 'th' ? 'รับสมัคร: ' : 'Apply: ') + '<strong class="text-on-surface">' + (currentLang === 'th' ? rd.applyTh : rd.applyEn) + '</strong></span>' +
      '<span>' + (currentLang === 'th' ? 'ประกาศผล: ' : 'Results: ') + '<strong class="text-on-surface">' + (currentLang === 'th' ? rd.announceTh : rd.announceEn) + '</strong></span>' +
      '<span>' + (currentLang === 'th' ? 'ยืนยันสิทธิ์: ' : 'Confirm: ') + '<strong class="text-on-surface">' + (currentLang === 'th' ? rd.confirmTh : rd.confirmEn) + '</strong></span>' +
    '</div>' +
    '<span class="px-2.5 py-0.5 rounded-full font-label text-label-sm ' + badgeCls + '">' + (currentLang === 'th' ? rd.sourceTh : rd.sourceEn) + '</span>';
}

function renderExamsAndTimeline(meta) {
  var strip = document.getElementById('rm-exams-strip');
  if (strip) {
    strip.innerHTML = (meta.exams || []).map(function (ex) {
      var ratio = Math.min(100, Math.round((ex.current / ex.target) * 100));
      return '<div class="min-w-[185px] shrink-0 p-gutter-sm rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-1">' +
        '<div class="flex items-center justify-between gap-1">' +
          '<span class="font-title text-label-md font-semibold text-on-surface">' + ex.name + '</span>' +
          '<span class="px-2 py-0.5 rounded-full bg-surface-container-low font-metric text-[10px] text-on-surface-variant">' + (currentLang === 'th' ? ex.dateTh : ex.dateEn) + '</span>' +
        '</div>' +
        '<div class="flex items-center justify-between text-xs font-metric text-on-surface-variant">' +
          '<span>' + (currentLang === 'th' ? 'ตอนนี้ ' : 'Now ') + ex.current + '</span>' +
          '<span class="text-primary font-semibold">' + (currentLang === 'th' ? 'เป้า ' : 'Target ') + ex.target + '</span>' +
        '</div>' +
        '<div class="w-full h-2 rounded-full bg-surface-container overflow-hidden"><div class="h-full rounded-full bg-secondary" style="width:' + ratio + '%"></div></div>' +
      '</div>';
    }).join('');
  }

  var track = document.getElementById('rm-timeline-track');
  if (track) {
    var months = currentLang === 'th' ? ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'] : ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    track.innerHTML =
      '<div class="min-w-[420px] relative px-2 pt-3">' +
        '<div class="h-2 rounded-full bg-surface-container relative">' +
          '<div class="absolute top-[-10px] bottom-[-6px] w-0.5 bg-tertiary" style="left: 22%;" title="Today">' +
            '<span class="absolute -top-5 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-tertiary text-on-tertiary text-[10px] font-label whitespace-nowrap">' + (currentLang === 'th' ? 'วันนี้' : 'Today') + '</span>' +
          '</div>' +
          '<span class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white" style="left: 14%;"></span>' +
          '<span class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-secondary border-2 border-white" style="left: 52%;"></span>' +
          '<span class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white" style="left: 78%;"></span>' +
        '</div>' +
        '<div class="grid grid-cols-9 gap-1 mt-2 text-center font-label text-[10px] text-on-surface-variant">' +
          months.map(function (m) { return '<span>' + m + '</span>'; }).join('') +
        '</div>' +
      '</div>';
  }
}

/* Interest & Website-Behavior Personalized Round Work Generator */

function buildPersonalizedRoundTasks(id, r, data) {
  var baseTasks = (data.rounds[r] || []).map(function (t, idx) {
    return Object.assign({}, t, {
      _idx: idx,
      _key: id + '-' + r + '-' + idx,
      tier: t.tier || (idx === 0 ? 'required' : 'recommended'),
      overdue: !!t.overdue,
      sourceKind: 'core'
    });
  });
  var extraTasks = [];
  var interests = Array.isArray(PF_STATE.interests) ? PF_STATE.interests : [];
  interests.slice(0, 3).forEach(function (ik) {
    var iw = PF_INTEREST_ROUND_WORK[ik];
    if (iw && iw[r]) {
      extraTasks.push(Object.assign({}, iw[r], {
        _idx: 100 + extraTasks.length,
        _key: id + '-' + r + '-int-' + ik,
        tier: 'recommended',
        sourceKind: 'interest',
        sourceLabelTh: 'จากความสนใจ: ' + iw.labelTh,
        sourceLabelEn: 'Interest: ' + iw.labelEn
      }));
    }
  });
  var customKw = (PF_STATE.customInterestText || '').trim();
  if (customKw && r === 'r1') {
    extraTasks.push({
      _idx: 150, _key: id + '-r1-customkw', tier: 'recommended', sourceKind: 'interest',
      sourceLabelTh: 'ความสนใจที่พิมพ์เอง', sourceLabelEn: 'Custom Interest',
      dateTh: 'ธ.ค.', dateEn: 'Dec', tag: customKw.slice(0, 18),
      titleTh: 'เชื่อมโยง "' + customKw + '" เข้ากับโปรเจกต์ใน Portfolio',
      titleEn: 'Connect "' + customKw + '" into a Portfolio Mini-Project',
      descTh: 'อธิบายว่าความถนัดนี้ช่วยแก้ปัญหาในสาขาเป้าหมายอย่างไร',
      descEn: 'Show how this interest solves a problem in your target field',
      deliverableTh: 'หน้าสรุป 1–2 หน้า', deliverableEn: '1–2 Page Feature', estHours: 2
    });
  }
  var visited = (PF_STATE.behavior && PF_STATE.behavior.visitedPages) || [];
  if (visited.indexOf('5') !== -1 && r === 'r3') {
    extraTasks.push({
      _idx: 201, _key: id + '-r3-beh-sim', tier: 'required', sourceKind: 'behavior',
      sourceLabelTh: 'จากพฤติกรรม: จำลองคะแนน', sourceLabelEn: 'Activity: Score Simulator',
      dateTh: 'เม.ย.', dateEn: 'Apr', tag: 'Score Gap Plan',
      titleTh: 'ปิดช่องว่างคะแนนสอบตามผลจำลอง (+4 คะแนน)',
      titleEn: 'Close Simulated Score Gap (+4 pts)',
      descTh: 'โฟกัสวิชาที่น้ำหนัก 30–40% เพื่อดันโอกาสติดเข้าโซนปลอดภัย',
      descEn: 'Focus on your 30–40% weight subject first',
      deliverableTh: 'ตารางเก็บคะแนน 4 สัปดาห์', deliverableEn: '4-Week Tracker', estHours: 4
    });
  }
  if (PF_STATE.gpax < 3.50 && r === 'r2') {
    extraTasks.push({
      _idx: 202, _key: id + '-r2-beh-gpax', tier: 'required', sourceKind: 'behavior',
      sourceLabelTh: 'ปรับตาม GPAX ' + PF_STATE.gpax.toFixed(2), sourceLabelEn: 'GPAX ' + PF_STATE.gpax.toFixed(2),
      dateTh: 'ก.พ.', dateEn: 'Feb', tag: 'GPAX Strategy',
      titleTh: 'คัดกรองเกณฑ์โควตาที่รับ GPAX ≥ ' + Math.max(2.75, PF_STATE.gpax - 0.25).toFixed(2),
      titleEn: 'Filter Quota Options Matching GPAX ' + PF_STATE.gpax.toFixed(2),
      descTh: 'จัดลำดับโครงการที่ GPAX ผ่านเกณฑ์ พร้อมเก็บเกรดเทอมนี้',
      descEn: 'Prioritize eligible quota tracks while raising term GPAX',
      deliverableTh: 'รายชื่อโครงการที่ผ่านเกณฑ์', deliverableEn: 'Eligible Shortlist', estHours: 2
    });
  }
  if (PF_STATE.targetUnis && PF_STATE.targetUnis.length > 0 && r === 'r2') {
    var uniStr = PF_STATE.targetUnis.slice(0, 3).map(function (u) { return u.toUpperCase(); }).join(' / ');
    extraTasks.push({
      _idx: 203, _key: id + '-r2-beh-unis', tier: 'recommended', sourceKind: 'behavior',
      sourceLabelTh: 'ม.ที่เลือก: ' + uniStr, sourceLabelEn: 'Target Unis: ' + uniStr,
      dateTh: 'ก.พ.–มี.ค.', dateEn: 'Feb–Mar', tag: uniStr,
      titleTh: 'เทียบกำหนดการรอบ Quota ของ ' + uniStr,
      titleEn: 'Compare Quota Deadlines for ' + uniStr,
      descTh: 'ตรวจเอกสารรับรองและวันสัมภาษณ์ไม่ให้ชนกัน',
      descEn: 'Ensure quota documents and interview dates do not clash',
      deliverableTh: 'ตารางเทียบวันรับสมัคร', deliverableEn: 'Quota Date Sheet', estHours: 1
    });
  }
  if (PF_STATE.beyond400 && r === 'r1') {
    extraTasks.push({
      _idx: 204, _key: id + '-r1-beh-beyond', tier: 'optional', sourceKind: 'behavior',
      sourceLabelTh: 'เปิดโหมด Beyond 4.00', sourceLabelEn: 'Beyond 4.00 Mode',
      dateTh: 'เสริม', dateEn: 'Bonus', tag: 'Beyond 4.00',
      titleTh: 'ทำหน้า "Beyond 4.00 Impact" แสดงผลงานนอกห้องเรียน',
      titleEn: 'Add a "Beyond 4.00 Impact" Portfolio Page',
      descTh: 'รวมผลงาน Open-Source / ค่ายพร้อมตัวเลขผลลัพธ์',
      descEn: 'Showcase extracurricular builds with measurable outcomes',
      deliverableTh: 'หน้า Portfolio 1 หน้า', deliverableEn: '1 Impact Page', estHours: 2
    });
  }
  if (r === 'r4') {
    extraTasks.push({
      _idx: 205, _key: id + '-r4-beh-backup', tier: 'recommended', sourceKind: 'behavior',
      sourceLabelTh: 'แผนสำรองรอบ 4', sourceLabelEn: 'Round 4 Safety Net',
      dateTh: 'ปลาย พ.ค.', dateEn: 'Late May', tag: 'Backup Checklist',
      titleTh: 'เตรียมชุดเอกสารด่วน (PDF ≤ 10MB + คะแนนสอบ)',
      titleEn: 'Keep Fast-Track Packet (PDF ≤ 10MB) Ready',
      descTh: 'พร้อมยื่นภายใน 48 ชม. เมื่อเห็นที่นั่งว่างรอบ 4',
      descEn: 'Ready for instant upload when Round 4 seats open',
      deliverableTh: 'โฟลเดอร์ Ready-to-Submit', deliverableEn: 'Ready Folder', estHours: 1
    });
  }
  var customForRound = (PF_PLAN_LOCAL.customItems || []).filter(function (ci) { return ci.round === r && ci.majorId === id; });
  return baseTasks.concat(extraTasks, customForRound);
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

  document.querySelectorAll('[data-rm-view]').forEach(function (vb) {
    var active = vb.getAttribute('data-rm-view') === (showCal ? 'calendar' : 'personal');
    vb.setAttribute('aria-selected', active ? 'true' : 'false');
    vb.classList.toggle('bg-primary', active);
    vb.classList.toggle('text-on-primary', active);
    vb.classList.toggle('text-on-surface-variant', !active);
  });

  var data = ROADMAP_CATALOG[id] || ROADMAP_CATALOG['1'];
  var meta = PF_MY_PLAN_META[id] || PF_MY_PLAN_META['1'];

  var rankBox = document.getElementById('rm-rank-switcher');
  if (rankBox) {
    var targetIds = (PF_STATE.savedIds && PF_STATE.savedIds.length) ? PF_STATE.savedIds.slice(0, 3) : ['1', '2', '3'];
    if (targetIds.indexOf(id) === -1) targetIds.unshift(id);
    targetIds = targetIds.slice(0, 3);
    rankBox.classList.toggle('hidden', targetIds.length <= 1);
    rankBox.innerHTML = targetIds.map(function (tid, rIdx) {
      var active = String(tid) === id;
      var cls = active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant';
      return '<button type="button" data-rm-rank-id="' + tid + '" class="px-2.5 py-0.5 rounded-full border font-label text-xs font-medium ' + cls + '">' +
        (currentLang === 'th' ? 'อันดับ ' : 'Rank ') + (rIdx + 1) +
      '</button>';
    }).join('');
    rankBox.querySelectorAll('[data-rm-rank-id]').forEach(function (rb) {
      rb.addEventListener('click', function () {
        renderRoadmap(rb.getAttribute('data-rm-rank-id'));
        if (typeof window.PF_REFRESH_BADGES === 'function') window.PF_REFRESH_BADGES();
      });
    });
  }

  var chipsBox = document.getElementById('rm-personalization-chips');
  if (chipsBox) {
    var chips = [];
    (PF_STATE.interests || []).forEach(function (ik) {
      var iw = PF_INTEREST_ROUND_WORK[ik];
      if (iw) chips.push('<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-[11px] font-medium">' + (currentLang === 'th' ? iw.labelTh : iw.labelEn) + '</span>');
    });
    if ((PF_STATE.customInterestText || '').trim()) {
      chips.push('<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-[11px] font-medium">' + PF_STATE.customInterestText.trim() + '</span>');
    }
    var gradeTxt = currentLang === 'th' ? PF_STATE.grade.replace('M.', 'ม.') : PF_STATE.grade;
    chips.push('<span class="px-2 py-0.5 rounded-full bg-surface-container-low border border-outline-variant font-metric text-[11px] text-on-surface-variant">' + gradeTxt + ' • GPAX ' + PF_STATE.gpax.toFixed(2) + ' • ' + PF_STATE.weeklyHours + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk') + '</span>');
    var visitedPages = (PF_STATE.behavior && PF_STATE.behavior.visitedPages) || [];
    if (visitedPages.indexOf('5') !== -1) {
      chips.push('<span class="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-[11px]">' + (currentLang === 'th' ? 'เชื่อมผลจำลองคะแนนแล้ว' : 'Score Simulator Synced') + '</span>');
    }
    chipsBox.innerHTML = chips.join('');
  }

  var uniEl = document.getElementById('rm-uni-name');
  if (uniEl) uniEl.textContent = currentLang === 'th' ? meta.uniTh : meta.uniEn;
  var gpaxEl = document.getElementById('rm-sub-gpax');
  if (gpaxEl) gpaxEl.textContent = meta.gpax;
  var wEl = document.getElementById('rm-sub-weights');
  if (wEl) wEl.textContent = meta.weights;
  var docsEl = document.getElementById('rm-sub-docs');
  if (docsEl) docsEl.textContent = currentLang === 'th' ? meta.docsTh : meta.docsEn;

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
    paceEl.setAttribute('data-th', paceTh);
    paceEl.setAttribute('data-en', paceEn);
    paceEl.textContent = currentLang === 'th' ? paceTh : paceEn;
  }

  var cdEl = document.getElementById('countdown-readout');
  if (cdEl) {
    var cd = getCountdownStrings();
    cdEl.setAttribute('data-th', cd.th);
    cdEl.setAttribute('data-en', cd.en);
    cdEl.textContent = currentLang === 'th' ? cd.th : cd.en;
  }

  var warnBox = document.getElementById('rm-warnings-box');
  if (warnBox) {
    var warns = currentLang === 'th' ? (meta.warningsTh || []) : (meta.warningsEn || []);
    warnBox.classList.toggle('hidden', warns.length === 0);
    warnBox.innerHTML = warns.map(function (w) {
      return '<div class="flex items-start gap-2 font-body text-body-sm text-on-tertiary-container">' +
        '<span class="material-symbols-outlined text-[16px] text-tertiary-text shrink-0 mt-0.5" aria-hidden="true">warning</span>' +
        '<span>' + w + '</span>' +
      '</div>';
    }).join('');
  }

  ['r1', 'r2', 'r3', 'r4'].forEach(function (r) {
    var tabBtn = document.querySelector('[data-rm-tab="' + r + '"]');
    var recDot = document.querySelector('[data-rm-rec-dot="' + r + '"]');
    var isRec = (meta.recommendedRounds || []).indexOf(r) !== -1;
    var isUnavailable = (meta.unavailableRounds || []).indexOf(r) !== -1;
    if (recDot) recDot.classList.toggle('hidden', !isRec);
    if (tabBtn) {
      tabBtn.disabled = isUnavailable;
      tabBtn.classList.toggle('opacity-45', isUnavailable);
      tabBtn.classList.toggle('cursor-not-allowed', isUnavailable);
    }
  });

  renderExamsAndTimeline(meta);
  renderRoundDatesBar(PF_STATE.activeRound || 'r1');

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
        : (t.tier === 'optional' ? '<button type="button" data-dismiss-opt="' + t._key + '" class="px-2 py-0.5 rounded-full bg-surface-container-low font-label text-[11px] text-on-surface-variant">' + (currentLang === 'th' ? 'ไม่สนใจ' : 'Dismiss') + '</button>' : '');
      var deliv = currentLang === 'th' ? (t.deliverableTh || '') : (t.deliverableEn || '');
      var hrs = t.estHours ? ('~' + t.estHours + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk')) : '';
      var metaLine = (deliv || hrs)
        ? '<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 font-label text-[11px] text-on-surface-variant">' +
            (deliv ? '<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[13px] text-primary" aria-hidden="true">task_alt</span>' + deliv + '</span>' : '') +
            (hrs ? '<span class="inline-flex items-center gap-1 font-metric"><span class="material-symbols-outlined text-[13px]" aria-hidden="true">schedule</span>' + hrs + '</span>' : '') +
          '</div>'
        : '';
      return '<article data-wp-card data-wp-round="' + r + '" data-wp-idx="' + t._idx + '" data-wp-key="' + t._key + '" class="p-gutter-md rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-gutter-sm ' + cardTone + dashed + '">' +
        '<div class="flex items-start gap-gutter-sm flex-1 min-w-0">' +
          '<input type="checkbox" ' + (isChecked ? 'checked ' : '') + 'data-waypoint-check data-wp-key="' + t._key + '" aria-label="' + (t.titleEn || t.titleTh) + '" class="mt-1 w-5 h-5 rounded-sm text-primary shrink-0 cursor-pointer" />' +
          '<div class="flex flex-col gap-0.5 min-w-0">' +
            '<div class="flex flex-wrap items-center gap-1">' +
              '<span class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm">' + (currentLang === 'th' ? (t.dateTh || 'กำหนดเอง') : (t.dateEn || 'Custom')) + '</span>' +
              '<span class="px-gutter-sm py-0.5 rounded-full bg-surface-container-low font-label text-label-sm text-on-surface-variant">' + (t.tag || 'Custom') + '</span>' +
              sourceBadge +
              tierChip +
            '</div>' +
            '<span class="font-title text-title-md text-on-surface break-words">' + (currentLang === 'th' ? t.titleTh : (t.titleEn || t.titleTh)) + '</span>' +
            '<span class="font-body text-body-md text-on-surface-variant break-words">' + (currentLang === 'th' ? (t.descTh || '') : (t.descEn || '')) + '</span>' +
            metaLine +
          '</div>' +
        '</div>' +
        '<span class="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 mt-1" aria-hidden="true">chevron_right</span>' +
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
    beyondList.innerHTML = data.beyond.map(function (item) {
      return '<li class="p-gutter-sm rounded-lg bg-surface-container-lowest flex flex-col gap-0.5">' +
        '<span data-th="' + item.titleTh + '" data-en="' + item.titleEn + '" class="font-title text-title-md text-on-surface">' + (currentLang === 'th' ? item.titleTh : item.titleEn) + '</span>' +
        '<span data-th="' + item.descTh + '" data-en="' + item.descEn + '" class="font-body text-body-md text-on-surface-variant">' + (currentLang === 'th' ? item.descTh : item.descEn) + '</span>' +
      '</li>';
    }).join('');
  }

  document.querySelectorAll('#rm-personal-view [data-waypoint-check]').forEach(function (c) {
    c.addEventListener('change', function () {
      var wpKey = c.getAttribute('data-wp-key');
      updateProgress();
      try {
        fetch('/api/my-plan/items/' + encodeURIComponent(wpKey), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !!c.checked })
        }).catch(function () {});
      } catch (e) {}
      savePFState();
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

(function wireRoadmapEnhancements() {
  var drawer = document.getElementById('rm-full-plan-drawer');
  var listEl = document.getElementById('rm-full-plan-list');
  var gcalLink = document.getElementById('rm-gcal-link');

  function populateFullPlan() {
    if (!listEl) return;
    var id = String(PF_STATE.lockedMajorId || '1');
    var data = ROADMAP_CATALOG[id] || ROADMAP_CATALOG['1'];
    listEl.innerHTML = ['r1', 'r2', 'r3', 'r4'].map(function (r) {
      var tasks = (data.rounds[r] || []).concat((PF_PLAN_LOCAL.customItems || []).filter(function (ci) { return ci.round === r && ci.majorId === id; }));
      return '<div class="flex flex-col gap-1.5">' +
        '<h3 class="font-label text-label-md font-semibold text-primary">' + r.toUpperCase() + '</h3>' +
        tasks.map(function (t, idx) {
          var key = t._key || (id + '-' + r + '-' + idx);
          var chk = PF_STATE.checkedWaypoints.hasOwnProperty(key) ? PF_STATE.checkedWaypoints[key] : !!t.defaultChecked;
          return '<div class="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between gap-2 text-sm">' +
            '<span>' + (chk ? '✅ ' : '⬜ ') + (currentLang === 'th' ? t.titleTh : (t.titleEn || t.titleTh)) + '</span>' +
            '<span class="text-xs text-on-surface-variant shrink-0">' + (currentLang === 'th' ? (t.dateTh || 'กำหนดเอง') : (t.dateEn || 'Custom')) + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('');

    if (gcalLink) {
      var text = encodeURIComponent('PathFinder TCAS70: ' + (data.titleTh || 'Roadmap'));
      gcalLink.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + text + '&dates=20261207/20261208';
    }
  }

  function openFullPlan() { populateFullPlan(); if (drawer) drawer.classList.remove('hidden'); }
  function closeFullPlan() { if (drawer) drawer.classList.add('hidden'); }

  var openBtn = document.getElementById('open-full-plan-btn');
  if (openBtn) openBtn.addEventListener('click', openFullPlan);
  document.querySelectorAll('[data-open-full-plan]').forEach(function (b) { b.addEventListener('click', openFullPlan); });
  var closeBtn = document.getElementById('close-full-plan-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeFullPlan);
  var backdrop = document.getElementById('full-plan-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeFullPlan);

  var icsBtn = document.getElementById('rm-download-ics-btn');
  if (icsBtn) {
    icsBtn.addEventListener('click', function () {
      var id = String(PF_STATE.lockedMajorId || '1');
      var data = ROADMAP_CATALOG[id] || ROADMAP_CATALOG['1'];
      var ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PathFinder//TCAS70//TH',
        'BEGIN:VEVENT', 'SUMMARY:PathFinder TCAS70 - ' + (data.titleEn || 'Target Major'),
        'DTSTART:20261207T090000Z', 'DTEND:20261207T100000Z',
        'DESCRIPTION:TGAT & Portfolio Checkpoint', 'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pathfinder-tcas70.ics';
      a.click();
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

  document.querySelectorAll('[data-nav-page="roadmap"], [data-go-page="4"]').forEach(function (nav) {
    nav.addEventListener('click', function () {
      var sk = document.getElementById('rm-skeleton');
      var pv = document.getElementById('rm-personal-view');
      if (sk && pv && !PF_PLAN_LOCAL.loadedOnce) {
        sk.classList.remove('hidden');
        pv.classList.add('hidden');
        fetch('/api/my-plan').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).finally(function () {
          PF_PLAN_LOCAL.loadedOnce = true;
          sk.classList.add('hidden');
          renderRoadmap(PF_STATE.lockedMajorId);
        });
      }
    });
  });

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
  var estHrs = task.estHours || Math.max(1, Math.round(PF_STATE.weeklyHours / 3));

  document.getElementById('wp-drawer-round').textContent = (currentLang === 'th' ? guide.roundTh : guide.roundEn) + (task.sourceLabelTh ? (' • ' + (currentLang === 'th' ? task.sourceLabelTh : (task.sourceLabelEn || task.sourceLabelTh))) : '');
  document.getElementById('wp-drawer-date').textContent = currentLang === 'th' ? (task.dateTh || 'กำหนดเอง') : (task.dateEn || 'Custom');
  document.getElementById('wp-drawer-hours').textContent = '~' + estHrs + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk');
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
    var cdEl = document.getElementById('countdown-readout');
    var baseMonths = PF_STATE.grade === 'M.4' ? 19.5 : (PF_STATE.grade === 'M.6' ? 2.5 : 7.5);
    if (cdEl) {
      cdEl.setAttribute('data-th', 'เหลือเวลา ' + baseMonths + ' เดือน');
      cdEl.setAttribute('data-en', baseMonths + ' Months Left');
      cdEl.textContent = currentLang === 'th' ? ('เหลือเวลา ' + baseMonths + ' เดือน') : (baseMonths + ' Months Left');
    }
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
