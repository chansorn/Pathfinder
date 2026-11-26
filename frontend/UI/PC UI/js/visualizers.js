/* =========================================================================
 * PathFinder — Interactive Visualizers
 * Section 4.6: liquid lime tab pill, offer swipe deck, endless university river, pixel-art badges.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js
 *
 * Depends on : js/state-i18n.js, js/roadmap.js (window.renderRoadmap), data/uni-logos.js
 * Provides   : window.PF_REFRESH_BADGES (plus self-contained IIFEs)
 * ========================================================================= */

/* 3-State Liquid Lime Pill Flow Tab Bar (Stretch -> Snap + Droplet Trail -> Label Fade) */
(function initFlowBar() {
  var bar = document.getElementById('hero-flow-bar');
  var pill = document.getElementById('hero-flow-pill');
  var droplet = document.getElementById('hero-flow-droplet');
  var launchBtn = document.getElementById('hero-flow-launch');
  if (!bar || !pill || !droplet) return;

  var tabs = Array.prototype.slice.call(bar.querySelectorAll('[data-flow-idx]'));
  var activeIdx = 0;
  var isAnimating = false;

  /* [JS 4.6] Interactive Visualizers (Step-3 Pill, Swipe Deck, Uni River, Pixel Badges) */
  function positionPillImmediate(idx) {
    var t = tabs[idx];
    if (!t) return;
    pill.style.left = t.offsetLeft + 'px';
    pill.style.width = t.offsetWidth + 'px';
  }
  positionPillImmediate(0);
  window.addEventListener('resize', function () { positionPillImmediate(activeIdx); });

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () {
      if (!isAnimating) positionPillImmediate(activeIdx);
    });
    tabs.forEach(function (t) { ro.observe(t); });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var nextIdx = Number(tab.getAttribute('data-flow-idx'));
      var targetPage = tab.getAttribute('data-flow-page');
      if (launchBtn) launchBtn.setAttribute('data-go-page', targetPage);

      if (nextIdx === activeIdx) {
        goToPage(targetPage);
        return;
      }

      isAnimating = true;
      var prevTab = tabs[activeIdx];
      var oldLeft = prevTab.offsetLeft;
      var oldWidth = prevTab.offsetWidth;

      /* Update selected state so target label begins expanding */
      tabs.forEach(function (t, i) {
        var sel = i === nextIdx;
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
        t.classList.toggle('text-on-surface', sel);
        t.classList.toggle('text-on-primary', !sel);
      });

      var newLeft = tab.offsetLeft;
      var newWidth = Math.max(tab.offsetWidth, 118);

      /* State 1 (0ms): Stretch pill across span + spawn trailing droplet + fade target label */
      var spanLeft = Math.min(oldLeft, newLeft);
      var spanWidth = Math.max(oldLeft + oldWidth, newLeft + newWidth) - spanLeft;

      droplet.style.transition = 'none';
      droplet.style.left = (oldLeft + oldWidth / 2) + 'px';
      droplet.style.transform = 'translate(-50%, -50%) scale(1)';
      droplet.style.opacity = '0.92';
      void droplet.offsetWidth;

      tab.classList.add('is-fading');
      pill.style.left = spanLeft + 'px';
      pill.style.width = spanWidth + 'px';

      /* State 2 (130ms): Snap pill to target with spring overshoot + trail droplet behind + fade label in */
      setTimeout(function () {
        var settledLeft = tab.offsetLeft;
        var settledWidth = tab.offsetWidth;
        pill.style.left = settledLeft + 'px';
        pill.style.width = settledWidth + 'px';

        droplet.style.transition = 'left 460ms cubic-bezier(0.16, 1, 0.3, 1), transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease';
        droplet.style.left = (settledLeft + settledWidth / 2) + 'px';
        tab.classList.remove('is-fading');
      }, 130);

      /* State 3 (340ms): Droplet merges and settles + sync final expanded width */
      setTimeout(function () {
        droplet.style.transform = 'translate(-50%, -50%) scale(0)';
        droplet.style.opacity = '0';
        isAnimating = false;
        positionPillImmediate(activeIdx);
      }, 340);

      activeIdx = nextIdx;
    });
  });
})();

/* Step 2 "รูปแบบการแสดงผลลัพธ์เบื้องต้น": a live preview built from REAL myTCAS programs (POST /api/match/programs)
     University Only  -> the universities that fit the answers so far, with their best program
     Card Shuffle     -> one real program per card: swipe/drag up = like, down = skip
   Liked ids go to PF_STATE.acceptedMajors (ranked higher on Page 3, synced as liked_majors),
   skipped ids to PF_STATE.ignoredMajors (never shown again, synced as ignored_majors). */
(function initBaselineDeck() {
  var deck = document.getElementById('baseline-preview-deck');
  if (!deck) return;
  var mode = PF_STATE.baselineMode === 'shuffle' ? 'shuffle' : 'university';
  var cards = [];       // real programs in the current stack
  var index = 0;        // top card
  var seen = [];        // ids dealt since the answers last changed (next deal skips them)
  var lastSig = null;
  var loading = false;
  var error = '';
  var seq = 0;

  var isId = function (v) { return /^[0-9a-f-]{36}$/i.test(String(v || '')); };
  function liked() { return (PF_STATE.acceptedMajors || []).filter(isId); }
  function skipped() { return (PF_STATE.ignoredMajors || []).filter(isId); }
  function T(th, en) { return currentLang === 'th' ? th : en; }
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function core(name) {
    return String(name).replace(/\s*\([^()]*(?:ภาษา|นานาชาติ|พิเศษ|ปกติ)[^()]*\)\s*$/, '').replace(/^หลักสูตร/, '')
      .replace(/^[ก-๙]{1,6}\.[ก-๙]{1,3}\.\s*/, '').replace(/^[ก-๙]+บัณฑิต\s*/, '').replace(/^\([ก-๙.]{2,10}\)\s*/, '')
      .replace(/^(สาขาวิชา|สาขา)\s*/, '').trim() || name;
  }
  function logo(c) {
    var letter = esc(String(c.university).replace(/^(มหาวิทยาลัย|สถาบัน)/, '').charAt(0));
    return '<span class="relative w-10 h-10 shrink-0">' +
      '<span class="absolute inset-0 rounded-full bg-primary text-on-primary flex items-center justify-center font-title" aria-hidden="true">' + letter + '</span>' +
      (c.university_id ? '<img data-deck-logo src="img/logos/' + esc(c.university_id) + '.png" alt="" loading="lazy" class="absolute inset-0 w-10 h-10 rounded-full object-contain bg-white border border-outline-variant p-0.5">' : '') +
    '</span>';
  }

  // the answers so far (same rules as Page 3)
  function body() {
    var b = {
      interests: (PF_STATE.interests || []).slice(0, 4),
      beyond_4: !!PF_STATE.beyond400,
      target_universities: (PF_STATE.targetUnis || []).concat(PF_STATE.otherUnis || []).slice(0, 10),
      liked_ids: liked().slice(-100),
      skipped_ids: skipped().slice(-100),
      limit: 8
    };
    if (PF_STATE.gpaxSet) b.gpax = Math.min(4, Math.max(0, Number(PF_STATE.gpax)));
    if (PF_STATE.hoursSet) b.weekly_hours = Number(PF_STATE.weeklyHours);
    if (PF_STATE.province) b.province = PF_STATE.province;
    if ((PF_STATE.targetFaculties || []).length) b.target_faculties = PF_STATE.targetFaculties.slice(0, 3);
    if (typeof pfVarietySeed === 'function') b.variety_seed = pfVarietySeed();
    return b;
  }
  function signature() {
    var b = body();
    return JSON.stringify([b.interests, b.beyond_4, b.target_universities, b.gpax, b.weekly_hours, b.province, b.target_faculties]);
  }

  async function deal(next) {
    var b = body();
    if (!b.interests.length) { cards = []; error = ''; render(); return; }
    var my = ++seq;
    if (next) b.exclude_ids = seen.slice(-60);
    loading = true; error = '';
    render();
    try {
      var data = await PF_API.request('/match/programs', { method: 'POST', body: b, timeoutMs: 30000 });
      if (my !== seq) return;
      cards = data.items || [];
      index = 0;
      cards.forEach(function (c) { if (seen.indexOf(c.id) === -1) seen.push(c.id); });
      if (next && !cards.length && seen.length) { seen = []; loading = false; return deal(false); }
    } catch (err) {
      if (my !== seq) return;
      error = PF_API.errorText(err);
    }
    loading = false;
    render();
  }

  function refreshIfChanged() {
    var sig = signature();
    if (sig === lastSig && (cards.length || loading)) { render(); return; }
    lastSig = sig;
    seen = [];
    deal(false);
  }

  function remember(c, up) {
    var add = up ? 'acceptedMajors' : 'ignoredMajors';
    var drop = up ? 'ignoredMajors' : 'acceptedMajors';
    PF_STATE[add] = (PF_STATE[add] || []).filter(function (x) { return x !== c.id; }).concat(c.id).slice(-100);
    PF_STATE[drop] = (PF_STATE[drop] || []).filter(function (x) { return x !== c.id; });
    // names for the "liked" list under the deck (ids alone mean nothing to the student)
    PF_STATE.deckNames = PF_STATE.deckNames || {};
    PF_STATE.deckNames[c.id] = c.university + ' • ' + core(c.program);
    var keep = liked().concat(skipped());
    Object.keys(PF_STATE.deckNames).forEach(function (k) { if (keep.indexOf(k) === -1) delete PF_STATE.deckNames[k]; });
    if (typeof window.savePFState === 'function') window.savePFState();
    if (window.PF_AUTH && typeof window.PF_AUTH.showToast === 'function') {
      window.PF_AUTH.showToast(
        up ? 'ถูกใจ: ' + core(c.program) + ' • จะขึ้นก่อนในหน้าคณะที่ใช่' : 'ข้าม: ' + core(c.program) + ' • จะไม่แสดงอีก',
        up ? 'Liked: ' + core(c.program) + ' • ranked higher on the matches page' : 'Skipped: ' + core(c.program) + ' • won\'t show again'
      );
    }
  }

  // the liked programs, removable (un-like)
  function likedListHtml() {
    var names = PF_STATE.deckNames || {};
    var ids = liked().slice(-8).reverse();
    if (!ids.length) return '';
    return '<div class="flex flex-col gap-1.5 pt-gutter-xs">' +
      '<span class="font-label text-label-sm text-on-surface-variant">' + T('ที่ถูกใจ (ขึ้นก่อนในหน้าคณะที่ใช่)', 'Liked (ranked higher on the matches page)') + '</span>' +
      '<div class="flex flex-wrap gap-1.5">' + ids.map(function (id) {
        return '<span class="inline-flex items-center gap-1 pl-gutter-sm pr-1 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm max-w-full">' +
          '<span class="truncate max-w-[240px]">' + esc(names[id] || T('หลักสูตรที่ถูกใจ', 'Liked program')) + '</span>' +
          '<button type="button" data-deck-unlike="' + esc(id) + '" class="w-5 h-5 rounded-full hover:bg-on-secondary-container/15 flex items-center justify-center" aria-label="' + esc(T('เอาออก', 'Remove')) + '"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">close</span></button>' +
        '</span>';
      }).join('') + '</div>' +
    '</div>';
  }

  function swipe(dir) {
    var c = cards[index];
    if (!c) return;
    var top = deck.querySelector('.swipe-card[data-stack-pos="0"]');
    if (top) {
      top.classList.remove('is-dragging');
      top.style.transform = '';
      top.classList.add(dir === 'up' ? 'fling-up' : 'fling-down');
    }
    remember(c, dir === 'up');
    setTimeout(function () { index++; entering = true; render(); }, 220);
  }

  function attachDrag() {
    var top = deck.querySelector('.swipe-card[data-stack-pos="0"]');
    if (!top) return;
    var up = top.querySelector('[data-swipe-badge="up"]');
    var down = top.querySelector('[data-swipe-badge="down"]');
    var startY = 0, dy = 0, dragging = false;
    top.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a, button')) return;
      dragging = true; startY = e.clientY; dy = 0;
      top.classList.add('is-dragging');
      top.setPointerCapture(e.pointerId);
    });
    top.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dy = e.clientY - startY;
      var cl = Math.max(-130, Math.min(130, dy));
      top.style.transform = 'translateY(' + cl + 'px) rotate(' + (cl * 0.03) + 'deg)';
      if (up) up.style.opacity = cl < -18 ? Math.min(1, (-cl - 18) / 55) : 0;
      if (down) down.style.opacity = cl > 18 ? Math.min(1, (cl - 18) / 55) : 0;
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      top.classList.remove('is-dragging');
      if (dy < -65) swipe('up');
      else if (dy > 65) swipe('down');
      else {
        top.style.transform = '';
        if (up) up.style.opacity = 0;
        if (down) down.style.opacity = 0;
      }
    }
    top.addEventListener('pointerup', end);
    top.addEventListener('pointercancel', end);
  }

  function message(icon, th, en, extra) {
    deck.className = 'flex flex-col gap-gutter-md';
    deck.innerHTML = '<div class="p-gutter-lg rounded-xl bg-surface-container-low border border-outline-variant flex flex-col items-center text-center gap-gutter-sm">' +
      '<span class="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">' + icon + '</span>' +
      '<span class="font-body text-body-md text-on-surface">' + esc(T(th, en)) + '</span>' + (extra || '') +
    '</div>';
  }

  function render() {
    if (!(PF_STATE.interests || []).length) {
      message('touch_app', 'เลือกความสนใจในขั้นที่ 1 ก่อน แล้วตรงนี้จะแสดงหลักสูตรจริงที่ตรงกับคุณ', 'Pick your interests in Step 1 first to preview real programs here.');
      return;
    }
    if (loading && !cards.length) { message('hourglass_top', 'กำลังหาหลักสูตรจริงจาก myTCAS…', 'Finding real myTCAS programs…'); return; }
    if (error) { message('error', error, error); return; }
    if (!cards.length) { message('search_off', 'ยังไม่พบหลักสูตรที่ตรงกับคำตอบตอนนี้ ลองเพิ่มความสนใจ', 'No program fits these answers yet. Try adding interests.'); return; }

    if (mode === 'university') {
      deck.className = 'grid grid-cols-1 sm:grid-cols-2 gap-gutter-sm';
      deck.innerHTML = cards.slice(0, 6).map(function (c) {
        return '<div class="p-gutter-md rounded-lg bg-surface-container-low border border-outline-variant flex items-center gap-gutter-sm min-w-0">' +
          logo(c) +
          '<div class="flex flex-col gap-0.5 min-w-0">' +
            '<span class="font-title text-title-md text-on-surface truncate">' + esc(c.university) + '</span>' +
            '<span class="font-label text-label-sm text-on-surface-variant truncate" title="' + esc(c.program) + '">' + esc(core(c.program)) + '</span>' +
          '</div>' +
          '<span class="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm">' + c.match_pct + '%</span>' +
        '</div>';
      }).join('');
      return;
    }

    // card shuffle
    deck.className = 'flex flex-col gap-gutter-md';
    if (index >= cards.length) {
      message('style', 'ดูครบสำรับแล้ว • ถูกใจรวม ' + liked().length + ' • ข้ามรวม ' + skipped().length + ' (หลักสูตรที่ถูกใจจะขึ้นก่อนในหน้าคณะที่ใช่)',
        'Deck done • liked ' + liked().length + ' • skipped ' + skipped().length + ' (liked programs rank higher on the matches page)',
        '<div class="flex flex-wrap justify-center gap-gutter-xs">' +
          '<button type="button" data-deck-action="next" class="inline-flex items-center gap-1.5 px-gutter-md py-2 rounded-full bg-primary text-on-primary font-label text-label-sm"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>' + T('สับไพ่ชุดใหม่', 'Deal new cards') + '</button>' +
          '<button type="button" data-deck-action="clear" class="inline-flex items-center gap-1.5 px-gutter-md py-2 rounded-full bg-surface-container-lowest border border-outline-variant font-label text-label-sm text-on-surface">' + T('ล้างที่ปัดไว้ทั้งหมด', 'Clear my swipes') + '</button>' +
        '</div>' + likedListHtml());
      return;
    }
    var stack = cards.slice(index, index + 3);
    deck.innerHTML =
      '<div class="swipe-deck-stage">' + stack.map(function (c, pos) {
        var r1 = c.rounds && c.rounds[0] ? c.rounds[0].projects : 0;
        return '<div class="swipe-card p-gutter-lg rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col justify-between gap-gutter-sm" data-stack-pos="' + pos + '">' +
          '<div class="flex items-start justify-between gap-gutter-sm">' +
            '<div class="flex flex-col gap-0.5 min-w-0">' +
              '<span class="font-label text-label-sm text-secondary-text">' + (index + pos + 1) + '/' + cards.length + ' • ' + esc(c.university) + (c.province ? ' • ' + esc(c.province) : '') + '</span>' +
              '<h3 class="font-headline text-title-lg text-on-surface line-clamp-2" title="' + esc(c.program) + '">' + esc(core(c.program)) + '</h3>' +
              '<span class="font-label text-label-sm text-on-surface-variant truncate">' + esc(c.faculty) + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-2 shrink-0">' +
              '<span class="px-gutter-sm py-1 rounded-full bg-secondary-container text-on-secondary-container font-metric text-metric-md tabular-nums">' + c.match_pct + '%</span>' +
              logo(c) +
            '</div>' +
          '</div>' +
          // real facts about this program (myTCAS / official stats)
          '<div class="grid grid-cols-2 gap-1.5 font-label text-label-sm">' +
            '<span class="px-2 py-1 rounded-md bg-surface-container-low">' + T('GPAX ขั้นต่ำ ', 'Min GPAX ') + '<b class="font-metric">' + (c.min_gpax != null ? Number(c.min_gpax).toFixed(2) : T('ไม่ระบุ', 'n/a')) + '</b></span>' +
            '<span class="px-2 py-1 rounded-md bg-surface-container-low">' + T('รอบที่เปิด ', 'Rounds ') + '<b class="font-metric">' + ((c.rounds || []).filter(function (r) { return r.projects > 0; }).map(function (r) { return 'R' + r.round; }).join(' ') || '—') + '</b></span>' +
            (c.last_year ? '<span class="px-2 py-1 rounded-md bg-surface-container-low col-span-2">' + T('ปี ', '') + c.last_year.academic_year + T(' สมัคร ', ': ') + Number(c.last_year.applicants).toLocaleString('en-US') + T(' • รับ ', ' applied • ') + Number(c.last_year.seats).toLocaleString('en-US') + T('', ' seats') + '</span>' : '') +
            ((c.reasons || [])[0] ? '<span class="px-2 py-1 rounded-md bg-primary/5 text-on-surface col-span-2 truncate">' + esc(T(c.reasons[0].th, c.reasons[0].en)) + '</span>' : '') +
          '</div>' +
          '<div class="flex items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-outline-variant">' +
            '<span data-swipe-badge="up" style="opacity:0;" class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">favorite</span>' + T('ถูกใจ', 'Like') + '</span>' +
            '<span class="font-label text-label-sm text-on-surface-variant">' + T('ลากขึ้น = ถูกใจ • ลากลง = ข้าม', 'Drag ↑ like • Drag ↓ skip') + '</span>' +
            '<span data-swipe-badge="down" style="opacity:0;" class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">close</span>' + T('ข้าม', 'Skip') + '</span>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="flex flex-wrap items-center justify-between gap-gutter-sm pt-gutter-xs">' +
        '<div class="flex items-center gap-gutter-xs font-label text-label-sm">' +
          '<span class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container">' + T('ถูกใจ ', 'Liked ') + liked().length + '</span>' +
          '<span class="px-gutter-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant">' + T('ข้าม ', 'Skipped ') + skipped().length + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-gutter-xs">' +
          '<button type="button" data-deck-action="ignore" class="inline-flex items-center gap-1 px-gutter-md py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container border border-outline-variant font-label text-label-sm"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_downward</span>' + T('ข้าม', 'Skip') + '</button>' +
          '<button type="button" data-deck-action="accept" class="inline-flex items-center gap-1 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-sm"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_upward</span>' + T('ถูกใจ', 'Like') + '</button>' +
        '</div>' +
      '</div>' + likedListHtml();
    attachDrag();
    if (entering && window.pfMotion) window.pfMotion(deck.querySelector('.swipe-card[data-stack-pos="0"]'), 'pf-deck-in');
    entering = false;
  }
  var entering = false;

  // one delegated listener: survives every re-render
  deck.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-deck-action], [data-deck-unlike]') : null;
    if (!b) return;
    var a = b.getAttribute('data-deck-action');
    var un = e.target.closest ? e.target.closest('[data-deck-unlike]') : null;
    if (un) {
      var id = un.getAttribute('data-deck-unlike');
      PF_STATE.acceptedMajors = (PF_STATE.acceptedMajors || []).filter(function (x) { return x !== id; });
      if (typeof window.savePFState === 'function') window.savePFState();
      render();
      return;
    }
    if (a === 'accept') swipe('up');
    else if (a === 'ignore') swipe('down');
    else if (a === 'next') deal(true);
    else if (a === 'clear') {
      PF_STATE.acceptedMajors = (PF_STATE.acceptedMajors || []).filter(function (x) { return !isId(x); });
      PF_STATE.ignoredMajors = (PF_STATE.ignoredMajors || []).filter(function (x) { return !isId(x); });
      if (typeof window.savePFState === 'function') window.savePFState();
      seen = []; lastSig = null;
      refreshIfChanged();
    }
  });
  deck.addEventListener('error', function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-deck-logo')) e.target.remove();
  }, true);

  function setMode(m) {
    mode = m;
    PF_STATE.baselineMode = m;
    document.querySelectorAll('[data-baseline-mode]').forEach(function (b) {
      var active = b.getAttribute('data-baseline-mode') === m;
      b.classList.toggle('bg-primary', active);
      b.classList.toggle('text-on-primary', active);
      b.classList.toggle('text-on-surface-variant', !active);
    });
    refreshIfChanged();
  }
  document.querySelectorAll('[data-baseline-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.getAttribute('data-baseline-mode')); });
  });

  // answers change -> new preview (debounced, and only while Step 2 is on screen)
  var timer = null;
  function soon() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var panel = document.querySelector('[data-step-panel="2"]');
      if (panel && !panel.classList.contains('hidden')) refreshIfChanged();
      else lastSig = null; // redo when Step 2 opens
    }, 450);
  }
  ['input', 'change', 'click'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      if (e.target.closest && e.target.closest('#baseline-preview-deck')) return;
      soon();
    }, { passive: true });
  });
  document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(render, 160); });
  });

  window.PF_DECK = { refresh: refreshIfChanged, liked: liked, skipped: skipped, setMode: setMode };
  setMode(mode);
})();

/* Authentic Thai University Logo River + Non-Blinding Hover Info Card */
(function () {
  var river = document.getElementById('uni-river-bg');
  var card = document.getElementById('uni-hover-card');
  if (!river || !card) return;

  var UNI_LOGOS = (function () {
      var keys = ["cmu", "cu", "kku", "kmitl", "kmutt", "ku", "mu", "su", "swu", "tu"];
      var map = {};
      keys.forEach(function (k) {
        var pre = document.querySelector('[data-uni-preload="' + k + '"]');
        map[k] = (pre && pre.getAttribute("src")) || ("../../images/unis/" + k + ".png");
      });
      return map;
    })();

  function uniImg(key, name, sizeCls) {
    return '<img src="' + (UNI_LOGOS[key] || '') + '" alt="' + name + '" class="' + sizeCls + ' object-contain pointer-events-none select-none" />';
  }

  window.__syncUniCardLogos = function () {
    document.querySelectorAll('img[data-uni-logo]').forEach(function (img) {
      var k = img.getAttribute('data-uni-logo');
      if (k && UNI_LOGOS[k] && img.getAttribute('src') !== UNI_LOGOS[k]) {
        img.setAttribute('src', UNI_LOGOS[k]);
      }
    });
  };
  window.__syncUniCardLogos();

  var UNI_DATA = {
    cu: {
      url: 'https://www.chula.ac.th/',
      nameTh: 'จุฬาลงกรณ์มหาวิทยาลัย (CU)',
      nameEn: 'Chulalongkorn University (CU)',
      tagTh: 'ปทุมวัน กรุงเทพฯ • รอบ 1–4',
      tagEn: 'Pathum Wan, Bangkok • TCAS 1–4',
      descTh: 'มหาวิทยาลัยเก่าแก่ที่สุดของไทย โดดเด่นด้านวิศวกรรมศาสตร์ แพทยศาสตร์ สถาปัตยกรรม และบริหารธุรกิจ พร้อมระบบนิเวศวิจัยและสตาร์ทอัพระดับแนวหน้า',
      descEn: 'Thailand’s oldest university, renowned for Engineering, Medicine, Architecture, and Business with a leading research and startup ecosystem.'
    },
    tu: {
      url: 'https://tu.ac.th/',
      nameTh: 'มหาวิทยาลัยธรรมศาสตร์ (TU)',
      nameEn: 'Thammasat University (TU)',
      tagTh: 'ท่าพระจันทร์ & รังสิต • รอบ 1–4',
      tagEn: 'Tha Prachan & Rangsit • TCAS 1–4',
      descTh: 'โดดเด่นด้านนิติศาสตร์ เศรษฐศาสตร์ รัฐศาสตร์ รวมถึงวิศวกรรมนานาชาติ (SIIT) และการออกแบบเชิงสร้างสรรค์ เน้นการคิดวิเคราะห์และเสรีภาพทางวิชาการ',
      descEn: 'Celebrated for Law, Economics, Political Science, and SIIT international engineering & design, championing critical thinking and innovation.'
    },
    kmutt: {
      url: 'https://www.kmutt.ac.th/',
      nameTh: 'มจธ. บางมด (KMUTT)',
      nameEn: 'KMUTT (Bangmod)',
      tagTh: 'ทุ่งครุ กรุงเทพฯ • รอบ 1–4',
      tagEn: 'Thung Khru, Bangkok • TCAS 1–4',
      descTh: 'มหาวิทยาลัยเทคโนโลยีชั้นนำที่เน้นการลงมือทำจริง (Hands-on) โดดเด่นด้านวิศวกรรมคอมพิวเตอร์ หุ่นยนต์ พลังงาน และสถาปัตยกรรมดิจิทัล',
      descEn: 'Premier hands-on science and technology university excelling in Computer Engineering, Robotics, Energy, and Digital Architecture.'
    },
    mu: {
      url: 'https://mahidol.ac.th/',
      nameTh: 'มหาวิทยาลัยมหิดล (MU)',
      nameEn: 'Mahidol University (MU)',
      tagTh: 'ศาลายา & พญาไท • รอบ 1–4',
      tagEn: 'Salaya & Phaya Thai • TCAS 1–4',
      descTh: 'ศูนย์กลางด้านวิทยาศาสตร์สุขภาพ การแพทย์ เภสัชศาสตร์ เทคโนโลยีชีวภาพ และหลักสูตรนานาชาติ (MUIC) ที่มีผลงานวิจัยติดอันดับโลก',
      descEn: 'Thailand’s powerhouse in Medicine, Health Sciences, Biotechnology, and international liberal arts (MUIC) with world-class research.'
    },
    ku: {
      url: 'https://www.ku.ac.th/',
      nameTh: 'มหาวิทยาลัยเกษตรศาสตร์ (KU)',
      nameEn: 'Kasetsart University (KU)',
      tagTh: 'บางเขน กรุงเทพฯ • รอบ 1–4',
      tagEn: 'Bangkhen, Bangkok • TCAS 1–4',
      descTh: 'ผู้นำด้านเกษตรศาสตร์ วิทยาศาสตร์อาหาร วิศวกรรมซอฟต์แวร์ เศรษฐศาสตร์ และสิ่งแวดล้อม พร้อมบรรยากาศแคมปัสสีเขียวขนาดใหญ่ใจกลางบางเขน',
      descEn: 'Leader in Agricultural Innovation, Food Science, Software Engineering, Economics, and Sustainability on a lush green Bangkhen campus.'
    },
    kmitl: {
      url: 'https://www.kmitl.ac.th/',
      nameTh: 'สจล. ลาดกระบัง (KMITL)',
      nameEn: 'KMITL (Ladkrabang)',
      tagTh: 'ลาดกระบัง กรุงเทพฯ • รอบ 1–4',
      tagEn: 'Ladkrabang, Bangkok • TCAS 1–4',
      descTh: 'โดดเด่นด้านวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ วิทยาการคอมพิวเตอร์ สถาปัตยกรรม และการบิน พร้อมหลักสูตร 42 Bangkok และนวัตกรรมดิจิทัล',
      descEn: 'Renowned for Electrical & Computer Engineering, Architecture, Aviation, and digital innovation programs including 42 Bangkok.'
    },
    cmu: {
      url: 'https://www.cmu.ac.th/',
      nameTh: 'มหาวิทยาลัยเชียงใหม่ (CMU)',
      nameEn: 'Chiang Mai University (CMU)',
      tagTh: 'สุเทพ เชียงใหม่ • รอบ 1–4',
      tagEn: 'Suthep, Chiang Mai • TCAS 1–4',
      descTh: 'มหาวิทยาลัยหลักภาคเหนือเชิงดอยสุเทพ โดดเด่นด้านวิศวกรรม วิทยาศาสตร์สุขภาพ ดิจิทัลมีเดีย (CAMT) และศิลปกรรมล้านนาร่วมสมัย',
      descEn: 'Northern Thailand’s flagship campus at the foot of Doi Suthep, strong in Engineering, Health Sciences, CAMT Digital Media, and Fine Arts.'
    },
    kku: {
      url: 'https://www.kku.ac.th/',
      nameTh: 'มหาวิทยาลัยขอนแก่น (KKU)',
      nameEn: 'Khon Kaen University (KKU)',
      tagTh: 'ขอนแก่น • รอบ 1–4',
      tagEn: 'Khon Kaen • TCAS 1–4',
      descTh: 'ศูนย์กลางการศึกษาและวิจัยแห่งภาคอีสาน โดดเด่นด้านแพทยศาสตร์ วิศวกรรมศาสตร์ เกษตรศาสตร์ และนวัตกรรมพลังงานสะอาด',
      descEn: 'Isan’s premier research hub excelling in Medicine, Engineering, Agricultural Technology, and clean energy innovation.'
    },
    su: {
      url: 'https://www.su.ac.th/',
      nameTh: 'มหาวิทยาลัยศิลปากร (SU)',
      nameEn: 'Silpakorn University (SU)',
      tagTh: 'วังท่าพระ & สนามจันทร์ • รอบ 1–4',
      tagEn: 'Wang Tha Phra & Sanam Chandra • TCAS 1–4',
      descTh: 'ต้นแบบด้านศิลปะ สถาปัตยกรรม มัณฑนศิลป์ โบราณคดี และเทคโนโลยีสารสนเทศเชิงสร้างสรรค์ ผสานงานคราฟต์กับดีไซน์ยุคใหม่',
      descEn: 'Thailand’s iconic home of Fine Arts, Architecture, Decorative Arts, Archaeology, and creative digital media.'
    },
    swu: {
      url: 'https://www.swu.ac.th/',
      nameTh: 'มหาวิทยาลัยศรีนครินทรวิโรฒ (SWU)',
      nameEn: 'Srinakharinwirot University (SWU)',
      tagTh: 'ประสานมิตร & องครักษ์ • รอบ 1–4',
      tagEn: 'Prasarnmit & Ongkharak • TCAS 1–4',
      descTh: 'โดดเด่นด้านนวัตกรรมสื่อสารสังคม (COSCI) ศิลปกรรม ศึกษาศาสตร์ และวิทยาศาสตร์การแพทย์ ใจกลางอโศก-ประสานมิตร',
      descEn: 'Known for Social Communication Innovation (COSCI), Performing Arts, Education, and Health Sciences in central Bangkok.'
    }
  };

  var lanes = [
    { speed: 18, offset: 0, keys: ['cu', 'tu', 'kmutt', 'mu', 'ku'] },
    { speed: 15, offset: -42, keys: ['kmitl', 'cmu', 'kku', 'su', 'swu'] },
    { speed: 17, offset: -18, keys: ['kmutt', 'cu', 'mu', 'tu', 'ku'] },
    { speed: 14, offset: -58, keys: ['ku', 'kmitl', 'su', 'cmu', 'kku'] },
    { speed: 20, offset: -28, keys: ['mu', 'swu', 'cu', 'tu', 'kmutt'] }
  ];

  var spacing = 98;
  var laneStates = [];

  function buildLanes() {
    var vh = window.innerHeight || 900;
    var count = Math.max(12, Math.ceil((vh + spacing * 2) / spacing));
    var cycleH = count * spacing;
    river.innerHTML = '';
    laneStates = lanes.map(function (cfg) {
      var laneEl = document.createElement('div');
      laneEl.className = 'uni-river-lane';
      var items = [];
      for (var i = 0; i < count; i++) {
        var key = cfg.keys[i % cfg.keys.length];
        var u = UNI_DATA[key];
        var btn = document.createElement('a');
        btn.href = u.url;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.tabIndex = -1;
        btn.className = 'uni-river-item p-1.5 no-underline';
        btn.setAttribute('data-uni', key);
        btn.setAttribute('aria-label', u.nameEn);
        btn.title = u.nameEn;
        btn.innerHTML = uniImg(key, u.nameEn, 'w-8 h-8');
        var y = i * spacing - spacing + cfg.offset;
        btn.style.setProperty('--ry', y.toFixed(2) + 'px');
        laneEl.appendChild(btn);
        items.push({ el: btn, y: y });
      }
      river.appendChild(laneEl);
      return { el: laneEl, speed: cfg.speed, cycleH: cycleH, items: items, paused: false };
    });
  }

  buildLanes();

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lastTime = performance.now();

  function tickRiver(now) {
    var dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    var vh = window.innerHeight || 900;
    var deleteStart = vh - 88;
    var resetY = vh + 12;

    for (var l = 0; l < laneStates.length; l++) {
      var lane = laneStates[l];
      for (var i = 0; i < lane.items.length; i++) {
        var item = lane.items[i];
        if (!lane.paused && !prefersReduced) {
          item.y += lane.speed * dt;
          if (item.y >= resetY) {
            item.y -= lane.cycleH;
          }
        }
        var fade = 1;
        if (item.y > deleteStart) {
          fade = Math.max(0, (vh - item.y) / 88);
        } else if (item.y < 52) {
          fade = Math.min(1, Math.max(0, (item.y + 36) / 88));
        }
        item.el.style.setProperty('--ry', item.y.toFixed(2) + 'px');
        item.el.style.setProperty('--ro', (0.30 * fade).toFixed(3));
      }
    }
    if (!prefersReduced) {
      requestAnimationFrame(tickRiver);
    }
  }
  requestAnimationFrame(tickRiver);

  function showUniCard(btn) {
    var key = btn.getAttribute('data-uni');
    var u = UNI_DATA[key];
    if (!u) return;
    var lang = document.documentElement.lang === 'en' ? 'en' : 'th';
    card.innerHTML =
      '<div class="flex items-center gap-gutter-sm">' +
        '<span class="shrink-0 inline-flex items-center justify-center w-11 h-11 p-1.5 rounded-full bg-surface-container-lowest border border-outline-variant">' + uniImg(key, u.nameEn, 'w-8 h-8') + '</span>' +
        '<div class="flex flex-col min-w-0">' +
          '<span class="font-headline text-title-md text-on-surface leading-snug">' + (lang === 'en' ? u.nameEn : u.nameTh) + '</span>' +
          '<span class="font-label text-label-sm text-secondary-text">' + (lang === 'en' ? u.tagEn : u.tagTh) + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="font-body text-body-sm text-on-surface-variant leading-relaxed">' + (lang === 'en' ? u.descEn : u.descTh) + '</p>' +
      '<div class="flex items-center justify-between pt-1.5 border-t border-outline-variant text-secondary-text font-label text-label-sm">' +
        '<span>' + (lang === 'en' ? 'Click icon to visit website' : 'คลิกไอคอนเพื่อเข้าเว็บไซต์หลัก') + '</span>' +
        '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">open_in_new</span>' +
      '</div>';

    var rect = btn.getBoundingClientRect();
    var cardW = 288;
    var cardH = card.offsetHeight || 168;
    var gap = 14;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var left = rect.right + gap;
    if (left + cardW > vw - 16) {
      left = rect.left - cardW - gap;
    }
    if (left < 16) {
      left = Math.max(16, Math.min(vw - cardW - 16, rect.left));
    }
    var top = rect.top + (rect.height / 2) - (cardH / 2);
    top = Math.max(76, Math.min(vh - cardH - 16, top));

    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    card.setAttribute('aria-hidden', 'false');
    card.classList.add('is-visible');
  }

  function hideUniCard() {
    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
  }

  function setLaneElPaused(laneEl, paused) {
    for (var l = 0; l < laneStates.length; l++) {
      if (laneStates[l].el === laneEl) {
        laneStates[l].paused = paused;
      }
    }
  }

  river.addEventListener('mouseover', function (e) {
    var laneEl = e.target.closest('.uni-river-lane');
    if (laneEl) setLaneElPaused(laneEl, true);
    var item = e.target.closest('.uni-river-item[data-uni]');
    if (item) showUniCard(item);
  });
  river.addEventListener('mouseout', function (e) {
    var item = e.target.closest('.uni-river-item[data-uni]');
    if (item && (!e.relatedTarget || !item.contains(e.relatedTarget))) {
      hideUniCard();
    }
    var laneEl = e.target.closest('.uni-river-lane');
    if (laneEl && (!e.relatedTarget || !laneEl.contains(e.relatedTarget))) {
      setLaneElPaused(laneEl, false);
    }
  });

  var linkToast = document.getElementById('uni-link-toast');
  function showUniLinkToast(key) {
    var u = UNI_DATA[key];
    if (!u || !linkToast) return;
    var lang = document.documentElement.lang === 'en' ? 'en' : 'th';
    linkToast.innerHTML =
      '<div class="flex items-center justify-between gap-gutter-sm">' +
        '<div class="flex items-center gap-gutter-sm min-w-0">' +
          '<span class="shrink-0 inline-flex items-center justify-center w-9 h-9 p-1 rounded-full bg-surface-container-low border border-outline-variant">' + uniImg(key, u.nameEn, 'w-6 h-6') + '</span>' +
          '<div class="flex flex-col min-w-0">' +
            '<span class="font-title text-title-md text-on-surface truncate">' + (lang === 'en' ? u.nameEn : u.nameTh) + '</span>' +
            '<span class="font-body text-label-sm text-secondary-text truncate select-all">' + u.url + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" data-close-uni-toast aria-label="Close" class="shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low">' +
          '<span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>' +
        '</button>' +
      '</div>' +
      '<p class="font-body text-label-sm text-on-surface-variant">' +
        (lang === 'en'
          ? 'If the preview frame blocks opening a new tab, copy the official URL below to open it in your browser.'
          : 'หากหน้าต่างพรีวิวบล็อกการเปิดแท็บใหม่ สามารถคัดลอกลิงก์ด้านล่างไปเปิดในเบราว์เซอร์ได้ทันที') +
      '</p>' +
      '<div class="flex items-center gap-gutter-xs">' +
        '<button type="button" data-copy-uni-url="' + u.url + '" class="flex-1 inline-flex items-center justify-center gap-1.5 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-sm">' +
          '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">content_copy</span>' +
          '<span>' + (lang === 'en' ? 'Copy Website URL' : 'คัดลอกลิงก์เว็บไซต์') + '</span>' +
        '</button>' +
        '<a href="' + u.url + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-1 px-gutter-md py-1.5 rounded-full bg-surface-container-low border border-outline-variant text-on-surface font-label text-label-sm no-underline">' +
          '<span>' + (lang === 'en' ? 'Open' : 'เปิดเว็บ') + '</span>' +
          '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">open_in_new</span>' +
        '</a>' +
      '</div>';
    linkToast.classList.remove('hidden');
    linkToast.setAttribute('aria-hidden', 'false');
  }

  document.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('[data-close-uni-toast]');
    if (closeBtn && linkToast) {
      linkToast.classList.add('hidden');
      linkToast.setAttribute('aria-hidden', 'true');
      return;
    }
    var copyBtn = e.target.closest('[data-copy-uni-url]');
    if (copyBtn) {
      var url = copyBtn.getAttribute('data-copy-uni-url');
      var lang = document.documentElement.lang === 'en' ? 'en' : 'th';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(function () {});
      }
      copyBtn.innerHTML = '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">check</span><span>' + (lang === 'en' ? 'Copied!' : 'คัดลอกแล้ว!') + '</span>';
      return;
    }
    var uniLink = e.target.closest('.uni-river-item[data-uni], [data-uni-link]');
    if (uniLink) {
      var key = uniLink.getAttribute('data-uni') || uniLink.getAttribute('data-uni-link');
      showUniLinkToast(key);
    }
  });
})();

/* Pixel-Art Badges for Each Faculty & Website Section */
(function initPixelBadges() {
  var BASE = '../../images/badges/';
  var BADGE_DATA_URIS = {
    "ai.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABqElEQVR4nO3dQa6CMBRAUcG//x0T/g7soHkhes+ZmkixN0za4usFAAAAVBzTF7iu6578/vf7PXoP0+Oftvp9/qYHcJ7n9CVGffv4V3777lgSQJwA4gQQJ4A4AcQJIE4AcQKIE0CcAOIEECeAOAHEba+lr9bLn15OPY5jfM/DJ/d9b+0nmB7/9n6ApyeYPWYvTgBxAogTQJwA4gQQJ4A4AcQJIE4AcQKIE0CcAOIEELdcDt49Hz+9nr1ab199/vR+gactA7De/9vMbpwA4gQQJ4A4AcQJIE4AcQKIE0CcAOIEECeAOAHECSBOAHECiBNAnADiBBAngDgBxAkgbvxv43bfk8csT4A4AcQJIE4AcQKIE0CcAOIEECeAOAHECSBOAHECiBNAnADixvcDPP2eQD7zBIgTQJwA4gQQJ4A4AcQJIE4AcQKIE0CcAOIEECeAOAHECSBOAHECiBNAnADiBBAngDgBxAkgbvxcwK+7rmv0XMLuuYfVuQwBbDrP736Ifvfo2SaAOAHECSBOAHECiBNAnADiBBAngDgBxAkgTgBxAgAAAACI+Ae1Riz1Z4hPKAAAAABJRU5ErkJggg==",
    "atom.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAACJUlEQVR4nO3d0U2CMRSAUTDu4AYyj5vKOi4gW+AG1uSzafk559WADXy5DzcFTicAAAAAnsF59QFWu9/v9/L48/n81K/hy+oD8NgERCIgEgGRCIhEQCQCIjn8DmO056l7nNnPvzsTiERAJAIiERCJgEgERCIgktfZ/+Do921u18vU59/99TOBSAREIiASAZEIiERAJAIiyTuC1fdtRlbvkVaff/b7YwKRCIhEQCQCIhEQiYBIBEQy/T5QNdpTjPYc9lRzmUAkAiIREImASAREIiASAZHkPVDd08zeg9TzrX7+kdWvrwlEIiASAZEIiERAJAIiERDJ9veB6h5l9p7k+/N96/PNZgKRCIhEQCQCIhEQiYBIBESyfMdQ9yD18aM9zstgy/P28TX1fLvviUwgEgGRCIhEQCQCIhEQiYBIlv9e2OrPVY32PLM9+p7IBCIREImASAREIiASAZEIiGT7z4X5nui9mUAkAiIREImASAREIiASAZHkPdDq+ygjR/+e6NX3hUwgEgGRCIhEQCQCIhEQiYBItr8PtPv3RO9+vtlMIBIBkQiIREAkAiIREImASPIe6Ha9/Pr31fdtdv9d+tX3lSoTiERAJAIiERCJgEgERCIgkq3vmvyH1feBdr/PU5lAJAIiERCJgEgERCIgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkRz6rspf7P65q92ZQCQCIhEQiYBIBEQiIBIBAQAAAABDP+/EwUZqOrPoAAAAAElFTkSuQmCC",
    "capsule.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAACaUlEQVR4nO3d0W1TQRRF0diiBiANkHIIlZKUAw0EKALTgS/S1mie47V+kR0Ttubj6Hl4eAAAAADgHpx2f4D37nK5XMrrT6fTof+Nzrs/ALdNQCQCIhEQiYBIBEQiIJLlG8Pby5erO8jj889D7xy7d5zdP3/iBCIREImASAREIiASAZEIiCRvBHXn+f39+us/fVu7E007y+odZ/VOs/rnO4FIBEQiIBIBkQiIREAkAiJZ/iyOnWfv97rsQByagEgERCIgEgGRCIhEQCSH/k7W/7j3naeqfz8nEImASAREIiASAZEIiERAJB92f4BJvR+nvv+t7zyrOYFIBEQiIBIBkQiIREAkAiLZvgNNO8yv16el7//edx7fC+PQBEQiIBIBkQiIREAkAiJZvgPVnec8PA003S/09vJ09R3ufSeqnEAkAiIREImASAREIiASAZHkjWP/znP9Hurp/Scfn39c/fPdO9HuHcsJRCIgEgGRCIhEQCQCIhEQyfbvhU07z/T/jT0svT1o3rHu/Z5qJxCJgEgERCIgEgGRCIhEQCTjhlCf93l8jjvPjZueJ5rs3nkmTiASAZEIiERAJAIiERCJgEi2Pw90746+80ycQCQCIhEQiYBIBEQiIBIBkRz+fqDd/g6/oc9f194fNN1/ND1vVV8/cQKRCIhEQCQCIhEQiYBIBETieaDB6p1nsnvnmTiBSAREIiASAZEIiERAJAIiWf6dpOl5ocmfl+vPE01u/X4ezwPxrgmIREAkAiIREImASAREcvi7acYdaViZTufbvn/n6JxAJAIiERCJgEgERCIgEgEBAAAAAKN/mXm7w9mG5tAAAAAASUVORK5CYII=",
    "dna.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAADaUlEQVR4nO3dQW7bMBBGYYnOHYKiFwh6G5/U1wmyD3KHwLa6iONVbaF+GXA4et8mQABJFPtzEE5la5okSZIkSZK0BXP0BU6n00KO3+12d8f4cXi5e/42ncnlsef9G5rj6PmjniJPPk3T1FqLvkRp2ecvPEDReleYrcsdb6U3fAWarEBdWYGEDF+BPs+ugZ6GD1D2XUp14X2gZVlQH2Oe5/Ax9rTW56ELJHr+hq9Aoxu9go49enVngIQYICEGSIgBEmKAhIRv42kfIvvzMHR8VO8+Wfo+UPY+SfbxRdv23QszQEIMkBADJMQACTFAQtJv46P7HFvv41DpAxRt630cytkTYoCEGCAhBkiIARJigIQMv423j9PX8AGyj9OXsy/EAAkxQEIMkBADJMQACem+ja/ex8n+uTaqe4Cq93HK31/vAWhsBkiIARJigIQYICEGSEj4Nj66z5P9eZzq34/k+8KSyz5/uUen9AyQEAMkxAAJMUBCDJCQ7o9zrKF9lPfDH9RHiX4r9K/9a+o+1horkJD0FYh6OtIK4luh7ykfoOyd3NGVD9A0H+EJrED3uDyFlK9AxxmuEbpHWmqv0dp3p3DDV6CPw8s/+zzt+lv4N8zCjn/evw3d51ljBRIyfAW62Sn+sXXvGrvH2REyfAWyT9OXFUjI8BXo8+wa6Gn4APl/XX2F9yiWZUHP42T/3Be19rkvukCi52/4CjS60Svo2KNXdwZIiAESYoCEGCAhBkhI+Da++vfjVP+e6zXp+0DZ+yTZxxdt23cvzAAJMUBCDJAQAyTEAAlJv43P/j4vqncfh0ofoGhb7+NQzp4QAyTEAAkxQEIMkBADJGT4bbx9nL6GD5B9nL6cfSEGSIgBEmKAhBggIQZISPdtfPU+TvbPtVHdA1S9j1P+/noPQGMzQEIMkBADJMQACTFAQsK38dF9nuzP41T/fqTwAFXvg0TLPn+5R6f0DJAQAyTEAAkxQEIMkJDuj3OsoX2U9xvvlV/Trj/ZO1nPlzPdOsvv/WvqPtYaK5CQ9BWIaidWQY7tsePbpe59H151pdYPEO3kPnj4NUBlo/OlfIDO7fjgkV//8A2+Ffr8YAUbRe3loXDlK9DxxNZIm78r2P9Wkst1i7/XvnyA6N9A7eFN9uW6S+0ASZIkSZIkaRv+Ama1k7b+jMaRAAAAAElFTkSuQmCC",
    "flask-lab.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAADk0lEQVR4nO3dYW7TQBCG4djlDogLIK7DSXsdLoAQV0CJzY82Ra2IR+3b6cza7/MnQlVgbX8edicb93SSJEmSJEnSEUzVA6Aul8taPQbi7u5u6GvwqXoA1DzP1UM4NM++EAMkxAAJMUBCDJAQAySk/TI+6vNM0zR0HyU6vu59ovYB2nufZ/TjG3v0KmeAhBggIQZIiAESYoCEtF/GR32e7n2Uvfex2gco0r2P0n181L6PTukMkBADJMQACTFAQgyQEAMkxAAJMUBCDJAQAyTEAAkxQEIMkBADJMQACTFAQgyQEAMkxAAJMUBCDJAQAyTEAAkxQEIMkBADJMQACTFAQgyQEAMkxAAJMUBCDJAQAyTEAAkxQEIMkJD2j/kd/TnLoz/nOtI+QLt/zvLgxzf26FXOAAkxQEIMkBADJMQACSlfxo/e5/l1/21z/F++/9gc/+h9ovIAjd4Hydb9/JQHaHTzZn3Yv97xVntWIGiZz9VDKGUFEmIFgs6XY9+DBgjqvkrKlt5D6N7HGF31+U2vQEe/Q7NVn1+vrhADJMQACTFAQuqW8Qf/DOndXM9j0VrWCiQEVyC6nyfaTzOflrcM690s8M5eVnaPRu+e5tr9RDhA1X0Ibcu+PuUfZeAKE9zh9O+P9vtEFYr++7QCZs+RLB9CyisQNm3vx4nu/xnOUY5u/ABpW/LyPi9AyX2ep7nB+nAItyrNrfpyndss0/Lsz7vjHEidhRUou88Tz1L+71oxPgffu4r8vv+6nk63VzvplSmag03b5+dncH6z+0RhgOzz7Bu9vumT6GXdXiXNU++A4j5MJKgwYQVcar8VUr8jca+T1w9S/T/E4ZfxYSc5PeBhpyp7AEjv0am9w1egKlEfa356rd2NELECCbECFYueH3TtU3VlBRKSv4yH+2lGt/fjswIJMUBCDJAQAyTEAAnJ7wPRPcfBp9XhfqPg/dXC8bfuAlmBBOX3gfD3vrZ/vMD9MNF2CNrHCftgwfi775ca/qOM6v0w1Oj7pT4gQG+tQI8ndvTvbeEALC9eexn86qhaegX6E1SQ5cYd+m8/zMMcYV6L7sD3+m76qz2cgfPj69J0LlS/J/rW+16+Vs0FkifRG+98/tr0Q1k8rOrnFGvbuq6pv4/N5wMJ8eoLMUBCDJAQAyTEAAkxQELwMp7+3nPlon2eSNtOtMbg1RVigIQYICEGSIgBEmKAJEmSJEmSJIX+AuVqu1TQihkpAAAAAElFTkSuQmCC",
    "flask-round.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAADuklEQVR4nO3dbYrUUBCF4XzMHho3IG5n3OhsR/wv4hZGO/GHMYKYlPSxrI+8D8jAQOvt2yfVSeXmOgwAAAAAAAC4gjF6AN7u9/sa+e/P89x6jp+iB+BtmqboIbTG7EJCgCAhQJAQIEgIECQECJLyl/FWn2ccx9A+jDW+6n2i8gHK3ufJPj5V73cHdwQIEgIECQGChABBQoAgKX8Zb/V5vPsw2ftQ3soHyOLdh+ne57Fc+91DRoAgIUCQECBICBAkBAgSAgQJAYKEAEFCgCAhQJAQIEgIECQECBICBAkBgoQAQUKAICFAkBAgSAgQJAQIkvSP9aj7PHs/l6U+l2bJvn9Q+gBVf+6q+vgtvd8d3BEgSAgQJAQIEgLkbd3+NEWAIAm/jK++v87nl3fn45+08WffZzo8QN37JKrs8xMeoOqmYYkeQqjc8UZ6VCAZFQh4GBVI9Lpc+xgkQKLsV0newnss67q69oGsPs2b5w/hc3DGe35U1z58IGv/FbYs175K8tY+QFc/R/HWPkDD+C16BK1xeELSvgJ9vXifxlv7AHEO5Mu9h5B9PUt10fPrXoGoAL6i55dPFxICBAkBgoQAQUKAICFAkKRvJH4y1vMcmfafte/G354/pu6TUYEgSV+BpkW7m+5ef1bjGBxrV0BL/gBl72SbAfo/w4iSPkDpGeuNJitgxfV+d3BHBXrQ8vOraf0xhb+f6exHZvNzICoQJFSgB01bd+pmPFf25eVt4/3JqEAQESBICBAkBc6BrKsY6xhQX48zzB4k6SvQ0f47+932eft5cK2zDH/Xpzl6Pc6lD9DRvbBfv+3dqMvO/Vaf9/42Vp/FWk+j9mkW4yzAXI9k3Cu7vT/vM0XvH8Q5ECTpv8LSuxsVZjZeX/xeGQES2euVagfEQoDC1Q4Y50CQUIGCWOuJqqACQRK+5Fvd38bs43g/NSH+/VafKrrPYwn/Ckv/1AVOhQdItRjHn/uTqcX7OCoOf0jKV6D86316V6jo2UVx5SvQ0T7Q43bt8mSsF/J2tB6pi/IBOrqKG/fAdP3ocgjvA0WvF/LuE6n7+2TvA3EOBEn5rzCLfe5jrRj8VyPpiQoESfsK9PhJ9HZsNd/fR8XsQNK+Ar2qFWTfgYx2wJ+0D5B8tz+80ZFb+umx1gtZov8/snU57+NYn0B0n8eSvgKxXii39AEqL3X90HF4Q0KAICFAkBAgSAgQJOmvwtQ+iNpHUmXv46jSB0hFH8kXswsJAYKEAEFCgCAhQJAQIAAAAAAAAACm7xx+w12QRl5KAAAAAElFTkSuQmCC",
    "globe.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAAFr0lEQVR4nO3dTXLbRhCGYQykHMFlu7xPpZKzJLFy0CjJWfLjyj7lco5gSwMvRFAkxUFL/NicnsH7bFIiQ5gcNBqDRgMYBgAAAAAAAKxBqv0Favt4+9209P7bmw+rH6MlY+0vgLZd1/4CtY1Drv0VmkYGgoQAgoQAgoQAgoQAgqT5GodVx7FYR2HZ2MasY7h3ndeRyECQNF8Hyvm0Os4284wP29A4HV9OLry+u6Q1az6AxvG0FfjcT9nLJ4Dalu4Kb2xW7LTuFeyN0YWk+Qz0JR/fBtLm2OyaTcRV8wFUmqMk6eAez9V1jWIYynWiw/pP8SgsWXUgrU5kefPTX4vvX11dVV2HzWeg3p16lHkp/QdQKuSAg7xUyjTZ2L5LmWv7/vLHm9f774Oz/jNQYRYyZ5axep2o7Y7IFQRQe049PVND9wF0d69lmOurM32RA3MGTMM3wzAMw/20MymrnRRfoPsA0o9iLpMNUkpDSmmYprYKWO41hP9uv5dG5N3N31XrHFa/kXpVx6sf/9z7Ox0GfLJS4P3iuyldu45f9xmoJXvBk9qo8boH0PVdOxPCY6wMMxr51aojPck4s3lXZsaR0yTtmdwDKHolFRr/XVixX6cVagY1NqDJyCBWBqqc4JkDRaVOgS40hXIPoDvjbHZ0nwv9RjPr15nHQPnLzsJ2lradW20y1OFyNu9P08Pn01T6vC8ykMGaw9mbxwv2MTnvB8FLqZ8/gZzoiv02h6+WzoobXt/828bxbMGn228Xc0HaOVw/Vkh89fOHxeX//8cPe3+/tBD55v0/0viSgQKZV/5LguDY/7v7WnKuJ8kBVKyTNJ03Lmc6WijaeW0TC4ejPG7/+/DOXtDs/QPiFzSQgRpX+9wZAeTOmPsZc8PSu1Hq+wRQo6KcKiOAnFl1JEvaaS5LFeo8FgLI2TnPBU45l0++ViInQqvOoVr7/Xk+/r7fTzVPmudRSXnzd2Et5HF5hNQ6GxkouFJtaP6r9tYRPoDy1PrZfE3aBM5uoOScH+tD8xqsNCcKH0D0Ez01juN2l5UrH9CfIYC4g5erQp3o8bq2uuPP2oVEzkClOsf8Kvfn0Vj3P5qVhtl7/PWTqYU5yuOrUYrubXru/Y/KceI7/u5HgWqdyLqqwfy8eO1763Uka/zVOhA7GEjiH8aL9Y21Pw9MzeAWMhAkF8hAztdVYZF3oZG1A4l7Bjq1H4Y60nnci/1IlrDXxlNHOg/vc4nhaxyfftWeB3bq9WiztfcjWdhBQBK/DiTuwtQd4Nr7kSzhA6g2+pGWNRBA1JEiY3QhCZ+BPotn033vUYrwAdTKfZ7Xqvvtk34kX8yBIAm/C6uNfqRlZCBIVpCBqCN5YnQg6T4D0Y/kq/sAoh/Jl9t9omdvg9cxLPQjLSNBQyLvwnrvl6EfaZnbtfE4j+jj2/0kWkcdaUnfvw7uyEAG+pGWEUAG+pGW6XWg35b7bXrvh7HU7kcajPFX63TMgSDRD+ON7av3fhhvaj+S9y6UDAQJk2h3fdeRYn87hEcGctZ7PxIB5Kz3fiT9eWFWv0zn/TDevJ/Hxn2iUZW+CxMzjCV6P8zahZ8DRe+HWTueF9Y9KtEIjOeFdS5vVrFXHuJ5YZDwvDBD7TqSOn5qncfCDgaS+Ifx3J8nNDIQJDwvLLzYGXTtawcinhcW3Knjdyk8Lyy46OcCw/fKcH+e2GKHN8KLXwfi/jyhhQ+g2qLPQWprIICoI0XG6EISPgNxf57YwgcQ9+eJrfvt0/u6KqtfyepHar1OxBwIkvC7sOhG41xV71to778PzlaQgbRJ9GjMYcylO1+5WxsZCJLuM5BXP9Lj0dfDubKneWbzwW0G63Nb7T6A6Efy1XQN4hKsfqTXv7Rdx1H1mVdxMd3vwmSdH0WpyECQkIFMZKAlZCBIyECG6Ndl1UYAGeiJBgAAAAAAAIbhKy/rguCusfAvAAAAAElFTkSuQmCC",
    "laptop.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAAB6UlEQVR4nO3cy00DMRRA0QmiB0QD1AOVQj00gKgiVEC8uLI8Hp2zTyafKy+ebB8HAAAAAAAAAABwFbfZD7jf7/fZz+B/t9tt6n/8NPPNuT4BkQiIREAkAiIREImASJ5Xf4DZc4qrWz1nswKRCIhEQCQCIhEQiYBIBESyfA5U/Xy9PZyDPJ18N9LLx/fWczArEImASAREIiASAZEIiERAJNvPgUZzntGc5ffz8RxpZPb7n50ViERAJAIiERCJgEgERCIgkuX3A43Ohe2+36cazZnq71tZgUgERCIgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkQiIREAkAiI5/X6gkd3PXdX7gewHYmsCIhEQiYBIBEQiIBIBkWx/P9DI6vuBRufadmcFIhEQiYBIBEQiIBIBkQiIZPl+oMsbffvJ/4D9QJyagEgERCIgEgGRCIhEQCR5RjD7HujX97afp+7XOfvzR2afG7MCkQiIREAkAiIREImASAREsnwONFLnLLu/vs6JzIE4NQGRCIhEQCQCIhEQiYBIhjOA1fcQV6vPpe3++4w+vxWIREAkAiIREImASAREIiASAZEIiERAJAIiERCJgEgERCIgkrwfiGuzH4ipBEQiIBIBkQiIREAkAgIAAAAAAAAAAOA4juP4A29HhOEWECS/AAAAAElFTkSuQmCC",
    "microscope.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAACGUlEQVR4nO3d0U0jMRhGUYLoYbUNUA90Sj3bwJYROogfrobfDucUgEJ05YdPnsnLCwAAAAC/wW36A6zc7/f7lX//drtt/x3s7HX6A3A2AZEIiERAJAIiERCJgEjepj9Atdpxrt6RfjsnEImASAREIiASAZEIiERAJON3YXbfadwXeswJRCIgEgGRCIhEQCQCIhEQyfjGsdqBrt5hPHfWOIFIBEQiIBIBkQiIREAkAiI5/rmw/1/vD3ecvx//0g5Td5zpnetqTiASAZEIiERAJAIiERCJgEiO34FOd/pO5AQiERCJgEgERCIgEgGRCIhkfGOY3kF2fy5s+vtZcQKRCIhEQCQCIhEQiYBIBESy/Q40bfcdZ3oncgKRCIhEQCQCIhEQiYBIBEQyvgOt1J1jeidZOf3/cwKRCIhEQCQCIhEQiYBIBERy/PuBdr9P9OycQCQCIhEQiYBIBEQiIBIBkWy/A03f16mm7+tczQlEIiASAZEIiERAJAIiERDJ+A60+t331+HbPn8+H//u/NX3kXbfkZxAJAIiERCJgEgERCIgEgGRHH0X5Sc8+3ueKycQiYBIBEQiIBIBkQiIREAk4/eBnt3qvtPu74FecQKRCIhEQCQCIhEQiYBIBERy+YZw+nucp3eWlemdyAlEIiASAZEIiERAJAIiERCJ+0ALp+9YV3MCkQiIREAkAiIREImASAQEAAAAACx9A+tfeMXuWDk7AAAAAElFTkSuQmCC",
    "neuro.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAACI0lEQVR4nO3d0Y3TQBRA0SSiBhANsOUAlQLlQANoKYLQgefjavTs5ZzfKLKdXM3Hk8e+3QAAAAD4H9ynT2Da8/l8Th7/fr9f+j94TJ8A1yYgEgGRCIhEQCQCIhEQyaVnELdbn+NMz2Gufv5WIBIBkQiIREAkAiIREImASE4/B1rNSabnINOmfx8rEImASAREIiASAZEIiERAJOMzlOk5xm6/v386vL6PX35tvb7dv68ViERAJAIiERCJgEgERCIgkne7D2DOczznef12/P0PX/fOiSorEImASAREIiASAZEIiERAJHnG8NbnPNXZ5zz1/7MCkQiIREAkAiIREImASAREMj4HMkeaZQ7EKAGRCIhEQCQCIhEQiYBIlvvCzHk4YgUiERCJgEgERCIgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkQiI5PL7wlbPaX4cfnp9q+cLeV8YpyYgEgGRCIhEQCQCIhEQyfierNWcgr3MgRglIBIBkQiIREAkAiIREMn4HGhl9/1CK6v7id5//nn4+Z8fL+Xw6/t9/i5+n8fe5y9ZgUgERCIgEgGRCIhEQCQCIhmfA+3eV7ZS74c5+/nbF8apCYhEQCQCIhEQiYBIBESyfQ509veFTe9LO/v1e288WwmIREAkAiIREImASAREsnxv/Fs3fT/Q1VmBSAREIiASAZEIiERAJAIiERCJgEgERCIgEgGRCIhEQCQCAgAAAACW/gHOqpYATw0/WQAAAABJRU5ErkJggg==",
    "rocket.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAACiElEQVR4nO3d0W0TQRRAUTuiBiIagHZCpQnlkAYgFGHTgZ/E1TDr5JxfR9ZmdTUfTzPj0wkAAACAj+A8/cH1er3+jwf5V+fzefwfdvr18vXm+/vy9Hro55887H4A7puASAREIiASAZEIiERAJHkOtHsOU+dUu5//3lmBSAREIiASAZEIiERAJAIi+bT7Aao6xzn6nKt6e769H+nxe9uPZAUiERCJgEgERCIgEgGRCIjk8HOg1ft9ps+PPieazp09DufO6pzICkQiIBIBkQiIREAkAiIREMn2c2HT9/95+Va+/vT56efNz9/7fqLV9xNZgUgERCIgEgGRCIhEQCQCIhn3A937fpnV6vv5/eP2nOth2A017ddZfQ+1FYhEQCQCIhEQiYBIBEQiIJI8I9i9X2hy9DnU7jlRZQUiERCJgEgERCIgEgGRCIhk+Yzko+8Xqq6X4dzcMCe6DG/XuTC2EhCJgEgERCIgEgGRCIhk+wzGnOi21fcnTdwTzVICIhEQiYBIBEQiIBIBkWz/vbB7v39o9T3Mk3rua3r+iRWIREAkAiIREImASAREIiCSu99r897nREf//6xAJAIiERCJgEgERCIgEgGRbN8PVE33KO+eo0xznmlOtHvOM7ECkQiIREAkAiIREImASAREsnwO9PZ8e85RzzVNv5c1zomGe5hX75ia5jy7z51NrEAkAiIREImASAREIiASAZHkGUKdU6yeE03fX63+XfbJ7jmRFYhEQCQCIhEQiYBIBEQiIJLlM4zdc4rJ9HzTfqPdc6DJ6vdvBSIREImASAREIiASAZEIiOTQM4wjmPYTXYY3uHvOtZoViERAJAIiERCJgEgERCIgAAAAAGD0F7kZwt0uHB2WAAAAAElFTkSuQmCC",
    "tools.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAACWElEQVR4nO3d0W0TURRFUTuiB0QD1AOVQj00gGgCpwMe0tbVHTtrFeBxnK33cTQe324AAAAAfAT37Tdw8ufH18fm9f8ePqEv336lz/DxeIz+fff7ffR//Db54rw+AZEIiERAJAIiERCJgEg+bb+B3z8PO8/qCjS/89SdZnpHOnECkQiIREAkAiIREImASAREMr4DHe/nGV4xpu/nmVZ3pLoTnV7fCUQiIBIBkQiIREAkAiIREEnegV79fp5tdeeZ3omcQCQCIhEQiYBIBEQiIBIBkeQd6O3i9/Nsfy/r9PqnHe30900//+fECUQiIBIBkQiIREAkAiIREMlxQ6g7RX3O8+fvs/fzTH9vqn5+V3+OtBOIREAkAiIREImASAREIiCSvLHUneNk+n6eev2T6e91bXMCkQiIREAkAiIREImASAREcumN4X9s7yjTO9HVOYFIBEQiIBIBkQiIREAkAiJ56g3idrv+DrO9U01zApEIiERAJAIiERCJgEgERHL5DWL797DsRP/mBCIREImASAREIiASAZEIiCT/Xtj2c4xPzyeqO9H0TvPszw9yApEIiERAJAIiERCJgEgERHLcELZ3iOnf29r+3fhq+/pOIBIBkQiIREAkAiIREImASMZ3oFffYU6239/09Z1AJAIiERCJgEgERCIgEgGR5B3oeIHhnWh7Z6m233+9vhOIREAkAiIREImASAREIiCS8Y3ko98PVF19J3MCkQiIREAkAiIREImASAREsr4DVc++81TbO5gTiERAJAIiERCJgEgERCIgAAAAAODoHYI46AEgIm8UAAAAAElFTkSuQmCC"
  };
  var FACULTY_BADGES = {
    '1': 'laptop.png',
    '2': 'ai.png',
    '3': 'tools.png',
    '4': 'globe.png',
    '5': 'neuro.png',
    '6': 'rocket.png'
  };
  var INTEREST_BADGES = {
    'tech-ai': 'ai.png',
    'product-ux': 'laptop.png',
    'healthcare': 'capsule.png',
    'business': 'globe.png',
    'robotics': 'atom.png',
    'media': 'rocket.png',
    'data-research': 'microscope.png',
    'law-policy': 'neuro.png',
    'arch-design': 'tools.png',
    'bio-env': 'dna.png',
    'psych-edtech': 'flask-round.png',
    'global-lang': 'globe.png',
    'game-interactive': 'rocket.png',
    'finance-quant': 'flask-lab.png',
    'health-bio': 'dna.png',
    'business-data': 'globe.png',
    'media-game': 'rocket.png',
    'engineering': 'atom.png',
    'comm-arts': 'microscope.png'
  };

  function makeBadge(file, sizeClass) {
    var wrap = document.createElement('span');
    wrap.className = 'inline-flex items-center justify-center rounded-lg bg-primary p-1 shrink-0 shadow-sm ' + (sizeClass || 'w-8 h-8');
    wrap.setAttribute('aria-hidden', 'true');
    var img = document.createElement('img');
    img.src = BADGE_DATA_URIS[file] || (BASE + file);
    img.alt = '';
    img.className = 'w-full h-full object-contain';
    img.style.imageRendering = 'pixelated';
    wrap.appendChild(img);
    return wrap;
  }

  function attachBefore(el, file, sizeClass) {
    if (!el || el.querySelector('[data-pixel-badge]')) return;
    el.classList.add('flex', 'items-center', 'gap-2.5');
    var b = makeBadge(file, sizeClass);
    b.setAttribute('data-pixel-badge', 'true');
    el.insertBefore(b, el.firstChild);
  }

  // Page 1: Hero eyebrow + Preview Card
  var heroEyebrow = document.querySelector('[data-page-view="1"] span.rounded-full');
  if (heroEyebrow) {
    var dot = heroEyebrow.querySelector('span.rounded-full.bg-secondary');
    if (dot) dot.replaceWith(makeBadge('rocket.png', 'w-5 h-5 rounded-md p-0.5'));
  }
  var heroCardTitle = document.querySelector('[data-page-view="1"] article h2');
  attachBefore(heroCardTitle, 'laptop.png', 'w-9 h-9');

  // Page 2: Step 1-3 section headings + Step 1 interest chips
  attachBefore(document.querySelector('[data-step-panel="1"] h1'), 'ai.png', 'w-9 h-9');
  attachBefore(document.querySelector('[data-step-panel="2"] h1'), 'atom.png', 'w-9 h-9');
  attachBefore(document.querySelector('[data-step-panel="3"] h1'), 'globe.png', 'w-9 h-9');

  document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
    var k = chip.getAttribute('data-interest-key');
    if (INTEREST_BADGES[k] && !chip.querySelector('[data-pixel-badge]')) {
      var b = makeBadge(INTEREST_BADGES[k], 'w-5 h-5 rounded-md p-0.5');
      b.setAttribute('data-pixel-badge', 'true');
      chip.appendChild(b);
    }
  });

  // Page 3: Section headings + all 6 Faculty cards
  attachBefore(document.querySelector('[data-page-view="3"] h1'), 'rocket.png', 'w-9 h-9');
  attachBefore(document.querySelector('[data-page-view="3"] h2[data-en*="Other Paths"]'), 'flask-round.png', 'w-8 h-8');

  document.querySelectorAll('[data-destination-card]').forEach(function (card) {
    var id = card.getAttribute('data-destination-card');
    var heading = card.querySelector('h2, h3');
    attachBefore(heading, FACULTY_BADGES[id] || 'laptop.png', 'w-8 h-8');
  });

  // Page 4: Locked Major title + Beyond 4.00 Edge aside
  var rmTitle = document.getElementById('roadmap-major-title');
  if (rmTitle && !document.getElementById('roadmap-major-pixel-badge')) {
    rmTitle.classList.add('flex', 'items-center', 'gap-3');
    var rmBadge = makeBadge(FACULTY_BADGES[PF_STATE.lockedMajorId] || 'laptop.png', 'w-10 h-10');
    rmBadge.id = 'roadmap-major-pixel-badge';
    rmTitle.insertBefore(rmBadge, rmTitle.firstChild);
  }
  var asideHeader = document.querySelector('[data-page-view="4"] aside header > span:first-child');
  if (asideHeader) {
    var icon = asideHeader.querySelector('.material-symbols-outlined');
    if (icon) icon.replaceWith(makeBadge('atom.png', 'w-7 h-7 rounded-md p-0.5'));
  }

  // Keep Page 4 badge synced when switching majors
  if (typeof window.renderRoadmap === 'function') {
    var origRender = window.renderRoadmap;
    window.renderRoadmap = function (majorId) {
      origRender(majorId);
      var id = String(majorId || PF_STATE.lockedMajorId || '1');
      var rmTitleEl = document.getElementById('roadmap-major-title');
      if (rmTitleEl) {
        rmTitleEl.classList.add('flex', 'items-center', 'gap-3');
        var existing = document.getElementById('roadmap-major-pixel-badge');
        if (!existing) {
          existing = makeBadge(FACULTY_BADGES[id] || 'laptop.png', 'w-10 h-10');
          existing.id = 'roadmap-major-pixel-badge';
        } else {
          var imgEl = existing.querySelector('img');
          var fKey = FACULTY_BADGES[id] || 'laptop.png'; if (imgEl) imgEl.src = BADGE_DATA_URIS[fKey] || (BASE + fKey);
        }
        if (rmTitleEl.firstChild !== existing) {
          rmTitleEl.insertBefore(existing, rmTitleEl.firstChild);
        }
      }
    };
  }

  window.PF_REFRESH_BADGES = function () {
    attachBefore(document.querySelector('[data-page-view="1"] article h2'), 'laptop.png', 'w-9 h-9');
    attachBefore(document.querySelector('[data-step-panel="1"] h1'), 'ai.png', 'w-9 h-9');
    attachBefore(document.querySelector('[data-step-panel="2"] h1'), 'atom.png', 'w-9 h-9');
    attachBefore(document.querySelector('[data-step-panel="3"] h1'), 'globe.png', 'w-9 h-9');
    attachBefore(document.querySelector('[data-page-view="3"] h1'), 'rocket.png', 'w-9 h-9');
    attachBefore(document.querySelector('[data-page-view="3"] h2[data-en*="Other Paths"]'), 'flask-round.png', 'w-8 h-8');
    document.querySelectorAll('[data-destination-card]').forEach(function (card) {
      var cid = card.getAttribute('data-destination-card');
      attachBefore(card.querySelector('h2, h3'), FACULTY_BADGES[cid] || 'laptop.png', 'w-8 h-8');
    });
    document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
      var k = chip.getAttribute('data-interest-key');
      if (INTEREST_BADGES[k] && !chip.querySelector('[data-pixel-badge]')) {
        var b = makeBadge(INTEREST_BADGES[k], 'w-5 h-5 rounded-md p-0.5');
        b.setAttribute('data-pixel-badge', 'true');
        chip.appendChild(b);
      }
    });
    var rmTitleEl = document.getElementById('roadmap-major-title');
    if (rmTitleEl && !document.getElementById('roadmap-major-pixel-badge')) {
      rmTitleEl.classList.add('flex', 'items-center', 'gap-3');
      var rmB = makeBadge(FACULTY_BADGES[PF_STATE.lockedMajorId] || 'laptop.png', 'w-10 h-10');
      rmB.id = 'roadmap-major-pixel-badge';
      rmTitleEl.insertBefore(rmB, rmTitleEl.firstChild);
    }
  };

})();
