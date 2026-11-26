/* =========================================================================
 * PathFinder — Hero Tabs, Discovery Wizard, AI Interest Matcher, GPAX & Major Scoring
 * Section 4.4: Page 1 hero preview tabs, Page 2 3-step intake wizard, Page 3 major match scoring.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js
 *
 * Depends on : data/catalog.js, js/state-i18n.js
 * Provides   : progressMap, renderStep, renderBeyondToggle, renderHoursPace, renderSummaryStrip, activateInterestChip, updateAIInterestSummary, analyzeCustomInterest, syncMajorMatches
 * ========================================================================= */

/* Hero Preview Tabs: one highlight slides under the picked round (css/transitions.css 2.10) */
var heroTabIndicator = null;
function placeHeroTabIndicator() {
  var on = document.querySelector('[data-hero-tab][aria-selected="true"]');
  if (!on) return;
  var bar = on.parentElement;
  if (!heroTabIndicator) {
    heroTabIndicator = document.createElement('span');
    heroTabIndicator.setAttribute('aria-hidden', 'true');
    heroTabIndicator.className = 'pf-tab-indicator absolute top-1 bottom-1 left-0 rounded-sm bg-primary pointer-events-none';
    bar.classList.add('relative');
    bar.insertBefore(heroTabIndicator, bar.firstChild);
    document.querySelectorAll('[data-hero-tab]').forEach(function (t) { t.classList.remove('bg-primary'); });
  }
  if (!on.offsetWidth) return; // page not visible yet: placed again when the home page opens
  heroTabIndicator.style.width = on.offsetWidth + 'px';
  heroTabIndicator.style.transform = 'translateX(' + on.offsetLeft + 'px)';
}
window.placeHeroTabIndicator = placeHeroTabIndicator;
window.addEventListener('resize', placeHeroTabIndicator);
// the tabs animate their own width (label in / out): follow them to the end
document.addEventListener('transitionend', function (e) {
  if (e.target && e.target.closest && e.target.closest('[data-hero-tab]')) placeHeroTabIndicator();
});
document.querySelectorAll('[data-hero-tab]').forEach(function (tab) {
  tab.addEventListener('click', function () {
    var target = tab.getAttribute('data-hero-tab');
    document.querySelectorAll('[data-hero-tab]').forEach(function (t) {
      var active = t.getAttribute('data-hero-tab') === target;
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.classList.toggle('text-on-primary', active);
      t.classList.toggle('text-on-surface-variant', !active);
    });
    // the active tab may widen (label shown): measure after layout
    requestAnimationFrame(function () { requestAnimationFrame(placeHeroTabIndicator); });
    setTimeout(placeHeroTabIndicator, 360);
    ['hr1', 'hr2', 'hr3', 'hr4'].forEach(function (id) {
      var p = document.querySelector('[data-round-panel="' + id + '"]');
      if (p) p.classList.toggle('hidden', id !== target);
    });
  });
});

requestAnimationFrame(placeHeroTabIndicator);

/* Discovery Stepper + Step Nav Tab Highlight */
var progressMap = { 1: '33%', 2: '67%', 3: '100%' };

/* [JS 4.4] Page 1-3 Controllers (Hero, Discovery Wizard, AI Matcher, Major Scoring) */
// Step 1 asks for 2-4 interests: Steps 2-3 (Next button or the step tabs) stay closed until 2 are picked
var MIN_INTERESTS = window.MIN_INTERESTS = 2;
function renderStep(step) {
  var picked = document.querySelectorAll('[data-interest-key][aria-pressed="true"]').length;
  if (step > 1 && picked < MIN_INTERESTS) {
    if (window.PF_AUTH && typeof window.PF_AUTH.showToast === 'function') {
      window.PF_AUTH.showToast(
        'เลือกความสนใจอย่างน้อย ' + MIN_INTERESTS + ' ด้านก่อนไปขั้นถัดไป (เลือกแล้ว ' + picked + ')',
        'Pick at least ' + MIN_INTERESTS + ' interests before the next step (' + picked + ' picked)'
      );
    }
    step = 1;
  }
  currentStep = step;
  PF_STATE.step = step;
  try { sessionStorage.setItem('pf_step', String(step)); } catch (e) {}
  document.getElementById('desktop-step-badge').textContent = stepNextLabels[currentLang].badge(step);
  document.getElementById('desktop-progress-fill').style.width = progressMap[step];
  document.getElementById('desktop-next-label').textContent = stepNextLabels[currentLang][step];
  var prevBtn = document.getElementById('desktop-prev-btn');
  prevBtn.disabled = step === 1;
  prevBtn.classList.toggle('cursor-not-allowed', step === 1);

  document.querySelectorAll('[data-step-nav]').forEach(function (navBtn) {
    var active = Number(navBtn.getAttribute('data-step-nav')) === step;
    navBtn.classList.toggle('bg-primary', active);
    navBtn.classList.toggle('text-on-primary', active);
    navBtn.classList.toggle('text-on-surface-variant', !active);
  });

  document.querySelectorAll('[data-step-panel]').forEach(function (panel) {
    panel.classList.toggle('hidden', Number(panel.getAttribute('data-step-panel')) !== step);
  });
}
document.getElementById('desktop-next-btn').addEventListener('click', function () {
  if (currentStep < 3) renderStep(currentStep + 1);
  else goToPage('3');
});
document.getElementById('desktop-prev-btn').addEventListener('click', function () {
  if (currentStep > 1) renderStep(currentStep - 1);
});
document.querySelectorAll('[data-step-nav]').forEach(function (btn) {
  btn.addEventListener('click', function () { renderStep(Number(btn.getAttribute('data-step-nav'))); });
});

/* Beyond 4.00 Toggle + Hours Pace + Journey Summary Strip */
var beyondToggle = document.getElementById('beyond-toggle');
var beyondLabel = document.getElementById('beyond-toggle-label');
var beyondAutoBadge = document.getElementById('beyond-auto-badge');
var hoursSlider = document.getElementById('hours-slider');
var hoursValue = document.getElementById('hours-value');
var summaryStrip = document.getElementById('journey-summary-strip');

function renderBeyondToggle(autoNudge) {
  var on = PF_STATE.beyond400;
  if (beyondToggle) {
    beyondToggle.setAttribute('aria-checked', on ? 'true' : 'false');
    beyondToggle.classList.toggle('bg-primary', on);
    beyondToggle.classList.toggle('text-on-primary', on);
    beyondToggle.classList.toggle('bg-surface-container-lowest', !on);
    beyondToggle.classList.toggle('text-on-surface-variant', !on);
    beyondToggle.classList.toggle('border', !on);
    beyondToggle.classList.toggle('border-outline-variant', !on);
    var iconEl = beyondToggle.querySelector('.material-symbols-outlined');
    if (iconEl) iconEl.textContent = on ? 'check_circle' : 'radio_button_unchecked';
  }
  if (beyondLabel) {
    beyondLabel.textContent = on ? (currentLang === 'th' ? 'เปิดอยู่' : 'On') : (currentLang === 'th' ? 'ปิดอยู่' : 'Off');
  }
  if (beyondAutoBadge) {
    beyondAutoBadge.classList.toggle('hidden', !(on && autoNudge));
  }
}

// replay a one-shot motion class (css/transitions.css 2.9) on an element
function pfMotion(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
  el.addEventListener('animationend', function done() { el.classList.remove(cls); el.removeEventListener('animationend', done); });
}
window.pfMotion = pfMotion;
window.pfReducedMotion = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

// a slider the student hasn't touched is shown faded with "not chosen yet" instead of its start value
function markSliderSet(el, isSet) {
  if (el) el.classList.toggle('opacity-50', !isSet);
}
function renderGpaxValue() {
  var el = document.getElementById('gpax-value');
  // the GPAX box is a text field now: don't rewrite it while the student is typing in it
  if (el && document.activeElement !== el) el.value = PF_STATE.gpaxSet ? Number(PF_STATE.gpax).toFixed(2) : '';
  markSliderSet(document.getElementById('gpax-slider'), PF_STATE.gpaxSet);
}
window.renderGpaxValue = renderGpaxValue;

// the hours pill = a number box (type) + the pace text; the slider sits under it
function renderHoursPace() {
  if (!hoursValue) return;
  markSliderSet(hoursSlider, PF_STATE.hoursSet);
  var box = document.getElementById('hours-input');
  var pace = document.getElementById('hours-pace');
  if (box && document.activeElement !== box) box.value = PF_STATE.hoursSet ? String(PF_STATE.weeklyHours) : '';
  if (!pace) return;
  if (!PF_STATE.hoursSet) {
    pace.textContent = currentLang === 'th' ? 'ยังไม่ได้เลือก • พิมพ์หรือเลื่อนเพื่อกำหนด' : 'Not set • type or drag';
    return;
  }
  var h = PF_STATE.weeklyHours;
  var paceTh = h < 5 ? 'จังหวะค่อยเป็นค่อยไป' : (h <= 10 ? 'จังหวะกำลังดี' : 'เร่งสปีดเข้มข้น');
  var paceEn = h < 5 ? 'Light & steady' : (h <= 10 ? 'Steady pace' : 'Intensive sprint');
  var band = h < 5 ? 'light' : (h <= 10 ? 'steady' : 'sprint');
  pace.textContent = currentLang === 'th' ? ('ชม./สัปดาห์ • ' + paceTh) : ('hrs/week • ' + paceEn);
  if (pace.getAttribute('data-band') && pace.getAttribute('data-band') !== band) pfMotion(pace, 'pf-swap-in');
  pace.setAttribute('data-band', band);
}

// typed university names go into innerHTML below: escape them
function rmSafe(v) {
  return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
// last texts of the summary chips, to see which one changed
var summaryPrev = null, summaryPrevLang = null;
function renderSummaryStrip() {
  if (!summaryStrip) return;
  var gradeLabel = pfGradeLabel();
  var uniNames = PF_STATE.targetUnis.map(function (k) { return k.toUpperCase(); }).concat(PF_STATE.otherUnis || []);
  var unis = uniNames.length
    ? rmSafe(uniNames.slice(0, 3).join(', ')) + (uniNames.length > 3 ? ' +' + (uniNames.length - 3) : '')
    : (currentLang === 'th' ? 'ยังไม่ระบุ' : 'Any');
  var beyondText = PF_STATE.beyond400
    ? (currentLang === 'th' ? 'Beyond 4.00: เปิด' : 'Beyond 4.00: On')
    : (currentLang === 'th' ? 'Beyond 4.00: ปิด' : 'Beyond 4.00: Off');
  var provinceText = PF_STATE.province ? rmSafe(PF_STATE.province) : (currentLang === 'th' ? 'จังหวัด: ไม่ระบุ' : 'Province: not set');
  var hoursText = (PF_STATE.hoursSet ? PF_STATE.weeklyHours : '—') + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk');

  summaryStrip.innerHTML =
    '<span class="font-label text-label-sm text-secondary-text uppercase tracking-wider">' + (currentLang === 'th' ? 'สรุปโปรไฟล์ของคุณ' : 'Your Journey Summary') + '</span>' +
    '<div class="flex flex-wrap items-center gap-gutter-xs">' +
      '<span data-sum="gpax" class="px-gutter-sm py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-metric text-label-sm text-on-surface tabular-nums">' + pfGradePrefix() + 'GPAX ' + (PF_STATE.gpaxSet ? Number(PF_STATE.gpax).toFixed(2) : '—') + '</span>' +
      '<span data-sum="beyond" class="px-gutter-sm py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm">' + beyondText + '</span>' +
      '<span data-sum="province" class="px-gutter-sm py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-sm text-on-surface">' + provinceText + '</span>' +
      '<span data-sum="unis" class="px-gutter-sm py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-sm text-on-surface">' + unis + '</span>' +
      (typeof window.pfFacultyLabels === 'function' && window.pfFacultyLabels().length
        ? '<span data-sum="faculties" class="px-gutter-sm py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-sm text-on-surface">' + rmSafe(window.pfFacultyLabels().join(', ')) + '</span>' : '') +
      '<span data-sum="hours" class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + hoursText + '</span>' +
    '</div>';
  // the chip whose answer just changed settles (not on first paint or a language switch)
  var now = {};
  summaryStrip.querySelectorAll('[data-sum]').forEach(function (c) { now[c.getAttribute('data-sum')] = c.textContent; });
  if (summaryPrev && summaryPrevLang === currentLang) {
    summaryStrip.querySelectorAll('[data-sum]').forEach(function (c) {
      var k = c.getAttribute('data-sum');
      if (summaryPrev[k] !== now[k]) pfMotion(c, 'pf-settle');
    });
  }
  summaryPrev = now;
  summaryPrevLang = currentLang;
}

if (beyondToggle) {
  beyondToggle.addEventListener('click', function () {
    PF_STATE.beyond400 = !PF_STATE.beyond400;
    renderBeyondToggle(false);
    renderSummaryStrip();
  });
}

if (hoursSlider) {
  hoursSlider.addEventListener('input', function () {
    PF_STATE.weeklyHours = Number(hoursSlider.value);
    PF_STATE.hoursSet = true;
    var b = document.getElementById('hours-input');
    if (b) b.value = String(PF_STATE.weeklyHours);
    renderHoursPace();
    renderSummaryStrip();
  });
}
// typing the hours: 0-80 (what the backend accepts), whole hours; the slider (2-25) follows as far as it goes
var hoursBox = document.getElementById('hours-input');
function parseHours(v) {
  var n = parseFloat(String(v).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 80) return null;
  return Math.round(n);
}
if (hoursBox && hoursSlider) {
  hoursBox.addEventListener('input', function () {
    var h = parseHours(hoursBox.value);
    hoursBox.classList.toggle('border-error', hoursBox.value !== '' && h === null);
    if (h === null) return;
    PF_STATE.weeklyHours = h;
    PF_STATE.hoursSet = true;
    hoursSlider.value = String(Math.max(Number(hoursSlider.min), Math.min(Number(hoursSlider.max), h)));
    renderHoursPace();
    renderSummaryStrip();
    if (typeof window.savePFState === 'function') window.savePFState();
  });
  hoursBox.addEventListener('blur', function () {
    if (hoursBox.value !== '' && parseHours(hoursBox.value) === null && window.PF_AUTH && typeof window.PF_AUTH.showToast === 'function') {
      window.PF_AUTH.showToast('ชั่วโมงต่อสัปดาห์ต้องอยู่ระหว่าง 0 – 80', 'Hours per week must be between 0 and 80');
    }
    var reverting = hoursBox.classList.contains('border-error');
    hoursBox.classList.remove('border-error');
    hoursBox.value = PF_STATE.hoursSet ? String(PF_STATE.weeklyHours) : '';
    if (reverting) pfMotion(hoursBox, 'pf-swap-in');
  });
  hoursBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); hoursBox.blur(); } });
}

/* Grade Pills (M.4 / M.5 / M.6) */
document.querySelectorAll('[data-grade-pill]').forEach(function (pill) {
  pill.addEventListener('click', function () {
    PF_STATE.grade = pill.getAttribute('data-grade-key') || 'M.5';
    document.querySelectorAll('[data-grade-pill]').forEach(function (p) {
      var active = p === pill;
      p.classList.toggle('border-primary', active);
      p.classList.toggle('bg-primary', active);
      p.classList.toggle('text-on-primary', active);
      p.classList.toggle('border-outline-variant', !active);
      p.classList.toggle('bg-surface', !active);
      p.classList.toggle('text-on-surface', !active);
    });
    renderSummaryStrip();
  });
});

/* Bubble Chips (Step 1 Interests + Step 3 Target Universities) */
// the only place that styles a chip as selected (green, check icon) or not. every path uses it, so a chip
// never ends up with two backgrounds at once (that showed white text on white)
function setChipSelected(chip, on) {
  chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  chip.classList.toggle('bg-primary', on);
  chip.classList.toggle('text-on-primary', on);
  chip.classList.toggle('border-primary', on);
  chip.classList.toggle('bg-surface', !on);
  chip.classList.toggle('text-on-surface', !on);
  chip.classList.toggle('border-outline-variant', !on);
  chip.classList.remove('bg-surface-container-lowest');
  var icon = chip.querySelector('.material-symbols-outlined');
  if (on && !icon) {
    icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[16px]';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'check_circle';
    chip.insertBefore(icon, chip.firstChild);
  } else if (!on && icon) {
    icon.remove();
  }
}
window.setChipSelected = setChipSelected;

// Step 1 says "pick 2-4": a 5th interest is refused (click, AI keyword match and restored state alike)
var MAX_INTERESTS = window.MAX_INTERESTS = 4;
function selectedInterestCount() {
  return document.querySelectorAll('[data-interest-key][aria-pressed="true"]').length;
}
function warnInterestLimit() {
  var th = 'เลือกได้สูงสุด ' + MAX_INTERESTS + ' ด้าน กดยกเลิกด้านที่เลือกไว้ก่อน แล้วค่อยเลือกด้านใหม่';
  var en = 'You can pick up to ' + MAX_INTERESTS + ' interests. Unselect one first, then pick another.';
  if (window.PF_AUTH && typeof window.PF_AUTH.showToast === 'function') window.PF_AUTH.showToast(th, en);
}

document.querySelectorAll('[data-interest-chip]').forEach(function (chip) {
  chip.addEventListener('click', function () {
    var turningOn = chip.getAttribute('aria-pressed') !== 'true';
    if (turningOn && chip.hasAttribute('data-interest-key') && selectedInterestCount() >= MAX_INTERESTS) {
      warnInterestLimit();
      return;
    }
    setChipSelected(chip, turningOn);

    if (chip.hasAttribute('data-interest-key')) {
      syncInterestOrder();
      if (typeof updateAIInterestSummary === 'function') updateAIInterestSummary();
      if (typeof syncMajorMatches === 'function') syncMajorMatches();
    } else if (chip.hasAttribute('data-uni-key')) {
      PF_STATE.targetUnis = Array.prototype.slice.call(document.querySelectorAll('[data-uni-key][aria-pressed="true"]'))
        .map(function (el) { return el.getAttribute('data-uni-key'); });
      renderSummaryStrip();
    }
  });
});

/* Step 3 "คณะที่สนใจเป็นพิเศษ": optional faculty chips, max 3, kept in PF_STATE.targetFaculties */
var MAX_FACULTIES = 3;
var FACULTY_LABEL = {};
document.querySelectorAll('[data-faculty-key]').forEach(function (chip) {
  var k = chip.getAttribute('data-faculty-key');
  var sp = chip.querySelector('[data-th]');
  FACULTY_LABEL[k] = { th: sp ? sp.getAttribute('data-th') : k, en: sp ? sp.getAttribute('data-en') : k };
  chip.addEventListener('click', function () {
    var list = Array.isArray(PF_STATE.targetFaculties) ? PF_STATE.targetFaculties.slice() : [];
    var i = list.indexOf(k);
    if (i === -1 && list.length >= MAX_FACULTIES) {
      if (window.PF_AUTH && typeof window.PF_AUTH.showToast === 'function') {
        window.PF_AUTH.showToast('เลือกคณะได้สูงสุด ' + MAX_FACULTIES + ' คณะ กดยกเลิกคณะที่เลือกไว้ก่อน', 'You can pick up to ' + MAX_FACULTIES + ' faculties. Unselect one first.');
      }
      return;
    }
    if (i === -1) list.push(k); else list.splice(i, 1);
    PF_STATE.targetFaculties = list;
    renderFaculties();
    renderSummaryStrip();
    if (typeof window.savePFState === 'function') window.savePFState();
  });
});
function renderFaculties() {
  var list = Array.isArray(PF_STATE.targetFaculties) ? PF_STATE.targetFaculties : [];
  document.querySelectorAll('[data-faculty-key]').forEach(function (c) {
    setChipSelected(c, list.indexOf(c.getAttribute('data-faculty-key')) !== -1);
  });
}
window.renderFaculties = renderFaculties;
window.pfFacultyLabels = function () {
  return (PF_STATE.targetFaculties || []).map(function (k) { var l = FACULTY_LABEL[k]; return l ? (currentLang === 'th' ? l.th : l.en) : k; });
};
renderFaculties();

/* "Other universities": free-text names next to the chip list. Stored in PF_STATE.otherUnis (max 5),
   synced with the chips in target_universities. Text only (textContent), never HTML */
var MAX_OTHER_UNIS = 5;
var otherUniToggle = document.getElementById('other-uni-toggle');
var otherUniPanel = document.getElementById('other-uni-panel');
var otherUniInput = document.getElementById('other-uni-input');
var otherUniTags = document.getElementById('other-uni-tags');

function renderOtherUnis() {
  var list = Array.isArray(PF_STATE.otherUnis) ? PF_STATE.otherUnis : [];
  var open = list.length > 0 || (otherUniPanel && !otherUniPanel.classList.contains('hidden') && otherUniPanel.getAttribute('data-open') === '1');
  if (otherUniToggle) setChipSelected(otherUniToggle, list.length > 0);
  if (otherUniToggle && list.length === 0) {
    // keep the "+" icon on the unselected toggle (setChipSelected removes icons when off)
    if (!otherUniToggle.querySelector('.material-symbols-outlined')) {
      var plus = document.createElement('span');
      plus.className = 'material-symbols-outlined text-[16px]';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = 'add';
      otherUniToggle.insertBefore(plus, otherUniToggle.firstChild);
    }
    otherUniToggle.classList.add('border-dashed');
  } else if (otherUniToggle) {
    otherUniToggle.classList.remove('border-dashed');
  }
  if (otherUniPanel) otherUniPanel.classList.toggle('hidden', !open);
  if (!otherUniTags) return;
  otherUniTags.textContent = '';
  list.forEach(function (name, i) {
    var tag = document.createElement('span');
    tag.className = 'inline-flex items-center gap-1 pl-gutter-sm pr-1 py-1 rounded-full bg-primary text-on-primary font-label text-label-md';
    var txt = document.createElement('span');
    txt.textContent = name;
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'w-6 h-6 rounded-full hover:bg-on-primary/20 flex items-center justify-center';
    x.setAttribute('aria-label', (currentLang === 'th' ? 'ลบ ' : 'Remove ') + name);
    x.innerHTML = '<span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>';
    x.addEventListener('click', function () {
      PF_STATE.otherUnis.splice(i, 1);
      renderOtherUnis();
      renderSummaryStrip();
      if (typeof window.savePFState === 'function') window.savePFState();
    });
    tag.appendChild(txt);
    tag.appendChild(x);
    otherUniTags.appendChild(tag);
  });
}
window.renderOtherUnis = renderOtherUnis;

function addOtherUni() {
  if (!otherUniInput) return;
  var name = otherUniInput.value.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!name) return;
  PF_STATE.otherUnis = Array.isArray(PF_STATE.otherUnis) ? PF_STATE.otherUnis : [];
  var dup = PF_STATE.otherUnis.some(function (n) { return n.toLowerCase() === name.toLowerCase(); });
  if (!dup && PF_STATE.otherUnis.length >= MAX_OTHER_UNIS) {
    if (window.PF_AUTH) window.PF_AUTH.showToast('เพิ่มมหาวิทยาลัยอื่นได้สูงสุด ' + MAX_OTHER_UNIS + ' แห่ง', 'You can add up to ' + MAX_OTHER_UNIS + ' other universities');
    return;
  }
  if (!dup) PF_STATE.otherUnis.push(name);
  otherUniInput.value = '';
  renderOtherUnis();
  renderSummaryStrip();
  if (typeof window.savePFState === 'function') window.savePFState();
  otherUniInput.focus();
}

if (otherUniToggle && otherUniPanel) {
  otherUniToggle.addEventListener('click', function () {
    var showing = !otherUniPanel.classList.contains('hidden');
    otherUniPanel.setAttribute('data-open', showing ? '0' : '1');
    otherUniPanel.classList.toggle('hidden', showing && !(PF_STATE.otherUnis || []).length);
    if (!showing && otherUniInput) otherUniInput.focus();
  });
}
if (otherUniInput) {
  otherUniInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addOtherUni(); }
  });
}
// Step 3 province
var provinceSelect = document.getElementById('province-select');
function renderProvince() {
  if (provinceSelect) provinceSelect.value = PF_STATE.province || '';
  if (typeof window.syncProvinceSearch === 'function') window.syncProvinceSearch();
}
window.renderProvince = renderProvince;
if (provinceSelect) {
  provinceSelect.addEventListener('change', function () {
    PF_STATE.province = provinceSelect.value || '';
    renderSummaryStrip();
    if (typeof window.savePFState === 'function') window.savePFState();
  });
}

/* Province search box: type to filter the 77 provinces (name, region, or a common alias), arrow keys + Enter,
   Esc closes. The hidden #province-select stays the value holder, so everything else reads it as before. */
(function () {
  var box = document.getElementById('province-search');
  var list = document.getElementById('province-list');
  var clearBtn = document.getElementById('province-clear');
  if (!box || !list || !provinceSelect) return;
  // [{ v: 'ชลบุรี', g: 'ภาคตะวันออก' }, ...] straight from the <select>
  var all = [];
  Array.prototype.forEach.call(provinceSelect.querySelectorAll('optgroup'), function (g) {
    Array.prototype.forEach.call(g.querySelectorAll('option'), function (o) { all.push({ v: o.value, g: g.label }); });
  });
  var ALIAS = { 'กทม': 'กรุงเทพมหานคร', 'กรุงเทพ': 'กรุงเทพมหานคร', 'bangkok': 'กรุงเทพมหานคร', 'bkk': 'กรุงเทพมหานคร',
    'โคราช': 'นครราชสีมา', 'อยุธยา': 'พระนครศรีอยุธยา', 'chiang mai': 'เชียงใหม่', 'chonburi': 'ชลบุรี', 'chon buri': 'ชลบุรี',
    'phuket': 'ภูเก็ต', 'khon kaen': 'ขอนแก่น', 'hat yai': 'สงขลา', 'หาดใหญ่': 'สงขลา', 'พัทยา': 'ชลบุรี', 'pattaya': 'ชลบุรี' };
  var norm = function (t) { return String(t || '').toLowerCase().replace(/\s+/g, ''); };
  var active = -1, shown = [];

  function matches(q) {
    var n = norm(q);
    if (!n) return all.slice();
    var alias = Object.keys(ALIAS).filter(function (a) { return norm(a).indexOf(n) === 0; }).map(function (a) { return ALIAS[a]; });
    return all.filter(function (p) {
      return norm(p.v).indexOf(n) !== -1 || norm(p.g).indexOf(n) !== -1 || alias.indexOf(p.v) !== -1;
    }).sort(function (a, b) { return (norm(a.v).indexOf(n) === 0 ? 0 : 1) - (norm(b.v).indexOf(n) === 0 ? 0 : 1); });
  }
  function open(q) {
    shown = matches(q);
    active = shown.length ? 0 : -1;
    list.textContent = '';
    if (!shown.length) {
      var li = document.createElement('li');
      li.className = 'px-gutter-md py-2 font-body text-body-sm text-on-surface-variant';
      li.textContent = currentLang === 'th' ? 'ไม่พบจังหวัดนี้' : 'No province found';
      list.appendChild(li);
    }
    var lastGroup = null;
    shown.forEach(function (p, i) {
      if (p.g !== lastGroup && !norm(q)) {
        var h = document.createElement('li');
        h.className = 'px-gutter-md pt-2 pb-0.5 font-label text-label-sm text-on-surface-variant';
        h.setAttribute('role', 'presentation');
        h.textContent = p.g;
        list.appendChild(h);
        lastGroup = p.g;
      }
      var li = document.createElement('li');
      li.id = 'province-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('data-province', p.v);
      li.className = 'px-gutter-md py-1.5 cursor-pointer font-body text-body-md text-on-surface flex justify-between gap-2';
      var name = document.createElement('span'); name.textContent = p.v; li.appendChild(name);
      if (norm(q)) { var g = document.createElement('span'); g.className = 'font-label text-label-sm text-on-surface-variant'; g.textContent = p.g; li.appendChild(g); }
      list.appendChild(li);
    });
    list.classList.remove('hidden');
    box.setAttribute('aria-expanded', 'true');
    highlight();
  }
  function close() {
    list.classList.add('hidden');
    box.setAttribute('aria-expanded', 'false');
    box.removeAttribute('aria-activedescendant');
  }
  function highlight() {
    list.querySelectorAll('[role="option"]').forEach(function (li, i) {
      var on = i === active;
      li.setAttribute('aria-selected', on ? 'true' : 'false');
      li.classList.toggle('bg-secondary-container', on);
      if (on) { box.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    });
  }
  function choose(v) {
    provinceSelect.value = v;
    provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    syncBox();
    close();
  }
  function syncBox() {
    box.value = PF_STATE.province || '';
    clearBtn.classList.toggle('hidden', !PF_STATE.province);
  }
  window.syncProvinceSearch = syncBox;

  box.addEventListener('focus', function () { box.select(); open(''); });
  // Step 3 may focus the box by itself: a click must still open the list
  box.addEventListener('click', function () { if (list.classList.contains('hidden')) open(''); });
  box.addEventListener('input', function () { open(box.value); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.classList.contains('hidden')) { open(box.value); return; }
      if (!shown.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      highlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && shown[active]) choose(shown[active].v);
    } else if (e.key === 'Escape') {
      syncBox(); close();
    }
  });
  // mousedown (not click) so the choice lands before the box loses focus
  list.addEventListener('mousedown', function (e) {
    var li = e.target.closest ? e.target.closest('[data-province]') : null;
    if (!li) return;
    e.preventDefault();
    choose(li.getAttribute('data-province'));
  });
  box.addEventListener('blur', function () {
    // an exact name typed and left = chosen; anything else goes back to the saved province
    var exact = all.find(function (p) { return norm(p.v) === norm(box.value); });
    if (exact && exact.v !== PF_STATE.province) choose(exact.v);
    else { syncBox(); close(); }
  });
  clearBtn.addEventListener('click', function () { choose(''); box.focus(); });
  syncBox();
})();

var otherUniAdd = document.getElementById('other-uni-add');
if (otherUniAdd) otherUniAdd.addEventListener('click', addOtherUni);
renderOtherUnis();

/* Main vs secondary interest. PF_STATE.interests keeps the order the student picked in:
   [0] = ความสนใจหลัก (main), the rest = ความสนใจรอง. "ตั้งเป็นหลัก" moves one to the front.
   The matcher (POST /api/match/programs) weighs the main interest more. */
function interestLabel(key) {
  var it = INTEREST_KEYWORD_MAP.find(function (m) { return m.key === key; });
  return it ? (currentLang === 'th' ? it.th : it.en) : key;
}
function renderInterestPriority() {
  var box = document.getElementById('interest-priority');
  var list = (PF_STATE.interests || []).filter(function (k) { return document.querySelector('[data-interest-key="' + k + '"]'); });
  // the "หลัก" tag on the main bubble
  document.querySelectorAll('[data-interest-key] [data-main-tag]').forEach(function (t) { t.remove(); });
  if (list[0]) {
    var chip = document.querySelector('[data-interest-key="' + list[0] + '"]');
    if (chip) {
      var tag = document.createElement('span');
      tag.setAttribute('data-main-tag', '');
      tag.className = 'px-1.5 py-0.5 rounded-full bg-on-primary/20 font-label text-[10px] leading-none';
      tag.textContent = currentLang === 'th' ? 'หลัก' : 'Main';
      chip.appendChild(tag);
    }
  }
  if (!box) return;
  box.classList.toggle('hidden', !list.length);
  if (!list.length) { box.textContent = ''; return; }
  var esc = function (v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  box.innerHTML =
    '<div class="flex flex-wrap items-center gap-gutter-xs">' +
      '<span class="font-label text-label-md text-on-surface-variant">' + (currentLang === 'th' ? 'ความสนใจหลัก' : 'Main interest') + '</span>' +
      '<span class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-primary text-on-primary font-label text-label-md"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">star</span>' + esc(interestLabel(list[0])) + '</span>' +
    '</div>' +
    (list.length > 1
      ? '<div class="flex flex-wrap items-center gap-gutter-xs">' +
          '<span class="font-label text-label-md text-on-surface-variant">' + (currentLang === 'th' ? 'ความสนใจรอง' : 'Secondary') + '</span>' +
          list.slice(1).map(function (k) {
            return '<span class="inline-flex items-center gap-1 pl-gutter-sm pr-1 py-1 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-md text-on-surface">' + esc(interestLabel(k)) +
              '<button type="button" data-make-main="' + esc(k) + '" class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] hover:bg-primary hover:text-on-primary">' +
                '<span class="material-symbols-outlined text-[13px]" aria-hidden="true">star</span>' + (currentLang === 'th' ? 'ตั้งเป็นหลัก' : 'Make main') +
              '</button></span>';
          }).join('') +
        '</div>'
      : '<p class="font-body text-label-sm text-on-surface-variant">' + (currentLang === 'th' ? 'เลือกเพิ่มอีกอย่างน้อย 1 ด้านเป็นความสนใจรอง' : 'Pick at least one more as a secondary interest') + '</p>');
}
window.renderInterestPriority = renderInterestPriority;

// keep PF_STATE.interests in pick order (new picks go to the end, unpicked ones drop out)
function syncInterestOrder() {
  var on = Array.prototype.slice.call(document.querySelectorAll('[data-interest-key][aria-pressed="true"]'))
    .map(function (el) { return el.getAttribute('data-interest-key'); });
  var kept = (PF_STATE.interests || []).filter(function (k) { return on.indexOf(k) !== -1; });
  on.forEach(function (k) { if (kept.indexOf(k) === -1) kept.push(k); });
  PF_STATE.interests = kept;
  renderInterestPriority();
}
window.syncInterestOrder = syncInterestOrder;

document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-make-main]') : null;
  if (!b) return;
  var k = b.getAttribute('data-make-main');
  PF_STATE.interests = [k].concat((PF_STATE.interests || []).filter(function (x) { return x !== k; }));
  renderInterestPriority();
  if (typeof updateAIInterestSummary === 'function') updateAIInterestSummary();
  if (typeof window.savePFState === 'function') window.savePFState();
});

/* AI Custom Interest Search & Smart Summarizer */

function activateInterestChip(key) {
  var chip = document.querySelector('[data-interest-key="' + key + '"]');
  if (!chip || chip.getAttribute('aria-pressed') === 'true') return;
  if (selectedInterestCount() >= MAX_INTERESTS) return; // AI keyword match never goes past the limit
  setChipSelected(chip, true);
}

function updateAIInterestSummary() {
  var summaryEl = document.getElementById('ai-interest-summary-text');
  if (!summaryEl) return;
  var activeKeys = PF_STATE.interests || [];
  var labelsTh = [];
  var labelsEn = [];
  activeKeys.forEach(function (k) {
    var found = INTEREST_KEYWORD_MAP.find(function (m) { return m.key === k; });
    if (found) {
      labelsTh.push(found.th);
      labelsEn.push(found.en);
    }
  });
  var customTxt = (PF_STATE.customInterestText || '').trim();
  var thOut = '';
  var enOut = '';
  var ai = PF_STATE.aiInterestSummary;
  if (customTxt && ai && ai.text === customTxt && ai.summary) {
    thOut = 'AI: ' + ai.summary + (labelsTh.length ? ' → จับคู่ด้าน ' + labelsTh.slice(0, 4).join(', ') : '');
    enOut = 'AI: ' + ai.summary + (labelsEn.length ? ' → Matched to ' + labelsEn.slice(0, 4).join(', ') : '');
  } else if (customTxt && !(window.PF_AUTH && window.PF_AUTH.getCurrentUser())) {
    thOut = 'จับคู่จากคำที่พิมพ์ ("' + customTxt + '")' + (labelsTh.length ? ' → ด้าน ' + labelsTh.slice(0, 4).join(', ') : ' → ยังไม่พบคำที่ตรงกับด้านไหน') + ' • เข้าสู่ระบบเพื่อให้ AI ช่วยวิเคราะห์';
    enOut = 'Matched from your words ("' + customTxt + '")' + (labelsEn.length ? ' → ' + labelsEn.slice(0, 4).join(', ') : ' → no matching area yet') + ' • sign in to let AI analyze';
  } else if (customTxt && ai && ai.error) {
    thOut = 'AI ไม่ว่างตอนนี้ (' + ai.error + ') จึงจับคู่จากคำที่พิมพ์แทน' + (labelsTh.length ? ' → ด้าน ' + labelsTh.slice(0, 4).join(', ') : '');
    enOut = 'AI is unavailable (' + ai.error + '), matched from your words instead' + (labelsEn.length ? ' → ' + labelsEn.slice(0, 4).join(', ') : '');
  } else if (customTxt) {
    thOut = 'จากสิ่งที่คุณพิมพ์ ("' + customTxt + '")' + (labelsTh.length ? ' → จับคู่ด้าน ' + labelsTh.slice(0, 4).join(', ') + ' และอัปเดตคะแนนคณะที่ตรงกับคุณแล้ว' : ' → วิเคราะห์ความสนใจเฉพาะทางและจัดอันดับคณะแนะนำให้แล้ว');
    enOut = 'From what you typed ("' + customTxt + '")' + (labelsEn.length ? ' → Matched to ' + labelsEn.slice(0, 4).join(', ') + ' and updated your faculty rankings.' : ' → Analyzed custom interests and updated your faculty rankings.');
  } else if (labelsTh.length) {
    thOut = 'กำลังจับคู่จากความสนใจ ' + labelsTh.length + ' ด้าน: ' + labelsTh.slice(0, 4).join(', ') + (labelsTh.length > 4 ? ' และอื่นๆ' : '') + ' — ระบบอัปเดตคณะที่ตรงกับคุณในหน้าถัดไปแล้ว';
    enOut = 'Matched from ' + labelsEn.length + ' interests: ' + labelsEn.slice(0, 4).join(', ') + (labelsEn.length > 4 ? ' & more' : '') + ' — faculty rankings updated.';
  } else {
    thOut = 'เลือก Bubble ความสนใจด้านบน หรือพิมพ์สิ่งที่ชอบในช่องค้นหาเพื่อให้ AI ช่วยจับคู่คณะให้';
    enOut = 'Select interest bubbles above or type what you enjoy so AI can match your best-fit majors.';
  }
  summaryEl.setAttribute('data-th', thOut);
  summaryEl.setAttribute('data-en', enOut);
  summaryEl.textContent = currentLang === 'th' ? thOut : enOut;
}
window.updateAIInterestSummary = updateAIInterestSummary;

// Step 1 "AI วิเคราะห์ความสนใจ": signed in -> POST /api/match/interests (Gemini maps the text to our
// interest keys + writes a short summary). Guests (or if the AI fails) -> matching the typed words to
// INTEREST_KEYWORD_MAP, and the summary says that honestly. Either way the 4-interest limit holds
function keywordInterests(raw) {
  var lower = raw.toLowerCase();
  return INTEREST_KEYWORD_MAP.filter(function (item) {
    return item.words.some(function (w) { return lower.indexOf(w) !== -1; });
  }).map(function (item) { return item.key; });
}
function applyInterestKeys(keys) {
  (keys || []).forEach(function (k) { activateInterestChip(k); });
  syncInterestOrder();
}
async function analyzeCustomInterest() {
  var inp = document.getElementById('custom-interest-input');
  if (!inp) return;
  var raw = inp.value.trim();
  PF_STATE.customInterestText = raw;
  PF_STATE.aiInterestSummary = null;
  var btn = document.getElementById('custom-interest-analyze-btn');
  var summaryEl = document.getElementById('ai-interest-summary-text');
  var signedIn = !!(window.PF_AUTH && window.PF_AUTH.getCurrentUser());
  if (raw && raw.length >= 2 && signedIn && window.PF_API) {
    if (btn) btn.disabled = true;
    if (summaryEl) summaryEl.textContent = currentLang === 'th' ? 'AI กำลังวิเคราะห์สิ่งที่คุณพิมพ์…' : 'AI is reading what you typed…';
    try {
      var d = await PF_API.request('/match/interests', { method: 'POST', auth: true, body: { text: raw.slice(0, 500) }, timeoutMs: 60000 });
      applyInterestKeys(d.interests);
      PF_STATE.aiInterestSummary = { text: raw, summary: d.summary, keys: d.interests };
    } catch (err) {
      applyInterestKeys(keywordInterests(raw));
      PF_STATE.aiInterestSummary = { text: raw, error: PF_API.errorText(err) };
    } finally {
      if (btn) btn.disabled = false;
    }
  } else if (raw) {
    applyInterestKeys(keywordInterests(raw));
  }
  updateAIInterestSummary();
  if (typeof syncMajorMatches === 'function') syncMajorMatches();
  if (typeof window.savePFState === 'function') window.savePFState();
}

var analyzeBtn = document.getElementById('custom-interest-analyze-btn');
var customInput = document.getElementById('custom-interest-input');
if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeCustomInterest);
if (customInput) {
  customInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      analyzeCustomInterest();
    }
  });
}
updateAIInterestSummary();

var slider = document.getElementById('gpax-slider');
var gpaxVal = document.getElementById('gpax-value');
// one place for a new GPAX, from the slider or typed in the box
function setGpax(nextGpax) {
  var prevGpax = PF_STATE.gpaxSet ? PF_STATE.gpax : 0;
  PF_STATE.gpax = nextGpax;
  PF_STATE.gpaxSet = true;
  if (prevGpax < 3.80 && nextGpax >= 3.80) {
    var wasOn = PF_STATE.beyond400;
    PF_STATE.beyond400 = true;
    renderBeyondToggle(true);
    if (!wasOn) pfMotion(document.getElementById('beyond-mode-card'), 'pf-settle');
  } else if (nextGpax < 3.80 && beyondAutoBadge) {
    beyondAutoBadge.classList.add('hidden');
  }
  renderSummaryStrip();
  if (typeof window.savePFState === 'function') window.savePFState();
}
// "3.476" -> 3.48, out of 0-4 or not a number -> null
function parseGpax(v) {
  var n = parseFloat(String(v).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 4) return null;
  return Math.round(n * 100) / 100;
}
if (slider && gpaxVal) {
  slider.addEventListener('input', function () {
    setGpax(Number(slider.value));
    gpaxVal.value = Number(slider.value).toFixed(2);
    renderGpaxValue();
  });
  // typing: a valid number moves the slider right away; the box is tidied (2 decimals) when you leave it
  gpaxVal.addEventListener('input', function () {
    var g = parseGpax(gpaxVal.value);
    gpaxVal.classList.toggle('border-error', gpaxVal.value !== '' && g === null);
    if (g === null) return;
    slider.value = String(Math.max(Number(slider.min), g));
    setGpax(g);
    markSliderSet(slider, true);
  });
  function tidyGpax() {
    var g = parseGpax(gpaxVal.value);
    if (gpaxVal.value !== '' && g === null && window.PF_AUTH && typeof window.PF_AUTH.showToast === 'function') {
      window.PF_AUTH.showToast('GPAX ต้องอยู่ระหว่าง 0.00 – 4.00', 'GPAX must be between 0.00 and 4.00');
    }
    var reverting = gpaxVal.classList.contains('border-error');
    gpaxVal.classList.remove('border-error');
    gpaxVal.value = PF_STATE.gpaxSet ? Number(PF_STATE.gpax).toFixed(2) : '';
    if (reverting) pfMotion(gpaxVal, 'pf-swap-in');
  }
  gpaxVal.addEventListener('blur', tidyGpax);
  gpaxVal.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gpaxVal.blur(); } });
}

renderBeyondToggle(false);
renderGpaxValue();
renderHoursPace();
renderSummaryStrip();

/* Sync Page 3 (Major Matches) from PF_STATE */

function syncMajorMatches() {
  var profilePill = document.getElementById('matches-profile-pill');
  var beyondPill = document.getElementById('matches-beyond-pill');
  var topGrid = document.getElementById('matches-top3-grid');
  var otherGrid = document.getElementById('matches-other-grid');

  if (profilePill) {
    var gradeTh = pfGradeLabel('th');
    var gpaxStr = pfGpaxText();
    var thText = pfGradePrefix('th') + 'GPAX ' + gpaxStr + ' • ' + pfHoursText() + ' ชม./สัปดาห์';
    var enText = pfGradePrefix('en') + 'GPAX ' + gpaxStr + ' • ' + pfHoursText() + ' hrs/wk';
    profilePill.setAttribute('data-th', thText);
    profilePill.setAttribute('data-en', enText);
    profilePill.textContent = currentLang === 'th' ? thText : enText;
  }

  if (beyondPill) {
    var bTh = PF_STATE.beyond400 ? 'Beyond 4.00 เปิดอยู่' : 'Beyond 4.00 ปิดอยู่';
    var bEn = PF_STATE.beyond400 ? 'Beyond 4.00 On' : 'Beyond 4.00 Off';
    beyondPill.setAttribute('data-th', bTh);
    beyondPill.setAttribute('data-en', bEn);
    beyondPill.textContent = currentLang === 'th' ? bTh : bEn;
  }

  if (!topGrid || !otherGrid) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-destination-card]'));
  if (!cards.length) return;

  var scored = cards.map(function (card) {
    var id = card.getAttribute('data-destination-card');
    var meta = MAJOR_SCORING[id] || { base: 72, unis: [], interests: [], key: '' };
    var score = meta.base;

    var interestHits = 0;
    meta.interests.forEach(function (tag) {
      if (PF_STATE.interests.indexOf(tag) !== -1) interestHits++;
    });
    score += Math.min(10, interestHits * 4);

    var uniHit = meta.unis.some(function (u) { return PF_STATE.targetUnis.indexOf(u) !== -1; });
    if (uniHit) score += 5;

    score += Math.round((PF_STATE.gpax - 3.75) * 8);
    if (PF_STATE.beyond400) score += (id === '1' || id === '3' ? 2 : 1);

    if (PF_STATE.acceptedMajors.some(function (m) { return m.indexOf(meta.key) !== -1; })) score += 5;
    if (PF_STATE.ignoredMajors.some(function (m) { return m.indexOf(meta.key) !== -1; })) score -= 6;

    score = Math.max(58, Math.min(99, score));
    return { card: card, id: Number(id), score: score };
  }).sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.id - b.id;
  });

  scored.forEach(function (entry, idx) {
    var pct = entry.score + '%';
    var matchSpan = entry.card.querySelector('span[data-th*="ตรงกัน"], span[data-en*="Match"]');
    if (matchSpan) {
      matchSpan.setAttribute('data-th', 'ตรงกัน ' + pct);
      matchSpan.setAttribute('data-en', pct + ' Match');
      matchSpan.textContent = currentLang === 'th' ? ('ตรงกัน ' + pct) : (pct + ' Match');
    }
    var lockBtn = entry.card.querySelector('[data-lock-btn]');
    if (lockBtn) lockBtn.setAttribute('data-match', pct);

    if (idx < 3) topGrid.appendChild(entry.card);
    else otherGrid.appendChild(entry.card);
  });
}
window.syncMajorMatches = syncMajorMatches;
syncMajorMatches();

PF_STATE.lockedMajorId = PF_STATE.lockedMajorId || '1';
PF_STATE.checkedWaypoints = PF_STATE.checkedWaypoints || { '1-r1-0': true, '1-r2-0': true };


