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

/* Baseline Window: University Alone vs Swipeable Card Shuffle (Swipe Up = Accept, Swipe Down = Ignore) */
(function initBaselineDeck() {
  var deck = document.getElementById('baseline-preview-deck');
  if (!deck) return;
  var mode = 'university';
  var currentIndex = 0;
  var acceptedCount = 0;
  var ignoredCount = 0;

  var universities = [
    { key: 'cu', theme: 'cu-eng', th: 'จุฬาลงกรณ์มหาวิทยาลัย', en: 'Chulalongkorn University', tagTh: 'วิศวกรรม • 5 หลักสูตร', tagEn: 'Engineering • 5 programs', base: 94 },
    { key: 'kmutt', theme: 'kmutt-design', th: 'มจธ. (KMUTT)', en: 'KMUTT', tagTh: 'เทคโนโลยี & ดีไซน์ • 4 หลักสูตร', tagEn: 'Tech & Design • 4 programs', base: 91 },
    { key: 'tu', theme: 'tu-tech', th: 'มหาวิทยาลัยธรรมศาสตร์', en: 'Thammasat University', tagTh: 'SIIT & นวัตกรรม • 3 หลักสูตร', tagEn: 'SIIT & Innovation • 3 programs', base: 87 },
    { key: 'mu', theme: 'mu-media', th: 'มหาวิทยาลัยมหิดล', en: 'Mahidol University', tagTh: 'ICT & สื่อดิจิทัล • 3 หลักสูตร', tagEn: 'ICT & Digital Media • 3 programs', base: 82 }
  ];

  var shuffleItems = [
    { uniKey: 'cu', theme: 'cu-eng', th: 'วิศวกรรมคอมพิวเตอร์ & ออกแบบผลิตภัณฑ์', en: 'Computer Eng & Product Design', uniTh: 'จุฬาฯ / มจธ.', uniEn: 'Chula / KMUTT', round: 'TCAS 1–3', base: 94 },
    { uniKey: 'tu', theme: 'tu-tech', th: 'เทคโนโลยีสร้างสรรค์ & นวัตกรรมดิจิทัล', en: 'Creative Tech & Innovation', uniTh: 'ธรรมศาสตร์ (SIIT)', uniEn: 'Thammasat (SIIT)', round: 'TCAS 1–2', base: 89 },
    { uniKey: 'kmutt', theme: 'kmutt-design', th: 'ออกแบบอุตสาหกรรม & UX', en: 'Industrial Design & UX', uniTh: 'มจธ. / จุฬาฯ', uniEn: 'KMUTT / Chula', round: 'TCAS 1', base: 84 },
    { uniKey: 'cu', theme: 'cu-biz', th: 'ธุรกิจดิจิทัล & Data', en: 'Digital Business & Data', uniTh: 'จุฬาฯ / ธรรมศาสตร์', uniEn: 'Chula / Thammasat', round: 'TCAS 3', base: 79 }
  ];

  function getSortedOffers() {
    var gpax = slider ? Number(slider.value) : 3.75;
    var delta = Math.round((gpax - 3.75) * 8);
    return shuffleItems.map(function (item) {
      var acc = Math.max(60, Math.min(99, item.base + delta));
      return { item: item, acc: acc };
    }).sort(function (a, b) { return b.acc - a.acc; });
  }

  function attachTopCardSwipe(sorted) {
    var topCard = deck.querySelector('.swipe-card[data-stack-pos="0"]');
    if (!topCard) return;

    var upBadge = topCard.querySelector('[data-swipe-badge="up"]');
    var downBadge = topCard.querySelector('[data-swipe-badge="down"]');
    var startY = 0;
    var dy = 0;
    var dragging = false;

    function triggerSwipe(dir) {
      topCard.classList.remove('is-dragging');
      topCard.style.transform = '';
      topCard.classList.add(dir === 'up' ? 'fling-up' : 'fling-down');
      var currentEntry = sorted[currentIndex];
      if (dir === 'up') {
        acceptedCount++;
        if (currentEntry) PF_STATE.acceptedMajors.push(currentEntry.item.en);
      } else {
        ignoredCount++;
        if (currentEntry) PF_STATE.ignoredMajors.push(currentEntry.item.en);
      }
      setTimeout(function () {
        currentIndex++;
        renderDeck();
      }, 220);
    }

    topCard.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = e.clientY;
      dy = 0;
      topCard.classList.add('is-dragging');
      topCard.setPointerCapture(e.pointerId);
    });

    topCard.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dy = e.clientY - startY;
      var clamped = Math.max(-130, Math.min(130, dy));
      topCard.style.transform = 'translateY(' + clamped + 'px) rotate(' + (clamped * 0.03) + 'deg)';
      if (upBadge) upBadge.style.opacity = clamped < -18 ? Math.min(1, (-clamped - 18) / 55) : 0;
      if (downBadge) downBadge.style.opacity = clamped > 18 ? Math.min(1, (clamped - 18) / 55) : 0;
    });

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      topCard.classList.remove('is-dragging');
      if (dy < -65) {
        triggerSwipe('up');
      } else if (dy > 65) {
        triggerSwipe('down');
      } else {
        topCard.style.transform = '';
        if (upBadge) upBadge.style.opacity = 0;
        if (downBadge) downBadge.style.opacity = 0;
      }
    }

    topCard.addEventListener('pointerup', onEnd);
    topCard.addEventListener('pointercancel', onEnd);

    var btnUp = deck.querySelector('[data-deck-action="accept"]');
    var btnDown = deck.querySelector('[data-deck-action="ignore"]');
    if (btnUp) btnUp.addEventListener('click', function () { triggerSwipe('up'); });
    if (btnDown) btnDown.addEventListener('click', function () { triggerSwipe('down'); });
  }

  function renderDeck() {
    if (mode === 'university') {
      deck.className = 'grid grid-cols-1 sm:grid-cols-2 gap-gutter-sm';
      deck.innerHTML = universities.map(function (u) {
        return '<div data-uni-theme="' + u.theme + '" class="shuffle-card p-gutter-md rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-gutter-sm">' +
          '<div class="flex flex-col gap-0.5">' +
            '<span class="font-title text-title-md text-on-surface">' + (currentLang === 'th' ? u.th : u.en) + '</span>' +
            '<span class="font-label text-label-sm text-on-surface-variant">' + (currentLang === 'th' ? u.tagTh : u.tagEn) + '</span>' +
          '</div>' +
          '<span class="w-10 h-10 rounded-xl bg-surface-container-lowest border border-outline-variant p-1 flex items-center justify-center shadow-sm shrink-0">' +
            '<img data-uni-logo="' + u.key + '" alt="' + u.en + '" class="w-full h-full object-contain" />' +
          '</span>' +
        '</div>';
      }).join('');
      if (window.__syncUniCardLogos) window.__syncUniCardLogos();
      return;
    }

    var sorted = getSortedOffers();
    deck.className = 'flex flex-col gap-gutter-md';

    if (currentIndex >= sorted.length) {
      deck.innerHTML = '<div class="p-gutter-lg rounded-xl bg-surface-container-low border border-outline-variant flex flex-col items-center text-center gap-gutter-sm">' +
        '<span class="material-symbols-outlined text-[28px] text-secondary-text" style="font-variation-settings:\'FILL\' 1;" aria-hidden="true">style</span>' +
        '<span class="font-headline text-title-lg text-on-surface">' + (currentLang === 'th' ? 'คัดเลือกข้อเสนอครบทั้งสำรับแล้ว' : 'Deck Complete') + '</span>' +
        '<span class="font-body text-body-md text-on-surface-variant">' +
          (currentLang === 'th'
            ? 'รับข้อเสนอ ' + acceptedCount + ' คณะ • ข้าม ' + ignoredCount + ' คณะ'
            : 'Accepted ' + acceptedCount + ' offers • Ignored ' + ignoredCount + ' offers') +
        '</span>' +
        '<button type="button" data-deck-action="reset" class="inline-flex items-center gap-1.5 px-gutter-md py-2 rounded-full bg-primary text-on-primary font-label text-label-sm">' +
          '<span class="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>' +
          '<span>' + (currentLang === 'th' ? 'สับไพ่ใหม่ (Shuffle Again)' : 'Shuffle Again') + '</span>' +
        '</button>' +
      '</div>';
      var resetBtn = deck.querySelector('[data-deck-action="reset"]');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          currentIndex = 0; acceptedCount = 0; ignoredCount = 0; renderDeck();
        });
      }
      return;
    }

    var remaining = sorted.slice(currentIndex);
    var cardsHtml = remaining.map(function (entry, stackPos) {
      var hiddenAttr = stackPos > 2 ? ' data-stack-hidden="true"' : ' data-stack-pos="' + stackPos + '"';
      return '<div data-uni-theme="' + entry.item.theme + '" class="swipe-card p-gutter-lg rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col justify-between gap-gutter-sm"' + hiddenAttr + '>' +
        '<div class="flex items-start justify-between gap-gutter-sm">' +
          '<div class="flex flex-col gap-0.5">' +
            '<span class="font-label text-label-sm text-secondary-text">#' + (currentIndex + stackPos + 1) + ' • ' + (currentLang === 'th' ? entry.item.uniTh : entry.item.uniEn) + ' • ' + entry.item.round + '</span>' +
            '<h3 class="font-headline text-title-lg text-on-surface">' + (currentLang === 'th' ? entry.item.th : entry.item.en) + '</h3>' +
          '</div>' +
          '<div class="flex items-center gap-2 shrink-0">' +
            '<span class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-secondary-container text-on-secondary-container font-metric text-metric-md tabular-nums shrink-0">' +
              '<span class="material-symbols-outlined text-[14px] text-secondary-text" style="font-variation-settings:\'FILL\' 1;" aria-hidden="true">check_circle</span>' +
              entry.acc + '%' +
            '</span>' +
            '<span class="w-9 h-9 rounded-xl bg-surface-container-lowest border border-outline-variant p-1 flex items-center justify-center shadow-sm shrink-0">' +
              '<img data-uni-logo="' + entry.item.uniKey + '" alt="' + entry.item.uniEn + '" class="w-full h-full object-contain" />' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-outline-variant">' +
          '<span data-swipe-badge="up" style="opacity:0;" class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm">' +
            '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_upward</span>' +
            (currentLang === 'th' ? 'รับข้อเสนอ' : 'Accept Offer') +
          '</span>' +
          '<span class="font-label text-label-sm text-on-surface-variant">' +
            (currentLang === 'th' ? 'ลากขึ้นเพื่อรับ • ลากลงเพื่อข้าม' : 'Drag ↑ Accept • Drag ↓ Ignore') +
          '</span>' +
          '<span data-swipe-badge="down" style="opacity:0;" class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm">' +
            '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_downward</span>' +
            (currentLang === 'th' ? 'ข้ามข้อเสนอ' : 'Ignore') +
          '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    deck.innerHTML =
      '<div class="swipe-deck-stage">' + cardsHtml + '</div>' +
      '<div class="flex flex-wrap items-center justify-between gap-gutter-sm pt-gutter-xs">' +
        '<div class="flex items-center gap-gutter-xs font-label text-label-sm">' +
          '<span class="px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container">' + (currentLang === 'th' ? 'รับแล้ว ' : 'Accepted ') + acceptedCount + '</span>' +
          '<span class="px-gutter-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant">' + (currentLang === 'th' ? 'ข้าม ' : 'Ignored ') + ignoredCount + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-gutter-xs">' +
          '<button type="button" data-deck-action="ignore" class="inline-flex items-center gap-1 px-gutter-md py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container border border-outline-variant font-label text-label-sm">' +
            '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_downward</span>' +
            '<span>' + (currentLang === 'th' ? 'ปัดลง: ข้าม' : 'Swipe Down: Ignore') + '</span>' +
          '</button>' +
          '<button type="button" data-deck-action="accept" class="inline-flex items-center gap-1 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-sm">' +
            '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_upward</span>' +
            '<span>' + (currentLang === 'th' ? 'ปัดขึ้น: รับข้อเสนอ' : 'Swipe Up: Accept') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    attachTopCardSwipe(sorted);
    if (window.__syncUniCardLogos) window.__syncUniCardLogos();
  }

  document.querySelectorAll('[data-baseline-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      mode = btn.getAttribute('data-baseline-mode');
      PF_STATE.baselineMode = mode;
      document.querySelectorAll('[data-baseline-mode]').forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('bg-primary', active);
        b.classList.toggle('text-on-primary', active);
        b.classList.toggle('text-on-surface-variant', !active);
      });
      renderDeck();
    });
  });

  if (slider) {
    slider.addEventListener('input', function () { renderDeck(); });
  }
  document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(function () { renderDeck(); }, 160); });
  });

  renderDeck();
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
