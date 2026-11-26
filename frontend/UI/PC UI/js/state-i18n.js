/* =========================================================================
 * PathFinder — Global State, Curved Dropdowns, SPA Router & TH/EN i18n
 * Sections 4.1-4.3: PF_STATE + ripple, curved dropdowns, goToPage router, setLang & window vibrancy.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js
 *
 * Depends on : data/catalog.js
 * Provides   : PF_STATE, currentPage, currentLang, currentStep, closeAllDropdowns, initCurvedDropdowns, pfDropdownSyncers, PAGE_NAMES, goToPage, stepNextLabels, setLang, restoreWindowVibrancy
 * ========================================================================= */

/* [JS 4.1] Global State (PF_STATE) & Ripple Effect */
var PF_STATE = window.PF_STATE = {
  lang: 'th',
  page: '1',
  step: 1,
  interests: [], // nothing preselected: the student picks
  grade: '', // not chosen yet (Step 2 / profile fills it)
  gpax: 3.75, // slider position only until gpaxSet
  gpaxSet: false, // true once the student moves the GPAX slider (or the profile has a GPAX)
  beyond400: false,
  baselineMode: 'university',
  acceptedMajors: [],
  ignoredMajors: [],
  targetUnis: [],
  otherUnis: [], // universities the student typed (not in the chip list), max 5
  targetFaculties: [], // Step 3 "คณะที่สนใจเป็นพิเศษ" keys (engineering, science, ...), max 3
  province: '', // where the student lives (Step 3) - nearby universities rank higher
  savedPrograms: [], // hearts on Page 3: [{ id, university, faculty, program, campus }]
  weeklyHours: 6, // slider position only until hoursSet
  hoursSet: false, // true once the student moves the hours slider (or the account has it)
  behavior: {
    visitedPages: ['1'],
    interactions: 0,
    pageClicks: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 },
    lastActionTh: 'กำลังสำรวจหน้าแรก PathFinder',
    lastActionEn: 'Exploring PathFinder Home'
  }
};
var currentPage = PF_STATE.page;
// GPAX / weekly hours as text, "—" until the student has set them
function pfGpaxText() { return PF_STATE.gpaxSet ? Number(PF_STATE.gpax).toFixed(2) : '—'; }
function pfHoursText() { return PF_STATE.hoursSet ? String(PF_STATE.weeklyHours) : '—'; }
// myTCAS score-weight keys -> what students call them ("cal_score_sum", "gpa22", ...)
var PF_SUBJECT_CODES = {
  cal_score_sum: ['คะแนนรวมตามสูตรของโครงการ', 'Project formula total'],
  priority_score: ['คะแนนพิจารณาพิเศษของโครงการ', 'Project priority score'],
  gpa21: ['GPA ภาษาไทย', 'GPA Thai'], gpa22: ['GPA คณิตศาสตร์', 'GPA Mathematics'], gpa23: ['GPA วิทยาศาสตร์', 'GPA Science'],
  gpa24: ['GPA สังคมศึกษา', 'GPA Social Studies'], gpa25: ['GPA สุขศึกษาและพลศึกษา', 'GPA Health & PE'], gpa26: ['GPA ศิลปะ', 'GPA Arts'],
  gpa27: ['GPA การงานอาชีพ', 'GPA Career & Tech'], gpa28: ['GPA ภาษาต่างประเทศ', 'GPA Foreign Languages'],
  ged_score: ['คะแนน GED', 'GED score'], ielts: ['IELTS', 'IELTS'], toeic: ['TOEIC', 'TOEIC'], toefl_ibt: ['TOEFL iBT', 'TOEFL iBT'],
  tpat11: ['TPAT1 ส่วนที่ 1', 'TPAT1 part 1'], tpat12: ['TPAT1 ส่วนที่ 2', 'TPAT1 part 2'], tpat13: ['TPAT1 ส่วนที่ 3', 'TPAT1 part 3']
};
// "TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์" -> "TPAT3", "A-Level คณิตศาสตร์ประยุกต์ 1" -> "A-Level คณิต 1",
// "gpa22" -> "GPA คณิตศาสตร์", "su001" -> "วิชาเฉพาะของมหาวิทยาลัย (su001)"
function pfSubjectLabel(key, lang) {
  var k = String(key || '').trim();
  var en = (lang || currentLang) === 'en';
  var known = PF_SUBJECT_CODES[k.toLowerCase()];
  if (known) return en ? known[1] : known[0];
  if (/^[a-z]{2,4}\d{3}$/i.test(k)) return en ? 'University test (' + k + ')' : 'วิชาเฉพาะของมหาวิทยาลัย (' + k + ')';
  var tp = /^(TPAT\d)/.exec(k);
  if (tp) return tp[1];
  return k.replace('คณิตศาสตร์ประยุกต์', 'คณิต');
}

// "ม.5" / "M.5", or "—" before the student has picked a grade
// per-student random seed for /match/programs (variety_seed): same answers, different students ->
// a different order among equally good programs. Random, kept in this browser only, not personal data.
function pfVarietySeed() {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(PF_STATE.varietySeed || ''))) {
    PF_STATE.varietySeed = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    if (typeof window.savePFState === 'function') window.savePFState();
  }
  return PF_STATE.varietySeed;
}
window.pfVarietySeed = pfVarietySeed;

// "ม.5 • " in front of "GPAX …" when a grade was picked, nothing when it wasn't (no lone "—")
function pfGradePrefix(lang) { return PF_STATE.grade ? pfGradeLabel(lang) + ' • ' : ''; }
function pfGradeLabel(lang) {
  var g = String(PF_STATE.grade || '');
  if (!g) return '—';
  return (lang || currentLang) === 'th' ? g.replace('M.', 'ม.') : g;
}
var currentLang = PF_STATE.lang;
var currentStep = PF_STATE.step;

/* Bubble Ripple Effect on every button click */
document.addEventListener('click', function (e) {
  var target = e.target.closest('button, .pf-bubble');
  if (!target || target.disabled || target.closest('.lang-switch')) return;
  var rect = target.getBoundingClientRect();
  var size = Math.max(rect.width, rect.height);
  var ripple = document.createElement('span');
  var isLight =
    target.classList.contains('bg-surface') ||
    target.classList.contains('bg-surface-container-low') ||
    target.classList.contains('bg-surface-container-lowest') ||
    target.classList.contains('bg-secondary-container/70') ||
    target.classList.contains('pf-dd-trigger') ||
    (target.classList.contains('pf-dd-option') && !target.classList.contains('is-selected'));
  ripple.className = 'pf-ripple' + (isLight ? ' pf-ripple-dark' : '');
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  target.appendChild(ripple);
  setTimeout(function () { ripple.remove(); }, 540);
});

/* Curved Vertical Drag-Down Dropdowns with Bubble Effect */
var pfDropdownSyncers = [];
function closeAllDropdowns(exceptWrap) {
  document.querySelectorAll('.pf-dd-wrap.is-open').forEach(function (w) {
    if (w !== exceptWrap) {
      w.classList.remove('is-open');
      var btn = w.querySelector('.pf-dd-trigger');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
}
/* [JS 4.2] Curved Dropdowns & SPA Page Router */
function initCurvedDropdowns() {
  var nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  document.querySelectorAll('select[data-pf-dropdown]').forEach(function (sel) {
    if (sel.dataset.pfEnhanced) return;
    sel.dataset.pfEnhanced = '1';
    var variant = sel.getAttribute('data-pf-dropdown') || 'card';
    sel.classList.add('sr-only');
    sel.tabIndex = -1;

    var wrap = document.createElement('div');
    wrap.className = 'pf-dd-wrap';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (variant === 'pill') {
      trigger.className = 'pf-dd-trigger pf-bubble px-gutter-md py-1.5 rounded-full bg-surface-container-low border border-outline-variant hover:border-primary/60 font-label text-label-md text-on-surface';
    } else if (variant === 'box') {
      trigger.className = 'pf-dd-trigger pf-bubble px-gutter-md py-2 rounded-2xl bg-surface-container-low border border-outline-variant hover:border-primary/60 font-body text-body-md text-on-surface';
    } else {
      trigger.className = 'pf-dd-trigger pf-bubble w-full bg-transparent font-body text-body-md text-on-surface py-0.5';
    }

    var labelSpan = document.createElement('span');
    labelSpan.className = 'pf-dd-label truncate';
    var chevron = document.createElement('span');
    chevron.className = 'material-symbols-outlined text-[18px] text-on-surface-variant pf-dd-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = 'expand_more';
    trigger.appendChild(labelSpan);
    trigger.appendChild(chevron);

    var menu = document.createElement('div');
    menu.className = 'pf-dd-menu';
    menu.setAttribute('role', 'listbox');

    var optButtons = [];
    Array.from(sel.options).forEach(function (opt, idx) {
      var optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.setAttribute('role', 'option');
      optBtn.className = 'pf-dd-option pf-bubble';
      optBtn.style.setProperty('--dd-idx', String(idx));
      optBtn.dataset.value = opt.value;

      var txt = document.createElement('span');
      if (opt.hasAttribute('data-th') && opt.hasAttribute('data-en')) {
        txt.setAttribute('data-th', opt.getAttribute('data-th'));
        txt.setAttribute('data-en', opt.getAttribute('data-en'));
      }
      txt.textContent = opt.textContent;

      var checkIcon = document.createElement('span');
      checkIcon.className = 'material-symbols-outlined text-[16px] pf-dd-check';
      checkIcon.setAttribute('aria-hidden', 'true');
      checkIcon.textContent = 'check';

      optBtn.appendChild(txt);
      optBtn.appendChild(checkIcon);
      optBtn.addEventListener('click', function () {
        if (nativeDescriptor && nativeDescriptor.set) {
          nativeDescriptor.set.call(sel, opt.value);
        } else {
          sel.value = opt.value;
        }
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        setTimeout(function () { closeAllDropdowns(null); }, 130);
      });
      menu.appendChild(optBtn);
      optButtons.push(optBtn);
    });

    function sync() {
      var activeOpt = sel.options[sel.selectedIndex] || sel.options[0];
      if (activeOpt) {
        var th = activeOpt.getAttribute('data-th');
        var en = activeOpt.getAttribute('data-en');
        if (th && en) {
          labelSpan.setAttribute('data-th', th);
          labelSpan.setAttribute('data-en', en);
          labelSpan.textContent = (typeof currentLang !== 'undefined' && currentLang === 'en') ? en : th;
        } else {
          labelSpan.textContent = activeOpt.textContent;
        }
      }
      optButtons.forEach(function (b) {
        var isSel = b.dataset.value === sel.value;
        b.classList.toggle('is-selected', isSel);
        b.setAttribute('aria-selected', isSel ? 'true' : 'false');
        var chk = b.querySelector('.pf-dd-check');
        if (chk) chk.style.opacity = isSel ? '1' : '0';
      });
    }

    if (nativeDescriptor && nativeDescriptor.get && nativeDescriptor.set) {
      Object.defineProperty(sel, 'value', {
        configurable: true,
        get: function () { return nativeDescriptor.get.call(sel); },
        set: function (v) {
          nativeDescriptor.set.call(sel, v);
          sync();
        }
      });
    }

    trigger.addEventListener('click', function () {
      var willOpen = !wrap.classList.contains('is-open');
      closeAllDropdowns(willOpen ? wrap : null);
      wrap.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    sel.addEventListener('change', sync);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
    sync();
    pfDropdownSyncers.push(sync);
  });
}
document.addEventListener('click', function (e) {
  if (!e.target.closest('.pf-dd-wrap')) closeAllDropdowns(null);
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeAllDropdowns(null);
});
initCurvedDropdowns();

/* Smooth Page Switching */
var PAGE_NAMES = {
  '1': { th: 'หน้าแรก', en: 'Home' },
  '2': { th: 'ค้นหาตัวเอง', en: 'Discovery' },
  '3': { th: 'คณะที่เหมาะ', en: 'Major Matches' },
  '4': { th: 'แผนรายบุคคล', en: 'Roadmap' },
  '5': { th: 'จำลองคะแนน TCAS70', en: 'TCAS70 Simulator' },
  '6': { th: 'AI โค้ช', en: 'AI Coach' },
  '7': { th: 'วิเคราะห์ผล', en: 'Analytics' }
};

function goToPage(nextPage) {
  if (nextPage === currentPage) return;
  if (typeof hideUniCard === 'function') hideUniCard();
  var oldView = document.querySelector('[data-page-view="' + currentPage + '"]');
  var newView = document.querySelector('[data-page-view="' + nextPage + '"]');
  if (!newView) return;

  currentPage = nextPage;
  PF_STATE.page = nextPage;
  // remembered for this tab only: a refresh comes back here, a new visit starts on the home page
  try { sessionStorage.setItem('pf_page', String(nextPage)); } catch (e) {}
  if (PF_STATE.behavior) {
    if (PF_STATE.behavior.visitedPages.indexOf(nextPage) === -1) {
      PF_STATE.behavior.visitedPages.push(nextPage);
    }
    var pMeta = PAGE_NAMES[nextPage] || PAGE_NAMES['1'];
    PF_STATE.behavior.lastActionTh = 'เปิดหน้าต่าง: ' + pMeta.th;
    PF_STATE.behavior.lastActionEn = 'Opened: ' + pMeta.en;
  }
  if (nextPage === '3' && typeof syncMajorMatches === 'function') {
    syncMajorMatches();
  }
  // "คณะที่ใช่": real programs for the current answers (js/matches.js, skips if nothing changed)
  if (nextPage === '3' && window.PF_MATCHES) window.PF_MATCHES.load();
  // home goal card: locked / saved / top match program (js/hero.js)
  if (nextPage === '1' && window.PF_HERO) window.PF_HERO.refresh();
  if (nextPage === '1' && typeof window.placeHeroTabIndicator === 'function') setTimeout(window.placeHeroTabIndicator, 60);
  if (nextPage === '4' && typeof renderRoadmap === 'function') {
    renderRoadmap(PF_STATE.lockedMajorId);
  }
  // roadmap timeline motion once the page is on screen (js/roadmap-real.js)
  if (nextPage === '4' && window.PF_RM_REAL && window.PF_RM_REAL.replayTimeline) setTimeout(window.PF_RM_REAL.replayTimeline, 450);
  // coach page: the signed-in account's past chat (and nothing left over from another account)
  if (nextPage === '6' && window.PF_CHAT) window.PF_CHAT.load();
  if (nextPage === '6' && window.PF_GUIDANCE) window.PF_GUIDANCE.render();
  if (nextPage === '7' && window.PF_ANALYTICS && typeof window.PF_ANALYTICS.render === 'function') {
    window.PF_ANALYTICS.render();
  }
  if (typeof window.updateFloatingCoachInsight === 'function') {
    window.updateFloatingCoachInsight();
  }
  if (typeof window.PF_REFRESH_BADGES === 'function') {
    window.PF_REFRESH_BADGES();
  }
  document.querySelectorAll('[data-page-pill]').forEach(function (pill) {
    var active = pill.getAttribute('data-page-pill') === nextPage;
    pill.classList.toggle('bg-primary', active);
    pill.classList.toggle('text-on-primary', active);
    pill.classList.toggle('text-on-surface-variant', !active);
  });

  clearTimeout(window.__pfPageNavTimer);
  clearTimeout(window.__pfPageEnterTimer);
  document.body.classList.remove('lang-fading');
  document.querySelectorAll('[data-page-view]').forEach(function (v) {
    if (v !== oldView && v !== newView) {
      v.classList.add('hidden');
      v.classList.remove('page-enter', 'page-exit');
    }
  });
  oldView.classList.remove('page-enter');
  oldView.classList.add('page-exit');
  window.__pfPageNavTimer = setTimeout(function () {
    document.querySelectorAll('[data-page-view]').forEach(function (v) {
      v.classList.remove('page-enter', 'page-exit');
      if (v !== newView) v.classList.add('hidden');
    });
    newView.classList.remove('hidden');
    newView.classList.add('page-enter');
    if (typeof window.PF_REFRESH_BADGES === 'function') window.PF_REFRESH_BADGES();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.__pfPageEnterTimer = setTimeout(function () { newView.classList.remove('page-enter'); }, 310);
  }, 150);
}
window.goToPage = goToPage;

document.querySelectorAll('[data-go-page]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    goToPage(btn.getAttribute('data-go-page'));
  });
});

/* Synchronized TH / EN Language Bubble + Text Cross-Fade */
var stepNextLabels = {
  th: { 1: 'ถัดไป: พื้นฐานการเรียน →', 2: 'ถัดไป: เป้าหมายและเวลา →', 3: 'ดูคณะที่เหมาะกับฉัน 5 อันดับ →', badge: function (s) { return 'ขั้นที่ ' + s + ' / 3'; } },
  en: { 1: 'Next: Academic Baseline →', 2: 'Next: Target & Pace →', 3: 'See My Top 5 Matches →', badge: function (s) { return 'Step ' + s + ' of 3'; } }
};

var langTimer = null;
/* [JS 4.3] Internationalization (i18n TH/EN) & Window Vibrancy */
function setLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  PF_STATE.lang = lang;
  document.getElementById('lang-switch').setAttribute('data-active-lang', lang);
  document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
    var active = b.getAttribute('data-lang-btn') === lang;
    b.classList.toggle('text-on-primary', active);
    b.classList.toggle('text-on-surface-variant', !active);
  });

  clearTimeout(langTimer);
  document.body.classList.add('lang-fading');
  langTimer = setTimeout(function () {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-th][data-en]').forEach(function (el) {
      var preserved = el.querySelector('[data-pixel-badge], #roadmap-major-pixel-badge');
      var nextText = el.getAttribute('data-' + lang);
      if (preserved && preserved.parentNode === el) {
        var isFirst = el.firstElementChild === preserved;
        el.textContent = nextText;
        if (isFirst) el.insertBefore(preserved, el.firstChild);
        else el.appendChild(preserved);
      } else {
        el.textContent = nextText;
      }
    });
    var prevSpan = document.querySelector('#desktop-prev-btn [data-th][data-en]');
    if (prevSpan) prevSpan.textContent = prevSpan.getAttribute('data-' + lang);
    var badgeEl = document.getElementById('roadmap-match-badge');
    if (badgeEl) {
      var numMatch = (badgeEl.textContent || '').match(/\d+%/);
      if (numMatch) badgeEl.textContent = (lang === 'th' ? 'ตรงกัน ' : '') + numMatch[0] + (lang === 'en' ? ' Match' : '');
    }
    var cdEl = document.getElementById('countdown-readout');
    if (cdEl && !cdEl.hasAttribute('data-th')) {
      var num = (cdEl.textContent || '8').match(/[\d.]+/);
      var months = num ? num[0] : '8';
      cdEl.textContent = months + (lang === 'th' ? ' เดือน' : ' Months');
    }
    document.getElementById('desktop-step-badge').textContent = stepNextLabels[lang].badge(currentStep);
    document.getElementById('desktop-next-label').textContent = stepNextLabels[lang][currentStep];
    renderHoursPace();
    if (window.PF_GUIDANCE) window.PF_GUIDANCE.render();
    renderSummaryStrip();
    if (typeof syncMajorMatches === 'function') syncMajorMatches();
    if (typeof updateAIInterestSummary === 'function') updateAIInterestSummary();
    if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
    if (typeof renderScoreSim === 'function') renderScoreSim();
    if (typeof renderCoachYield === 'function') renderCoachYield();
    if (typeof window.updateFloatingCoachInsight === 'function') window.updateFloatingCoachInsight();
    if (typeof window.renderInterestPriority === 'function') window.renderInterestPriority();
    if (window.PF_PROFILE_UI && typeof window.PF_PROFILE_UI.refreshHeader === 'function') window.PF_PROFILE_UI.refreshHeader();
    if (window.PF_ANALYTICS && typeof window.PF_ANALYTICS.render === 'function') window.PF_ANALYTICS.render();
    if (typeof window.PF_REFRESH_BADGES === 'function') window.PF_REFRESH_BADGES();
    // both spellings are used in the markup: data-placeholder-th/-en and data-th-placeholder/-en-placeholder
    document.querySelectorAll('[data-placeholder-th][data-placeholder-en]').forEach(function (inp) {
      inp.placeholder = inp.getAttribute('data-placeholder-' + lang) || inp.placeholder;
    });
    document.querySelectorAll('[data-th-placeholder][data-en-placeholder]').forEach(function (inp) {
      inp.placeholder = inp.getAttribute('data-' + lang + '-placeholder') || inp.placeholder;
    });
    document.body.classList.remove('lang-fading');
  }, 140);
}

function restoreWindowVibrancy() {
  document.body.classList.remove('lang-fading');
  document.querySelectorAll('[data-page-view]').forEach(function (v) {
    var isCur = v.getAttribute('data-page-view') === currentPage;
    v.classList.toggle('hidden', !isCur);
    v.classList.remove('page-exit');
  });
  if (typeof window.PF_REFRESH_BADGES === 'function') window.PF_REFRESH_BADGES();
}
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) restoreWindowVibrancy();
});
window.addEventListener('focus', restoreWindowVibrancy);

document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
  b.addEventListener('click', function () {
    setLang(b.getAttribute('data-lang-btn'));
  });
});
