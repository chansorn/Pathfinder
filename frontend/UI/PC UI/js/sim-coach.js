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
    // logged in: push the change to the account too (debounced, only what changed)
    if (window.PF_SYNC) window.PF_SYNC.schedule();
  }
  window.savePFState = savePFState;

  function hydratePFState() {
    try {
      var raw = localStorage.getItem(PF_STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      // page / step are not restored: opening the site always starts on the home page, form at Step 1
      Object.keys(saved).forEach(function (k) {
        if (saved[k] !== undefined && k !== 'page' && k !== 'step') PF_STATE[k] = saved[k];
      });

      if (Array.isArray(PF_STATE.interests)) {
        PF_STATE.interests = PF_STATE.interests.slice(0, window.MAX_INTERESTS || 4);
        document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
          setChipSelected(chip, PF_STATE.interests.indexOf(chip.getAttribute('data-interest-key')) !== -1);
        });
      }
      if (Array.isArray(PF_STATE.targetUnis)) {
        document.querySelectorAll('[data-uni-key]').forEach(function (chip) {
          setChipSelected(chip, PF_STATE.targetUnis.indexOf(chip.getAttribute('data-uni-key')) !== -1);
        });
      }
      if (typeof window.renderOtherUnis === 'function') window.renderOtherUnis();
      if (typeof window.renderFaculties === 'function') window.renderFaculties();
      // saved Beyond 4.00 on/off back onto the Step 2 toggle
      if (typeof renderBeyondToggle === 'function') renderBeyondToggle(false);
      if (typeof window.renderInterestPriority === 'function') window.renderInterestPriority();
      if (typeof window.renderProvince === 'function') window.renderProvince();
      if (window.PF_DECK && typeof window.PF_DECK.setMode === 'function') window.PF_DECK.setMode(PF_STATE.baselineMode === 'shuffle' ? 'shuffle' : 'university');
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
        if (typeof renderGpaxValue === 'function') renderGpaxValue();
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
      if (PF_STATE.lang && PF_STATE.lang !== currentLang && typeof setLang === 'function') setLang(PF_STATE.lang);
      if (typeof syncMajorMatches === 'function') syncMajorMatches();
      if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
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
      var gradeStr = pfGradeLabel();
      var summaryText = currentLang === 'th'
        ? ('PathFinder สรุปแผน TCAS 1–4\nคณะเป้าหมาย: ' + majorName + '\nโปรไฟล์: ' + pfGradePrefix() + 'GPAX ' + pfGpaxText() + ' • ' + pfHoursText() + ' ชม./สัปดาห์\nความพร้อม: ' + pct + (cd ? ' • เหลือเวลา: ' + cd : '') + '\nตรวจสอบเกณฑ์ทางการที่ mytcas.com')
        : ('PathFinder TCAS 1–4 Summary\nTarget Major: ' + majorName + '\nProfile: ' + pfGradePrefix() + 'GPAX ' + pfGpaxText() + ' • ' + pfHoursText() + ' hrs/wk\nReadiness: ' + pct + (cd ? ' • Time left: ' + cd : '') + '\nVerify official weightings at mytcas.com');

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
    resetBtn.addEventListener('click', async function () {
      var loggedIn = !!(window.PF_AUTH && window.PF_AUTH.getCurrentUser());
      if (loggedIn) {
        var ok = window.confirm(currentLang === 'th'
          ? 'ล้างแผนและเป้าหมายที่บันทึกไว้ในบัญชีด้วยไหม? (โปรไฟล์ คะแนน และประวัติ AI ยังอยู่)'
          : 'Also clear the plan and targets saved in your account? (Profile, scores and AI history stay.)');
        if (!ok) return;
        try { await PF_API.request('/my-plan/reset', { method: 'POST', auth: true }); } catch (e) {}
      }
      try { localStorage.removeItem(PF_STORAGE_KEY); } catch (e) {}
      window.location.reload();
    });
  }

  // Page 3 Filter Chips

  // =====================================================================
  // Page 5: Score Simulator - real data only
  //   faculty group  -> GET  /tcas/faculty-groups/:key/programs   (most applicants first)
  //   chosen program -> POST /tcas/programs/:id/simulate          (myTCAS weights + official past cutoffs)
  // No data = "—". The bar is the position inside last year's min..max range, not a chance of admission.
  // =====================================================================
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function T(th, en) { return currentLang === 'th' ? th : en; }
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function fmt(n) { return typeof n === 'number' && isFinite(n) ? n.toFixed(2) : '—'; }
  // the total score rolls from the old number to the new one (≈0.4s, ease-out); '—' and reduced motion jump
  var countRaf = null;
  function countTo(el, to) {
    if (!el) return;
    var from = parseFloat(el.textContent);
    cancelAnimationFrame(countRaf);
    if (typeof to !== 'number' || !isFinite(to) || isNaN(from) || from === to || (window.pfReducedMotion && window.pfReducedMotion())) { el.textContent = fmt(to); return; }
    var t0 = null;
    var step = function (ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / 420);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) countRaf = requestAnimationFrame(step);
    };
    countRaf = requestAnimationFrame(step);
  }

  var SIM_DEFAULTS = { tgat: 68, tpat1: 68, tpat3: 72, tpat4: 74, math1: 78, physics: 75, chem: 76, bio: 74, eng: 82.5, thai: 78, social: 75 };
  // slider key -> how it is sent to the backend, and which myTCAS weight names it covers (order matters)
  var SIM_SUBJECTS = {
    tgat: { th: 'TGAT ความถนัดทั่วไป', en: 'TGAT General Aptitude', exam_type: 'TGAT', subject: 'TGAT', re: /^TGAT/i },
    tpat1: { th: 'TPAT1 วิชาเฉพาะ กสพท', en: 'TPAT1 Medical Aptitude', exam_type: 'TPAT', subject: 'TPAT1', re: /^TPAT\s*1/i },
    tpat3: { th: 'TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์', en: 'TPAT3 Science, Tech & Engineering', exam_type: 'TPAT', subject: 'TPAT3', re: /^TPAT\s*3/i },
    tpat4: { th: 'TPAT4 ความถนัดทางสถาปัตยกรรม', en: 'TPAT4 Architecture', exam_type: 'TPAT', subject: 'TPAT4', re: /^TPAT\s*4/i },
    math1: { th: 'A-Level คณิตศาสตร์ประยุกต์ 1', en: 'A-Level Applied Math 1', exam_type: 'A-Level', subject: 'คณิตศาสตร์ประยุกต์ 1', re: /คณิต[^2]*1|math\s*1/i },
    physics: { th: 'A-Level ฟิสิกส์', en: 'A-Level Physics', exam_type: 'A-Level', subject: 'ฟิสิกส์', re: /ฟิสิกส์|physics/i },
    chem: { th: 'A-Level เคมี', en: 'A-Level Chemistry', exam_type: 'A-Level', subject: 'เคมี', re: /เคมี|chem/i },
    bio: { th: 'A-Level ชีววิทยา', en: 'A-Level Biology', exam_type: 'A-Level', subject: 'ชีววิทยา', re: /ชีว|bio/i },
    eng: { th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English', exam_type: 'A-Level', subject: 'ภาษาอังกฤษ', re: /^A-Level.*(อังกฤษ|english)/i },
    thai: { th: 'A-Level ภาษาไทย', en: 'A-Level Thai', exam_type: 'A-Level', subject: 'ภาษาไทย', re: /ภาษาไทย|thai/i },
    social: { th: 'A-Level สังคมศึกษา', en: 'A-Level Social Studies', exam_type: 'A-Level', subject: 'สังคมศึกษา', re: /สังคม|social/i }
  };
  // UI faculty key -> backend group + subjects shown before the program's real weights arrive
  var SIM_GROUPS = {
    'comp-eng': { group: 'computer-eng', subjects: ['tgat', 'tpat3', 'math1', 'physics', 'chem', 'eng'] },
    'med': { group: 'medicine', subjects: ['tpat1', 'bio', 'chem', 'physics', 'math1', 'eng'] },
    'bba': { group: 'bba', subjects: ['tgat', 'math1', 'eng', 'social'] },
    'arch-ux': { group: 'architecture-design', subjects: ['tpat4', 'tgat', 'math1', 'eng'] },
    'comm-arts': { group: 'comm-arts', subjects: ['tgat', 'eng', 'thai', 'social'] },
    'law': { group: 'law', subjects: ['tgat', 'thai', 'social', 'eng'] }
  };

  // only scores the student typed / slid are kept. Older saves were pre-filled with SIM_DEFAULTS (made-up
  // numbers), so those are cleared once; SIM_DEFAULTS is now only where an untouched slider sits.
  if (!PF_STATE.simScoresV2) { PF_STATE.simScores = {}; PF_STATE.simScoresV2 = true; }
  PF_STATE.simScores = PF_STATE.simScores || {};
  if (!SIM_GROUPS[PF_STATE.simFacultyKey]) PF_STATE.simFacultyKey = 'comp-eng';

  var sim = {
    seq: 0, timer: null, ctrl: null,
    group: null, programs: [],
    subjects: null, renderedFor: null, // slider list from the program's real weights
    weights: {}, contributes: {}, unsupported: [],
    result: null, admission: null
  };
  window.PF_SIM = sim; // the coach reads the latest result from here

  // the score the student entered, or null (not entered yet)
  function scoreOf(k) {
    var v = PF_STATE.simScores[k];
    return v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v);
  }
  function enteredCount() { return activeSubjects().filter(function (k) { return scoreOf(k) !== null; }).length; }
  function activeSubjects() {
    return sim.subjects || (SIM_GROUPS[PF_STATE.simFacultyKey] || SIM_GROUPS['comp-eng']).subjects;
  }
  function subjectLabel(k) { return T(SIM_SUBJECTS[k].th, SIM_SUBJECTS[k].en); }

  function scoresBody() {
    var out = [];
    activeSubjects().forEach(function (k) {
      var s = SIM_SUBJECTS[k];
      var v = scoreOf(k);
      if (v === null) return; // not entered: the backend reports it as missing instead of guessing
      out.push({ exam_type: s.exam_type, subject: s.subject, score: v });
      // programs that weigh TGAT1/2/3 separately get the same value for each part
      if (k === 'tgat') ['TGAT1', 'TGAT2', 'TGAT3'].forEach(function (x) { out.push({ exam_type: 'TGAT', subject: x, score: v }); });
    });
    return out;
  }

  function keyForWeight(name) {
    var keys = Object.keys(SIM_SUBJECTS);
    for (var i = 0; i < keys.length; i++) if (SIM_SUBJECTS[keys[i]].re.test(name)) return keys[i];
    return null;
  }

  // the admission the backend calls best, else the first one with a score
  function pickAdmission(data) {
    var list = (data && data.admissions) || [];
    var best = data && data.best;
    var hit = best && list.find(function (a) { return a.project_name === best.project_name && a.round === best.round; });
    return hit || list.find(function (a) { return a.score && a.score.parts && a.score.parts.length; }) || list[0] || null;
  }

  function readWeights(adm) {
    sim.weights = {}; sim.contributes = {}; sim.unsupported = [];
    var keys = [];
    ((adm && adm.score && adm.score.parts) || []).forEach(function (p) {
      var k = keyForWeight(p.subject || '');
      if (!k) { sim.unsupported.push(p.subject + ' ' + p.weight + '%'); return; }
      if (keys.indexOf(k) === -1) keys.push(k);
      sim.weights[k] = (sim.weights[k] || 0) + Number(p.weight || 0);
      sim.contributes[k] = (sim.contributes[k] || 0) + Number(p.contributes || 0);
    });
    return keys;
  }

  async function loadPrograms() {
    var g = SIM_GROUPS[PF_STATE.simFacultyKey] || SIM_GROUPS['comp-eng'];
    var seq = ++sim.seq;
    sim.subjects = null; sim.renderedFor = null; sim.result = null; sim.admission = null;
    renderScoreSim(true);
    renderSimResult();
    setText('sim-strategy-tip', T('กำลังโหลดหลักสูตร…', 'Loading programs…'));
    try {
      var data = await PF_API.request('/tcas/faculty-groups/' + g.group + '/programs?limit=10', { auth: false });
      if (seq !== sim.seq) return;
      sim.group = data.group || null;
      sim.programs = data.items || [];
      var sel = document.getElementById('sim-program-select');
      if (sel) {
        sel.innerHTML = sim.programs.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.university + ' • ' + p.program) + '</option>';
        }).join('');
        sel.classList.toggle('hidden', !sim.programs.length);
      }
      var keep = sim.programs.some(function (p) { return p.id === PF_STATE.simProgramId; });
      PF_STATE.simProgramId = keep ? PF_STATE.simProgramId : (sim.programs[0] ? sim.programs[0].id : null);
      if (sel && PF_STATE.simProgramId) sel.value = PF_STATE.simProgramId;
      if (!PF_STATE.simProgramId) {
        renderSimResult();
        return;
      }
      runSimulate();
    } catch (err) {
      if (seq !== sim.seq) return;
      setText('sim-strategy-tip', PF_API.errorText(err));
    }
  }

  function scheduleSimulate() {
    clearTimeout(sim.timer);
    sim.timer = setTimeout(runSimulate, 350);
  }

  async function runSimulate() {
    var id = PF_STATE.simProgramId;
    if (!id) return;
    if (sim.ctrl) sim.ctrl.abort();
    var ctrl = sim.ctrl = new AbortController();
    var gpax = PF_STATE.gpaxSet ? Number(PF_STATE.gpax) : NaN;
    var body = { scores: scoresBody() };
    if (isFinite(gpax) && gpax > 0) body.gpax = Math.min(4, gpax);
    try {
      var data = await PF_API.request('/tcas/programs/' + encodeURIComponent(id) + '/simulate', { method: 'POST', auth: false, body: body, signal: ctrl.signal });
      if (ctrl !== sim.ctrl) return;
      sim.result = data;
      sim.admission = pickAdmission(data);
      var keys = readWeights(sim.admission);
      // first answer for this program: sliders = the subjects it really weighs, then score again
      if (sim.renderedFor !== id) {
        sim.renderedFor = id;
        if (keys.length && keys.join() !== activeSubjects().join()) {
          sim.subjects = keys;
          renderScoreSim(true);
          scheduleSimulate();
        }
      }
      renderSimResult();
    } catch (err) {
      if (err.code === 'ABORTED' || ctrl !== sim.ctrl) return;
      setText('sim-strategy-tip', PF_API.errorText(err));
    }
  }

  var ZONE_TEXT = {
    safe: ['โซนปลอดภัย (Safe)', 'Safe Zone', 'bg-secondary-container text-on-secondary-container'],
    target: ['โซนลุ้น (Target)', 'Target Zone', 'bg-tertiary-container text-on-tertiary-container'],
    reach: ['โซนท้าทาย (Reach)', 'Reach Zone', 'bg-surface-container text-on-surface']
  };

  function renderSimResult() {
    var data = sim.result;
    var adm = sim.admission;
    var score = adm && adm.score;
    var zone = adm && adm.zone;
    var groupName = sim.group ? T(sim.group.label_th || '', sim.group.label_en || '') : '';

    setText('sim-major-eyebrow', [groupName, adm ? T('รอบ ', 'Round ') + adm.round + ' ' + (adm.project_name || '') : ''].filter(Boolean).join(' • ') || '—');
    setText('sim-faculty-title', data && data.program ? data.program.university + ' • ' + data.program.program : T('เลือกหลักสูตร', 'Pick a program'));
    setText('sim-faculty-sub', adm
      ? T('สัดส่วนคะแนนจาก myTCAS', 'Weights from myTCAS') + (sim.unsupported.length ? T(' • ไม่รวมในตัวจำลอง: ', ' • not simulated: ') + sim.unsupported.join(', ') : '')
      : '');

    // per subject: real weight and points earned
    activeSubjects().forEach(function (k) {
      var w = sim.weights[k];
      setText('sim-wbadge-' + k, w ? Math.round(w) + '%' : '—');
      setText('sim-weighted-' + k, w
        ? T('ได้ ', 'Earns ') + fmt(sim.contributes[k] || 0) + T(' จาก ', ' of ') + Math.round(w)
        : T('หลักสูตรนี้ไม่ใช้วิชานี้', 'Not weighted by this program'));
    });

    var total = score && enteredCount() ? (typeof score.weighted_score === 'number' ? score.weighted_score : score.partial_score) : null;
    countTo(document.getElementById('sim-total-score'), total);

    var hist = ((adm && adm.cutoff_history) || []).slice().sort(function (a, b) { return b.academic_year - a.academic_year; });
    var latest = hist[0];
    setText('sim-cutoff-label', latest ? T('คะแนนต่ำสุดปี ', 'Min score ') + (latest.academic_year - 2500) : T('คะแนนต่ำสุดปีล่าสุด', 'Latest min score'));
    setText('sim-cutoff-67', latest ? fmt(Number(latest.min_score)) : '—');
    ['69', '68', '67'].forEach(function (slot, i) {
      var h = hist[i];
      setText('sim-hist-label-' + i, h ? 'TCAS' + (h.academic_year - 2500) : '—');
      setText('sim-hist-' + slot, h ? fmt(Number(h.min_score)) : '—');
    });

    var buffer = zone ? zone.buffer : (adm ? adm.gap_to_last_year : null);
    setText('sim-buffer-val', typeof buffer === 'number' ? (buffer >= 0 ? '+' : '') + buffer.toFixed(2) : '—');

    var pos = zone && typeof zone.position_in_last_year_range === 'number' ? Math.max(0, Math.min(100, zone.position_in_last_year_range)) : null;
    setText('sim-chance-pct', pos === null ? '—' : Math.round(pos) + '%');
    var bar = document.getElementById('sim-chance-bar');
    if (bar) bar.style.width = (pos || 0) + '%';

    var zoneEl = document.getElementById('sim-zone-badge');
    var zt = zone && ZONE_TEXT[zone.zone];
    if (zoneEl) {
      var zoneBefore = zoneEl.textContent;
      zoneEl.textContent = zt ? T(zt[0], zt[1]) : T('ยังประเมินโซนไม่ได้', 'No zone yet');
      if (zoneBefore && zoneBefore !== zoneEl.textContent && window.pfMotion) setTimeout(function () { window.pfMotion(zoneEl, 'pf-fade-in'); }, 0);
      zoneEl.className = 'px-gutter-sm py-0.5 rounded-full font-label text-label-sm ' + (zt ? zt[2] : 'bg-surface-container text-on-surface');
    }

    var missing = (score && score.missing || []).map(function (m) { return m.subject || m; });
    var tip = '';
    if (sim.group && sim.group.note) tip = sim.group.note;
    else if (sim.result && !enteredCount()) tip = T('ใส่คะแนนของคุณอย่างน้อย 1 วิชา (พิมพ์หรือเลื่อน) แล้วระบบจะคำนวณคะแนนรวมและโซนให้', 'Enter at least one of your scores (type or slide) to get your total and zone');
    else if (!sim.programs.length && sim.result === null && sim.group) tip = T('ยังไม่มีข้อมูลหลักสูตรในกลุ่มนี้', 'No programs in this group yet');
    else if (missing.length) tip = T('ยังขาดคะแนน: ', 'Missing scores: ') + missing.join(', ');
    else if (adm && !zone) tip = T('ยังไม่มีสถิติคะแนนต่ำสุดย้อนหลังของโครงการนี้', 'No past cutoff data for this project');
    else if (data && data.verify_note) tip = data.verify_note;
    if (tip || data) setText('sim-strategy-tip', tip);

    var badge = document.getElementById('matches-sim-badge');
    if (badge) badge.textContent = T('คะแนนจำลองล่าสุด: ', 'Simulated Score: ') + fmt(total) + ' / 100';

    // Page 6 summary from the same numbers
    var maxMin = hist.reduce(function (m, h) { return Math.max(m, Number(h.min_score) || 0); }, 0);
    setText('coach-chance-badge', zt ? T(zt[0], zt[1]) : '—');
    setText('coach-sim-score', fmt(total) + ' / 100');
    setText('coach-safe-target', maxMin ? (maxMin + 3).toFixed(2) + ' / 100' : '—');
    var focus = focusSubject();
    var gapEl = document.getElementById('coach-priority-gap');
    if (gapEl) {
      var th = focus ? 'เน้น ' + SIM_SUBJECTS[focus].th + ' (' + Math.round(sim.weights[focus]) + '%)' : '—';
      var en = focus ? 'Focus ' + SIM_SUBJECTS[focus].en + ' (' + Math.round(sim.weights[focus]) + '%)' : '—';
      gapEl.setAttribute('data-th', th);
      gapEl.setAttribute('data-en', en);
      gapEl.textContent = T(th, en);
    }
    setText('coach-summary-headline', zt
      ? T('ตอนนี้คะแนนจำลองอยู่ใน' + zt[0] + ' เทียบกับสถิติปีก่อนของ ' + (data.program.program || ''), 'Your simulated score sits in the ' + zt[1] + ' against last year for ' + (data.program.program || ''))
      : T('ลองจำลองคะแนนในหน้า 5 เพื่อดูตำแหน่งเทียบสถิติจริง', 'Try the simulator (page 5) to compare with official past cutoffs'));

    sim.total = total;
    sim.missing = missing;
    if (typeof window.updateFloatingCoachInsight === 'function') window.updateFloatingCoachInsight();
  }

  // the subject where raising the score moves the total most
  function focusSubject() {
    var best = null, bestGain = 0;
    Object.keys(sim.weights).forEach(function (k) {
      var gain = sim.weights[k] * (100 - (scoreOf(k) || 0));
      if (gain > bestGain) { bestGain = gain; best = k; }
    });
    return best;
  }

  function updateSimCalculations() {
    // what the student typed is shown at once, the scored result follows from the backend
    activeSubjects().forEach(function (k) { var v = scoreOf(k); setText('sim-val-' + k, v === null ? '—' : v.toFixed(2)); });
    scheduleSimulate();
  }

  /* [JS 4.8] Page 5-6 Controllers (Score Simulator & AI Academic Coach) */
  function renderScoreSim(skipSimulate) {
    var list = document.getElementById('sim-subjects-list');
    if (!list) return;
    var facSel = document.getElementById('sim-faculty-select');
    if (facSel) facSel.value = PF_STATE.simFacultyKey || 'comp-eng';
    list.innerHTML = activeSubjects().map(function (k) {
      var val = scoreOf(k);
      var isSet = val !== null;
      var labelTxt = subjectLabel(k);
      var w = sim.weights[k];
      return '<article class="p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-gutter-xs">' +
        '<div class="flex items-start justify-between gap-gutter-sm">' +
          '<div class="flex flex-col gap-0.5">' +
            '<div class="flex items-center gap-gutter-xs">' +
              '<span class="font-title text-title-md text-on-surface">' + esc(labelTxt) + '</span>' +
              '<span id="sim-wbadge-' + k + '" class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + (w ? Math.round(w) + '%' : '—') + '</span>' +
            '</div>' +
            '<span class="font-body text-label-sm text-on-surface-variant">' + T('สัดส่วนจริงของหลักสูตรที่เลือก', 'Real weight of the chosen program') + '</span>' +
          '</div>' +
          '<div class="flex flex-col items-end shrink-0 gap-0.5">' +
            '<input type="number" min="0" max="100" step="0.5" value="' + (isSet ? val.toFixed(1) : '') + '" placeholder="—" data-sim-input="' + k + '" aria-label="' + esc(labelTxt) + '" class="w-24 text-right px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant font-display text-title-lg text-secondary-text tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" />' +
            '<span data-sim-hint="' + k + '" class="font-label text-label-sm ' + (isSet ? 'text-on-surface-variant' : 'text-tertiary-text') + '">' + (isSet ? T('พิมพ์หรือเลื่อนคะแนน', 'Type or slide') : T('ยังไม่ได้ใส่คะแนน', 'Not entered yet')) + '</span>' +
          '</div>' +
        '</div>' +
        '<input type="range" min="0" max="100" step="0.5" value="' + (isSet ? val : 50) + '" data-sim-slider="' + k + '" aria-label="' + esc(labelTxt) + '" class="w-full accent-primary cursor-pointer' + (isSet ? '' : ' opacity-50') + '" />' +
        '<div class="flex items-center justify-between font-metric text-label-sm text-on-surface-variant tabular-nums">' +
          '<span>0</span>' +
          '<span id="sim-weighted-' + k + '" class="text-secondary-text">—</span>' +
          '<span>100</span>' +
        '</div>' +
      '</article>';
    }).join('');

    list.querySelectorAll('[data-sim-slider]').forEach(function (slider) {
      slider.addEventListener('input', function () {
        var k = slider.getAttribute('data-sim-slider');
        var num = Number(slider.value);
        PF_STATE.simScores[k] = num;
        markEntered(k);
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
        markEntered(k);
        var slider = list.querySelector('[data-sim-slider="' + k + '"]');
        if (slider) slider.value = String(clamped);
        updateSimCalculations();
      });
      numInp.addEventListener('blur', function () {
        var k = numInp.getAttribute('data-sim-input');
        var parsed = parseFloat(numInp.value);
        if (isNaN(parsed)) { if (scoreOf(k) === null) numInp.value = ''; return; } // left empty = still not entered
        var clamped = Math.max(0, Math.min(100, parsed));
        PF_STATE.simScores[k] = clamped;
        numInp.value = clamped.toFixed(1);
        var slider = list.querySelector('[data-sim-slider="' + k + '"]');
        if (slider) slider.value = String(clamped);
      });
    });
    function markEntered(k) {
      var sl = list.querySelector('[data-sim-slider="' + k + '"]');
      if (sl) sl.classList.remove('opacity-50');
      var hint = list.querySelector('[data-sim-hint="' + k + '"]');
      if (hint) { hint.textContent = T('พิมพ์หรือเลื่อนคะแนน', 'Type or slide'); hint.classList.remove('text-tertiary-text'); hint.classList.add('text-on-surface-variant'); }
    }
    renderSimResult();
    if (!skipSimulate) updateSimCalculations();
  }

  var simResetBtn = document.getElementById('sim-reset-btn');
  if (simResetBtn) {
    simResetBtn.addEventListener('click', function () {
      PF_STATE.simScores = {}; // back to "not entered"
      renderScoreSim();
    });
  }

  var simFacultySelect = document.getElementById('sim-faculty-select');
  if (simFacultySelect) {
    simFacultySelect.addEventListener('change', function () {
      PF_STATE.simFacultyKey = SIM_GROUPS[simFacultySelect.value] ? simFacultySelect.value : 'comp-eng';
      PF_STATE.simProgramId = null;
      loadPrograms();
    });
  }
  var simProgramSelect = document.getElementById('sim-program-select');
  if (simProgramSelect) {
    simProgramSelect.addEventListener('change', function () {
      PF_STATE.simProgramId = simProgramSelect.value || null;
      sim.renderedFor = null;
      sim.subjects = null;
      renderScoreSim(true);
      runSimulate();
    });
  }

  // =====================================================================
  // Page 6: AI Coach
  //   high-yield chapters -> POST /coach/high-yield (SSE progress, cached, may answer with a labelled fallback)
  //   chat                -> POST /chat (SSE, replies stream in) with what the student is looking at
  //   share               -> POST /share -> QR code
  // =====================================================================
  function needLogin(thMsg, enMsg) {
    if (window.PF_AUTH && window.PF_AUTH.getCurrentUser()) return false;
    if (window.PF_AUTH) window.PF_AUTH.showToast(thMsg, enMsg);
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.openAuthModal('login');
    return true;
  }

  var STAGE_TEXT = {
    started: ['เริ่มวิเคราะห์', 'Starting'], profile: ['อ่านโปรไฟล์', 'Reading profile'], tcas_data: ['ดูข้อมูล TCAS', 'Checking TCAS data'],
    ai: ['AI กำลังคิด', 'AI is thinking'], ai_web_search: ['AI กำลังค้นข้อมูล', 'AI is searching'], saving: ['บันทึกผล', 'Saving'], working: ['ยังทำงานอยู่', 'Still working']
  };

  function renderCoachYield() {
    var grid = document.getElementById('coach-yield-grid');
    if (!grid || grid.getAttribute('data-has-result')) return;
    grid.innerHTML = '<p class="md:col-span-3 font-body text-body-md text-on-surface-variant">' +
      T('พิมพ์วิชาแล้วกด "วิเคราะห์" ให้ AI จัดลำดับบทที่ควรอ่านก่อน (ต้องเข้าสู่ระบบ)', 'Type a subject and press "Analyze" to get the chapters worth studying first (sign-in needed)') + '</p>';
    var inp = document.getElementById('hy-subject');
    var focus = focusSubject();
    if (inp && !inp.value && focus) inp.value = SIM_SUBJECTS[focus].th;
  }

  function renderHighYield(data) {
    var grid = document.getElementById('coach-yield-grid');
    if (!grid) return;
    var r = data.result || {};
    grid.setAttribute('data-has-result', '1');
    var banner = data.fallback
      ? '<p class="md:col-span-3 p-gutter-sm rounded-lg bg-tertiary-container text-on-tertiary-container font-label text-label-md">' + esc(data.fallback.note) + '</p>'
      : '';
    var cards = (r.chapters || []).map(function (c) {
      return '<article class="p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col justify-between gap-gutter-sm">' +
        '<div class="flex flex-col gap-gutter-xs">' +
          '<span class="self-start px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm">' + T('อันดับ ', 'Rank #') + esc(c.rank) + '</span>' +
          '<h3 class="font-title text-title-md text-on-surface">' + esc(c.chapter) + '</h3>' +
          '<span class="font-label text-label-sm text-secondary-text">' + esc(c.exam_weight_note) + '</span>' +
          '<p class="font-body text-label-md text-on-surface-variant">' + esc(c.why_high_yield) + '</p>' +
          '<ul class="list-disc pl-5 font-body text-label-md text-on-surface-variant">' + (c.how_to_study || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '</div>' +
        '<div class="flex items-center justify-between pt-2 border-t border-outline-variant font-label text-label-sm">' +
          '<span class="text-on-surface-variant">' + T('เวลาอ่านแนะนำ', 'Est. Study') + '</span>' +
          '<span class="font-metric text-on-surface tabular-nums">~' + esc(c.study_hours) + T(' ชม.', ' hrs') + '</span>' +
        '</div>' +
      '</article>';
    }).join('');
    var foot = '<div class="md:col-span-3 flex flex-wrap items-center justify-between gap-gutter-sm font-label text-label-sm text-on-surface-variant">' +
      '<span>' + esc(r.verify_note || '') + ' <a class="text-primary underline" href="https://www.mytcas.com/blueprint" target="_blank" rel="noopener">mytcas.com/blueprint</a></span>' +
      (data.id ? '<button type="button" id="hy-share-btn" class="px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-md">' + T('แชร์ผลนี้ (QR)', 'Share (QR)') + '</button>' : '') +
    '</div>';
    grid.innerHTML = banner + cards + foot;
    var shareBtn = document.getElementById('hy-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', function () { openShare('high_yield', data.id); });
  }

  async function runHighYield() {
    var inp = document.getElementById('hy-subject');
    var btn = document.getElementById('hy-run-btn');
    var status = document.getElementById('hy-status');
    var subject = (inp && inp.value || '').trim();
    if (!subject) { if (inp) inp.focus(); return; }
    if (needLogin('เข้าสู่ระบบก่อนเพื่อให้ AI วิเคราะห์บทที่ควรอ่าน', 'Sign in to let the AI rank chapters for you')) return;
    var body = { subject: subject.slice(0, 100) };
    var key = keyForWeight(subject) || Object.keys(SIM_SUBJECTS).find(function (k) { return SIM_SUBJECTS[k].th === subject || SIM_SUBJECTS[k].en === subject; });
    if (key && scoreOf(key) !== null) body.current_score = Math.max(0, Math.min(100, scoreOf(key)));
    var hrs = PF_STATE.hoursSet ? Number(PF_STATE.weeklyHours) : 0;
    if (hrs >= 1) body.weekly_hours = Math.min(80, hrs);
    if (btn) btn.disabled = true;
    try {
      var data = await PF_API.stream('/coach/high-yield', {
        body: body,
        onProgress: function (p) {
          var st = STAGE_TEXT[p && p.stage] || STAGE_TEXT.working;
          if (status) status.textContent = T(st[0], st[1]) + '… ' + Math.round((p.elapsed_ms || 0) / 1000) + 's';
        }
      });
      if (status) status.textContent = data.cached ? T('ผลที่วิเคราะห์ไว้แล้ว', 'Saved result') : '';
      renderHighYield(data);
    } catch (err) {
      if (status) status.textContent = PF_API.errorText(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  var hyBtn = document.getElementById('hy-run-btn');
  if (hyBtn) hyBtn.addEventListener('click', runHighYield);
  var hyInp = document.getElementById('hy-subject');
  if (hyInp) hyInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runHighYield(); } });

  // --- chat UI (chatbot layout): user bubbles on the right, coach answers on the left with a copy button ---
  var chatLog = document.getElementById('coach-chat-log');

  // AI text -> safe HTML: escape everything first, then only **bold**, `code` and "- " bullets
  function chatHtml(text) {
    return String(text || '').split('\n').map(function (line) {
      var h = esc(line)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-surface-container-low font-metric text-[0.9em]">$1</code>');
      var bullet = /^\s*[-*•]\s+/.test(line);
      if (bullet) h = '<span class="inline-block w-4 text-primary">•</span>' + h.replace(/^\s*[-*•]\s+/, '');
      if (/^#{1,4}\s/.test(line)) h = '<strong>' + h.replace(/^#{1,4}\s/, '') + '</strong>';
      return h;
    }).join('<br>');
  }

  function chatScroll() { if (chatLog) chatLog.scrollTop = chatLog.scrollHeight; }
  function chatEmpty(show) {
    var e = document.getElementById('coach-chat-empty');
    if (e) e.classList.toggle('hidden', !show);
    var clr = document.getElementById('coach-chat-clear');
    if (clr) clr.classList.toggle('hidden', show || !(window.PF_AUTH && window.PF_AUTH.getCurrentUser()));
  }

  function chatCopyButton(getText) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg font-label text-[11px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface';
    b.setAttribute('aria-label', T('คัดลอกคำตอบ', 'Copy answer'));
    b.innerHTML = '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">content_copy</span><span>' + T('คัดลอก', 'Copy') + '</span>';
    b.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(getText()).then(function () {
        b.lastChild.textContent = T('คัดลอกแล้ว', 'Copied');
        setTimeout(function () { b.lastChild.textContent = T('คัดลอก', 'Copy'); }, 1500);
      }).catch(function () {});
    });
    return b;
  }

  // isUser: right-hand bubble. otherwise a coach message: { bubble, text, set(text), actions }
  function appendCoachMessage(textOrObj, isUser) {
    if (!chatLog) return null;
    chatEmpty(false);
    var thTxt = typeof textOrObj === 'object' ? textOrObj.th : textOrObj;
    var enTxt = typeof textOrObj === 'object' ? textOrObj.en : textOrObj;
    var txt = currentLang === 'th' ? thTxt : enTxt;

    if (isUser) {
      var row = document.createElement('div');
      row.className = 'flex justify-end';
      var ub = document.createElement('div');
      ub.className = 'max-w-[85%] sm:max-w-[70%] px-gutter-md py-2.5 rounded-2xl rounded-br-md bg-secondary-container text-on-secondary-container font-body text-body-md whitespace-pre-wrap break-words';
      ub.textContent = txt;
      row.appendChild(ub);
      chatLog.appendChild(row);
      chatScroll();
      return { bubble: ub, text: ub };
    }

    var wrap = document.createElement('div');
    wrap.className = 'flex items-start gap-gutter-sm max-w-full sm:max-w-[85%]';
    wrap.innerHTML = '<span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true"><span class="material-symbols-outlined text-[18px]">psychology</span></span>';
    var col = document.createElement('div');
    col.className = 'flex flex-col gap-1 min-w-0';
    var name = document.createElement('span');
    name.className = 'font-label text-label-sm text-secondary-text';
    name.textContent = T('AI โค้ช', 'AI Coach');
    var body = document.createElement('div');
    body.className = 'px-gutter-md py-2.5 rounded-2xl rounded-tl-md bg-surface-container-low font-body text-body-md text-on-surface break-words leading-relaxed';
    var actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center gap-1';
    col.appendChild(name);
    col.appendChild(body);
    col.appendChild(actions);
    wrap.appendChild(col);
    chatLog.appendChild(wrap);

    var current = '';
    // while the coach is still writing, a caret sits at the end of the text (css/transitions.css 2.10)
    var writing = !txt || txt === '…';
    var caret = function () { return writing ? '<span class="pf-caret" aria-hidden="true"></span>' : ''; };
    var msg = {
      bubble: col,
      text: body,
      actions: actions,
      set: function (t) { current = String(t || ''); body.innerHTML = chatHtml(current) + caret(); chatScroll(); },
      typing: function () {
        body.innerHTML = '<span class="inline-flex items-center py-1 text-on-surface-variant" role="status" aria-label="' + T('กำลังพิมพ์', 'Typing') + '"><span class="pf-caret"></span></span>';
      },
      finish: function () { if (!writing) return; writing = false; if (current) body.innerHTML = chatHtml(current); },
      done: function () { msg.finish(); if (current) actions.appendChild(chatCopyButton(function () { return current; })); }
    };
    if (txt && txt !== '…') { msg.set(txt); } else msg.typing();
    chatScroll();
    return msg;
  }

  var PAGE_KEYS = { '1': 'home', '2': 'discovery', '3': 'matches', '4': 'roadmap', '5': 'simulator', '6': 'coach', '7': 'analytics' };

  // what the student is looking at; the backend re-reads weights/cutoffs itself from program_id
  function chatContext() {
    var ctx = { page: PAGE_KEYS[String(PF_STATE.page)] || 'coach' };
    if (/^[0-9a-f-]{36}$/i.test(String(PF_STATE.simProgramId || ''))) ctx.program_id = PF_STATE.simProgramId;
    if (typeof sim.total === 'number') ctx.simulated_score = Math.max(0, Math.min(100, sim.total));
    var checks = Array.prototype.slice.call(document.querySelectorAll('#rm-personal-view [data-waypoint-check]'));
    if (checks.length) {
      ctx.roadmap = {
        done: checks.filter(function (c) { return c.checked; }).length,
        total: checks.length,
        next_tasks: checks.filter(function (c) { return !c.checked; }).slice(0, 3)
          .map(function (c) { return String(c.getAttribute('aria-label') || '').slice(0, 200); }).filter(Boolean)
      };
    }
    return ctx;
  }

  var chatBusy = false;
  var coachForm = document.getElementById('coach-chat-form');
  var coachInput = document.getElementById('coach-chat-input');
  var coachSend = document.getElementById('coach-chat-send');

  function setChatBusy(b) {
    chatBusy = b;
    if (coachSend) coachSend.disabled = b;
  }

  // textarea grows with the text, up to max-h-40
  function fitInput() {
    if (!coachInput) return;
    coachInput.style.height = 'auto';
    coachInput.style.height = Math.min(coachInput.scrollHeight, 160) + 'px';
  }

  async function sendChat(q) {
    q = String(q || '').trim().slice(0, 2000);
    if (!q || chatBusy) return;
    appendCoachMessage(q, true);
    if (needLogin('เข้าสู่ระบบก่อนเพื่อคุยกับ AI โค้ช', 'Sign in to chat with the AI coach')) {
      appendCoachMessage({ th: 'เข้าสู่ระบบก่อนนะ แล้วพี่จะตอบโดยดูจากโปรไฟล์และแผนของน้อง', en: 'Please sign in first so I can answer based on your profile and plan.' }, false).done();
      return;
    }
    setChatBusy(true);
    var reply = appendCoachMessage('…', false);
    var text = '';
    try {
      var done = await PF_API.stream('/chat', {
        body: { message: q, context: chatContext() },
        onEvent: function (ev, d) {
          if (ev === 'delta' && d && d.text) {
            text += d.text;
            reply.set(text);
          }
        }
      });
      if (done && done.content) reply.set(done.content);
      (done && done.sources || []).slice(0, 5).forEach(function (s) {
        if (!/^https?:\/\//.test(s.url || '')) return;
        var a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-low font-label text-[11px] text-primary hover:underline max-w-[220px] truncate';
        a.textContent = s.title || s.url;
        reply.actions.appendChild(a);
      });
      reply.done();
    } catch (err) {
      reply.set((text ? text + '\n\n' : '') + PF_API.errorText(err));
      reply.finish();
    } finally {
      setChatBusy(false);
      if (coachInput) coachInput.focus();
    }
  }

  // past conversation of the signed-in account (GET /history?type=chat, oldest first).
  // a different account / sign-out clears what is on screen first
  var chatLoadedFor = null;
  function clearChatLog() {
    if (!chatLog) return;
    Array.prototype.slice.call(chatLog.children).forEach(function (c) { if (c.id !== 'coach-chat-empty') c.remove(); });
    chatEmpty(true);
  }
  async function loadChatHistory(force) {
    var user = window.PF_AUTH && window.PF_AUTH.getCurrentUser();
    var uid = user ? String(user.userId || '') : null;
    if (!force && uid === chatLoadedFor) return;
    chatLoadedFor = uid;
    clearChatLog();
    if (!uid) return;
    try {
      var data = await PF_API.request('/history?type=chat&limit=50', { auth: true });
      if (chatLoadedFor !== uid || chatBusy) return;
      (data.items || []).forEach(function (m) {
        if (m.role === 'user') appendCoachMessage(m.content, true);
        else appendCoachMessage(m.content, false).done();
      });
      chatEmpty(!(data.items || []).length);
    } catch (e) { /* history is a nice-to-have: the chat still works */ }
  }

  var clearBtn = document.getElementById('coach-chat-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', async function () {
      if (chatBusy || !window.confirm(T('ลบประวัติแชททั้งหมด? กู้คืนไม่ได้', 'Delete the whole chat history? This cannot be undone.'))) return;
      try {
        await PF_API.request('/chat/messages', { method: 'DELETE', auth: true });
        clearChatLog();
      } catch (err) {
        window.alert(PF_API.errorText(err));
      }
    });
  }

  document.querySelectorAll('[data-coach-prompt-th]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var q = currentLang === 'th' ? btn.getAttribute('data-coach-prompt-th') : (btn.getAttribute('data-coach-prompt-en') || btn.getAttribute('data-coach-prompt-th'));
      sendChat(q || btn.textContent.trim());
    });
  });

  if (coachForm && coachInput) {
    coachForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = coachInput.value.trim();
      if (!q || chatBusy) return; // keep the text in the box while a reply is still streaming
      coachInput.value = '';
      fitInput();
      sendChat(q);
    });
    // Enter sends, Shift+Enter is a new line (and never while a Thai/IME word is being composed)
    coachInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        coachForm.requestSubmit ? coachForm.requestSubmit() : coachForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
    coachInput.addEventListener('input', fitInput);
  }

  window.PF_CHAT = { load: loadChatHistory, send: sendChat };
  window.addEventListener('pf:auth-expired', function () { loadChatHistory(); });

  // --- share an AI result with a QR code (POST /share) ---
  function closeShare() {
    var m = document.getElementById('pf-share-modal');
    if (m) m.remove();
  }
  async function openShare(kind, id) {
    if (needLogin('เข้าสู่ระบบก่อนเพื่อแชร์ผล', 'Sign in to share')) return;
    closeShare();
    var modal = document.createElement('div');
    modal.id = 'pf-share-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.className = 'fixed inset-0 z-50 bg-primary/40 flex items-center justify-center p-gutter-md';
    modal.innerHTML = '<div class="w-full max-w-sm p-gutter-lg rounded-2xl bg-surface flex flex-col items-center gap-gutter-sm text-center">' +
      '<h2 class="font-headline text-headline-md text-on-surface">' + T('แชร์ผลด้วย QR', 'Share with a QR code') + '</h2>' +
      '<div id="pf-share-body" class="font-body text-body-md text-on-surface-variant">' + T('กำลังสร้างลิงก์…', 'Creating link…') + '</div>' +
      '<button type="button" id="pf-share-close" class="px-gutter-lg py-2 rounded-full bg-surface-container-low border border-outline-variant font-label text-label-md">' + T('ปิด', 'Close') + '</button>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeShare(); });
    document.getElementById('pf-share-close').addEventListener('click', closeShare);
    var bodyEl = document.getElementById('pf-share-body');
    try {
      var s = await PF_API.request('/share', { method: 'POST', auth: true, body: { kind: kind, id: id } });
      var expires = s.expires_at ? new Date(s.expires_at).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB') : '';
      // qr_svg is generated by our own backend from the link
      // qr_svg is null when the backend has no qrcode package: show the link only
      bodyEl.innerHTML = (s.qr_svg ? '<div class="w-56 h-56 mx-auto [&>svg]:w-full [&>svg]:h-full">' + s.qr_svg + '</div>' : '') +
        '<input readonly class="w-full mt-2 px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant font-metric text-label-sm" value="' + esc(s.url) + '">' +
        '<button type="button" id="pf-share-copy" class="mt-2 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-md">' + T('คัดลอกลิงก์', 'Copy link') + '</button>' +
        '<p class="mt-2 font-label text-label-sm">' + T('ใครมีลิงก์ก็เปิดดูได้ อย่าโพสต์ในที่สาธารณะ', 'Anyone with the link can open it, so don\'t post it publicly.') +
        (expires ? T(' • หมดอายุ ', ' • Expires ') + esc(expires) : '') + '</p>';
      document.getElementById('pf-share-copy').addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(s.url).catch(function () {});
      });
    } catch (err) {
      bodyEl.textContent = PF_API.errorText(err);
    }
  }
  window.PF_SHARE = { open: openShare };

  // first load: real programs for the saved faculty
  loadPrograms();

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
      targetPill.textContent = 'GPAX ' + pfGpaxText() + (simChance ? ' • ' + simChance : '');
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
          ? 'ระบบจับความสนใจของคุณได้แก่ ' + interestSummary + ' (GPAX ' + pfGpaxText() + ') ลองพิมพ์สิ่งที่ชอบเพิ่มเติมเพื่อให้ AI จับคู่คณะแม่นขึ้น'
          : 'Tracking your interests (' + interestSummary + ', GPAX ' + pfGpaxText() + '). Type custom hobbies for sharper AI major matching.';
      } else if (page === '3') {
        msg = lang === 'th'
          ? 'จากความสนใจ ' + interestSummary + ' และ ' + (beh.interactions || 0) + ' การโต้ตอบ แนะนำให้กดล็อกคณะอันดับ #1 เพื่อสร้างแผน TCAS70 อัตโนมัติ'
          : 'Based on ' + interestSummary + ' and ' + (beh.interactions || 0) + ' actions, lock your #1 major card to auto-build your TCAS70 roadmap.';
      } else if (page === '4') {
        msg = lang === 'th'
          ? 'คุณกำลังดูแผนรายบุคคล (' + pfHoursText() + ' ชม./สัปดาห์) คลิกติ๊กงานที่ทำเสร็จหรือเปิดดูรายละเอียดเพื่ออัปเดตความพร้อมจริง'
          : 'Viewing your personal roadmap (' + pfHoursText() + ' hrs/wk). Check off completed milestones to update your readiness score.';
      } else if (page === '5') {
        var simScore = document.getElementById('sim-total-score') ? document.getElementById('sim-total-score').textContent : '—';
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
