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
 * Provides   : progressMap, renderStep, renderBeyondToggle, renderHoursPace, renderSummaryStrip, activateInterestChip, updateAIInterestSummary, analyzeCustomInterest, syncMajorMatches, getCountdownStrings
 * ========================================================================= */

/* Hero Preview Tabs */
document.querySelectorAll('[data-hero-tab]').forEach(function (tab) {
  tab.addEventListener('click', function () {
    var target = tab.getAttribute('data-hero-tab');
    document.querySelectorAll('[data-hero-tab]').forEach(function (t) {
      var active = t.getAttribute('data-hero-tab') === target;
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.classList.toggle('bg-primary', active);
      t.classList.toggle('text-on-primary', active);
      t.classList.toggle('text-on-surface-variant', !active);
    });
    ['hr1', 'hr2', 'hr3', 'hr4'].forEach(function (id) {
      var p = document.querySelector('[data-round-panel="' + id + '"]');
      if (p) p.classList.toggle('hidden', id !== target);
    });
  });
});

/* Discovery Stepper + Step Nav Tab Highlight */
var progressMap = { 1: '33%', 2: '67%', 3: '100%' };

/* [JS 4.4] Page 1-3 Controllers (Hero, Discovery Wizard, AI Matcher, Major Scoring) */
function renderStep(step) {
  currentStep = step;
  PF_STATE.step = step;
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

function renderHoursPace() {
  if (!hoursValue) return;
  var h = PF_STATE.weeklyHours;
  var paceTh = h < 5 ? 'จังหวะค่อยเป็นค่อยไป' : (h <= 10 ? 'จังหวะกำลังดี' : 'เร่งสปีดเข้มข้น');
  var paceEn = h < 5 ? 'Light & steady' : (h <= 10 ? 'Steady pace' : 'Intensive sprint');
  hoursValue.textContent = currentLang === 'th'
    ? (h + ' ชม./สัปดาห์ • ' + paceTh)
    : (h + ' hrs/week • ' + paceEn);
}

function renderSummaryStrip() {
  if (!summaryStrip) return;
  var gradeLabel = currentLang === 'th' ? PF_STATE.grade.replace('M.', 'ม.') : PF_STATE.grade;
  var unis = PF_STATE.targetUnis.length
    ? PF_STATE.targetUnis.slice(0, 3).map(function (k) { return k.toUpperCase(); }).join(', ') + (PF_STATE.targetUnis.length > 3 ? ' +' + (PF_STATE.targetUnis.length - 3) : '')
    : (currentLang === 'th' ? 'ยังไม่ระบุ' : 'Any');
  var beyondText = PF_STATE.beyond400
    ? (currentLang === 'th' ? 'Beyond 4.00: เปิด' : 'Beyond 4.00: On')
    : (currentLang === 'th' ? 'Beyond 4.00: ปิด' : 'Beyond 4.00: Off');
  var hoursText = PF_STATE.weeklyHours + (currentLang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk');

  summaryStrip.innerHTML =
    '<span class="font-label text-label-sm text-secondary-text uppercase tracking-wider">' + (currentLang === 'th' ? 'สรุปโปรไฟล์ของคุณ' : 'Your Journey Summary') + '</span>' +
    '<div class="flex flex-wrap items-center gap-gutter-xs">' +
      '<span class="px-gutter-sm py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-metric text-label-sm text-on-surface tabular-nums">' + gradeLabel + ' • GPAX ' + PF_STATE.gpax.toFixed(2) + '</span>' +
      '<span class="px-gutter-sm py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm">' + beyondText + '</span>' +
      '<span class="px-gutter-sm py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-sm text-on-surface">' + unis + '</span>' +
      '<span class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + hoursText + '</span>' +
    '</div>';
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
    renderHoursPace();
    renderSummaryStrip();
  });
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
document.querySelectorAll('[data-interest-chip]').forEach(function (chip) {
  chip.addEventListener('click', function () {
    var pressed = chip.getAttribute('aria-pressed') === 'true';
    var nextPressed = !pressed;
    chip.setAttribute('aria-pressed', nextPressed ? 'true' : 'false');
    chip.classList.toggle('bg-primary', nextPressed);
    chip.classList.toggle('text-on-primary', nextPressed);
    chip.classList.toggle('border-primary', nextPressed);
    chip.classList.toggle('bg-surface', !nextPressed);
    chip.classList.toggle('text-on-surface', !nextPressed);
    chip.classList.toggle('border-outline-variant', !nextPressed);

    var existingIcon = chip.querySelector('.material-symbols-outlined');
    if (nextPressed && !existingIcon) {
      var ic = document.createElement('span');
      ic.className = 'material-symbols-outlined text-[16px]';
      ic.setAttribute('aria-hidden', 'true');
      ic.textContent = 'check_circle';
      chip.insertBefore(ic, chip.firstChild);
    } else if (!nextPressed && existingIcon) {
      existingIcon.remove();
    }

    if (chip.hasAttribute('data-interest-key')) {
      PF_STATE.interests = Array.prototype.slice.call(document.querySelectorAll('[data-interest-key][aria-pressed="true"]'))
        .map(function (el) { return el.getAttribute('data-interest-key'); });
      if (typeof updateAIInterestSummary === 'function') updateAIInterestSummary();
      if (typeof syncMajorMatches === 'function') syncMajorMatches();
    } else if (chip.hasAttribute('data-uni-key')) {
      PF_STATE.targetUnis = Array.prototype.slice.call(document.querySelectorAll('[data-uni-key][aria-pressed="true"]'))
        .map(function (el) { return el.getAttribute('data-uni-key'); });
      renderSummaryStrip();
    }
  });
});

/* AI Custom Interest Search & Smart Summarizer */

function activateInterestChip(key) {
  var chip = document.querySelector('[data-interest-key="' + key + '"]');
  if (!chip) return;
  chip.setAttribute('aria-pressed', 'true');
  chip.classList.add('bg-primary', 'text-on-primary', 'border-primary');
  chip.classList.remove('bg-surface', 'text-on-surface', 'border-outline-variant');
  if (!chip.querySelector('.material-symbols-outlined')) {
    var ic = document.createElement('span');
    ic.className = 'material-symbols-outlined text-[16px]';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = 'check_circle';
    chip.insertBefore(ic, chip.firstChild);
  }
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
  if (customTxt) {
    thOut = 'AI สรุปจากสิ่งที่คุณพิมพ์ ("' + customTxt + '")' + (labelsTh.length ? ' → จับคู่ด้าน ' + labelsTh.slice(0, 4).join(', ') + ' และอัปเดตคะแนนคณะที่ตรงกับคุณแล้ว' : ' → วิเคราะห์ความสนใจเฉพาะทางและจัดอันดับคณะแนะนำให้แล้ว');
    enOut = 'AI summary for "' + customTxt + '"' + (labelsEn.length ? ' → Matched to ' + labelsEn.slice(0, 4).join(', ') + ' and updated your faculty rankings.' : ' → Analyzed custom interests and updated your faculty rankings.');
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

function analyzeCustomInterest() {
  var inp = document.getElementById('custom-interest-input');
  if (!inp) return;
  var raw = inp.value.trim();
  PF_STATE.customInterestText = raw;
  if (raw) {
    var lower = raw.toLowerCase();
    var matched = [];
    INTEREST_KEYWORD_MAP.forEach(function (item) {
      if (item.words.some(function (w) { return lower.indexOf(w) !== -1; })) {
        matched.push(item.key);
        activateInterestChip(item.key);
      }
    });
    PF_STATE.interests = Array.prototype.slice.call(document.querySelectorAll('[data-interest-key][aria-pressed="true"]'))
      .map(function (el) { return el.getAttribute('data-interest-key'); });
  }
  updateAIInterestSummary();
  if (typeof syncMajorMatches === 'function') syncMajorMatches();
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
if (slider && gpaxVal) {
  slider.addEventListener('input', function () {
    var prevGpax = PF_STATE.gpax;
    var nextGpax = Number(slider.value);
    PF_STATE.gpax = nextGpax;
    gpaxVal.textContent = nextGpax.toFixed(2);
    if (prevGpax < 3.80 && nextGpax >= 3.80) {
      PF_STATE.beyond400 = true;
      renderBeyondToggle(true);
    } else if (nextGpax < 3.80 && beyondAutoBadge) {
      beyondAutoBadge.classList.add('hidden');
    }
    renderSummaryStrip();
  });
}

renderBeyondToggle(false);
renderHoursPace();
renderSummaryStrip();

/* Sync Page 3 (Major Matches) from PF_STATE */

function syncMajorMatches() {
  var profilePill = document.getElementById('matches-profile-pill');
  var beyondPill = document.getElementById('matches-beyond-pill');
  var topGrid = document.getElementById('matches-top3-grid');
  var otherGrid = document.getElementById('matches-other-grid');

  if (profilePill) {
    var gradeTh = PF_STATE.grade.replace('M.', 'ม.');
    var gpaxStr = PF_STATE.gpax.toFixed(2);
    var thText = gradeTh + ' • GPAX ' + gpaxStr + ' • ' + PF_STATE.weeklyHours + ' ชม./สัปดาห์';
    var enText = PF_STATE.grade + ' • GPAX ' + gpaxStr + ' • ' + PF_STATE.weeklyHours + ' hrs/wk';
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


function getCountdownStrings() {
  var map = {
    'M.4': { th: '20 เดือน', en: '20 Months' },
    'M.5': { th: '8 เดือน', en: '8 Months' },
    'M.6': { th: '3 เดือน', en: '3 Months' }
  };
  return map[PF_STATE.grade] || map['M.5'];
}
