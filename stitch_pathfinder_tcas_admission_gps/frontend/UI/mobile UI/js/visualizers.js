/* =========================================================================
 * PathFinder (Mobile Prototype) — Interactive Visualizers
 * Section 4.6: liquid lime tab pill, offer swipe deck, endless university river, pixel-art badges.
 *
 * Classic (non-module) script sharing the page's global scope. In the
 * single-file build all of this lived inside one IIFE; it now runs at
 * top level in the same order. Load order is fixed in index.html:
 *   data/image-assets.js > data/catalog.js > js/state-i18n.js >
 *   js/discovery-matches.js > js/roadmap.js > js/visualizers.js >
 *   js/sim-coach.js > js/auth-analytics-profile.js
 *
 * Depends on : data/image-assets.js, js/state-i18n.js, js/roadmap.js (window.renderRoadmap)
 * Provides   : window.PF_REFRESH_BADGES (plus self-contained IIFEs)
 * ========================================================================= */

/* Hero Flowing Lime Pill Tab Bar (3 states: stretch -> snap + droplet trail -> label fade) */
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

      tabs.forEach(function (t, i) {
        var sel = i === nextIdx;
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
        t.classList.toggle('text-on-surface', sel);
        t.classList.toggle('text-on-primary', !sel);
      });

      var newLeft = tab.offsetLeft;
      var newWidth = Math.max(tab.offsetWidth, 108);

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
      var currentEntry = sorted && sorted[currentIndex];
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
      var clamped = Math.max(-120, Math.min(120, dy));
      topCard.style.transform = 'translateY(' + clamped + 'px) rotate(' + (clamped * 0.03) + 'deg)';
      if (upBadge) upBadge.style.opacity = clamped < -16 ? Math.min(1, (-clamped - 16) / 50) : 0;
      if (downBadge) downBadge.style.opacity = clamped > 16 ? Math.min(1, (clamped - 16) / 50) : 0;
    });

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      topCard.classList.remove('is-dragging');
      if (dy < -60) {
        triggerSwipe('up');
      } else if (dy > 60) {
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
      deck.className = 'flex flex-col gap-gutter-xs';
      deck.innerHTML = universities.map(function (u) {
        return '<div data-uni-theme="' + u.theme + '" class="shuffle-card p-gutter-sm rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-gutter-sm">' +
          '<div class="flex flex-col gap-0.5">' +
            '<span class="font-title text-title-md text-on-surface">' + (currentLang === 'th' ? u.th : u.en) + '</span>' +
            '<span class="font-label text-label-sm text-on-surface-variant">' + (currentLang === 'th' ? u.tagTh : u.tagEn) + '</span>' +
          '</div>' +
          '<span class="w-9 h-9 rounded-xl bg-surface-container-lowest border border-outline-variant p-1 flex items-center justify-center shadow-sm shrink-0">' +
            '<img data-uni-logo="' + u.key + '" alt="' + u.en + '" class="w-full h-full object-contain" />' +
          '</span>' +
        '</div>';
      }).join('');
      if (window.__syncUniCardLogos) window.__syncUniCardLogos();
      return;
    }

    var sorted = getSortedOffers();
    deck.className = 'flex flex-col gap-gutter-sm';

    if (currentIndex >= sorted.length) {
      deck.innerHTML = '<div class="p-gutter-md rounded-xl bg-surface-container-low border border-outline-variant flex flex-col items-center text-center gap-gutter-xs">' +
        '<span class="material-symbols-outlined text-[24px] text-secondary-text" style="font-variation-settings:\'FILL\' 1;" aria-hidden="true">style</span>' +
        '<span class="font-headline text-title-md text-on-surface">' + (currentLang === 'th' ? 'คัดเลือกข้อเสนอครบแล้ว' : 'Deck Complete') + '</span>' +
        '<span class="font-body text-body-md text-on-surface-variant">' +
          (currentLang === 'th'
            ? 'รับข้อเสนอ ' + acceptedCount + ' คณะ • ข้าม ' + ignoredCount + ' คณะ'
            : 'Accepted ' + acceptedCount + ' • Ignored ' + ignoredCount) +
        '</span>' +
        '<button type="button" data-deck-action="reset" class="inline-flex items-center gap-1 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-sm">' +
          '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">refresh</span>' +
          '<span>' + (currentLang === 'th' ? 'สับไพ่ใหม่' : 'Shuffle Again') + '</span>' +
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
      return '<div data-uni-theme="' + entry.item.theme + '" class="swipe-card p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col justify-between gap-gutter-xs"' + hiddenAttr + '>' +
        '<div class="flex items-start justify-between gap-gutter-xs">' +
          '<div class="flex flex-col gap-0.5">' +
            '<span class="font-label text-label-sm text-secondary-text">#' + (currentIndex + stackPos + 1) + ' • ' + (currentLang === 'th' ? entry.item.uniTh : entry.item.uniEn) + '</span>' +
            '<h3 class="font-headline text-title-md text-on-surface">' + (currentLang === 'th' ? entry.item.th : entry.item.en) + '</h3>' +
          '</div>' +
          '<div class="flex items-center gap-1.5 shrink-0">' +
            '<span class="inline-flex items-center gap-1 px-gutter-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-metric-md tabular-nums shrink-0">' +
              '<span class="material-symbols-outlined text-[14px] text-secondary-text" style="font-variation-settings:\'FILL\' 1;" aria-hidden="true">check_circle</span>' +
              entry.acc + '%' +
            '</span>' +
            '<span class="w-8 h-8 rounded-lg bg-surface-container-lowest border border-outline-variant p-1 flex items-center justify-center shadow-sm shrink-0">' +
              '<img data-uni-logo="' + entry.item.uniKey + '" alt="' + entry.item.uniEn + '" class="w-full h-full object-contain" />' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center justify-between gap-gutter-xs pt-gutter-xs border-t border-outline-variant">' +
          '<span data-swipe-badge="up" style="opacity:0;" class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label text-label-sm">' +
            '<span class="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_upward</span>' +
            (currentLang === 'th' ? 'รับ' : 'Accept') +
          '</span>' +
          '<span class="font-label text-label-sm text-on-surface-variant">' +
            (currentLang === 'th' ? 'ปัดขึ้นรับ • ปัดลงข้าม' : 'Swipe ↑ / ↓') +
          '</span>' +
          '<span data-swipe-badge="down" style="opacity:0;" class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm">' +
            '<span class="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_downward</span>' +
            (currentLang === 'th' ? 'ข้าม' : 'Ignore') +
          '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    deck.innerHTML =
      '<div class="swipe-deck-stage">' + cardsHtml + '</div>' +
      '<div class="grid grid-cols-2 gap-gutter-xs pt-gutter-xs">' +
        '<button type="button" data-deck-action="ignore" class="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-full bg-tertiary-container text-on-tertiary-container border border-outline-variant font-label text-label-sm">' +
          '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_downward</span>' +
          '<span>' + (currentLang === 'th' ? 'ปัดลง: ข้าม (' + ignoredCount + ')' : 'Ignore (' + ignoredCount + ')') + '</span>' +
        '</button>' +
        '<button type="button" data-deck-action="accept" class="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-full bg-primary text-on-primary font-label text-label-sm">' +
          '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_upward</span>' +
          '<span>' + (currentLang === 'th' ? 'ปัดขึ้น: รับ (' + acceptedCount + ')' : 'Accept (' + acceptedCount + ')') + '</span>' +
        '</button>' +
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

/* Authentic Thai University Logo River + Non-Blinding Tap/Hover Info Card */
(function () {
  var river = document.getElementById('uni-river-bg');
  var card = document.getElementById('uni-hover-card');
  if (!river || !card) return;

  var UNI_LOGOS = PF_UNI_LOGOS;  /* data/image-assets.js */

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
    { speed: 14, offset: -36, keys: ['kmitl', 'cmu', 'kku', 'su', 'swu'] },
    { speed: 16, offset: -18, keys: ['kmutt', 'cu', 'mu', 'tu', 'ku'] }
  ];

  var spacing = 84;
  var laneStates = [];

  function buildLanes() {
    var vh = window.innerHeight || 860;
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
        btn.className = 'uni-river-item p-1 no-underline';
        btn.setAttribute('data-uni', key);
        btn.setAttribute('aria-label', u.nameEn);
        btn.title = u.nameEn;
        btn.innerHTML = uniImg(key, u.nameEn, 'w-7 h-7');
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
    var vh = window.innerHeight || 860;
    var deleteStart = vh - 78;
    var resetY = vh + 10;

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
          fade = Math.max(0, (vh - item.y) / 78);
        } else if (item.y < 46) {
          fade = Math.min(1, Math.max(0, (item.y + 32) / 78));
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

  var activeBtn = null;

  function setLanePaused(btn, paused) {
    var laneEl = btn.closest('.uni-river-lane');
    for (var l = 0; l < laneStates.length; l++) {
      if (laneStates[l].el === laneEl) {
        laneStates[l].paused = paused;
      }
    }
  }

  function showUniCard(btn, pin) {
    var key = btn.getAttribute('data-uni');
    var u = UNI_DATA[key];
    if (!u) return;
    if (activeBtn && activeBtn !== btn) {
      activeBtn.classList.remove('is-active');
      setLanePaused(activeBtn, false);
    }
    activeBtn = pin ? btn : null;
    if (pin) {
      btn.classList.add('is-active');
    }
    setLanePaused(btn, true);

    var lang = document.documentElement.lang === 'en' ? 'en' : 'th';
    card.innerHTML =
      '<div class="flex items-center gap-gutter-sm">' +
        '<span class="shrink-0 inline-flex items-center justify-center w-10 h-10 p-1 rounded-full bg-surface-container-lowest border border-outline-variant">' + uniImg(key, u.nameEn, 'w-7 h-7') + '</span>' +
        '<div class="flex flex-col min-w-0">' +
          '<span class="font-headline text-title-md text-on-surface leading-snug">' + (lang === 'en' ? u.nameEn : u.nameTh) + '</span>' +
          '<span class="font-label text-label-sm text-secondary-text">' + (lang === 'en' ? u.tagEn : u.tagTh) + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="font-body text-body-sm text-on-surface-variant leading-relaxed">' + (lang === 'en' ? u.descEn : u.descTh) + '</p>' +
      '<div class="flex items-center justify-between pt-1.5 border-t border-outline-variant text-secondary-text font-label text-label-sm">' +
        '<span>' + (lang === 'en' ? 'Tap icon to visit website' : 'แตะไอคอนเพื่อเข้าเว็บไซต์หลัก') + '</span>' +
        '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">open_in_new</span>' +
      '</div>';

    var rect = btn.getBoundingClientRect();
    var cardW = 268;
    var cardH = card.offsetHeight || 160;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = Math.max(12, Math.min(vw - cardW - 12, rect.left + (rect.width / 2) - (cardW / 2)));
    var top = rect.bottom + 10;
    if (top + cardH > vh - 12) {
      top = Math.max(96, rect.top - cardH - 10);
    }

    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    card.setAttribute('aria-hidden', 'false');
    card.classList.add('is-visible');
  }

  function hideUniCard() {
    if (activeBtn) {
      activeBtn.classList.remove('is-active');
      setLanePaused(activeBtn, false);
      activeBtn = null;
    }
    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
  }

  river.addEventListener('mouseover', function (e) {
    var laneEl = e.target.closest('.uni-river-lane');
    if (laneEl) {
      for (var l = 0; l < laneStates.length; l++) {
        if (laneStates[l].el === laneEl) laneStates[l].paused = true;
      }
    }
    var item = e.target.closest('.uni-river-item[data-uni]');
    if (item && !activeBtn) showUniCard(item, false);
  });
  river.addEventListener('mouseout', function (e) {
    var item = e.target.closest('.uni-river-item[data-uni]');
    if (item && !activeBtn && (!e.relatedTarget || !item.contains(e.relatedTarget))) {
      hideUniCard();
    }
    var laneEl = e.target.closest('.uni-river-lane');
    if (laneEl && !activeBtn && (!e.relatedTarget || !laneEl.contains(e.relatedTarget))) {
      for (var l = 0; l < laneStates.length; l++) {
        if (laneStates[l].el === laneEl) laneStates[l].paused = false;
      }
    }
  });
  river.addEventListener('click', function (e) {
    var item = e.target.closest('.uni-river-item[data-uni]');
    if (!item) return;
    e.stopPropagation();
    showUniLinkToast(item.getAttribute('data-uni'));
  });

  var linkToast = document.getElementById('uni-link-toast');
  function showUniLinkToast(key) {
    var u = UNI_DATA[key];
    if (!u || !linkToast) return;
    var lang = document.documentElement.lang === 'en' ? 'en' : 'th';
    linkToast.innerHTML =
      '<div class="flex items-center justify-between gap-gutter-sm">' +
        '<div class="flex items-center gap-gutter-sm min-w-0">' +
          '<span class="shrink-0 inline-flex items-center justify-center w-8 h-8 p-1 rounded-full bg-surface-container-low border border-outline-variant">' + uniImg(key, u.nameEn, 'w-6 h-6') + '</span>' +
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
          ? 'If the preview frame blocks new tabs, copy the URL below to open in your browser.'
          : 'หากพรีวิวบล็อกการเปิดแท็บใหม่ สามารถคัดลอกลิงก์ด้านล่างไปเปิดในเบราว์เซอร์ได้ทันที') +
      '</p>' +
      '<div class="flex items-center gap-gutter-xs">' +
        '<button type="button" data-copy-uni-url="' + u.url + '" class="flex-1 inline-flex items-center justify-center gap-1.5 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-sm">' +
          '<span class="material-symbols-outlined text-[15px]" aria-hidden="true">content_copy</span>' +
          '<span>' + (lang === 'en' ? 'Copy URL' : 'คัดลอกลิงก์') + '</span>' +
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
    var uniLink = e.target.closest('[data-uni-link]');
    if (uniLink) {
      showUniLinkToast(uniLink.getAttribute('data-uni-link'));
    }
    if (activeBtn && !e.target.closest('.uni-river-item[data-uni]')) {
      hideUniCard();
    }
  });
})();

/* Pixel-Art Badges for Each Faculty & Website Section */
(function initPixelBadges() {
  var BASE = '../../images/badges/';
  var BADGE_DATA_URIS = PF_BADGE_DATA_URIS;  /* data/image-assets.js */
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
    wrap.className = 'inline-flex items-center justify-center rounded-lg bg-primary p-1 shrink-0 shadow-sm ' + (sizeClass || 'w-7 h-7');
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
    el.classList.add('flex', 'items-center', 'gap-2');
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
  attachBefore(heroCardTitle, 'laptop.png', 'w-8 h-8');

  // Page 2: Step 1-3 section headings + Step 1 interest chips
  attachBefore(document.querySelector('[data-step-panel="1"] h1'), 'ai.png', 'w-8 h-8');
  attachBefore(document.querySelector('[data-step-panel="2"] h1'), 'atom.png', 'w-8 h-8');
  attachBefore(document.querySelector('[data-step-panel="3"] h1'), 'globe.png', 'w-8 h-8');

  document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
    var k = chip.getAttribute('data-interest-key');
    if (INTEREST_BADGES[k] && !chip.querySelector('[data-pixel-badge]')) {
      var b = makeBadge(INTEREST_BADGES[k], 'w-4 h-4 rounded-sm p-0.5');
      b.setAttribute('data-pixel-badge', 'true');
      chip.appendChild(b);
    }
  });

  // Page 3: Section headings + all 6 Faculty cards
  attachBefore(document.querySelector('[data-page-view="3"] h1'), 'rocket.png', 'w-8 h-8');
  attachBefore(document.querySelector('[data-page-view="3"] h2[data-en*="Other Paths"]'), 'flask-round.png', 'w-7 h-7');

  document.querySelectorAll('[data-destination-card]').forEach(function (card) {
    var id = card.getAttribute('data-destination-card');
    var heading = card.querySelector('h2, h3');
    attachBefore(heading, FACULTY_BADGES[id] || 'laptop.png', 'w-7 h-7');
  });

  // Page 4: Locked Major title + Beyond 4.00 Edge aside
  var rmTitle = document.getElementById('roadmap-major-title');
  if (rmTitle && !document.getElementById('roadmap-major-pixel-badge')) {
    rmTitle.classList.add('flex', 'items-center', 'gap-2.5');
    var rmBadge = makeBadge(FACULTY_BADGES[PF_STATE.lockedMajorId] || 'laptop.png', 'w-8 h-8');
    rmBadge.id = 'roadmap-major-pixel-badge';
    rmTitle.insertBefore(rmBadge, rmTitle.firstChild);
  }
  var asideHeader = document.querySelector('[data-page-view="4"] aside header > span:first-child');
  if (asideHeader) {
    var icon = asideHeader.querySelector('.material-symbols-outlined');
    if (icon) icon.replaceWith(makeBadge('atom.png', 'w-6 h-6 rounded-md p-0.5'));
  }

  // Keep Page 4 badge synced when switching majors
  if (typeof window.renderRoadmap === 'function') {
    var origRender = window.renderRoadmap;
    window.renderRoadmap = function (majorId) {
      origRender(majorId);
      var id = String(majorId || PF_STATE.lockedMajorId || '1');
      var rmTitleEl = document.getElementById('roadmap-major-title');
      if (rmTitleEl) {
        rmTitleEl.classList.add('flex', 'items-center', 'gap-2.5');
        var existing = document.getElementById('roadmap-major-pixel-badge');
        if (!existing) {
          existing = makeBadge(FACULTY_BADGES[id] || 'laptop.png', 'w-8 h-8');
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
    attachBefore(document.querySelector('[data-page-view="1"] article h2'), 'laptop.png', 'w-8 h-8');
    attachBefore(document.querySelector('[data-step-panel="1"] h1'), 'ai.png', 'w-8 h-8');
    attachBefore(document.querySelector('[data-step-panel="2"] h1'), 'atom.png', 'w-8 h-8');
    attachBefore(document.querySelector('[data-step-panel="3"] h1'), 'globe.png', 'w-8 h-8');
    attachBefore(document.querySelector('[data-page-view="3"] h1'), 'rocket.png', 'w-8 h-8');
    attachBefore(document.querySelector('[data-page-view="3"] h2[data-en*="Other Paths"]'), 'flask-round.png', 'w-7 h-7');
    document.querySelectorAll('[data-destination-card]').forEach(function (card) {
      var cid = card.getAttribute('data-destination-card');
      attachBefore(card.querySelector('h2, h3'), FACULTY_BADGES[cid] || 'laptop.png', 'w-7 h-7');
    });
    document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
      var k = chip.getAttribute('data-interest-key');
      if (INTEREST_BADGES[k] && !chip.querySelector('[data-pixel-badge]')) {
        var b = makeBadge(INTEREST_BADGES[k], 'w-4 h-4 rounded-md p-0.5');
        b.setAttribute('data-pixel-badge', 'true');
        chip.appendChild(b);
      }
    });
    var rmTitleEl = document.getElementById('roadmap-major-title');
    if (rmTitleEl && !document.getElementById('roadmap-major-pixel-badge')) {
      rmTitleEl.classList.add('flex', 'items-center', 'gap-2.5');
      var rmB = makeBadge(FACULTY_BADGES[PF_STATE.lockedMajorId] || 'laptop.png', 'w-8 h-8');
      rmB.id = 'roadmap-major-pixel-badge';
      rmTitleEl.insertBefore(rmB, rmTitleEl.firstChild);
    }
  };

})();
