/* =========================================================================
 * PathFinder (Mobile Prototype) — Data Layer, Analytics, Auth & Full-Window Profile + App Bootstrap
 * Sections 4.9-4.11: PF_STORAGE, PF_ANALYTICS (Page 7), PF_AUTH, PF_PROFILE_UI, then PF_AUTH.init().
 *
 * Classic (non-module) script sharing the page's global scope. In the
 * single-file build all of this lived inside one IIFE; it now runs at
 * top level in the same order. Load order is fixed in index.html:
 *   data/image-assets.js > data/catalog.js > js/state-i18n.js >
 *   js/discovery-matches.js > js/roadmap.js > js/visualizers.js >
 *   js/sim-coach.js > js/auth-analytics-profile.js
 *
 * Depends on : all previous scripts
 * Provides   : PF_STORAGE, PF_ANALYTICS, PF_AUTH, PF_PROFILE_UI, window.PF (namespace index)
 * ========================================================================= */

/* =========================================================================
 * MODULE 1: PF_STORAGE (localStorage CRUD, SHA-256 hashing, Demo Seeding)
 * ========================================================================= */
/* [JS 4.9] Data Layer: PF_STORAGE (Users, Sessions, Plan Snapshots) */
var PF_STORAGE = window.PF_STORAGE = (function () {
  var DB_KEY = 'pathfinder_users_db';
  var SESSION_KEY = 'pathfinder_active_session';
  var memDB = {};
  var memSession = null;

  function readDB() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) {
        memDB = JSON.parse(raw);
        return memDB;
      }
      return memDB;
    } catch (e) {
      return memDB;
    }
  }

  function writeDB(db) {
    memDB = db || {};
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(memDB));
    } catch (e) {}
  }

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        memSession = JSON.parse(raw);
        return memSession;
      }
      return memSession;
    } catch (e) {
      return memSession;
    }
  }

  function writeSession(session) {
    memSession = session || null;
    try {
      if (!session) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {}
  }

  function fallbackHash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return 'fb_' + (h >>> 0).toString(16);
  }

  async function hashPassword(password, salt) {
    var input = (salt || 'pf_salt_2026') + ':' + String(password || '');
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        var buf = new TextEncoder().encode(input);
        var digest = await window.crypto.subtle.digest('SHA-256', buf);
        var arr = Array.from(new Uint8Array(digest));
        return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (e) {}
    return fallbackHash(input);
  }

  async function seedDemoUser() {
    var db = readDB();
    if (db['user_demo_01']) return db['user_demo_01'];
    var now = Date.now();
    var day = 86400000;
    var pwHash = await hashPassword('pathfinder2026', 'demo@pathfinder.ac.th');
    var demoUser = {
      userId: 'user_demo_01',
      email: 'demo@pathfinder.ac.th',
      passwordHash: pwHash,
      createdAt: new Date(now - 42 * day).toISOString(),
      lastLoginAt: new Date(now - 1 * day).toISOString(),
      profile: {
        fullName: 'Namo Wattanasak',
        nickname: 'Namo',
        grade: 'M.5',
        school: 'Triam Udom Suksa',
        targetYear: 'TCAS70',
        avatarPreset: 'rocket',
        avatarColor: '#1F3A3D',
        bio: 'Aiming for Computer Engineering & Product Design — building 3 real prototypes before M.6.'
      },
      currentPlan: {
        interests: ['tech-ai', 'product-ux', 'eng-robot'],
        gpax: 3.75,
        beyond400: true,
        targetUnis: ['cu', 'kmutt', 'tu'],
        weeklyHours: 6,
        lockedMajorId: '1',
        checkedWaypoints: {
          '1-r1-0': true,
          '1-r1-1': true,
          '1-r2-0': true,
          '1-r3-0': true
        },
        rerouteHistory: [
          { timestamp: new Date(now - 21 * day).toISOString(), mode: 'missed', note: 'Midterm exam pause (-2 weeks)' },
          { timestamp: new Date(now - 7 * day).toISOString(), mode: 'hours', note: 'Adjusted to 6 hrs/wk steady pace' }
        ]
      },
      analyticsHistory: [
        { timestamp: new Date(now - 42 * day).toISOString(), eventType: 'checkin', gpax: 3.62, readinessPct: 12, weeklyHours: 4, lockedMajorId: '1', completedCount: 1, totalCount: 8, roundBreakdown: { r1: 25, r2: 0, r3: 0, r4: 0 } },
        { timestamp: new Date(now - 34 * day).toISOString(), eventType: 'gpax_update', gpax: 3.68, readinessPct: 25, weeklyHours: 5, lockedMajorId: '1', completedCount: 2, totalCount: 8, roundBreakdown: { r1: 50, r2: 0, r3: 0, r4: 0 } },
        { timestamp: new Date(now - 26 * day).toISOString(), eventType: 'major_locked', gpax: 3.68, readinessPct: 25, weeklyHours: 5, lockedMajorId: '1', completedCount: 2, totalCount: 8, roundBreakdown: { r1: 50, r2: 0, r3: 0, r4: 0 } },
        { timestamp: new Date(now - 21 * day).toISOString(), eventType: 'reroute', gpax: 3.68, readinessPct: 38, weeklyHours: 5, lockedMajorId: '1', completedCount: 3, totalCount: 8, roundBreakdown: { r1: 50, r2: 50, r3: 0, r4: 0 } },
        { timestamp: new Date(now - 12 * day).toISOString(), eventType: 'gpax_update', gpax: 3.75, readinessPct: 38, weeklyHours: 6, lockedMajorId: '1', completedCount: 3, totalCount: 8, roundBreakdown: { r1: 50, r2: 50, r3: 0, r4: 0 } },
        { timestamp: new Date(now - 5 * day).toISOString(), eventType: 'reroute', gpax: 3.75, readinessPct: 50, weeklyHours: 6, lockedMajorId: '1', completedCount: 4, totalCount: 8, roundBreakdown: { r1: 100, r2: 50, r3: 50, r4: 0 } },
        { timestamp: new Date(now - 1 * day).toISOString(), eventType: 'waypoint_complete', gpax: 3.75, readinessPct: 50, weeklyHours: 6, lockedMajorId: '1', completedCount: 4, totalCount: 8, roundBreakdown: { r1: 100, r2: 50, r3: 50, r4: 0 } }
      ]
    };
    db['user_demo_01'] = demoUser;
    writeDB(db);
    return demoUser;
  }

  function findUserByEmail(email) {
    var db = readDB();
    var target = String(email || '').trim().toLowerCase();
    var keys = Object.keys(db);
    for (var i = 0; i < keys.length; i++) {
      if ((db[keys[i]].email || '').toLowerCase() === target) return db[keys[i]];
    }
    return null;
  }

  function getUserById(userId) {
    var db = readDB();
    return db[userId] || null;
  }

  function saveUser(user) {
    if (!user || !user.userId) return;
    var db = readDB();
    db[user.userId] = user;
    writeDB(db);
  }

  return {
    readDB: readDB,
    writeDB: writeDB,
    readSession: readSession,
    writeSession: writeSession,
    hashPassword: hashPassword,
    seedDemoUser: seedDemoUser,
    findUserByEmail: findUserByEmail,
    getUserById: getUserById,
    saveUser: saveUser
  };
})();

/* =========================================================================
 * MODULE 2: PF_ANALYTICS (Snapshot Recorder, SVG Chart, Round Breakdown, AI)
 * ========================================================================= */
/* [JS 4.10] Page 7 Engine: PF_ANALYTICS (Metrics, History, SVG Trend Chart) */
var PF_ANALYTICS = window.PF_ANALYTICS = (function () {
  var activeRange = 'all';

  function computeCurrentMetrics() {
    var checks = document.querySelectorAll('[data-waypoint-check]');
    var total = checks.length || 8;
    var done = 0;
    var rounds = { r1: { d: 0, t: 0 }, r2: { d: 0, t: 0 }, r3: { d: 0, t: 0 }, r4: { d: 0, t: 0 } };
    if (checks.length) {
      checks.forEach(function (c) {
        if (c.checked) done++;
        var key = c.getAttribute('data-wp-key') || '';
        var parts = key.split('-');
        var rk = parts[1] || 'r1';
        if (rounds[rk]) {
          rounds[rk].t++;
          if (c.checked) rounds[rk].d++;
        }
      });
    } else {
      var wp = PF_STATE.checkedWaypoints || {};
      Object.keys(wp).forEach(function (k) { if (wp[k]) done++; });
    }
    var pct = total ? Math.round((done / total) * 100) : 0;
    var rb = {
      r1: rounds.r1.t ? Math.round((rounds.r1.d / rounds.r1.t) * 100) : Math.min(100, pct + 15),
      r2: rounds.r2.t ? Math.round((rounds.r2.d / rounds.r2.t) * 100) : pct,
      r3: rounds.r3.t ? Math.round((rounds.r3.d / rounds.r3.t) * 100) : Math.max(0, pct - 10),
      r4: rounds.r4.t ? Math.round((rounds.r4.d / rounds.r4.t) * 100) : 0
    };
    return {
      gpax: Number(PF_STATE.gpax || 3.75),
      readinessPct: pct,
      weeklyHours: Number(PF_STATE.weeklyHours || 6),
      lockedMajorId: String(PF_STATE.lockedMajorId || '1'),
      completedCount: done,
      totalCount: total,
      roundBreakdown: rb
    };
  }

  function getActiveHistory() {
    var user = window.PF_AUTH ? window.PF_AUTH.getCurrentUser() : null;
    if (user && Array.isArray(user.analyticsHistory) && user.analyticsHistory.length) {
      return user.analyticsHistory;
    }
    var m = computeCurrentMetrics();
    return [
      {
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        eventType: 'checkin',
        gpax: Math.max(2.5, Number((m.gpax - 0.05).toFixed(2))),
        readinessPct: Math.max(0, m.readinessPct - 10),
        weeklyHours: m.weeklyHours,
        lockedMajorId: m.lockedMajorId,
        completedCount: Math.max(0, m.completedCount - 1),
        totalCount: m.totalCount,
        roundBreakdown: m.roundBreakdown
      },
      Object.assign({ timestamp: new Date().toISOString(), eventType: 'checkin' }, m)
    ];
  }

  function recordSnapshot(eventType) {
    var user = window.PF_AUTH ? window.PF_AUTH.getCurrentUser() : null;
    if (!user) return null;
    var m = computeCurrentMetrics();
    var snap = Object.assign({ timestamp: new Date().toISOString(), eventType: eventType || 'checkin' }, m);
    user.analyticsHistory = user.analyticsHistory || [];
    user.analyticsHistory.push(snap);
    user.currentPlan = {
      interests: (PF_STATE.interests || []).slice(),
      gpax: Number(PF_STATE.gpax || 3.75),
      beyond400: !!PF_STATE.beyond400,
      targetUnis: (PF_STATE.targetUnis || []).slice(),
      weeklyHours: Number(PF_STATE.weeklyHours || 6),
      lockedMajorId: String(PF_STATE.lockedMajorId || '1'),
      checkedWaypoints: Object.assign({}, PF_STATE.checkedWaypoints || {}),
      rerouteHistory: (user.currentPlan && user.currentPlan.rerouteHistory) ? user.currentPlan.rerouteHistory : []
    };
    PF_STORAGE.saveUser(user);
    if (PF_STATE.page === '7') render();
    return snap;
  }

  function filterByRange(history) {
    if (activeRange === 'all') return history;
    var days = activeRange === '7d' ? 7 : 30;
    var cutoff = Date.now() - days * 86400000;
    var filtered = history.filter(function (pt) { return new Date(pt.timestamp).getTime() >= cutoff; });
    return filtered.length ? filtered : history.slice(-2);
  }

  function formatShortDate(iso, lang) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric' });
  }

  function eventLabel(type, lang) {
    var map = {
      waypoint_complete: { th: 'ทำ Milestone สำเร็จ', en: 'Milestone Completed' },
      gpax_update: { th: 'อัปเดต GPAX', en: 'GPAX Updated' },
      major_locked: { th: 'ล็อกคณะเป้าหมาย', en: 'Major Locked' },
      reroute: { th: 'ปรับเส้นทางแผนใหม่', en: 'Plan Rerouted' },
      checkin: { th: 'บันทึกความคืบหน้า', en: 'Progress Check-in' }
    };
    var entry = map[type] || map.checkin;
    return entry[lang] || entry.en;
  }

  function renderSVGChart(points, lang) {
    var svg = document.getElementById('analytics-trend-svg');
    var tooltip = document.getElementById('analytics-chart-tooltip');
    if (!svg) return;
    var W = 640, H = 240;
    var padL = 42, padR = 20, padT = 20, padB = 34;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    var gridHtml = '';
    [0, 25, 50, 75, 100].forEach(function (val) {
      var y = padT + plotH - (val / 100) * plotH;
      gridHtml += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#E2DFD7" stroke-dasharray="3 3" stroke-width="1" />';
      gridHtml += '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#687373" font-size="11" font-family="JetBrains Mono, monospace">' + val + '%</text>';
    });

    if (!points.length) {
      svg.innerHTML = gridHtml;
      return;
    }

    var coords = points.map(function (pt, idx) {
      var x = points.length === 1 ? padL + plotW / 2 : padL + (idx / (points.length - 1)) * plotW;
      var rY = padT + plotH - (Math.max(0, Math.min(100, pt.readinessPct || 0)) / 100) * plotH;
      var gNorm = Math.max(0, Math.min(100, ((Number(pt.gpax || 3.0) - 2.0) / 2.0) * 100));
      var gY = padT + plotH - (gNorm / 100) * plotH;
      return { x: x, rY: rY, gY: gY, pt: pt };
    });

    var rLine = coords.map(function (c, i) { return (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ',' + c.rY.toFixed(1); }).join(' ');
    var rArea = rLine + ' L' + coords[coords.length - 1].x.toFixed(1) + ',' + (padT + plotH) + ' L' + coords[0].x.toFixed(1) + ',' + (padT + plotH) + ' Z';
    var gLine = coords.map(function (c, i) { return (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ',' + c.gY.toFixed(1); }).join(' ');

    var labelsHtml = coords.map(function (c, idx) {
      if (coords.length > 6 && idx % 2 !== 0 && idx !== coords.length - 1) return '';
      return '<text x="' + c.x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#687373" font-size="11" font-family="JetBrains Mono, monospace">' + formatShortDate(c.pt.timestamp, lang) + '</text>';
    }).join('');

    var dotsHtml = coords.map(function (c, idx) {
      return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.gY.toFixed(1) + '" r="4" fill="#D98A4E" stroke="#FAF9F6" stroke-width="1.5" />' +
        '<circle data-chart-idx="' + idx + '" cx="' + c.x.toFixed(1) + '" cy="' + c.rY.toFixed(1) + '" r="6" fill="#1F3A3D" stroke="#B8F25C" stroke-width="2" class="cursor-pointer" />';
    }).join('');

    svg.innerHTML =
      '<defs><linearGradient id="pfReadinessGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#1F3A3D" stop-opacity="0.22"/>' +
        '<stop offset="100%" stop-color="#1F3A3D" stop-opacity="0.01"/>' +
      '</linearGradient></defs>' +
      gridHtml +
      '<path d="' + rArea + '" fill="url(#pfReadinessGrad)" />' +
      '<path d="' + gLine + '" fill="none" stroke="#D98A4E" stroke-width="2.5" stroke-dasharray="6 4" stroke-linecap="round" />' +
      '<path d="' + rLine + '" fill="none" stroke="#1F3A3D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />' +
      labelsHtml + dotsHtml;

    svg.querySelectorAll('[data-chart-idx]').forEach(function (dot) {
      var showTip = function () {
        if (!tooltip) return;
        var i = Number(dot.getAttribute('data-chart-idx'));
        var c = coords[i];
        if (!c) return;
        tooltip.innerHTML =
          '<div class="font-title">' + formatShortDate(c.pt.timestamp, lang) + ' • ' + eventLabel(c.pt.eventType, lang) + '</div>' +
          '<div class="font-metric mt-0.5">' + (lang === 'th' ? 'ความพร้อม: ' : 'Readiness: ') + c.pt.readinessPct + '% | GPAX: ' + Number(c.pt.gpax).toFixed(2) + '</div>';
        tooltip.style.left = Math.min(62, Math.max(4, (c.x / W) * 100)) + '%';
        tooltip.style.top = Math.max(0, (c.rY / H) * 100 - 26) + '%';
        tooltip.classList.remove('hidden');
      };
      dot.addEventListener('mouseenter', showTip);
      dot.addEventListener('click', showTip);
      dot.addEventListener('mouseleave', function () {
        if (tooltip) tooltip.classList.add('hidden');
      });
    });
  }

  function render() {
    var lang = PF_STATE.lang || 'th';
    var user = window.PF_AUTH ? window.PF_AUTH.getCurrentUser() : null;
    var history = getActiveHistory();
    var filtered = filterByRange(history);
    var latest = history[history.length - 1] || computeCurrentMetrics();
    var first = history[0] || latest;
    var prev = history.length > 1 ? history[history.length - 2] : latest;

    var userPill = document.getElementById('analytics-user-pill');
    if (userPill) {
      userPill.textContent = user
        ? (user.profile.nickname + ' • ' + (lang === 'th' ? user.profile.grade.replace('M.', 'ม.') : user.profile.grade))
        : (lang === 'th' ? 'โหมดผู้เยี่ยมชม' : 'Guest Mode');
    }

    var rDelta = (latest.readinessPct || 0) - (prev.readinessPct || 0);
    var gDelta = Number((latest.gpax - first.gpax).toFixed(2));
    var rEl = document.getElementById('analytics-kpi-readiness');
    var rDeltaEl = document.getElementById('analytics-kpi-readiness-delta');
    var gEl = document.getElementById('analytics-kpi-gpax');
    var gDeltaEl = document.getElementById('analytics-kpi-gpax-delta');
    var vEl = document.getElementById('analytics-kpi-velocity');
    var vSubEl = document.getElementById('analytics-kpi-velocity-sub');
    var fitEl = document.getElementById('analytics-kpi-fit');
    var fitMajEl = document.getElementById('analytics-kpi-fit-major');

    if (rEl) rEl.textContent = (latest.readinessPct || 0) + '%';
    if (rDeltaEl) rDeltaEl.textContent = (rDelta >= 0 ? '+' : '') + rDelta + '%';
    if (gEl) gEl.textContent = Number(latest.gpax || 3.75).toFixed(2);
    if (gDeltaEl) gDeltaEl.textContent = (gDelta >= 0 ? '+' : '') + gDelta.toFixed(2);
    if (vEl) vEl.textContent = (latest.weeklyHours || 6) + (lang === 'th' ? ' ชม./wk' : ' hrs/wk');
    if (vSubEl) vSubEl.textContent = (latest.completedCount || 0) + ' / ' + (latest.totalCount || 8);

    var fitScore = (Number(latest.gpax || 3.75) >= 3.5 && (latest.readinessPct || 0) >= 40) ? 'High' : (Number(latest.gpax || 3.75) >= 3.2 ? 'Strong' : 'Building');
    var fitThMap = { High: 'สูงมาก', Strong: 'แข็งแกร่ง', Building: 'กำลังสร้าง' };
    if (fitEl) fitEl.textContent = lang === 'th' ? fitThMap[fitScore] : fitScore;
    var majorTitleEl = document.getElementById('roadmap-major-title');
    if (fitMajEl) fitMajEl.textContent = majorTitleEl ? majorTitleEl.textContent : 'Comp Eng';

    renderSVGChart(filtered, lang);

    var rb = latest.roundBreakdown || { r1: 50, r2: 33, r3: 25, r4: 0 };
    var roundBarsEl = document.getElementById('analytics-round-bars');
    if (roundBarsEl) {
      var roundsMeta = [
        { k: 'r1', th: 'รอบ 1 Portfolio', en: 'Round 1 Portfolio', color: 'bg-primary' },
        { k: 'r2', th: 'รอบ 2 Quota', en: 'Round 2 Quota', color: 'bg-secondary' },
        { k: 'r3', th: 'รอบ 3 Admission', en: 'Round 3 Admission', color: 'bg-primary' },
        { k: 'r4', th: 'รอบ 4 รับตรงอิสระ', en: 'Round 4 Direct', color: 'bg-secondary' }
      ];
      roundBarsEl.innerHTML = roundsMeta.map(function (rm) {
        var val = Math.max(0, Math.min(100, rb[rm.k] || 0));
        return '<div class="flex flex-col gap-1">' +
          '<div class="flex items-center justify-between font-label text-label-sm">' +
            '<span class="text-on-surface">' + (lang === 'th' ? rm.th : rm.en) + '</span>' +
            '<span class="font-metric text-secondary-text tabular-nums">' + val + '%</span>' +
          '</div>' +
          '<div class="w-full h-2 rounded-full bg-surface-container-low overflow-hidden border border-outline-variant/50">' +
            '<div class="h-full rounded-full ' + rm.color + '" style="width:' + val + '%"></div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var insightsEl = document.getElementById('analytics-ai-insights');
    if (insightsEl) {
      var rGain = (latest.readinessPct || 0) - (first.readinessPct || 0);
      var weakest = 'r3';
      if ((rb.r2 || 0) < (rb[weakest] || 0)) weakest = 'r2';
      if ((rb.r1 || 0) < (rb[weakest] || 0)) weakest = 'r1';
      var weakName = weakest === 'r1' ? (lang === 'th' ? 'รอบ 1 Portfolio' : 'Round 1 Portfolio')
        : (weakest === 'r2' ? (lang === 'th' ? 'รอบ 2 Quota' : 'Round 2 Quota') : (lang === 'th' ? 'รอบ 3 Admission' : 'Round 3 Admission'));
      var cards = [
        {
          icon: 'trending_up',
          th: 'ความพร้อมรวมเพิ่มขึ้น +' + Math.max(0, rGain) + '% และ GPAX ขยับ ' + (gDelta >= 0 ? '+' : '') + gDelta.toFixed(2),
          en: 'Readiness grew +' + Math.max(0, rGain) + '% with ' + (gDelta >= 0 ? '+' : '') + gDelta.toFixed(2) + ' GPAX.'
        },
        {
          icon: 'target',
          th: 'จุดที่ควรเสริมถัดไป: ' + weakName,
          en: 'Next priority: focus on ' + weakName + '.'
        }
      ];
      insightsEl.innerHTML = cards.map(function (c) {
        return '<div class="p-gutter-sm rounded-xl bg-surface-container-lowest border border-outline-variant flex items-start gap-2">' +
          '<span class="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">' + c.icon + '</span>' +
          '<p class="font-body text-body-md text-on-surface">' + (lang === 'th' ? c.th : c.en) + '</p>' +
        '</div>';
      }).join('');
    }

    var logEl = document.getElementById('analytics-activity-log');
    var countEl = document.getElementById('analytics-log-count');
    if (countEl) countEl.textContent = String(history.length);
    if (logEl) {
      logEl.innerHTML = history.slice().reverse().map(function (item) {
        return '<div class="p-gutter-xs rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between gap-2">' +
          '<div class="flex flex-col">' +
            '<span class="font-title text-title-md text-on-surface">' + eventLabel(item.eventType, lang) + '</span>' +
            '<span class="font-label text-label-sm text-on-surface-variant">' + formatShortDate(item.timestamp, lang) + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-1.5 shrink-0">' +
            '<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + item.readinessPct + '%</span>' +
            '<span class="px-2 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-metric text-label-sm text-on-surface tabular-nums">' + Number(item.gpax).toFixed(2) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  document.querySelectorAll('[data-analytics-range]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeRange = btn.getAttribute('data-analytics-range') || 'all';
      document.querySelectorAll('[data-analytics-range]').forEach(function (b) {
        var active = b.getAttribute('data-analytics-range') === activeRange;
        b.classList.toggle('bg-primary', active);
        b.classList.toggle('text-on-primary', active);
        b.classList.toggle('text-on-surface-variant', !active);
      });
      render();
    });
  });

  return { computeCurrentMetrics: computeCurrentMetrics, recordSnapshot: recordSnapshot, render: render };
})();

/* =========================================================================
 * MODULE 3: PF_AUTH (Login, Sign Up, Demo, Logout, Guest Migration)
 * ========================================================================= */
/* =====================================================================
 * BACKEND & FRONTEND DEVELOPER GUIDE — PF_AUTH & STATE INTEGRATION
 * =====================================================================
 * 1. CURRENT PROTOTYPE STORAGE (replace with fetch() for production):
 *    - localStorage['pf_users_v1']   : Registered user records
 *    - localStorage['pf_session_v1'] : Active session { userId, token }
 *    - localStorage['pf_state_v1']   : Saved TCAS plan, scores, & matches
 *
 * 2. BACKEND API ENDPOINTS TO WIRE INSIDE PF_AUTH METHODS:
 *    - PF_AUTH.login(email, password, remember)
 *        -> POST /api/auth/login { email, password, remember }
 *        <- { ok: true, user: { id, fullName, nickname, email, grade, school, avatarId, targetYear }, token }
 *    - PF_AUTH.signup(payload)
 *        -> POST /api/auth/signup { fullName, nickname, email, phone, password, grade, school, avatarId }
 *        <- { ok: true, user, token }
 *    - PF_AUTH.socialLogin('google')
 *        -> Redirect or popup OAuth2 -> GET/POST /api/auth/oauth/google
 *    - PF_AUTH.resetPassword(email, newPassword)
 *        -> POST /api/auth/reset-password { email, newPassword }
 *    - PF_AUTH.updateProfile(updates)
 *        -> PUT /api/user/profile { fullName, nickname, grade, school, targetYear, avatarId }
 *
 * 3. FRONTEND FLOW HOOKS:
 *    - goToPage('hero'|'intake'|'matches'|'roadmap') switches pages & refreshes badges
 *    - setLang('th'|'en') updates all [data-th]/[data-en] elements
 *    - initCurvedDropdowns() binds custom curved dropdowns on [data-pf-dropdown]
 * ===================================================================== */
/* [JS 4.11] Auth & Profile Layer: PF_AUTH & PF_PROFILE_UI */
var PF_AUTH = window.PF_AUTH = (function () {
  var currentUser = null;

  function showToast(thMsg, enMsg) {
    var toast = document.getElementById('pf-toast');
    var txt = document.getElementById('pf-toast-text');
    if (!toast || !txt) return;
    txt.textContent = (PF_STATE.lang === 'th' ? thMsg : enMsg);
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.classList.add('hidden'); }, 2600);
  }

  function hydrateUserPlan(user) {
    if (!user) return;
    var p = user.currentPlan || {};
    if (Array.isArray(p.interests) && p.interests.length) PF_STATE.interests = p.interests.slice();
    if (p.gpax) PF_STATE.gpax = Number(p.gpax);
    if (typeof p.beyond400 === 'boolean') PF_STATE.beyond400 = p.beyond400;
    if (Array.isArray(p.targetUnis)) PF_STATE.targetUnis = p.targetUnis.slice();
    if (p.weeklyHours) PF_STATE.weeklyHours = Number(p.weeklyHours);
    if (p.lockedMajorId) PF_STATE.lockedMajorId = String(p.lockedMajorId);
    if (p.checkedWaypoints) PF_STATE.checkedWaypoints = Object.assign({}, p.checkedWaypoints);
    if (user.profile && user.profile.grade) PF_STATE.grade = user.profile.grade;

    if (typeof syncMajorMatches === 'function') syncMajorMatches();
    if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
    if (typeof window.updateFloatingCoachInsight === 'function') window.updateFloatingCoachInsight();
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
    if (window.PF_ANALYTICS) window.PF_ANALYTICS.render();
  }

  async function login(email, password, rememberMe) {
    var user = PF_STORAGE.findUserByEmail(email);
    if (!user) return { ok: false, th: 'ไม่พบบัญชีอีเมลนี้', en: 'Account not found' };
    var hash = await PF_STORAGE.hashPassword(password, user.email.toLowerCase());
    if (hash !== user.passwordHash) return { ok: false, th: 'รหัสผ่านไม่ถูกต้อง', en: 'Incorrect password' };
    user.lastLoginAt = new Date().toISOString();
    PF_STORAGE.saveUser(user);
    currentUser = user;
    PF_STORAGE.writeSession({ userId: user.userId, loginAt: user.lastLoginAt, rememberMe: !!rememberMe });
    hydrateUserPlan(user);
    showToast('ยินดีต้อนรับ, ' + user.profile.nickname + '!', 'Welcome back, ' + user.profile.nickname + '!');
    return { ok: true, user: user };
  }

  async function loginDemo() {
    var demo = await PF_STORAGE.seedDemoUser();
    demo.lastLoginAt = new Date().toISOString();
    PF_STORAGE.saveUser(demo);
    currentUser = demo;
    PF_STORAGE.writeSession({ userId: demo.userId, loginAt: demo.lastLoginAt, rememberMe: true });
    hydrateUserPlan(demo);
    showToast('เข้าสู่ระบบด้วยบัญชีตัวอย่าง (Namo) แล้ว', 'Signed in as Demo Student (Namo)!');
    return { ok: true, user: demo };
  }

  async function signup(payload) {
    var email = String(payload.email || '').trim().toLowerCase();
    if (!email || PF_STORAGE.findUserByEmail(email)) {
      return { ok: false, th: 'อีเมลนี้ถูกใช้งานแล้ว', en: 'Email already exists or invalid' };
    }
    var hash = await PF_STORAGE.hashPassword(payload.password, email);
    var nowIso = new Date().toISOString();
    var metrics = PF_ANALYTICS.computeCurrentMetrics();
    var userId = 'user_' + Date.now();
    var newUser = {
      userId: userId,
      email: email,
      passwordHash: hash,
      createdAt: nowIso,
      lastLoginAt: nowIso,
      profile: {
        fullName: payload.fullName || payload.nickname || 'Student',
        nickname: payload.nickname || 'Student',
        grade: payload.grade || PF_STATE.grade || 'M.5',
        school: payload.school || '',
        targetYear: 'TCAS70',
        avatarPreset: payload.avatarPreset || 'rocket',
        avatarColor: payload.avatarColor || '#1F3A3D',
        bio: ''
      },
      currentPlan: {
        interests: (PF_STATE.interests || []).slice(),
        gpax: Number(PF_STATE.gpax || 3.75),
        beyond400: !!PF_STATE.beyond400,
        targetUnis: (PF_STATE.targetUnis || []).slice(),
        weeklyHours: Number(PF_STATE.weeklyHours || 6),
        lockedMajorId: String(PF_STATE.lockedMajorId || '1'),
        checkedWaypoints: Object.assign({}, PF_STATE.checkedWaypoints || {}),
        rerouteHistory: []
      },
      analyticsHistory: [Object.assign({ timestamp: nowIso, eventType: 'checkin' }, metrics)]
    };
    PF_STORAGE.saveUser(newUser);
    currentUser = newUser;
    PF_STORAGE.writeSession({ userId: userId, loginAt: nowIso, rememberMe: true });
    hydrateUserPlan(newUser);
    showToast('สร้างบัญชีและบันทึกแผนแล้ว!', 'Account created & plan saved!');
    return { ok: true, user: newUser };
  }

  function logout() {
    currentUser = null;
    PF_STORAGE.writeSession(null);
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
    if (window.PF_ANALYTICS) window.PF_ANALYTICS.render();
    showToast('ออกจากระบบแล้ว', 'Logged out safely');
  }

  async function init() {
    await PF_STORAGE.seedDemoUser();
    var sess = PF_STORAGE.readSession();
    if (sess && sess.userId) {
      var u = PF_STORAGE.getUserById(sess.userId);
      if (u) { currentUser = u; hydrateUserPlan(u); }
    }
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
  }

  return { init: init, login: login, loginDemo: loginDemo, signup: signup, logout: logout, showToast: showToast, getCurrentUser: function () { return currentUser; } };
})();

/* =========================================================================
 * MODULE 4: PF_PROFILE_UI (Avatar Studio, Modals, Header Dropdown)
 * ========================================================================= */
var PF_PROFILE_UI = window.PF_PROFILE_UI = (function () {
  var AVATAR_PRESETS = [
    { id: 'rocket', icon: 'rocket_launch', label: 'Rocket' },
    { id: 'compass', icon: 'explore', label: 'Compass' },
    { id: 'terminal', icon: 'terminal', label: 'Code' },
    { id: 'microscope', icon: 'biotech', label: 'Science' },
    { id: 'palette', icon: 'palette', label: 'Design' },
    { id: 'brain', icon: 'psychology', label: 'AI/Mind' },
    { id: 'gradcap', icon: 'school', label: 'Scholar' },
    { id: 'star', icon: 'auto_awesome', label: 'Star' }
  ];
  var AVATAR_COLORS = ['#1F3A3D', '#6B9080', '#D98A4E', '#C94B77', '#B8860B', '#4F46E5'];
  var AVATAR_FRAME_COLORS = ['#6B9080', '#D98A4E', '#B8F25C', '#1F3A3D', '#C94B77', '#EAB308'];
  var signupAvatarPreset = 'rocket';
  var draftAvatarPreset = 'rocket';
  var draftAvatarColor = '#1F3A3D';
  var draftAvatarFrameColor = '#6B9080';
  var draftAvatarImage = '';

  function getPresetIcon(id) {
    var found = AVATAR_PRESETS.find(function (a) { return a.id === id; });
    return found ? found.icon : 'rocket_launch';
  }

  function isLightHex(hex) {
    if (!hex || hex.charAt(0) !== '#' || hex.length < 7) return false;
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 165;
  }

  function renderAvatarBadge(el, preset, color, sizePx, frameColor, imageSrc) {
    if (!el) return;
    var bg = color || '#1F3A3D';
    var ring = frameColor || '#6B9080';
    el.style.backgroundColor = bg;
    el.style.color = isLightHex(bg) ? '#1F3A3D' : '#FAF9F6';
    el.style.border = '2.5px solid ' + ring;
    el.style.overflow = 'hidden';
    if (imageSrc) {
      el.innerHTML = '<img src="' + imageSrc + '" alt="Avatar" class="w-full h-full object-cover rounded-full" />';
    } else {
      el.innerHTML = '<span class="material-symbols-outlined" style="font-size:' + (sizePx || 15) + 'px;" aria-hidden="true">' + getPresetIcon(preset) + '</span>';
    }
  }

  function refreshHeader() {
    var user = PF_AUTH.getCurrentUser();
    var lang = PF_STATE.lang || 'th';
    var openAuthBtn = document.getElementById('open-auth-btn');
    var profileWrap = document.getElementById('user-profile-wrap');
    var guestBanner = document.getElementById('guest-save-banner');

    if (user) {
      if (openAuthBtn) openAuthBtn.classList.add('hidden');
      if (profileWrap) profileWrap.classList.remove('hidden');
      if (guestBanner) guestBanner.classList.add('hidden');
      var gradeTxt = lang === 'th' ? user.profile.grade.replace('M.', 'ม.') : user.profile.grade;
      var lbl = document.getElementById('header-user-label');
      var dName = document.getElementById('dropdown-user-name');
      var dEmail = document.getElementById('dropdown-user-email');
      if (lbl) lbl.textContent = user.profile.nickname + ' • ' + gradeTxt;
      if (dName) dName.textContent = user.profile.fullName || user.profile.nickname;
      if (dEmail) dEmail.textContent = user.email;
      renderAvatarBadge(
        document.getElementById('header-avatar-badge'),
        user.profile.avatarPreset,
        user.profile.avatarColor,
        15,
        user.profile.avatarFrameColor,
        user.profile.avatarImage
      );
    } else {
      if (openAuthBtn) openAuthBtn.classList.remove('hidden');
      if (profileWrap) profileWrap.classList.add('hidden');
      if (guestBanner && !guestBanner.getAttribute('data-dismissed')) guestBanner.classList.remove('hidden');
    }
  }

  function openAuthModal(defaultTab) {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;
    switchAuthTab(defaultTab || 'login');
    var err = document.getElementById('auth-error-msg');
    if (err) err.classList.add('hidden');
    modal.classList.remove('hidden');
  }

  function closeAuthModal() {
    var modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchAuthTab(tab) {
    var loginForm = document.getElementById('auth-login-form');
    var signupForm = document.getElementById('auth-signup-form');
    var titleEl = document.getElementById('auth-modal-title');
    var subEl = document.getElementById('auth-modal-subtitle');
    var forgotPanel = document.getElementById('auth-forgot-panel');
    var lang = PF_STATE.lang || 'th';
    document.querySelectorAll('[role="tab"][data-auth-tab]').forEach(function (b) {
      var active = b.getAttribute('data-auth-tab') === tab;
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.classList.toggle('bg-primary', active);
      b.classList.toggle('text-on-primary', active);
      b.classList.toggle('text-on-surface-variant', !active);
    });
    if (titleEl) {
      titleEl.setAttribute('data-th', tab === 'signup' ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ');
      titleEl.setAttribute('data-en', tab === 'signup' ? 'Create Account' : 'Login');
      titleEl.textContent = titleEl.getAttribute('data-' + lang);
    }
    if (subEl) {
      subEl.setAttribute('data-th', tab === 'signup' ? 'กรอกข้อมูลด้านล่าง หรือเข้าสู่ระบบด้วยบัญชีโซเชียล' : 'ยินดีต้อนรับกลับมา! กรุณาเข้าสู่ระบบเพื่อใช้งานต่อ');
      subEl.setAttribute('data-en', tab === 'signup' ? 'Enter your information below or continue with social media account.' : 'Welcome back! Please login to continue.');
      subEl.textContent = subEl.getAttribute('data-' + lang);
    }
    if (forgotPanel) forgotPanel.classList.add('hidden');
    if (loginForm) loginForm.classList.toggle('hidden', tab !== 'login');
    if (signupForm) signupForm.classList.toggle('hidden', tab !== 'signup');
  }

  function renderSignupAvatarPicker() {
    var wrap = document.getElementById('signup-avatar-picker');
    if (!wrap) return;
    wrap.innerHTML = AVATAR_PRESETS.map(function (a) {
      var active = a.id === signupAvatarPreset;
      return '<button type="button" data-signup-avatar="' + a.id + '" aria-label="' + a.label + '" class="w-8 h-8 rounded-full flex items-center justify-center border ' + (active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface border-outline-variant') + '">' +
        '<span class="material-symbols-outlined text-[16px]" aria-hidden="true">' + a.icon + '</span>' +
      '</button>';
    }).join('');
    wrap.querySelectorAll('[data-signup-avatar]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        signupAvatarPreset = btn.getAttribute('data-signup-avatar');
        renderSignupAvatarPicker();
      });
    });
  }

  function renderProfileStudio() {
    var iconsWrap = document.getElementById('profile-avatar-icons');
    var colorsWrap = document.getElementById('profile-avatar-colors');
    var framesWrap = document.getElementById('profile-frame-colors');
    var removeBtn = document.getElementById('prof-remove-avatar-img-btn');
    var bgWheel = document.getElementById('prof-bg-color-wheel');
    var bgHex = document.getElementById('prof-bg-color-hex');
    var frameWheel = document.getElementById('prof-frame-color-wheel');
    var frameHex = document.getElementById('prof-frame-color-hex');

    renderAvatarBadge(document.getElementById('profile-preview-avatar'), draftAvatarPreset, draftAvatarColor, 20, draftAvatarFrameColor, draftAvatarImage);
    if (removeBtn) removeBtn.classList.toggle('hidden', !draftAvatarImage);
    if (bgWheel) bgWheel.value = draftAvatarColor;
    if (bgHex) bgHex.textContent = draftAvatarColor.toUpperCase();
    if (frameWheel) frameWheel.value = draftAvatarFrameColor;
    if (frameHex) frameHex.textContent = draftAvatarFrameColor.toUpperCase();

    if (iconsWrap) {
      iconsWrap.innerHTML = AVATAR_PRESETS.map(function (a) {
        var active = !draftAvatarImage && a.id === draftAvatarPreset;
        return '<button type="button" data-prof-icon="' + a.id + '" aria-label="' + a.label + '" class="w-9 h-9 rounded-full flex items-center justify-center border ' + (active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-outline-variant') + '">' +
          '<span class="material-symbols-outlined text-[18px]" aria-hidden="true">' + a.icon + '</span>' +
        '</button>';
      }).join('');
      iconsWrap.querySelectorAll('[data-prof-icon]').forEach(function (b) {
        b.addEventListener('click', function () {
          draftAvatarPreset = b.getAttribute('data-prof-icon');
          draftAvatarImage = '';
          renderProfileStudio();
        });
      });
    }
    if (colorsWrap) {
      colorsWrap.innerHTML = AVATAR_COLORS.map(function (col) {
        var active = col.toLowerCase() === draftAvatarColor.toLowerCase();
        return '<button type="button" data-prof-color="' + col + '" aria-label="Color ' + col + '" class="w-7 h-7 rounded-full border-2 ' + (active ? 'border-on-surface scale-110' : 'border-transparent') + '" style="background:' + col + '"></button>';
      }).join('');
      colorsWrap.querySelectorAll('[data-prof-color]').forEach(function (b) {
        b.addEventListener('click', function () {
          draftAvatarColor = b.getAttribute('data-prof-color');
          renderProfileStudio();
        });
      });
    }
    if (framesWrap) {
      framesWrap.innerHTML = AVATAR_FRAME_COLORS.map(function (col) {
        var active = col.toLowerCase() === draftAvatarFrameColor.toLowerCase();
        return '<button type="button" data-prof-frame-color="' + col + '" aria-label="Frame color ' + col + '" class="w-7 h-7 rounded-full border-2 ' + (active ? 'border-on-surface scale-110' : 'border-transparent') + '" style="background:' + col + '"></button>';
      }).join('');
      framesWrap.querySelectorAll('[data-prof-frame-color]').forEach(function (b) {
        b.addEventListener('click', function () {
          draftAvatarFrameColor = b.getAttribute('data-prof-frame-color');
          renderProfileStudio();
        });
      });
    }
  }

  function openProfileModal() {
    var user = PF_AUTH.getCurrentUser();
    if (!user) { openAuthModal('login'); return; }
    var modal = document.getElementById('profile-modal');
    if (!modal) return;
    draftAvatarPreset = user.profile.avatarPreset || 'rocket';
    draftAvatarColor = user.profile.avatarColor || '#1F3A3D';
    draftAvatarFrameColor = user.profile.avatarFrameColor || '#6B9080';
    draftAvatarImage = user.profile.avatarImage || '';
    document.getElementById('profile-email-readout').textContent = user.email;
    document.getElementById('prof-fullname').value = user.profile.fullName || '';
    document.getElementById('prof-nickname').value = user.profile.nickname || '';
    document.getElementById('prof-grade').value = user.profile.grade || 'M.5';
    document.getElementById('prof-target-year').value = user.profile.targetYear || 'TCAS70';
    document.getElementById('prof-school').value = user.profile.school || '';
    document.getElementById('prof-bio').value = user.profile.bio || '';
    document.getElementById('prof-json-preview-wrap').classList.add('hidden');
    renderProfileStudio();
    modal.classList.remove('hidden');
  }

  var openAuthBtn = document.getElementById('open-auth-btn');
  var bannerAuthBtn = document.getElementById('banner-open-auth-btn');
  var dismissBannerBtn = document.getElementById('dismiss-guest-banner-btn');
  var closeAuthBtn = document.getElementById('close-auth-btn');
  var demoLoginBtn = document.getElementById('demo-login-btn');
  var loginForm = document.getElementById('auth-login-form');
  var signupForm = document.getElementById('auth-signup-form');
  var triggerBtn = document.getElementById('user-profile-trigger');
  var dropdown = document.getElementById('user-menu-dropdown');

  if (openAuthBtn) openAuthBtn.addEventListener('click', function () { openAuthModal('login'); });
  if (bannerAuthBtn) bannerAuthBtn.addEventListener('click', function () { openAuthModal('login'); });
  if (dismissBannerBtn) {
    dismissBannerBtn.addEventListener('click', function () {
      var b = document.getElementById('guest-save-banner');
      if (b) { b.setAttribute('data-dismissed', '1'); b.classList.add('hidden'); }
    });
  }
  if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuthModal);

  document.querySelectorAll('[data-auth-tab]').forEach(function (tabBtn) {
    tabBtn.addEventListener('click', function () { switchAuthTab(tabBtn.getAttribute('data-auth-tab')); });
  });
  document.querySelectorAll('[data-toggle-pw]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var inp = document.getElementById(btn.getAttribute('data-toggle-pw'));
      if (!inp) return;
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      var ic = btn.querySelector('.material-symbols-outlined');
      if (ic) ic.textContent = show ? 'visibility_off' : 'visibility';
    });
  });

  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', async function () {
      await PF_AUTH.loginDemo();
      closeAuthModal();
    });
  }
  async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    var res = await PF_AUTH.login(document.getElementById('login-email').value, document.getElementById('login-password').value, document.getElementById('login-remember').checked);
    var err = document.getElementById('auth-error-msg');
    if (!res.ok) {
      if (err) { err.textContent = PF_STATE.lang === 'th' ? res.th : res.en; err.classList.remove('hidden'); }
      return;
    }
    closeAuthModal();
  }
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  var loginSubmitBtn = document.getElementById('auth-login-submit-btn');
  if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', handleLoginSubmit);

  async function handleSignupSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    var res = await PF_AUTH.signup({
      fullName: document.getElementById('signup-fullname').value,
      nickname: document.getElementById('signup-nickname').value,
      email: document.getElementById('signup-email').value,
      password: document.getElementById('signup-password').value,
      grade: document.getElementById('signup-grade').value,
      school: document.getElementById('signup-school').value,
      avatarPreset: signupAvatarPreset,
      avatarColor: '#1F3A3D'
    });
    var err = document.getElementById('auth-error-msg');
    if (!res.ok) {
      if (err) { err.textContent = PF_STATE.lang === 'th' ? res.th : res.en; err.classList.remove('hidden'); }
      return;
    }
    closeAuthModal();
  }
  if (signupForm) signupForm.addEventListener('submit', handleSignupSubmit);
  var signupSubmitBtn = document.getElementById('auth-signup-submit-btn');
  if (signupSubmitBtn) signupSubmitBtn.addEventListener('click', handleSignupSubmit);

  var forgotBtn = document.getElementById('auth-forgot-btn');
  var forgotPanel = document.getElementById('auth-forgot-panel');
  var forgotCancelBtn = document.getElementById('forgot-cancel-btn');
  var forgotConfirmBtn = document.getElementById('forgot-confirm-btn');
  if (forgotBtn && forgotPanel) {
    forgotBtn.addEventListener('click', function () {
      forgotPanel.classList.toggle('hidden');
      var loginEmailEl = document.getElementById('login-email');
      var forgotEmailEl = document.getElementById('forgot-email');
      if (forgotEmailEl && loginEmailEl && loginEmailEl.value.trim()) {
        forgotEmailEl.value = loginEmailEl.value.trim();
      }
    });
  }
  if (forgotCancelBtn && forgotPanel) {
    forgotCancelBtn.addEventListener('click', function () {
      forgotPanel.classList.add('hidden');
    });
  }
  if (forgotConfirmBtn && forgotPanel) {
    forgotConfirmBtn.addEventListener('click', async function () {
      var email = (document.getElementById('forgot-email').value || '').trim().toLowerCase();
      var newPw = (document.getElementById('forgot-new-pw').value || '').trim();
      var err = document.getElementById('auth-error-msg');
      var found = PF_STORAGE.findUserByEmail(email);
      if (!found) {
        if (err) {
          err.textContent = PF_STATE.lang === 'th' ? 'ไม่พบอีเมลนี้ในระบบ (ลองใช้ demo@pathfinder.ac.th)' : 'Email not found (try demo@pathfinder.ac.th)';
          err.classList.remove('hidden');
        }
        return;
      }
      if (newPw.length < 6) {
        if (err) {
          err.textContent = PF_STATE.lang === 'th' ? 'กรุณาตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร' : 'New password must be at least 6 characters';
          err.classList.remove('hidden');
        }
        return;
      }
      found.passwordHash = await PF_STORAGE.hashPassword(newPw, email);
      PF_STORAGE.saveUser(found);
      if (err) err.classList.add('hidden');
      forgotPanel.classList.add('hidden');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = newPw;
      PF_AUTH.showToast('อัปเดตรหัสผ่านใหม่แล้ว!', 'Password updated!');
    });
  }

  document.querySelectorAll('[data-social-auth]').forEach(function (socBtn) {
    socBtn.addEventListener('click', async function () {
      var provider = socBtn.getAttribute('data-social-auth') || 'google';
      var labelMap = { google: 'Google', facebook: 'Facebook', apple: 'Apple', x: 'X' };
      var providerName = labelMap[provider] || 'Social';
      var socEmail = 'student.' + provider + '@pathfinder.ac.th';
      var socPw = 'social_' + provider + '_2026';
      var existing = PF_STORAGE.findUserByEmail(socEmail);
      if (existing) {
        await PF_AUTH.login(socEmail, socPw, true);
      } else {
        await PF_AUTH.signup({
          fullName: 'PathFinder (' + providerName + ')',
          nickname: providerName + 'User',
          email: socEmail,
          password: socPw,
          grade: PF_STATE.grade || 'M.5',
          school: 'PathFinder High',
          avatarPreset: signupAvatarPreset || 'rocket',
          avatarColor: '#1F3A3D'
        });
      }
      closeAuthModal();
      PF_AUTH.showToast('เชื่อมต่อบัญชี ' + providerName + ' แล้ว!', 'Signed in with ' + providerName + '!');
    });
  });

  if (triggerBtn && dropdown) {
    triggerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isHidden = dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', !isHidden);
      triggerBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#user-profile-wrap')) {
        dropdown.classList.add('hidden');
        triggerBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.getElementById('menu-open-profile')) {
    document.getElementById('menu-open-profile').addEventListener('click', function () {
      if (dropdown) dropdown.classList.add('hidden');
      openProfileModal();
    });
  }
  if (document.getElementById('menu-open-analytics')) {
    document.getElementById('menu-open-analytics').addEventListener('click', function () {
      if (dropdown) dropdown.classList.add('hidden');
    });
  }
  if (document.getElementById('menu-save-snapshot')) {
    document.getElementById('menu-save-snapshot').addEventListener('click', function () {
      if (dropdown) dropdown.classList.add('hidden');
      PF_ANALYTICS.recordSnapshot('checkin');
      PF_AUTH.showToast('บันทึก Snapshot แล้ว!', 'Snapshot saved!');
    });
  }
  if (document.getElementById('menu-logout')) {
    document.getElementById('menu-logout').addEventListener('click', function () {
      if (dropdown) dropdown.classList.add('hidden');
      PF_AUTH.logout();
    });
  }
  if (document.getElementById('analytics-save-snapshot-btn')) {
    document.getElementById('analytics-save-snapshot-btn').addEventListener('click', function () {
      if (!PF_AUTH.getCurrentUser()) { openAuthModal('login'); return; }
      PF_ANALYTICS.recordSnapshot('checkin');
      PF_AUTH.showToast('บันทึก Snapshot แล้ว!', 'Snapshot saved!');
    });
  }
  if (document.getElementById('analytics-edit-profile-btn')) {
    document.getElementById('analytics-edit-profile-btn').addEventListener('click', openProfileModal);
  }
  if (document.getElementById('close-profile-btn')) {
    document.getElementById('close-profile-btn').addEventListener('click', function () {
      document.getElementById('profile-modal').classList.add('hidden');
    });
  }

  var bgWheelInput = document.getElementById('prof-bg-color-wheel');
  if (bgWheelInput) {
    bgWheelInput.addEventListener('input', function (e) {
      draftAvatarColor = e.target.value;
      renderProfileStudio();
    });
  }
  var frameWheelInput = document.getElementById('prof-frame-color-wheel');
  if (frameWheelInput) {
    frameWheelInput.addEventListener('input', function (e) {
      draftAvatarFrameColor = e.target.value;
      renderProfileStudio();
    });
  }
  var uploadAvatarBtn = document.getElementById('prof-upload-avatar-btn');
  var avatarFileInput = document.getElementById('prof-avatar-file-input');
  var removeAvatarBtn = document.getElementById('prof-remove-avatar-img-btn');
  if (uploadAvatarBtn && avatarFileInput) {
    uploadAvatarBtn.addEventListener('click', function () {
      avatarFileInput.click();
    });
    avatarFileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var size = 160;
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          var minSide = Math.min(img.width, img.height);
          var sx = (img.width - minSide) / 2;
          var sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          draftAvatarImage = canvas.toDataURL('image/jpeg', 0.85);
          renderProfileStudio();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      avatarFileInput.value = '';
    });
  }
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', function () {
      draftAvatarImage = '';
      renderProfileStudio();
    });
  }

  function saveProfileFromModal(e) {
    if (e && e.preventDefault) e.preventDefault();
    var user = PF_AUTH.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }
    var fn = document.getElementById('prof-fullname').value.trim();
    var nn = document.getElementById('prof-nickname').value.trim();
    user.profile.fullName = fn || user.profile.fullName || 'PathFinder Student';
    user.profile.nickname = nn || user.profile.nickname || 'Student';
    user.profile.grade = document.getElementById('prof-grade').value;
    user.profile.targetYear = document.getElementById('prof-target-year').value;
    user.profile.school = document.getElementById('prof-school').value.trim();
    user.profile.bio = document.getElementById('prof-bio').value.trim();
    user.profile.avatarPreset = draftAvatarPreset;
    user.profile.avatarColor = draftAvatarColor;
    user.profile.avatarFrameColor = draftAvatarFrameColor;
    user.profile.avatarImage = draftAvatarImage;
    PF_STATE.grade = user.profile.grade;
    PF_STORAGE.saveUser(user);
    refreshHeader();
    try { PF_ANALYTICS.render(); } catch (err) {}
    document.getElementById('profile-modal').classList.add('hidden');
    PF_AUTH.showToast('อัปเดตโปรไฟล์แล้ว!', 'Profile updated!');
  }

  var profForm = document.getElementById('profile-edit-form');
  var profSaveBtn = document.getElementById('prof-save-btn');
  if (profForm) profForm.addEventListener('submit', saveProfileFromModal);
  if (profSaveBtn) profSaveBtn.addEventListener('click', saveProfileFromModal);
  if (document.getElementById('prof-export-json-btn')) {
    document.getElementById('prof-export-json-btn').addEventListener('click', function () {
      var user = PF_AUTH.getCurrentUser();
      if (!user) return;
      var wrap = document.getElementById('prof-json-preview-wrap');
      var ta = document.getElementById('prof-json-textarea');
      if (ta) ta.value = JSON.stringify({ email: user.email, profile: user.profile, currentPlan: user.currentPlan, analyticsHistory: user.analyticsHistory }, null, 2);
      if (wrap) wrap.classList.remove('hidden');
    });
  }
  if (document.getElementById('prof-copy-json-btn')) {
    document.getElementById('prof-copy-json-btn').addEventListener('click', function () {
      var ta = document.getElementById('prof-json-textarea');
      if (ta && navigator.clipboard) {
        navigator.clipboard.writeText(ta.value);
        PF_AUTH.showToast('คัดลอก JSON แล้ว!', 'JSON copied!');
      }
    });
  }
  if (document.getElementById('prof-reset-plan-btn')) {
    document.getElementById('prof-reset-plan-btn').addEventListener('click', function () {
      PF_STATE.checkedWaypoints = {};
      PF_STATE.weeklyHours = 6;
      if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
      PF_ANALYTICS.recordSnapshot('reroute');
      PF_AUTH.showToast('รีเซ็ตแผนแล้ว', 'Study plan reset');
    });
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.hasAttribute('data-waypoint-check')) PF_ANALYTICS.recordSnapshot('waypoint_complete');
    else if (t.id === 'hours-slider') PF_ANALYTICS.recordSnapshot('checkin');
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.closest('[data-lock-btn]')) setTimeout(function () { PF_ANALYTICS.recordSnapshot('major_locked'); }, 80);
    else if (t.closest('#apply-reroute-btn')) setTimeout(function () { PF_ANALYTICS.recordSnapshot('reroute'); }, 80);
  });

  renderSignupAvatarPicker();
  return { refreshHeader: refreshHeader, openAuthModal: openAuthModal, openProfileModal: openProfileModal };
})();

PF_AUTH.init();

/* Single namespace index of the shared PathFinder modules (read-only aliases). */
window.PF = window.PF || {};
window.PF.STATE = PF_STATE;
window.PF.STORAGE = PF_STORAGE;
window.PF.ANALYTICS = PF_ANALYTICS;
window.PF.AUTH = PF_AUTH;
window.PF.PROFILE_UI = PF_PROFILE_UI;
window.PF.goToPage = goToPage;
window.PF.setLang = setLang;
