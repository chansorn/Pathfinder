/* =========================================================================
 * PathFinder — State Persistence, Score Simulator, AI Academic Coach & Behavior Tracking
 * Sections 4.7-4.8: localStorage state + share/reset, match filters, Page 5 score simulator, Page 6 AI coach, live behavior coach popover.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js
 *
 * Depends on : data/catalog.js, js/state-i18n.js, js/discovery-matches.js, js/roadmap.js
 * Provides   : window.renderScoreSim, window.renderCoachYield, window.updateSimCalculations (plus self-contained IIFEs)
 * ========================================================================= */

/* State Persistence, Score Simulator & AI Academic Coach */
(function () {
  // Day 6: localStorage Persistence, Copy Summary, Reset & Scroll Polish
  /* [JS 4.7] State Persistence (localStorage) & Shareable Plan URL */
  var PF_STORAGE_KEY = 'pathfinder_v1_state';
  function savePFState() {
    try {
      localStorage.setItem(PF_STORAGE_KEY, JSON.stringify(PF_STATE));
    } catch (e) {}
  }

  function hydratePFState() {
    try {
      var raw = localStorage.getItem(PF_STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      Object.keys(saved).forEach(function (k) {
        if (saved[k] !== undefined) PF_STATE[k] = saved[k];
      });

      if (Array.isArray(PF_STATE.interests)) {
        document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
          var active = PF_STATE.interests.indexOf(chip.getAttribute('data-interest-key')) !== -1;
          chip.setAttribute('aria-pressed', active ? 'true' : 'false');
          chip.classList.toggle('bg-primary', active);
          chip.classList.toggle('text-on-primary', active);
          chip.classList.toggle('border-primary', active);
          chip.classList.toggle('bg-surface-container-lowest', !active);
          chip.classList.toggle('text-on-surface', !active);
        });
      }
      if (Array.isArray(PF_STATE.targetUnis)) {
        document.querySelectorAll('[data-uni-key]').forEach(function (chip) {
          var active = PF_STATE.targetUnis.indexOf(chip.getAttribute('data-uni-key')) !== -1;
          chip.setAttribute('aria-pressed', active ? 'true' : 'false');
          chip.classList.toggle('bg-primary', active);
          chip.classList.toggle('text-on-primary', active);
          chip.classList.toggle('border-primary', active);
          chip.classList.toggle('bg-surface-container-lowest', !active);
          chip.classList.toggle('text-on-surface', !active);
        });
      }
      if (PF_STATE.grade) {
        document.querySelectorAll('[data-grade-key]').forEach(function (pill) {
          var active = pill.getAttribute('data-grade-key') === PF_STATE.grade;
          pill.setAttribute('aria-pressed', active ? 'true' : 'false');
          pill.classList.toggle('bg-primary', active);
          pill.classList.toggle('text-on-primary', active);
          pill.classList.toggle('bg-surface', !active);
          pill.classList.toggle('text-on-surface', !active);
        });
      }
      var gpaxEl = document.getElementById('gpax-slider');
      var gpaxVal = document.getElementById('gpax-value');
      if (gpaxEl && typeof PF_STATE.gpax === 'number') {
        gpaxEl.value = PF_STATE.gpax.toFixed(2);
        if (gpaxVal) gpaxVal.textContent = PF_STATE.gpax.toFixed(2);
      }
      var hrsEl = document.getElementById('hours-slider');
      if (hrsEl && typeof PF_STATE.weeklyHours === 'number') {
        hrsEl.value = String(PF_STATE.weeklyHours);
      }
      var customInp = document.getElementById('custom-interest-input');
      if (customInp && typeof PF_STATE.customInterestText === 'string') {
        customInp.value = PF_STATE.customInterestText;
      }
      if (typeof updateAIInterestSummary === 'function') updateAIInterestSummary();
      if (typeof syncBeyond400UI === 'function') syncBeyond400UI();
      if (typeof renderHoursPace === 'function') renderHoursPace();
      if (typeof renderSummaryStrip === 'function') renderSummaryStrip();
      if (PF_STATE.step && typeof setStep === 'function') setStep(PF_STATE.step);
      if (PF_STATE.lang && PF_STATE.lang !== currentLang && typeof setLang === 'function') setLang(PF_STATE.lang);
      if (typeof syncMajorMatches === 'function') syncMajorMatches();
      if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
      if (PF_STATE.page && PF_STATE.page !== currentPage && typeof goToPage === 'function') {
        goToPage(PF_STATE.page);
      }
    } catch (e) {}
  }

  hydratePFState();

  ['click', 'input', 'change'].forEach(function (evtName) {
    document.addEventListener(evtName, function () {
      setTimeout(savePFState, 60);
    }, { passive: true });
  });

  window.addEventListener('scroll', function () {
    if (typeof hideUniCard === 'function') hideUniCard();
  }, { passive: true });

  var copyBtn = document.getElementById('copy-summary-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var titleEl = document.getElementById('roadmap-major-title');
      var pctEl = document.getElementById('readiness-pct');
      var cdEl = document.getElementById('countdown-readout');
      var majorName = titleEl ? titleEl.textContent.trim() : 'PathFinder Major';
      var pct = pctEl ? pctEl.textContent.trim() : '50%';
      var cd = cdEl ? cdEl.textContent.trim() : '';
      var gradeStr = currentLang === 'th' ? PF_STATE.grade.replace('M.', 'ม.') : PF_STATE.grade;
      var summaryText = currentLang === 'th'
        ? ('PathFinder สรุปแผน TCAS 1–4\nคณะเป้าหมาย: ' + majorName + '\nโปรไฟล์: ' + gradeStr + ' • GPAX ' + Number(PF_STATE.gpax).toFixed(2) + ' • ' + PF_STATE.weeklyHours + ' ชม./สัปดาห์\nความพร้อม: ' + pct + (cd ? ' • เหลือเวลา: ' + cd : '') + '\nตรวจสอบเกณฑ์ทางการที่ mytcas.com')
        : ('PathFinder TCAS 1–4 Summary\nTarget Major: ' + majorName + '\nProfile: ' + gradeStr + ' • GPAX ' + Number(PF_STATE.gpax).toFixed(2) + ' • ' + PF_STATE.weeklyHours + ' hrs/wk\nReadiness: ' + pct + (cd ? ' • Time left: ' + cd : '') + '\nVerify official weightings at mytcas.com');

      function showCopied() {
        var lbl = copyBtn.querySelector('[data-th]');
        if (!lbl) return;
        var origTh = lbl.getAttribute('data-th');
        var origEn = lbl.getAttribute('data-en');
        lbl.textContent = currentLang === 'th' ? 'คัดลอกแล้ว!' : 'Copied!';
        setTimeout(function () {
          lbl.textContent = currentLang === 'th' ? origTh : origEn;
        }, 1800);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summaryText).then(showCopied).catch(showCopied);
      } else {
        var ta = document.createElement('textarea');
        ta.value = summaryText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        ta.remove();
        showCopied();
      }
    });
  }

  var resetBtn = document.getElementById('reset-state-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      try { localStorage.removeItem(PF_STORAGE_KEY); } catch (e) {}
      window.location.reload();
    });
  }

  // Page 3 Filter Chips
  document.querySelectorAll('[data-match-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var filter = btn.getAttribute('data-match-filter');
      document.querySelectorAll('[data-match-filter]').forEach(function (b) {
        var active = b === btn;
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.classList.toggle('bg-primary', active);
        b.classList.toggle('text-on-primary', active);
        b.classList.toggle('bg-surface-container-low', !active);
        b.classList.toggle('text-on-surface', !active);
      });
      document.querySelectorAll('#matches-top3-grid article[data-destination-card]').forEach(function (card) {
        var id = card.getAttribute('data-destination-card');
        var show = filter === 'all' || (filter === 'safe' && (id === '1' || id === '2')) || (filter === 'portfolio' && (id === '1' || id === '3'));
        card.classList.toggle('hidden', !show);
      });
    });
  });

  // Page 5: Score Simulator & Admission Chance (TCAS70 Multi-Faculty)
  var SIM_DEFAULTS = { tgat: 68, tpat1: 68, tpat3: 72, tpat4: 74, math1: 78, physics: 75, chem: 76, bio: 74, eng: 82.5, thai: 78, social: 75 };
  PF_STATE.simScores = PF_STATE.simScores || Object.assign({}, SIM_DEFAULTS);
  PF_STATE.simFacultyKey = PF_STATE.simFacultyKey || 'comp-eng';

  var SIM_FACULTIES = {
    'comp-eng': {
      eyebrowTh: 'วิศวกรรมคอมพิวเตอร์ • รอบ 3 Admission',
      eyebrowEn: 'Computer Engineering • Round 3 Admission',
      titleTh: 'วิศวกรรมศาสตร์ สาขาวิศวกรรมคอมพิวเตอร์',
      titleEn: 'Faculty of Engineering • Computer Engineering',
      cutoffs: [72.15, 71.60, 71.20],
      topSubjectTh: 'A-Level คณิต 1',
      topSubjectEn: 'A-Level Math 1',
      subjects: [
        { key: 'tgat', weight: 0.20, th: 'TGAT ความถนัดทั่วไป', en: 'TGAT General Aptitude', subTh: 'รหัส 90 • Mock ล่าสุด: 62.50', subEn: 'Code 90 • Latest Mock: 62.50' },
        { key: 'tpat3', weight: 0.20, th: 'TPAT3 วิทยาศาสตร์ เทคโนโลยี และวิศวกรรม', en: 'TPAT3 Science, Tech & Engineering', subTh: 'รหัส 30 • Mock ล่าสุด: 68.00', subEn: 'Code 30 • Latest Mock: 68.00' },
        { key: 'math1', weight: 0.20, th: 'A-Level คณิตศาสตร์ประยุกต์ 1', en: 'A-Level Applied Math 1', subTh: 'รหัส 61 • Mock ล่าสุด: 71.00', subEn: 'Code 61 • Latest Mock: 71.00' },
        { key: 'physics', weight: 0.15, th: 'A-Level ฟิสิกส์', en: 'A-Level Physics', subTh: 'รหัส 64 • Mock ล่าสุด: 70.00', subEn: 'Code 64 • Latest Mock: 70.00' },
        { key: 'chem', weight: 0.15, th: 'A-Level เคมี', en: 'A-Level Chemistry', subTh: 'รหัส 65 • Mock ล่าสุด: 72.00', subEn: 'Code 65 • Latest Mock: 72.00' },
        { key: 'eng', weight: 0.10, th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', subTh: 'รหัส 82 • Mock ล่าสุด: 78.00', subEn: 'Code 82 • Latest Mock: 78.00' }
      ]
    },
    'med': {
      eyebrowTh: 'แพทยศาสตร์ กสพท • รอบ 3 Admission',
      eyebrowEn: 'Medicine (Cotmes) • Round 3 Admission',
      titleTh: 'แพทยศาสตร์ (กลุ่มสถาบันแพทยศาสตร์ กสพท)',
      titleEn: 'Doctor of Medicine (Cotmes)',
      cutoffs: [68.40, 67.95, 67.20],
      topSubjectTh: 'TPAT1 (วิชาเฉพาะ กสพท)',
      topSubjectEn: 'TPAT1 (Medical Aptitude)',
      subjects: [
        { key: 'tpat1', weight: 0.30, th: 'TPAT1 วิชาเฉพาะ กสพท', en: 'TPAT1 Medical Aptitude', subTh: 'รหัส 10 • ค่าน้ำหนักสูงสุด 30%', subEn: 'Code 10 • Highest Weight 30%' },
        { key: 'bio', weight: 0.14, th: 'A-Level ชีววิทยา', en: 'A-Level Biology', subTh: 'รหัส 66 • ขั้นต่ำกลุ่มวิทย์', subEn: 'Code 66 • Science Core' },
        { key: 'chem', weight: 0.14, th: 'A-Level เคมี', en: 'A-Level Chemistry', subTh: 'รหัส 65 • ขั้นต่ำกลุ่มวิทย์', subEn: 'Code 65 • Science Core' },
        { key: 'physics', weight: 0.14, th: 'A-Level ฟิสิกส์', en: 'A-Level Physics', subTh: 'รหัส 64 • ขั้นต่ำกลุ่มวิทย์', subEn: 'Code 64 • Science Core' },
        { key: 'math1', weight: 0.14, th: 'A-Level คณิตศาสตร์ประยุกต์ 1', en: 'A-Level Applied Math 1', subTh: 'รหัส 61 • ขั้นต่ำ ≥ 30%', subEn: 'Code 61 • Min ≥ 30%' },
        { key: 'eng', weight: 0.14, th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', subTh: 'รหัส 82 • ขั้นต่ำ ≥ 30%', subEn: 'Code 82 • Min ≥ 30%' }
      ]
    },
    'bba': {
      eyebrowTh: 'พาณิชยศาสตร์และการบัญชี • รอบ 3 Admission',
      eyebrowEn: 'Business & FinTech • Round 3 Admission',
      titleTh: 'พาณิชยศาสตร์และการบัญชี / บริหารธุรกิจ',
      titleEn: 'Commerce & Accountancy / BBA',
      cutoffs: [74.80, 74.10, 73.50],
      topSubjectTh: 'A-Level คณิต 1 & TGAT',
      topSubjectEn: 'A-Level Math 1 & TGAT',
      subjects: [
        { key: 'tgat', weight: 0.30, th: 'TGAT ความถนัดทั่วไป', en: 'TGAT General Aptitude', subTh: 'รหัส 90 • ค่าน้ำหนัก 30%', subEn: 'Code 90 • Weight 30%' },
        { key: 'math1', weight: 0.30, th: 'A-Level คณิตศาสตร์ประยุกต์ 1', en: 'A-Level Applied Math 1', subTh: 'รหัส 61 • ค่าน้ำหนัก 30%', subEn: 'Code 61 • Weight 30%' },
        { key: 'eng', weight: 0.25, th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', subTh: 'รหัส 82 • ค่าน้ำหนัก 25%', subEn: 'Code 82 • Weight 25%' },
        { key: 'social', weight: 0.15, th: 'A-Level สังคมศึกษา', en: 'A-Level Social Studies', subTh: 'รหัส 70 • ค่าน้ำหนัก 15%', subEn: 'Code 70 • Weight 15%' }
      ]
    },
    'arch-ux': {
      eyebrowTh: 'สถาปัตยกรรม & ออกแบบฯ • รอบ 3 Admission',
      eyebrowEn: 'Architecture & Design • Round 3 Admission',
      titleTh: 'สถาปัตยกรรมศาสตร์ & ออกแบบอุตสาหกรรม',
      titleEn: 'Architecture & Industrial Design',
      cutoffs: [69.50, 68.90, 68.40],
      topSubjectTh: 'TPAT4 ความถนัดทางสถาปัตยกรรม',
      topSubjectEn: 'TPAT4 Architectural Aptitude',
      subjects: [
        { key: 'tpat4', weight: 0.40, th: 'TPAT4 ความถนัดทางสถาปัตยกรรม', en: 'TPAT4 Architectural Aptitude', subTh: 'รหัส 40 • ค่าน้ำหนักสูงสุด 40%', subEn: 'Code 40 • Highest Weight 40%' },
        { key: 'tgat', weight: 0.25, th: 'TGAT ความถนัดทั่วไป', en: 'TGAT General Aptitude', subTh: 'รหัส 90 • ค่าน้ำหนัก 25%', subEn: 'Code 90 • Weight 25%' },
        { key: 'math1', weight: 0.20, th: 'A-Level คณิตศาสตร์ประยุกต์ 1', en: 'A-Level Applied Math 1', subTh: 'รหัส 61 • ค่าน้ำหนัก 20%', subEn: 'Code 61 • Weight 20%' },
        { key: 'eng', weight: 0.15, th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', subTh: 'รหัส 82 • ค่าน้ำหนัก 15%', subEn: 'Code 82 • Weight 15%' }
      ]
    },
    'comm-arts': {
      eyebrowTh: 'นิเทศศาสตร์ & สื่อดิจิทัล • รอบ 3 Admission',
      eyebrowEn: 'Communication Arts • Round 3 Admission',
      titleTh: 'นิเทศศาสตร์ & วารสารศาสตร์สื่อสารมวลชน',
      titleEn: 'Communication Arts & Digital Media',
      cutoffs: [76.20, 75.60, 74.90],
      topSubjectTh: 'TGAT & A-Level อังกฤษ',
      topSubjectEn: 'TGAT & A-Level English',
      subjects: [
        { key: 'tgat', weight: 0.40, th: 'TGAT ความถนัดทั่วไป', en: 'TGAT General Aptitude', subTh: 'รหัส 90 • ค่าน้ำหนักสูงสุด 40%', subEn: 'Code 90 • Highest Weight 40%' },
        { key: 'eng', weight: 0.30, th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', subTh: 'รหัส 82 • ค่าน้ำหนัก 30%', subEn: 'Code 82 • Weight 30%' },
        { key: 'thai', weight: 0.15, th: 'A-Level ภาษาไทย', en: 'A-Level Thai Language', subTh: 'รหัส 81 • ค่าน้ำหนัก 15%', subEn: 'Code 81 • Weight 15%' },
        { key: 'social', weight: 0.15, th: 'A-Level สังคมศึกษา', en: 'A-Level Social Studies', subTh: 'รหัส 70 • ค่าน้ำหนัก 15%', subEn: 'Code 70 • Weight 15%' }
      ]
    },
    'law': {
      eyebrowTh: 'นิติศาสตร์ • รอบ 3 Admission',
      eyebrowEn: 'Faculty of Law • Round 3 Admission',
      titleTh: 'นิติศาสตร์ (เกณฑ์สายศิลป์/ทั่วไป)',
      titleEn: 'Faculty of Law (General Track)',
      cutoffs: [71.90, 71.30, 70.80],
      topSubjectTh: 'TGAT & A-Level ภาษาไทย',
      topSubjectEn: 'TGAT & A-Level Thai',
      subjects: [
        { key: 'tgat', weight: 0.35, th: 'TGAT ความถนัดทั่วไป', en: 'TGAT General Aptitude', subTh: 'รหัส 90 • ค่าน้ำหนักสูงสุด 35%', subEn: 'Code 90 • Highest Weight 35%' },
        { key: 'thai', weight: 0.25, th: 'A-Level ภาษาไทย', en: 'A-Level Thai Language', subTh: 'รหัส 81 • ค่าน้ำหนัก 25%', subEn: 'Code 81 • Weight 25%' },
        { key: 'social', weight: 0.25, th: 'A-Level สังคมศึกษา', en: 'A-Level Social Studies', subTh: 'รหัส 70 • ค่าน้ำหนัก 25%', subEn: 'Code 70 • Weight 25%' },
        { key: 'eng', weight: 0.15, th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', subTh: 'รหัส 82 • ค่าน้ำหนัก 15%', subEn: 'Code 82 • Weight 15%' }
      ]
    }
  };

  function getActiveSimFaculty() {
    return SIM_FACULTIES[PF_STATE.simFacultyKey] || SIM_FACULTIES['comp-eng'];
  }

  function updateSimCalculations() {
    var fac = getActiveSimFaculty();
    var total = 0;
    fac.subjects.forEach(function (s) {
      var val = Number(PF_STATE.simScores[s.key] !== undefined ? PF_STATE.simScores[s.key] : (SIM_DEFAULTS[s.key] || 70));
      total += val * s.weight;
      var valEl = document.getElementById('sim-val-' + s.key);
      var wEl = document.getElementById('sim-weighted-' + s.key);
      if (valEl) valEl.textContent = val.toFixed(2);
      if (wEl) wEl.textContent = (currentLang === 'th' ? 'คะแนนถ่วงน้ำหนัก: ' : 'Weighted: ') + (val * s.weight).toFixed(2) + ' / ' + Math.round(s.weight * 100);
    });

    var cutoff = fac.cutoffs[0];
    var buffer = total - cutoff;
    var chance = Math.max(12, Math.min(99, Math.round(55 + buffer * 8.5)));
    var totalStr = total.toFixed(2);
    var bufStr = (buffer >= 0 ? '+' : '') + buffer.toFixed(2);

    var eyEl = document.getElementById('sim-major-eyebrow');
    var ftEl = document.getElementById('sim-faculty-title');
    var c69El = document.getElementById('sim-cutoff-67');
    var h69 = document.getElementById('sim-hist-69');
    var h68 = document.getElementById('sim-hist-68');
    var h67 = document.getElementById('sim-hist-67');
    if (eyEl) eyEl.textContent = currentLang === 'th' ? fac.eyebrowTh : fac.eyebrowEn;
    if (ftEl) ftEl.textContent = currentLang === 'th' ? fac.titleTh : fac.titleEn;
    if (c69El) c69El.textContent = fac.cutoffs[0].toFixed(2);
    if (h69) h69.textContent = fac.cutoffs[0].toFixed(2);
    if (h68) h68.textContent = fac.cutoffs[1].toFixed(2);
    if (h67) h67.textContent = fac.cutoffs[2].toFixed(2);

    var totalEl = document.getElementById('sim-total-score');
    var bufEl = document.getElementById('sim-buffer-val');
    var chEl = document.getElementById('sim-chance-pct');
    var barEl = document.getElementById('sim-chance-bar');
    var zoneEl = document.getElementById('sim-zone-badge');
    var tipEl = document.getElementById('sim-strategy-tip');
    var matchSimBadge = document.getElementById('matches-sim-badge');

    if (totalEl) totalEl.textContent = totalStr;
    if (bufEl) bufEl.textContent = bufStr;
    if (chEl) chEl.textContent = chance + '%';
    if (barEl) barEl.style.width = chance + '%';
    if (matchSimBadge) matchSimBadge.textContent = (currentLang === 'th' ? 'คะแนนจำลองล่าสุด: ' : 'Simulated Score: ') + totalStr + ' / 100';

    if (zoneEl) {
      if (buffer >= 2) {
        zoneEl.textContent = currentLang === 'th' ? 'โซนปลอดภัย (Safe Zone)' : 'Safe Zone';
        zoneEl.className = 'px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm';
      } else if (buffer >= -1) {
        zoneEl.textContent = currentLang === 'th' ? 'โซนลุ้น (Target Zone)' : 'Target Zone';
        zoneEl.className = 'px-gutter-sm py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm';
      } else {
        zoneEl.textContent = currentLang === 'th' ? 'โซนท้าทาย (Reach)' : 'Reach Zone';
        zoneEl.className = 'px-gutter-sm py-0.5 rounded-full bg-surface-container text-on-surface font-label text-label-sm';
      }
    }

    if (tipEl) {
      tipEl.textContent = currentLang === 'th'
        ? ('ข้อเสนอแนะ: เพิ่มอีกเพียง 4 คะแนนใน ' + fac.topSubjectTh + ' โอกาสสอบติด TCAS70 จะขยับสู่ ' + Math.min(99, chance + 7) + '% (High Safe Zone)')
        : ('Strategy Tip: Adding +4 points in ' + fac.topSubjectEn + ' raises your estimated TCAS70 chance to ' + Math.min(99, chance + 7) + '% (High Safe Zone).');
    }

    // Sync Page 6 Coach Summary
    var coachHeadline = document.getElementById('coach-summary-headline');
    var coachChance = document.getElementById('coach-chance-badge');
    var coachSim = document.getElementById('coach-sim-score');
    var coachSafe = document.getElementById('coach-safe-target');
    var coachGap = document.getElementById('coach-priority-gap');
    if (coachChance) coachChance.textContent = chance + '%';
    if (coachSim) coachSim.textContent = totalStr + ' / 100';
    if (coachSafe) coachSafe.textContent = (fac.cutoffs[0] + 2).toFixed(2) + ' / 100';
    if (coachGap) {
      var gapTh = '+4 คะแนน ' + fac.topSubjectTh;
      var gapEn = '+4 points ' + fac.topSubjectEn;
      coachGap.setAttribute('data-th', gapTh);
      coachGap.setAttribute('data-en', gapEn);
      coachGap.textContent = currentLang === 'th' ? gapTh : gapEn;
    }
    if (coachHeadline) {
      coachHeadline.textContent = currentLang === 'th'
        ? ('สถานะโดยรวมของคุณอยู่ใน' + (buffer >= 2 ? 'โซนปลอดภัย' : 'โซนลุ้น') + ' (' + chance + '%) สำหรับเป้าหมายปัจจุบัน')
        : ('Your overall status is in the ' + (buffer >= 2 ? 'Safe Zone' : 'Target Zone') + ' (' + chance + '%) for your target major');
    }
  }

  /* [JS 4.8] Page 5-6 Controllers (Score Simulator & AI Academic Coach) */
  function renderScoreSim() {
    var list = document.getElementById('sim-subjects-list');
    if (!list) return;
    var fac = getActiveSimFaculty();
    var facSel = document.getElementById('sim-faculty-select');
    if (facSel) facSel.value = PF_STATE.simFacultyKey || 'comp-eng';
    list.innerHTML = fac.subjects.map(function (s) {
      var val = Number(PF_STATE.simScores[s.key] !== undefined ? PF_STATE.simScores[s.key] : (SIM_DEFAULTS[s.key] || 70));
      var pctLabel = Math.round(s.weight * 100) + '%';
      var labelTxt = currentLang === 'th' ? s.th : s.en;
      return '<article class="p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-gutter-xs">' +
        '<div class="flex items-start justify-between gap-gutter-sm">' +
          '<div class="flex flex-col gap-0.5">' +
            '<div class="flex items-center gap-gutter-xs">' +
              '<span class="font-title text-title-md text-on-surface">' + labelTxt + '</span>' +
              '<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + pctLabel + '</span>' +
            '</div>' +
            '<span class="font-body text-label-sm text-on-surface-variant">' + (currentLang === 'th' ? s.subTh : s.subEn) + '</span>' +
          '</div>' +
          '<div class="flex flex-col items-end shrink-0 gap-0.5">' +
            '<input type="number" min="0" max="100" step="0.5" value="' + val.toFixed(1) + '" data-sim-input="' + s.key + '" aria-label="' + labelTxt + '" class="w-24 text-right px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant font-display text-title-lg text-secondary-text tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" />' +
            '<span class="font-label text-label-sm text-on-surface-variant">' + (currentLang === 'th' ? 'พิมพ์หรือเลื่อนคะแนน' : 'Type or slide') + '</span>' +
          '</div>' +
        '</div>' +
        '<input type="range" min="0" max="100" step="0.5" value="' + val + '" data-sim-slider="' + s.key + '" class="w-full accent-primary cursor-pointer" />' +
        '<div class="flex items-center justify-between font-metric text-label-sm text-on-surface-variant tabular-nums">' +
          '<span>0</span>' +
          '<span id="sim-weighted-' + s.key + '" class="text-secondary-text">' + (currentLang === 'th' ? 'คะแนนถ่วงน้ำหนัก: ' : 'Weighted: ') + (val * s.weight).toFixed(2) + ' / ' + Math.round(s.weight * 100) + '</span>' +
          '<span>100</span>' +
        '</div>' +
      '</article>';
    }).join('');

    list.querySelectorAll('[data-sim-slider]').forEach(function (slider) {
      slider.addEventListener('input', function () {
        var k = slider.getAttribute('data-sim-slider');
        var num = Number(slider.value);
        PF_STATE.simScores[k] = num;
        var numInp = list.querySelector('[data-sim-input="' + k + '"]');
        if (numInp) numInp.value = num.toFixed(1);
        updateSimCalculations();
      });
    });
    list.querySelectorAll('[data-sim-input]').forEach(function (numInp) {
      numInp.addEventListener('input', function () {
        var k = numInp.getAttribute('data-sim-input');
        if (numInp.value === '') return;
        var parsed = parseFloat(numInp.value);
        if (isNaN(parsed)) return;
        var clamped = Math.max(0, Math.min(100, parsed));
        PF_STATE.simScores[k] = clamped;
        var slider = list.querySelector('[data-sim-slider="' + k + '"]');
        if (slider) slider.value = String(clamped);
        updateSimCalculations();
      });
      numInp.addEventListener('blur', function () {
        var k = numInp.getAttribute('data-sim-input');
        var parsed = parseFloat(numInp.value);
        var clamped = isNaN(parsed) ? Number(PF_STATE.simScores[k] || 0) : Math.max(0, Math.min(100, parsed));
        PF_STATE.simScores[k] = clamped;
        numInp.value = clamped.toFixed(1);
        var slider = list.querySelector('[data-sim-slider="' + k + '"]');
        if (slider) slider.value = String(clamped);
        updateSimCalculations();
      });
    });
    updateSimCalculations();
  }

  var simResetBtn = document.getElementById('sim-reset-btn');
  if (simResetBtn) {
    simResetBtn.addEventListener('click', function () {
      PF_STATE.simScores = Object.assign({}, SIM_DEFAULTS);
      renderScoreSim();
    });
  }

  var simFacultySelect = document.getElementById('sim-faculty-select');
  if (simFacultySelect) {
    simFacultySelect.addEventListener('change', function () {
      PF_STATE.simFacultyKey = simFacultySelect.value || 'comp-eng';
      renderScoreSim();
    });
  }

  // Page 6: High-Yield Topics & Interactive AI Coach Q&A
  var HIGH_YIELD_TOPICS = [
    { rank: 1, yieldScore: '9.8/10', th: 'สถิติและการแจกแจงความน่าจะเป็น', en: 'Statistics & Probability Distribution', weightTh: 'ออกสอบ 5–6 ข้อ (~16 คะแนน)', weightEn: '5–6 Qs (~16 pts)', descTh: 'เนื้อหาตรงไปตรงมา เน้นอ่านตาราง Z ค่ามาตรฐาน และแจกแจงทวินาม เก็บแต้มได้เต็มแน่นอน', descEn: 'High predictability: Z-tables, standard deviation, and binomial distribution.', hrsTh: '6–8 ชั่วโมง', hrsEn: '6–8 hrs' },
    { rank: 2, yieldScore: '9.2/10', th: 'แคลคูลัสประยุกต์ (ลิมิต & อนุพันธ์)', en: 'Applied Calculus (Limits & Derivatives)', weightTh: 'ออกสอบ 4 ข้อ (~12 คะแนน)', weightEn: '4 Qs (~12 pts)', descTh: 'เน้นสูตรมาตรฐาน จุดวิกฤต/ค่าสูงสุดต่ำสุด และการหาอินทิเกรตพื้นที่ใต้กราฟ', descEn: 'Standard formulas, critical points, optimization, and area under curves.', hrsTh: '10–12 ชั่วโมง', hrsEn: '10–12 hrs' },
    { rank: 3, yieldScore: '8.9/10', th: 'จำนวนจริงและพหุนาม', en: 'Real Numbers & Polynomials', weightTh: 'ออกสอบ 3 ข้อ (~9 คะแนน)', weightEn: '3 Qs (~9 pts)', descTh: 'เก็บบล็อกพื้นฐานง่าย เส้นจำนวน อสมการ ค่าสัมบูรณ์ และทฤษฎีบทเศษเหลือ', descEn: 'Quick foundational points: inequalities, absolute values, remainder theorem.', hrsTh: '5–6 ชั่วโมง', hrsEn: '5–6 hrs' }
  ];

  function renderCoachYield() {
    var grid = document.getElementById('coach-yield-grid');
    if (!grid) return;
    grid.innerHTML = HIGH_YIELD_TOPICS.map(function (t) {
      return '<article class="p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col justify-between gap-gutter-sm">' +
        '<div class="flex flex-col gap-gutter-xs">' +
          '<div class="flex items-center justify-between gap-2">' +
            '<span class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm">' + (currentLang === 'th' ? 'อันดับ ' : 'Rank #') + t.rank + '</span>' +
            '<span class="font-metric text-label-sm text-secondary-text tabular-nums">' + (currentLang === 'th' ? 'คุ้มค่า ' : 'Yield ') + t.yieldScore + '</span>' +
          '</div>' +
          '<h3 class="font-title text-title-md text-on-surface">' + (currentLang === 'th' ? t.th : t.en) + '</h3>' +
          '<span class="font-label text-label-sm text-secondary-text">' + (currentLang === 'th' ? t.weightTh : t.weightEn) + '</span>' +
          '<p class="font-body text-label-md text-on-surface-variant">' + (currentLang === 'th' ? t.descTh : t.descEn) + '</p>' +
        '</div>' +
        '<div class="flex items-center justify-between pt-2 border-t border-outline-variant font-label text-label-sm">' +
          '<span class="text-on-surface-variant">' + (currentLang === 'th' ? 'เวลาอ่านแนะนำ' : 'Est. Study') + '</span>' +
          '<span class="font-metric text-on-surface tabular-nums">' + (currentLang === 'th' ? t.hrsTh : t.hrsEn) + '</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function appendCoachMessage(textOrObj, isUser) {
    var log = document.getElementById('coach-chat-log');
    if (!log) return;
    var bubble = document.createElement('div');
    bubble.className = isUser
      ? 'self-end p-gutter-md rounded-xl bg-primary text-on-primary flex flex-col gap-1 max-w-xl'
      : 'p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-1 max-w-2xl';
    var thTxt = typeof textOrObj === 'object' ? textOrObj.th : textOrObj;
    var enTxt = typeof textOrObj === 'object' ? textOrObj.en : textOrObj;
    var showTxt = currentLang === 'th' ? thTxt : enTxt;
    var p = document.createElement('p');
    p.className = 'font-body text-body-md';
    if (typeof textOrObj === 'object') {
      p.setAttribute('data-th', thTxt);
      p.setAttribute('data-en', enTxt);
    }
    p.textContent = showTxt;
    if (!isUser) {
      var lbl = document.createElement('span');
      lbl.className = 'font-label text-label-sm text-secondary-text';
      lbl.textContent = 'AI Academic Coach';
      bubble.appendChild(lbl);
    }
    bubble.appendChild(p);
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function generateCoachReply(q) {
    var lower = q.toLowerCase();
    var simTotal = document.getElementById('sim-total-score') ? document.getElementById('sim-total-score').textContent : '74.50';
    if (lower.indexOf('คณิต') !== -1 || lower.indexOf('math') !== -1 || lower.indexOf('เวลา') !== -1) {
      return {
        th: 'แนะนำสูตร 30-40-20 สำหรับคณิต 1 (90 นาที): 30 นาทีแรกเก็บ 10 ข้อพื้นฐาน (สถิติ/จำนวนจริง) 40 นาทีถัดไปลุยแคลคูลัสกับเวกเตอร์ และ 20 นาทีสุดท้ายทวนข้อที่เว้นไว้ครับ',
        en: 'Use the 30-40-20 pacing rule for 90-min Math 1: spend 30 mins locking in 10 core questions (Stats/Real Numbers), 40 mins on Calculus & Vectors, and 20 mins reviewing skipped items.'
      };
    }
    if (lower.indexOf('port') !== -1 || lower.indexOf('รอบ 1') !== -1 || lower.indexOf('round 1') !== -1) {
      return {
        th: 'ด้วย GPAX ' + Number(PF_STATE.gpax).toFixed(2) + ' แนะนำให้จัดเวลา 60% ทำ Portfolio รอบ 1 จนถึงเดือน พ.ย. และคงเวลา 40% อ่าน TGAT/TPAT3 + คณิต 1 เป็นฐานสำรองรอบ 3 ครับ',
        en: 'With a ' + Number(PF_STATE.gpax).toFixed(2) + ' GPAX, dedicate 60% of your weekly ' + PF_STATE.weeklyHours + ' hrs to Round 1 Portfolio through November, while keeping 40% on TGAT/TPAT3 & Math 1 as a Round 3 safety net.'
      };
    }
    return {
      th: 'จากคะแนนจำลองปัจจุบัน (' + simTotal + ' / 100) แนะนำให้จัดอันดับ TCAS สูตร 2-4-4: 2 อันดับแรกเลือกคณะในฝันที่คะแนนเฉียดเกณฑ์ 4 อันดับกลางเลือกโซนปลอดภัย (+2 ถึง +5 คะแนน) และ 4 อันดับท้ายเป็นคณะสำรองชัวร์ครับ',
      en: 'At your current simulated score (' + simTotal + ' / 100), follow the 2-4-4 TCAS ranking formula: 2 Reach choices, 4 Safe Zone targets (+2 to +5 points buffer), and 4 high-certainty backup programs.'
    };
  }

  document.querySelectorAll('[data-coach-prompt-th]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var qTh = btn.getAttribute('data-coach-prompt-th') || btn.textContent.trim();
      var qEn = btn.getAttribute('data-coach-prompt-en') || qTh;
      appendCoachMessage({ th: qTh, en: qEn }, true);
      setTimeout(function () { appendCoachMessage(generateCoachReply(qTh), false); }, 260);
    });
  });

  var coachForm = document.getElementById('coach-chat-form');
  var coachInput = document.getElementById('coach-chat-input');
  if (coachForm && coachInput) {
    coachForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = coachInput.value.trim();
      if (!q) return;
      coachInput.value = '';
      appendCoachMessage(q, true);
      setTimeout(function () { appendCoachMessage(generateCoachReply(q), false); }, 280);
    });
  }

  window.renderScoreSim = renderScoreSim;
  window.renderCoachYield = renderCoachYield;
  window.updateSimCalculations = updateSimCalculations;

  renderScoreSim();
  renderCoachYield();
})();

/* Live Behavior & Interest AI Coach Analyzer (visible on every window) */
(function () {
  var INTEREST_LABELS = {
    'tech-ai': { th: 'AI & เทคโนโลยี', en: 'AI & Tech' },
    'product-ux': { th: 'ออกแบบ UX/UI', en: 'UX/UI Design' },
    'data-biz': { th: 'ธุรกิจ & Data', en: 'Business & Data' },
    'health-bio': { th: 'การแพทย์ & ชีววิทยา', en: 'Medicine & Bio' },
    'eng-robot': { th: 'วิศวะ & หุ่นยนต์', en: 'Engineering & Robotics' },
    'media-game': { th: 'สื่อดิจิทัล & เกม', en: 'Media & Games' },
    'law-pol': { th: 'นิติศาสตร์ & รัฐศาสตร์', en: 'Law & Politics' },
    'arch-design': { th: 'สถาปัตยกรรม', en: 'Architecture' },
    'fin-econ': { th: 'การเงิน & เศรษฐศาสตร์', en: 'Finance & Econ' },
    'edu-psych': { th: 'จิตวิทยา & การศึกษา', en: 'Psychology & Ed' },
    'sci-space': { th: 'วิทยาศาสตร์ & อวกาศ', en: 'Science & Space' },
    'lang-comm': { th: 'ภาษา & นิเทศศาสตร์', en: 'Languages & Comm' },
    'env-agri': { th: 'สิ่งแวดล้อม & เกษตร', en: 'Env & AgriTech' },
    'music-art': { th: 'ศิลปะ & ดนตรี', en: 'Arts & Music' }
  };

  var floatBtn = document.getElementById('floating-ai-coach-btn');
  var floatPanel = document.getElementById('floating-ai-coach-panel');
  var floatClose = document.getElementById('floating-coach-close');
  var floatOpenFull = document.getElementById('floating-coach-open-full');

  function getInterestText(lang) {
    var list = (PF_STATE.interests || []).map(function (k) {
      var meta = INTEREST_LABELS[k];
      return meta ? meta[lang] : k;
    });
    if (PF_STATE.customInterestText && PF_STATE.customInterestText.trim()) {
      list.push('"' + PF_STATE.customInterestText.trim() + '"');
    }
    if (!list.length) return lang === 'th' ? 'ยังไม่ได้เลือกความสนใจ' : 'No interests selected yet';
    return list.slice(0, 4).join(', ') + (list.length > 4 ? ' +' + (list.length - 4) : '');
  }

  function updateFloatingCoachInsight() {
    var lang = PF_STATE.lang || 'th';
    var beh = PF_STATE.behavior || { visitedPages: ['1'], interactions: 0, pageClicks: {}, lastActionTh: '', lastActionEn: '' };
    var page = String(PF_STATE.page || '1');
    var badgeEl = document.getElementById('floating-coach-badge');
    var pagePill = document.getElementById('floating-coach-page-pill');
    var actionsPill = document.getElementById('floating-coach-actions-pill');
    var targetPill = document.getElementById('floating-coach-target-pill');
    var interestsEl = document.getElementById('floating-coach-interests-pill');
    var lastActionEl = document.getElementById('floating-coach-last-action');
    var insightEl = document.getElementById('floating-coach-insight');

    if (badgeEl) badgeEl.textContent = String(beh.interactions || 0);
    if (pagePill) pagePill.textContent = (lang === 'th' ? 'หน้า ' : 'Window ') + page + '/6';
    if (actionsPill) actionsPill.textContent = (beh.interactions || 0) + (lang === 'th' ? ' กิจกรรม' : ' actions');
    if (targetPill) {
      var simChance = document.getElementById('sim-chance-pct') ? document.getElementById('sim-chance-pct').textContent : '';
      targetPill.textContent = 'GPAX ' + Number(PF_STATE.gpax || 3.75).toFixed(2) + (simChance ? ' • ' + simChance : '');
    }
    if (interestsEl) interestsEl.textContent = getInterestText(lang);
    if (lastActionEl) lastActionEl.textContent = (lang === 'th' ? beh.lastActionTh : beh.lastActionEn) || '';

    if (insightEl) {
      var interestSummary = getInterestText(lang);
      var visitedCount = (beh.visitedPages || ['1']).length;
      var msg = '';
      if (page === '1') {
        msg = lang === 'th'
          ? 'คุณสำรวจไปแล้ว ' + visitedCount + '/6 หน้า • ความสนใจตั้งต้นคือ ' + interestSummary + ' กด "ค้นหาตัวเอง" เพื่อปรับโปรไฟล์ให้แม่นยำขึ้นได้เลย'
          : 'You have explored ' + visitedCount + '/6 windows. Initial interests: ' + interestSummary + '. Open Discovery to refine your profile.';
      } else if (page === '2') {
        msg = lang === 'th'
          ? 'ระบบจับความสนใจของคุณได้แก่ ' + interestSummary + ' (GPAX ' + Number(PF_STATE.gpax).toFixed(2) + ') ลองพิมพ์สิ่งที่ชอบเพิ่มเติมเพื่อให้ AI จับคู่คณะแม่นขึ้น'
          : 'Tracking your interests (' + interestSummary + ', GPAX ' + Number(PF_STATE.gpax).toFixed(2) + '). Type custom hobbies for sharper AI major matching.';
      } else if (page === '3') {
        msg = lang === 'th'
          ? 'จากความสนใจ ' + interestSummary + ' และ ' + (beh.interactions || 0) + ' การโต้ตอบ แนะนำให้กดล็อกคณะอันดับ #1 เพื่อสร้างแผน TCAS70 อัตโนมัติ'
          : 'Based on ' + interestSummary + ' and ' + (beh.interactions || 0) + ' actions, lock your #1 major card to auto-build your TCAS70 roadmap.';
      } else if (page === '4') {
        msg = lang === 'th'
          ? 'คุณกำลังดูแผนรายบุคคล (' + PF_STATE.weeklyHours + ' ชม./สัปดาห์) คลิกติ๊กงานที่ทำเสร็จหรือเปิดดูรายละเอียดเพื่ออัปเดตความพร้อมจริง'
          : 'Viewing your personal roadmap (' + PF_STATE.weeklyHours + ' hrs/wk). Check off completed milestones to update your readiness score.';
      } else if (page === '5') {
        var simScore = document.getElementById('sim-total-score') ? document.getElementById('sim-total-score').textContent : '74.50';
        msg = lang === 'th'
          ? 'คะแนนจำลอง TCAS70 ล่าสุดของคุณคือ ' + simScore + '/100 • AI แนะนำให้โฟกัสวิชาที่น้ำหนักสูงสุดเพื่อขยับเข้า Safe Zone'
          : 'Your live TCAS70 simulated score is ' + simScore + '/100. Focus on the highest-weight subject to push into the Safe Zone.';
      } else {
        msg = lang === 'th'
          ? 'AI โค้ชสรุปพฤติกรรมครบ ' + visitedCount + '/6 หน้า (' + (beh.interactions || 0) + ' กิจกรรม) พร้อมความสนใจ ' + interestSummary + ' — ถามกลยุทธ์ต่อด้านล่างได้เลย!'
          : 'AI Coach synthesized ' + visitedCount + '/6 windows (' + (beh.interactions || 0) + ' actions) and interests (' + interestSummary + ') — ask anything below!';
      }
      insightEl.textContent = msg;
    }
  }
  window.updateFloatingCoachInsight = updateFloatingCoachInsight;

  function recordBehavior(thText, enText) {
    if (!PF_STATE.behavior) return;
    PF_STATE.behavior.interactions = (PF_STATE.behavior.interactions || 0) + 1;
    var p = String(PF_STATE.page || '1');
    PF_STATE.behavior.pageClicks[p] = (PF_STATE.behavior.pageClicks[p] || 0) + 1;
    if (thText) PF_STATE.behavior.lastActionTh = thText;
    if (enText) PF_STATE.behavior.lastActionEn = enText;
    updateFloatingCoachInsight();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || t.closest('#floating-ai-coach-btn') || t.closest('#floating-ai-coach-panel')) return;
    if (t.closest('[data-interest-bubble]')) {
      recordBehavior('อัปเดตความสนใจในหน้าค้นหาตัวเอง', 'Updated interest bubble in Discovery');
    } else if (t.closest('[data-lock-btn]')) {
      recordBehavior('ล็อกคณะเป้าหมายสำหรับแผน TCAS70', 'Locked target major for TCAS70');
    } else if (t.closest('[data-waypoint-check]')) {
      recordBehavior('อัปเดตความคืบหน้าแผนรายบุคคล', 'Updated roadmap milestone');
    } else if (t.closest('#beyond-toggle')) {
      recordBehavior('ปรับโหมด Beyond 4.00', 'Toggled Beyond 4.00 mode');
    } else if (t.closest('button')) {
      recordBehavior('โต้ตอบบนหน้า ' + (PF_STATE.page || '1'), 'Interacted on Window ' + (PF_STATE.page || '1'));
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'custom-interest-input') {
      PF_STATE.customInterestText = t.value;
      recordBehavior('พิมพ์ความสนใจเฉพาะตัว', 'Typed custom interest');
    } else if (t.hasAttribute('data-sim-slider') || t.hasAttribute('data-sim-input')) {
      recordBehavior('ปรับคะแนนจำลอง TCAS70', 'Adjusted TCAS70 simulator score');
    } else if (t.id === 'hours-slider') {
      recordBehavior('ปรับชั่วโมงเตรียมตัวต่อสัปดาห์', 'Adjusted weekly study hours');
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.id === 'sim-faculty-select') {
      recordBehavior('เปลี่ยนคณะจำลองคะแนน TCAS70', 'Switched TCAS70 simulator faculty');
    }
  });

  if (floatBtn && floatPanel) {
    floatBtn.addEventListener('click', function () {
      var isHidden = floatPanel.classList.contains('hidden');
      floatPanel.classList.toggle('hidden', !isHidden);
      floatBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      updateFloatingCoachInsight();
    });
  }
  if (floatClose && floatPanel && floatBtn) {
    floatClose.addEventListener('click', function () {
      floatPanel.classList.add('hidden');
      floatBtn.setAttribute('aria-expanded', 'false');
    });
  }
  if (floatOpenFull && floatPanel && floatBtn) {
    floatOpenFull.addEventListener('click', function () {
      floatPanel.classList.add('hidden');
      floatBtn.setAttribute('aria-expanded', 'false');
    });
  }

  updateFloatingCoachInsight();
})();
