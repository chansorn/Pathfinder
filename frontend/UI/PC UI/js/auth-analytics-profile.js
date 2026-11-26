/* =========================================================================
 * PathFinder — Data Layer, Analytics, Auth & Full-Window Profile + App Bootstrap
 * Sections 4.9-4.11: PF_REF, PF_ANALYTICS (Page 7), PF_AUTH, PF_PROFILE_UI, then PF_AUTH.init().
 * Talks to the backend through PF_API (js/api.js); nothing account-related is stored locally
 * except the session tokens PF_API keeps.
 *
 * Classic (non-module) script: shares the page's global scope with the
 * other PathFinder scripts. Load order is fixed in index.html:
 *   data/catalog.js > js/state-i18n.js > js/discovery-matches.js >
 *   js/roadmap.js > js/visualizers.js > js/sim-coach.js >
 *   js/auth-analytics-profile.js   (js/config.js + js/api.js load first)
 *
 * Depends on : all previous scripts, PF_API
 * Provides   : PF_REF, PF_ANALYTICS, PF_AUTH, PF_PROFILE_UI, window.PF (namespace index)
 * ========================================================================= */

/* =========================================================================
 * MODULE 1: PF_REF (reference data from the backend: grade levels, school search)
 * Users, passwords and sessions are NOT kept in the browser any more - see PF_AUTH / js/api.js.
 * ========================================================================= */
/* [JS 4.9] Data Layer: PF_REF (grade levels, schools) */
var PF_REF = window.PF_REF = (function () {
  // the old prototype kept users + password hashes here; nothing reads them any more
  try {
    localStorage.removeItem('pathfinder_users_db');
    localStorage.removeItem('pathfinder_active_session');
  } catch (e) {}

  var gradesPromise = null;
  var schoolIds = {}; // school name -> id, filled from every search

  function gradeLevels() {
    if (!gradesPromise) {
      gradesPromise = PF_API.request('/grade-levels', { auth: false }).catch(function (err) {
        gradesPromise = null; // try again next time
        throw err;
      });
    }
    return gradesPromise;
  }

  // the UI says 'M.5', the backend code is 'M5'
  async function gradeIdFor(uiGrade) {
    var code = String(uiGrade || '').replace('.', '');
    try {
      var hit = (await gradeLevels()).find(function (g) { return g.code === code; });
      return hit ? hit.id : null;
    } catch (e) { return null; }
  }

  async function gradeFor(id) {
    if (!id) return null;
    try {
      var hit = (await gradeLevels()).find(function (g) { return g.id === id; });
      return hit ? hit.code.replace(/^M(\d)$/, 'M.$1') : null;
    } catch (e) { return null; }
  }

  async function searchSchools(q) {
    var list = await PF_API.request('/schools?q=' + encodeURIComponent(q) + '&limit=20', { auth: false });
    list.forEach(function (s) { schoolIds[s.name] = s.id; });
    return list;
  }

  // only an exact name from the list counts; anything else is saved as "no school"
  async function schoolIdFor(name) {
    name = String(name || '').trim();
    if (!name) return null;
    if (schoolIds[name]) return schoolIds[name];
    try {
      var exact = (await searchSchools(name)).find(function (s) { return s.name === name; });
      return exact ? exact.id : null;
    } catch (e) { return null; }
  }

  // type-ahead from GET /schools on a plain <input> (native <datalist>)
  function attachSchoolAutocomplete(input) {
    if (!input || input.getAttribute('list')) return;
    var list = document.createElement('datalist');
    list.id = input.id + '-options';
    input.parentNode.appendChild(list);
    input.setAttribute('list', list.id);
    input.setAttribute('autocomplete', 'off');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) return;
      timer = setTimeout(function () {
        searchSchools(q).then(function (schools) {
          list.innerHTML = '';
          schools.forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s.name;
            if (s.province) opt.label = s.province;
            list.appendChild(opt);
          });
        }).catch(function () {});
      }, 300);
    });
  }

  return {
    gradeIdFor: gradeIdFor,
    gradeFor: gradeFor,
    schoolIdFor: schoolIdFor,
    searchSchools: searchSchools,
    attachSchoolAutocomplete: attachSchoolAutocomplete
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
      // what the student entered in the form right now; not entered = null (never a made-up default)
      gpax: PF_STATE.gpaxSet && isFinite(Number(PF_STATE.gpax)) ? Number(PF_STATE.gpax) : null,
      readinessPct: pct,
      weeklyHours: PF_STATE.hoursSet && isFinite(Number(PF_STATE.weeklyHours)) ? Number(PF_STATE.weeklyHours) : null,
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
    // guest: only today's real numbers (no invented earlier point)
    return [Object.assign({ timestamp: new Date().toISOString(), eventType: 'checkin', isLive: true }, computeCurrentMetrics())];
  }

  // UI snapshot <-> POST/GET /api/me/progress
  function clamp(n, lo, hi) { n = Number(n); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; }
  function toProgressBody(s) {
    var rb = s.roundBreakdown || {};
    return {
      event_type: s.eventType,
      gpax: s.gpax === null || s.gpax === undefined ? null : clamp(s.gpax, 0, 4),
      readiness_pct: Math.round(clamp(s.readinessPct, 0, 100)),
      weekly_hours: clamp(s.weeklyHours, 0, 80),
      locked_major: s.lockedMajorId ? String(s.lockedMajorId).slice(0, 100) : null,
      completed_count: Math.round(clamp(s.completedCount, 0, 500)),
      total_count: Math.round(clamp(s.totalCount, 0, 500)),
      round_breakdown: {
        r1: Math.round(clamp(rb.r1, 0, 100)),
        r2: Math.round(clamp(rb.r2, 0, 100)),
        r3: Math.round(clamp(rb.r3, 0, 100)),
        r4: Math.round(clamp(rb.r4, 0, 100))
      }
    };
  }
  function fromProgress(p) {
    return {
      timestamp: p.created_at,
      eventType: p.event_type,
      gpax: p.gpax,
      readinessPct: p.readiness_pct,
      weeklyHours: p.weekly_hours,
      lockedMajorId: p.locked_major,
      completedCount: p.completed_count,
      totalCount: p.total_count,
      roundBreakdown: p.round_breakdown
    };
  }

  function sameNumbers(a, b) {
    return JSON.stringify(toProgressBody(a)) === JSON.stringify(toProgressBody(b));
  }

  function recordSnapshot(eventType) {
    var user = window.PF_AUTH ? window.PF_AUTH.getCurrentUser() : null;
    if (!user) return null;
    var m = computeCurrentMetrics();
    var snap = Object.assign({
      timestamp: new Date().toISOString(),
      eventType: eventType || 'checkin'
    }, m);
    user.analyticsHistory = user.analyticsHistory || [];
    var last = user.analyticsHistory[user.analyticsHistory.length - 1];
    // a checkbox clicked on and off again within a minute is not a new data point (backend skips it too)
    var repeat = last && sameNumbers(last, snap) && Date.now() - new Date(last.timestamp).getTime() < 60000;
    if (!repeat) user.analyticsHistory.push(snap);
    if (PF_STATE.page === '7') render();
    if (!repeat) {
      PF_API.request('/me/progress', { method: 'POST', auth: true, body: toProgressBody(snap) }).catch(function (err) {
        // the chart already shows the point; losing it on a network blip is fine
        if (window.console) console.warn('[analytics] snapshot not saved:', err && err.code);
      });
    }
    return snap;
  }

  function filterByRange(history) {
    if (activeRange === 'all') return history;
    var days = activeRange === '7d' ? 7 : 30;
    var cutoff = Date.now() - days * 86400000;
    var filtered = history.filter(function (pt) {
      return new Date(pt.timestamp).getTime() >= cutoff;
    });
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
      var hasG = typeof pt.gpax === 'number' && isFinite(pt.gpax);
      var gNorm = hasG ? Math.max(0, Math.min(100, ((pt.gpax - 2.0) / 2.0) * 100)) : 0;
      var gY = hasG ? padT + plotH - (gNorm / 100) * plotH : null;
      return { x: x, rY: rY, gY: gY, pt: pt };
    });

    var rLine = coords.map(function (c, i) { return (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ',' + c.rY.toFixed(1); }).join(' ');
    var rArea = rLine + ' L' + coords[coords.length - 1].x.toFixed(1) + ',' + (padT + plotH) + ' L' + coords[0].x.toFixed(1) + ',' + (padT + plotH) + ' Z';
    var gLine = '', gPrev = false;
    coords.forEach(function (c) {
      if (c.gY === null) { gPrev = false; return; }
      gLine += (gPrev ? ' L' : ' M') + c.x.toFixed(1) + ',' + c.gY.toFixed(1);
      gPrev = true;
    });
    gLine = gLine.trim() || 'M0,0';

    var labelsHtml = coords.map(function (c, idx) {
      if (coords.length > 6 && idx % 2 !== 0 && idx !== coords.length - 1) return '';
      return '<text x="' + c.x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#687373" font-size="11" font-family="JetBrains Mono, monospace">' + formatShortDate(c.pt.timestamp, lang) + '</text>';
    }).join('');

    var dotsHtml = coords.map(function (c, idx) {
      return (c.gY === null ? '' : '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.gY.toFixed(1) + '" r="4" fill="#D98A4E" stroke="#FAF9F6" stroke-width="1.5" />') +
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
          '<div class="font-metric mt-0.5">' + (lang === 'th' ? 'ความพร้อม: ' : 'Readiness: ') + c.pt.readinessPct + '% | GPAX: ' + (typeof c.pt.gpax === 'number' ? c.pt.gpax.toFixed(2) : '—') + (c.pt.isLive ? (lang === 'th' ? ' • ตอนนี้ (ยังไม่บันทึก)' : ' • now (not saved)') : '') + '</div>';
        tooltip.style.left = Math.min(72, Math.max(4, (c.x / W) * 100)) + '%';
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
    var saved = getActiveHistory();
    // the cards and the last chart point always show what the form says now (GPAX, hours, plan progress);
    // saved snapshots are the history before it
    var live = Object.assign({ timestamp: new Date().toISOString(), eventType: 'checkin', isLive: true }, computeCurrentMetrics());
    var lastSaved = saved[saved.length - 1];
    var history = !lastSaved || lastSaved.isLive ? [live] : (sameNumbers(lastSaved, live) ? saved : saved.concat([live]));
    var filtered = filterByRange(history);
    var latest = live;
    var first = history[0] || latest;
    var prev = history.length > 1 ? history[history.length - 2] : latest;

    var userPill = document.getElementById('analytics-user-pill');
    if (userPill) {
      userPill.textContent = user
        ? (user.profile.nickname + ' • ' + (lang === 'th' ? user.profile.grade.replace('M.', 'ม.') : user.profile.grade))
        : (lang === 'th' ? 'โหมดผู้เยี่ยมชม (Demo Preview)' : 'Guest Mode (Preview)');
    }

    var rDelta = (latest.readinessPct || 0) - (prev.readinessPct || 0);
    var firstGpax = (history.find(function (h) { return typeof h.gpax === 'number'; }) || {}).gpax;
    var gDelta = typeof latest.gpax === 'number' && typeof firstGpax === 'number' ? Number((latest.gpax - firstGpax).toFixed(2)) : null;
    var rEl = document.getElementById('analytics-kpi-readiness');
    var rDeltaEl = document.getElementById('analytics-kpi-readiness-delta');
    var gEl = document.getElementById('analytics-kpi-gpax');
    var gDeltaEl = document.getElementById('analytics-kpi-gpax-delta');
    var vEl = document.getElementById('analytics-kpi-velocity');
    var vSubEl = document.getElementById('analytics-kpi-velocity-sub');
    var fitEl = document.getElementById('analytics-kpi-fit');
    var fitMajEl = document.getElementById('analytics-kpi-fit-major');

    if (rEl) rEl.textContent = (latest.readinessPct || 0) + '%';
    if (rDeltaEl) rDeltaEl.textContent = (rDelta >= 0 ? '+' : '') + rDelta + '% ' + (lang === 'th' ? 'จากช่วงก่อนหน้า' : 'vs previous');
    if (gEl) gEl.textContent = typeof latest.gpax === 'number' ? latest.gpax.toFixed(2) : '—';
    if (gDeltaEl) gDeltaEl.textContent = gDelta === null
      ? (lang === 'th' ? 'ยังไม่ได้กรอก GPAX ในฟอร์ม' : 'GPAX not entered yet')
      : (gDelta >= 0 ? '+' : '') + gDelta.toFixed(2) + ' ' + (lang === 'th' ? 'ตั้งแต่เริ่มต้น' : 'since start');
    if (vEl) vEl.textContent = latest.weeklyHours === null || latest.weeklyHours === undefined ? '—' : latest.weeklyHours + (lang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk');
    if (vSubEl) vSubEl.textContent = (latest.completedCount || 0) + ' / ' + (latest.totalCount || 8) + (lang === 'th' ? ' ภารกิจสำเร็จ' : ' waypoints done');

    var g = typeof latest.gpax === 'number' ? latest.gpax : null;
    var fitScore = g === null ? 'Unknown' : ((g >= 3.5 && (latest.readinessPct || 0) >= 40) ? 'High' : (g >= 3.2 ? 'Strong' : 'Building'));
    var fitThMap = { High: 'สูงมาก (High)', Strong: 'แข็งแกร่ง (Strong)', Building: 'กำลังสร้างฐาน', Unknown: 'กรอก GPAX ก่อน' };
    var fitEnMap = { High: 'High', Strong: 'Strong', Building: 'Building', Unknown: 'Enter your GPAX' };
    if (fitEl) fitEl.textContent = lang === 'th' ? fitThMap[fitScore] : fitEnMap[fitScore];
    var majorTitleEl = document.getElementById('roadmap-major-title');
    if (fitMajEl) fitMajEl.textContent = majorTitleEl ? majorTitleEl.textContent : 'Computer Engineering';

    renderSVGChart(filtered, lang);

    // TCAS 1-4 Round Breakdown Bars
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
          '<div class="w-full h-2.5 rounded-full bg-surface-container-low overflow-hidden border border-outline-variant/50">' +
            '<div class="h-full rounded-full ' + rm.color + ' transition-all duration-300" style="width:' + val + '%"></div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // AI Longitudinal Insights
    var insightsEl = document.getElementById('analytics-ai-insights');
    if (insightsEl) {
      var rGain = (latest.readinessPct || 0) - (first.readinessPct || 0);
      var weakest = 'r3';
      if ((rb.r2 || 0) < (rb[weakest] || 0)) weakest = 'r2';
      if ((rb.r1 || 0) < (rb[weakest] || 0)) weakest = 'r1';
      var weakName = weakest === 'r1' ? (lang === 'th' ? 'รอบ 1 Portfolio' : 'Round 1 Portfolio')
        : (weakest === 'r2' ? (lang === 'th' ? 'รอบ 2 Quota' : 'Round 2 Quota') : (lang === 'th' ? 'รอบ 3 Admission (TGAT/TPAT)' : 'Round 3 Admission (TGAT/TPAT)'));

      var cards = [
        {
          icon: 'trending_up',
          th: 'ความพร้อมรวมของคุณเพิ่มขึ้น +' + Math.max(0, rGain) + '%' + (gDelta === null ? ' (ยังไม่ได้กรอก GPAX)' : ' และ GPAX ขยับ ' + (gDelta >= 0 ? '+' : '') + gDelta.toFixed(2) + ' นับจากจุดเริ่มต้น'),
          en: 'Your overall readiness grew +' + Math.max(0, rGain) + '%' + (gDelta === null ? ' (GPAX not entered yet).' : ' with a ' + (gDelta >= 0 ? '+' : '') + gDelta.toFixed(2) + ' GPAX shift since your baseline.')
        },
        {
          icon: 'target',
          th: 'จุดที่ควรเสริมถัดไปคือ ' + weakName + ' เพื่อสร้างสมดุลแผนสำรอง TCAS 1–4',
          en: 'Next priority: focus on ' + weakName + ' to balance your TCAS 1–4 safety net.'
        }
      ];
      insightsEl.innerHTML = cards.map(function (c) {
        return '<div class="p-gutter-md rounded-xl bg-surface-container-lowest border border-outline-variant flex items-start gap-2.5">' +
          '<span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">' + c.icon + '</span>' +
          '<p class="font-body text-body-md text-on-surface">' + (lang === 'th' ? c.th : c.en) + '</p>' +
        '</div>';
      }).join('');
    }

    // Activity Timeline Log
    var logEl = document.getElementById('analytics-activity-log');
    var countEl = document.getElementById('analytics-log-count');
    // the log = saved snapshots only (the unsaved "now" point lives on the chart / cards)
    var logItems = saved.filter(function (h) { return !h.isLive; });
    if (countEl) countEl.textContent = String(logItems.length);
    if (logEl && !logItems.length) {
      logEl.innerHTML = '<p class="font-body text-body-sm text-on-surface-variant">' + (lang === 'th' ? 'ยังไม่มีบันทึก • กด "บันทึก Snapshot ตอนนี้" เพื่อเก็บค่าปัจจุบัน' : 'No snapshots yet • press "Save snapshot" to keep today numbers') + '</p>';
    } else if (logEl) {
      logEl.innerHTML = logItems.slice().reverse().map(function (item) {
        return '<div class="p-gutter-sm rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between gap-gutter-sm">' +
          '<div class="flex flex-col gap-0.5">' +
            '<span class="font-title text-title-md text-on-surface">' + eventLabel(item.eventType, lang) + '</span>' +
            '<span class="font-label text-label-sm text-on-surface-variant">' + formatShortDate(item.timestamp, lang) + ' • ' + (typeof item.weeklyHours === 'number' && item.weeklyHours > 0 ? item.weeklyHours : '—') + (lang === 'th' ? ' ชม./สัปดาห์' : ' hrs/wk') + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-2 shrink-0">' +
            '<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm tabular-nums">' + item.readinessPct + '%</span>' +
            '<span class="px-2 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-metric text-label-sm text-on-surface tabular-nums">GPAX ' + (typeof item.gpax === 'number' ? item.gpax.toFixed(2) : '—') + '</span>' +
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

  return {
    computeCurrentMetrics: computeCurrentMetrics,
    recordSnapshot: recordSnapshot,
    fromProgress: fromProgress,
    render: render
  };
})();

/* =========================================================================
 * MODULE 3: PF_AUTH (Login, Sign Up, Demo, Password reset, Logout, Guest Migration)
 * ========================================================================= */
/* =====================================================================
 * BACKEND WIRING (all calls go through PF_API, js/api.js)
 *   login            POST /auth/login            { email, password }
 *   signup           POST /auth/register         { email, password, display_name, school_id, grade_level_id, accept_terms }
 *                    then PUT /profile + PATCH /me/state carry the guest's progress over
 *   demo             POST /auth/demo             (a fresh throwaway account each click)
 *   forgot password  POST /auth/forgot-password  { email }   (email link comes back here with ?token_hash=&type=recovery)
 *   reset password   POST /auth/reset-password   { token_hash, password }
 *   logout           POST /auth/logout
 *   current user     GET /me + GET /profile + GET /me/state + GET /me/progress
 *   profile          PUT /profile, POST|DELETE /profile/avatar
 *
 * The UI keeps using the same user object shape as the old localStorage prototype:
 *   { userId, email, accountType, profile: { fullName, nickname, grade, school, targetYear,
 *     avatarPreset, avatarColor, avatarFrameColor, avatarImage, bio }, analyticsHistory, state }
 * ===================================================================== */
/* [JS 4.11] Auth & Profile Layer: PF_AUTH & PF_PROFILE_UI */
var PF_AUTH = window.PF_AUTH = (function () {
  var currentUser = null;

  function t(th, en) { return PF_STATE.lang === 'th' ? th : en; }

  function showToast(thMsg, enMsg) {
    var toast = document.getElementById('pf-toast');
    var txt = document.getElementById('pf-toast-text');
    if (!toast || !txt) return;
    txt.textContent = (PF_STATE.lang === 'th' ? thMsg : enMsg);
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.add('hidden');
    }, 2600);
  }

  // { ok:false, th, en } is what the modal handlers already expect.
  // PF_API.errorText is in the current UI language already, so both get the same text
  function fail(err) {
    var msg = PF_API.errorText(err);
    return { ok: false, th: msg, en: msg, error: err };
  }

  var KNOWN_INTERESTS = (typeof INTEREST_KEYWORD_MAP !== 'undefined' ? INTEREST_KEYWORD_MAP : []).map(function (i) { return i.key; });

  async function buildUser(me, profile, progress, state) {
    var grade = await PF_REF.gradeFor(profile.grade_level_id);
    return {
      userId: me.id,
      email: me.email || '', // demo accounts have no address to show
      accountType: me.account_type,
      isDemo: me.account_type === 'demo',
      canChangePassword: !!me.can_change_password,
      profile: {
        fullName: profile.display_name || '',
        nickname: profile.nickname || profile.display_name || 'Student',
        grade: grade || PF_STATE.grade || 'M.5',
        gradeLevelId: profile.grade_level_id || null,
        school: profile.school_name || '',
        schoolId: profile.school_id || null,
        targetYear: profile.target_tcas_year ? 'TCAS' + (profile.target_tcas_year - 2500) : 'TCAS70',
        avatarPreset: profile.avatar_icon || 'rocket',
        avatarColor: profile.avatar_bg_color || '#1F3A3D',
        avatarFrameColor: profile.avatar_frame_color || '#6B9080',
        avatarImage: profile.avatar_url || '',
        bio: profile.bio || '',
        gpax: typeof profile.gpax === 'number' ? profile.gpax : null,
        interests: Array.isArray(profile.interests) ? profile.interests : []
      },
      analyticsHistory: ((progress && progress.items) || []).map(PF_ANALYTICS.fromProgress),
      state: (state && state.state) || {}
    };
  }

  async function loadUser() {
    var r = await Promise.all([
      PF_API.request('/me', { auth: true }),
      PF_API.request('/profile', { auth: true }),
      // the page still works without these two
      PF_API.request('/me/progress', { auth: true }).catch(function () { return { items: [] }; }),
      PF_API.request('/me/state', { auth: true }).catch(function () { return { state: {} }; })
    ]);
    currentUser = await buildUser(r[0], r[1], r[2], r[3]);
    PF_SYNC.reset(); // next change pushes the merged state (account + what this device had)
    hydrateUserPlan(currentUser);
    return currentUser;
  }

  // saved account data -> PF_STATE (only keys the account actually has)
  function hydrateUserPlan(user) {
    if (!user) return;
    var s = user.state || {};
    var p = user.profile || {};
    if (typeof s.beyond_4 === 'boolean') {
      PF_STATE.beyond400 = s.beyond_4;
      if (typeof window.renderBeyondToggle === 'function') window.renderBeyondToggle(false);
    }
    if (typeof s.province === 'string' && s.province) {
      PF_STATE.province = s.province;
      if (typeof window.renderProvince === 'function') window.renderProvince();
    }
    if (Array.isArray(s.target_universities) && s.target_universities.length) {
      // chip codes (cu, ku, ...) back to the chips, anything else is a typed "other" university
      var chipKeys = Array.prototype.map.call(document.querySelectorAll('[data-uni-key]'), function (c) { return c.getAttribute('data-uni-key'); });
      PF_STATE.targetUnis = s.target_universities.map(function (u) { return String(u).toLowerCase(); }).filter(function (u) { return chipKeys.indexOf(u) !== -1; });
      PF_STATE.otherUnis = s.target_universities.filter(function (u) { return chipKeys.indexOf(String(u).toLowerCase()) === -1; }).slice(0, 5);
      if (typeof window.setChipSelected === 'function') {
        document.querySelectorAll('[data-uni-key]').forEach(function (c) { window.setChipSelected(c, PF_STATE.targetUnis.indexOf(c.getAttribute('data-uni-key')) !== -1); });
      }
      if (typeof window.renderOtherUnis === 'function') window.renderOtherUnis();
    }
    if (Array.isArray(s.target_faculties)) {
      PF_STATE.targetFaculties = s.target_faculties.slice(0, 3);
      if (typeof window.renderFaculties === 'function') window.renderFaculties();
    }
    if (typeof s.weekly_hours === 'number' && s.weekly_hours > 0) { PF_STATE.weeklyHours = s.weekly_hours; PF_STATE.hoursSet = true; }
    if (s.locked_major) PF_STATE.lockedMajorId = String(s.locked_major);
    if (s.locked_major && s.locked_program_id) {
      PF_STATE.rmPrograms = PF_STATE.rmPrograms || {};
      PF_STATE.rmPrograms[String(s.locked_major)] = String(s.locked_program_id);
    }
    if (Array.isArray(s.checked_waypoints)) {
      PF_STATE.checkedWaypoints = {};
      s.checked_waypoints.forEach(function (k) { PF_STATE.checkedWaypoints[k] = true; });
    }
    if (Array.isArray(s.liked_majors)) PF_STATE.acceptedMajors = s.liked_majors.slice();
    if (Array.isArray(s.ignored_majors)) PF_STATE.ignoredMajors = s.ignored_majors.slice();
    if (typeof p.gpax === 'number') { PF_STATE.gpax = p.gpax; PF_STATE.gpaxSet = true; }
    // put the account's values on the Step 2-3 sliders
    var gEl = document.getElementById('gpax-slider');
    if (gEl) gEl.value = Number(PF_STATE.gpax).toFixed(2);
    var hEl = document.getElementById('hours-slider');
    if (hEl) hEl.value = String(PF_STATE.weeklyHours);
    if (typeof renderGpaxValue === 'function') renderGpaxValue();
    if (typeof renderHoursPace === 'function') renderHoursPace();
    if (typeof renderBeyondToggle === 'function') renderBeyondToggle(false);
    if (typeof renderSummaryStrip === 'function') renderSummaryStrip();
    var interests = (p.interests || []).filter(function (k) { return KNOWN_INTERESTS.indexOf(k) !== -1; });
    if (interests.length) PF_STATE.interests = interests.slice(0, window.MAX_INTERESTS || 4);
    // repaint the Step 1 bubbles from the account's interests
    if (typeof window.setChipSelected === 'function') {
      document.querySelectorAll('[data-interest-key]').forEach(function (chip) {
        window.setChipSelected(chip, PF_STATE.interests.indexOf(chip.getAttribute('data-interest-key')) !== -1);
      });
      if (typeof window.renderInterestPriority === 'function') window.renderInterestPriority();
    }
    if (p.grade) PF_STATE.grade = p.grade;
    // and the Step 2 grade pills from the profile's grade
    document.querySelectorAll('[data-grade-key]').forEach(function (pill) {
      var on = pill.getAttribute('data-grade-key') === PF_STATE.grade;
      pill.classList.toggle('border-primary', on);
      pill.classList.toggle('bg-primary', on);
      pill.classList.toggle('text-on-primary', on);
      pill.classList.toggle('border-outline-variant', !on);
      pill.classList.toggle('bg-surface', !on);
      pill.classList.toggle('text-on-surface', !on);
    });

    if (typeof syncMajorMatches === 'function') syncMajorMatches();
    if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
    if (typeof window.updateFloatingCoachInsight === 'function') window.updateFloatingCoachInsight();
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
    if (window.PF_ANALYTICS) window.PF_ANALYTICS.render();
  }

  async function login(email, password, rememberMe) {
    try {
      var data = await PF_API.request('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: String(email || '').trim(), password: String(password || '') }
      });
      PF_API.setSession(data, !!rememberMe);
      var user = await loadUser();
      showToast('ยินดีต้อนรับกลับมา, ' + user.profile.nickname + '!', 'Welcome back, ' + user.profile.nickname + '!');
      return { ok: true, user: user };
    } catch (err) {
      return fail(err);
    }
  }

  async function loginDemo() {
    try {
      var data = await PF_API.request('/auth/demo', { method: 'POST', auth: false });
      // demo accounts are deleted after a few hours anyway, keep them to this tab
      PF_API.setSession(data, false);
      var user = await loadUser();
      showToast('เข้าสู่ระบบด้วยบัญชีทดลองแล้ว (ข้อมูลจะถูกลบอัตโนมัติ)', 'Signed in with a demo account (deleted automatically later)');
      return { ok: true, user: user };
    } catch (err) {
      return fail(err);
    }
  }

  async function signup(payload) {
    if (!payload.acceptTerms) {
      return { ok: false, th: 'กรุณายอมรับข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว', en: 'Please accept the terms of use and privacy policy' };
    }
    if (String(payload.password || '').length < 8) {
      return { ok: false, th: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', en: 'Password must be at least 8 characters' };
    }
    try {
      var ids = await Promise.all([PF_REF.gradeIdFor(payload.grade), PF_REF.schoolIdFor(payload.school)]);
      var data = await PF_API.request('/auth/register', {
        method: 'POST',
        auth: false,
        body: {
          email: String(payload.email || '').trim(),
          password: String(payload.password),
          display_name: String(payload.fullName || payload.nickname || '').trim() || 'Student',
          grade_level_id: ids[0],
          school_id: ids[1],
          accept_terms: true
        }
      });
      if (data.requires_email_confirmation || !data.session) {
        return { ok: true, pendingConfirmation: true };
      }
      PF_API.setSession(data.session, true);

      // carry the guest's progress over. Failing here must not undo the sign-up
      var profilePatch = {
        nickname: String(payload.nickname || '').trim().slice(0, 50) || null,
        avatar_icon: payload.avatarPreset || 'rocket',
        avatar_bg_color: payload.avatarColor || '#1F3A3D'
      };
      if (typeof PF_STATE.gpax === 'number') profilePatch.gpax = Math.min(4, Math.max(0, PF_STATE.gpax));
      if (Array.isArray(PF_STATE.interests) && PF_STATE.interests.length) profilePatch.interests = PF_STATE.interests.slice(0, 30);
      await Promise.all([
        PF_API.request('/profile', { method: 'PUT', auth: true, body: profilePatch }),
        PF_API.request('/me/state', { method: 'PATCH', auth: true, body: PF_SYNC.statePatch() })
      ].map(function (p) { return p.catch(function (e) { if (window.console) console.warn('[signup] migrate step failed:', e && e.code); }); }));

      var user = await loadUser();
      PF_ANALYTICS.recordSnapshot('checkin');
      showToast('สร้างบัญชีและบันทึกแผนปัจจุบันแล้ว!', 'Account created & guest plan migrated!');
      return { ok: true, user: user };
    } catch (err) {
      return fail(err);
    }
  }

  // the account no longer exists (deleted): clear what this page knows about it, no server call
  async function forgetLocalUser() {
    currentUser = null;
    PF_STATE.savedPrograms = [];
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
    if (window.PF_ANALYTICS) window.PF_ANALYTICS.render();
  }

  async function logout() {
    try {
      if (PF_API.hasSession()) await PF_API.request('/auth/logout', { method: 'POST', auth: true });
    } catch (e) {
      // the token is dropped below either way
    }
    PF_API.clearSession();
    PF_SYNC.reset();
    currentUser = null;
    // the account's saved programs stay in the account, not on this (possibly shared) screen
    PF_STATE.savedPrograms = [];
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
    if (window.PF_ANALYTICS) window.PF_ANALYTICS.render();
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'Logged out safely');
  }

  async function forgotPassword(email) {
    try {
      var data = await PF_API.request('/auth/forgot-password', { method: 'POST', auth: false, body: { email: String(email || '').trim() } });
      return { ok: true, message: data && data.message };
    } catch (err) {
      return fail(err);
    }
  }

  async function resetPassword(tokenHash, password) {
    try {
      var data = await PF_API.request('/auth/reset-password', { method: 'POST', auth: false, body: { token_hash: tokenHash, password: password } });
      return { ok: true, message: data && data.message };
    } catch (err) {
      return fail(err);
    }
  }

  function cleanUrl(keys) {
    try {
      var url = new URL(location.href);
      keys.forEach(function (k) { url.searchParams.delete(k); });
      history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (e) {}
  }

  // ?token_hash=&type=recovery (reset-password email link)
  async function handleRedirects() {
    var params = new URLSearchParams(location.search);
    var tokenHash = params.get('token_hash');
    if (tokenHash && params.get('type') === 'recovery') {
      cleanUrl(['token_hash', 'type']);
      return { reset: tokenHash };
    }

    return null;
  }

  // PUT /profile (+ avatar upload / removal). updates use the UI field names
  async function saveProfile(updates, avatar) {
    if (!currentUser) return { ok: false, th: 'กรุณาเข้าสู่ระบบก่อน', en: 'Please sign in first' };
    try {
      var old = currentUser.profile;
      var schoolName = String(updates.school || '').trim();
      var ids = await Promise.all([
        PF_REF.gradeIdFor(updates.grade),
        schoolName && schoolName === old.school ? Promise.resolve(old.schoolId) : PF_REF.schoolIdFor(schoolName)
      ]);
      var yearMatch = /^TCAS(\d{2})$/.exec(String(updates.targetYear || ''));
      var body = {
        display_name: String(updates.fullName || '').trim().slice(0, 100) || old.fullName || 'Student',
        nickname: String(updates.nickname || '').trim().slice(0, 50) || null,
        bio: String(updates.bio || '').trim().slice(0, 500) || null,
        grade_level_id: ids[0],
        school_id: ids[1],
        avatar_icon: updates.avatarPreset || 'rocket',
        avatar_bg_color: updates.avatarColor || null,
        avatar_frame_color: updates.avatarFrameColor || null
      };
      if (yearMatch) body.target_tcas_year = 2500 + Number(yearMatch[1]);
      await PF_API.request('/profile', { method: 'PUT', auth: true, body: body });

      if (avatar && avatar.blob) {
        await PF_API.request('/profile/avatar', { method: 'POST', auth: true, body: avatar.blob, contentType: avatar.blob.type || 'image/jpeg' });
      } else if (avatar && avatar.remove) {
        await PF_API.request('/profile/avatar', { method: 'DELETE', auth: true });
      }
      await loadUser();
      return { ok: true, schoolNotFound: !!schoolName && !ids[1] };
    } catch (err) {
      return fail(err);
    }
  }

  var retries = 0;
  async function restoreSession() {
    if (currentUser || !PF_API.hasSession()) return;
    try {
      await loadUser();
    } catch (err) {
      if (err.status === 401) {
        PF_API.clearSession();
        return;
      }
      // 429 / 503 / offline: the login is still good, try again shortly
      if (retries++ < 3) setTimeout(restoreSession, 5000 * retries);
      else showToast('โหลดข้อมูลบัญชีไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง', 'Could not load your account. Please refresh the page.');
    }
  }

  window.addEventListener('pf:auth-expired', function () {
    if (!currentUser) return;
    currentUser = null;
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
    showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'Your session expired. Please sign in again.');
  });

  async function init() {
    var redirect = await handleRedirects();
    if (redirect && redirect.reset && window.PF_PROFILE_UI) window.PF_PROFILE_UI.openResetPassword(redirect.reset);
    await restoreSession();
    if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.refreshHeader();
  }

  return {
    init: init,
    login: login,
    loginDemo: loginDemo,
    forgetLocalUser: forgetLocalUser,
    signup: signup,
    logout: logout,
    forgotPassword: forgotPassword,
    resetPassword: resetPassword,
    saveProfile: saveProfile,
    reload: loadUser,
    showToast: showToast,
    getCurrentUser: function () { return currentUser; }
  };
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
  var originalAvatarImage = ''; // to tell an upload / removal apart from no change
  var resetTokenHash = null; // set when the page was opened from the reset-password email

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
      el.innerHTML = '<span class="material-symbols-outlined" style="font-size:' + (sizePx || 16) + 'px;" aria-hidden="true">' + getPresetIcon(preset) + '</span>';
    }
  }

  function refreshHeader() {
    var user = PF_AUTH.getCurrentUser();
    // sign-in / sign-out / account switch: the coach chat shows this account's history only
    if (window.PF_CHAT && String(PF_STATE.page) === '6') window.PF_CHAT.load();
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
      if (dEmail) dEmail.textContent = user.email || (lang === 'th' ? 'บัญชีทดลอง (ลบอัตโนมัติ)' : 'Demo account (auto-deleted)');
      renderAvatarBadge(
        document.getElementById('header-avatar-badge'),
        user.profile.avatarPreset,
        user.profile.avatarColor,
        16,
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

  function showAuthError(res) {
    var err = document.getElementById('auth-error-msg');
    if (!err) return;
    err.textContent = PF_STATE.lang === 'th' ? res.th : res.en;
    err.classList.remove('hidden');
  }

  function hideAuthError() {
    var err = document.getElementById('auth-error-msg');
    if (err) err.classList.add('hidden');
  }

  // stops double submits while a request is running
  async function withBusy(btn, fn) {
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
    try { return await fn(); } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
    }
  }

  // forgot panel has two modes: "send me a link" (email) and "set the new password" (from the email link)
  function setForgotMode(mode) {
    var emailEl = document.getElementById('forgot-email');
    var pwEl = document.getElementById('forgot-new-pw');
    var title = document.getElementById('forgot-title');
    var btn = document.getElementById('forgot-confirm-btn');
    var lang = PF_STATE.lang || 'th';
    var reset = mode === 'reset';
    if (emailEl) emailEl.classList.toggle('hidden', reset);
    if (pwEl) pwEl.classList.toggle('hidden', !reset);
    if (title) {
      title.setAttribute('data-th', reset ? 'ตั้งรหัสผ่านใหม่' : 'ลืมรหัสผ่าน: รับลิงก์ทางอีเมล');
      title.setAttribute('data-en', reset ? 'Set a new password' : 'Forgot password: get a link by email');
      title.textContent = title.getAttribute('data-' + lang);
    }
    if (btn) {
      btn.setAttribute('data-th', reset ? 'บันทึกรหัสใหม่' : 'ส่งลิงก์');
      btn.setAttribute('data-en', reset ? 'Update password' : 'Send link');
      btn.textContent = btn.getAttribute('data-' + lang);
    }
  }

  function openResetPassword(tokenHash) {
    resetTokenHash = tokenHash;
    openAuthModal('login');
    var panel = document.getElementById('auth-forgot-panel');
    if (panel) panel.classList.remove('hidden');
    setForgotMode('reset');
    var pw = document.getElementById('forgot-new-pw');
    if (pw) pw.focus();
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
      subEl.setAttribute('data-th', tab === 'signup' ? 'กรอกข้อมูลด้านล่างเพื่อสร้างบัญชี' : 'ยินดีต้อนรับกลับมา! กรุณาเข้าสู่ระบบเพื่อบันทึกแผน TCAS ของคุณ');
      subEl.setAttribute('data-en', tab === 'signup' ? 'Fill in the details below to create your account.' : 'Welcome back! Please login to continue.');
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
      return '<button type="button" data-signup-avatar="' + a.id + '" aria-label="' + a.label + '" class="w-9 h-9 rounded-full flex items-center justify-center border ' + (active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface border-outline-variant') + '">' +
        '<span class="material-symbols-outlined text-[18px]" aria-hidden="true">' + a.icon + '</span>' +
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
    var preview = document.getElementById('profile-preview-avatar');
    var removeBtn = document.getElementById('prof-remove-avatar-img-btn');
    var bgWheel = document.getElementById('prof-bg-color-wheel');
    var bgHex = document.getElementById('prof-bg-color-hex');
    var frameWheel = document.getElementById('prof-frame-color-wheel');
    var frameHex = document.getElementById('prof-frame-color-hex');

    renderAvatarBadge(preview, draftAvatarPreset, draftAvatarColor, 24, draftAvatarFrameColor, draftAvatarImage);
    if (removeBtn) removeBtn.classList.toggle('hidden', !draftAvatarImage);
    if (bgWheel) bgWheel.value = draftAvatarColor;
    if (bgHex) bgHex.textContent = draftAvatarColor.toUpperCase();
    if (frameWheel) frameWheel.value = draftAvatarFrameColor;
    if (frameHex) frameHex.textContent = draftAvatarFrameColor.toUpperCase();

    if (iconsWrap) {
      iconsWrap.innerHTML = AVATAR_PRESETS.map(function (a) {
        var active = !draftAvatarImage && a.id === draftAvatarPreset;
        return '<button type="button" data-prof-icon="' + a.id + '" aria-label="' + a.label + '" class="w-10 h-10 rounded-full flex items-center justify-center border ' + (active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-outline-variant') + '">' +
          '<span class="material-symbols-outlined text-[20px]" aria-hidden="true">' + a.icon + '</span>' +
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
    if (!user) {
      openAuthModal('login');
      return;
    }
    var modal = document.getElementById('profile-modal');
    if (!modal) return;
    draftAvatarPreset = user.profile.avatarPreset || 'rocket';
    draftAvatarColor = user.profile.avatarColor || '#1F3A3D';
    draftAvatarFrameColor = user.profile.avatarFrameColor || '#6B9080';
    draftAvatarImage = user.profile.avatarImage || '';
    originalAvatarImage = draftAvatarImage;
    document.getElementById('profile-email-readout').textContent = user.email || (PF_STATE.lang === 'th' ? 'บัญชีทดลอง' : 'Demo account');
    renderAccountSecurity(user);
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

  // Wire Header & Auth & Profile Events
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
    tabBtn.addEventListener('click', function () {
      switchAuthTab(tabBtn.getAttribute('data-auth-tab'));
    });
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
    demoLoginBtn.addEventListener('click', function () {
      withBusy(demoLoginBtn, async function () {
        hideAuthError();
        var res = await PF_AUTH.loginDemo();
        if (!res.ok) { showAuthError(res); return; }
        closeAuthModal();
      });
    });
  }

  function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    return withBusy(document.getElementById('auth-login-submit-btn'), async function () {
      hideAuthError();
      var res = await PF_AUTH.login(
        document.getElementById('login-email').value,
        document.getElementById('login-password').value,
        document.getElementById('login-remember').checked
      );
      if (!res.ok) { showAuthError(res); return; }
      document.getElementById('login-password').value = '';
      closeAuthModal();
    });
  }
  // the button is type="submit", so Enter in the email / password box signs in too
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  function handleSignupSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    return withBusy(document.getElementById('auth-signup-submit-btn'), async function () {
      hideAuthError();
      var terms = document.getElementById('signup-accept-terms');
      var res = await PF_AUTH.signup({
        fullName: document.getElementById('signup-fullname').value,
        nickname: document.getElementById('signup-nickname').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-password').value,
        grade: document.getElementById('signup-grade').value,
        school: document.getElementById('signup-school').value,
        acceptTerms: !!(terms && terms.checked),
        avatarPreset: signupAvatarPreset,
        avatarColor: '#1F3A3D'
      });
      if (!res.ok) { showAuthError(res); return; }
      document.getElementById('signup-password').value = '';
      if (res.pendingConfirmation) {
        switchAuthTab('login');
        document.getElementById('login-email').value = document.getElementById('signup-email').value.trim();
        // Supabase "Confirm email" is on: no session until the link in the email is clicked. say so where they look
        showAuthError({
          th: 'สมัครเรียบร้อย! เราส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดลิงก์ในอีเมลก่อน แล้วค่อยเข้าสู่ระบบที่นี่',
          en: 'Account created! We sent a confirmation link to your email. Click it first, then sign in here.'
        });
        return;
      }
      closeAuthModal();
    });
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
      resetTokenHash = null;
      setForgotMode('forgot');
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
      resetTokenHash = null;
      forgotPanel.classList.add('hidden');
    });
  }
  // the forgot panel sits inside the login form: Enter there means "send link" / "save password", not sign in
  ['forgot-email', 'forgot-new-pw'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el || !forgotConfirmBtn) return;
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      forgotConfirmBtn.click();
    });
  });
  if (forgotConfirmBtn && forgotPanel) {
    forgotConfirmBtn.addEventListener('click', function () {
      withBusy(forgotConfirmBtn, async function () {
        hideAuthError();
        var res;
        if (resetTokenHash) {
          var newPw = document.getElementById('forgot-new-pw').value;
          if (newPw.length < 8) {
            showAuthError({ th: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', en: 'New password must be at least 8 characters' });
            return;
          }
          res = await PF_AUTH.resetPassword(resetTokenHash, newPw);
          if (!res.ok) { showAuthError(res); return; }
          resetTokenHash = null;
          document.getElementById('forgot-new-pw').value = '';
          forgotPanel.classList.add('hidden');
          PF_AUTH.showToast(res.message || 'ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ', res.message || 'Password updated. Please sign in.');
          return;
        }
        var email = (document.getElementById('forgot-email').value || '').trim();
        if (!email) {
          showAuthError({ th: 'กรุณากรอกอีเมล', en: 'Please enter your email' });
          return;
        }
        res = await PF_AUTH.forgotPassword(email);
        if (!res.ok) { showAuthError(res); return; }
        forgotPanel.classList.add('hidden');
        // same answer whether the account exists or not
        PF_AUTH.showToast(res.message || 'ถ้ามีบัญชีนี้ เราได้ส่งลิงก์ไปที่อีเมลแล้ว', res.message || 'If the account exists, a link has been sent.');
      });
    });
  }

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
      PF_AUTH.showToast('บันทึก Snapshot พัฒนาการแล้ว!', 'Progress snapshot saved!');
    });
  }
  if (document.getElementById('menu-logout')) {
    document.getElementById('menu-logout').addEventListener('click', function () {
      if (dropdown) dropdown.classList.add('hidden');
      PF_AUTH.logout();
      resetTokenHash = null;
    });
  }

  if (document.getElementById('analytics-save-snapshot-btn')) {
    document.getElementById('analytics-save-snapshot-btn').addEventListener('click', function () {
      if (!PF_AUTH.getCurrentUser()) { openAuthModal('login'); return; }
      PF_ANALYTICS.recordSnapshot('checkin');
      PF_AUTH.showToast('บันทึก Snapshot ล่าสุดแล้ว!', 'Snapshot saved!');
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

  async function dataUrlToBlob(url) {
    var res = await fetch(url);
    return res.blob();
  }

  function saveProfileFromModal(e) {
    if (e && e.preventDefault) e.preventDefault();
    var user = PF_AUTH.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }
    return withBusy(document.getElementById('prof-save-btn'), async function () {
      var avatar = null;
      if (draftAvatarImage && draftAvatarImage.indexOf('data:') === 0) avatar = { blob: await dataUrlToBlob(draftAvatarImage) };
      else if (!draftAvatarImage && originalAvatarImage) avatar = { remove: true };
      var res = await PF_AUTH.saveProfile({
        fullName: document.getElementById('prof-fullname').value,
        nickname: document.getElementById('prof-nickname').value,
        grade: document.getElementById('prof-grade').value,
        targetYear: document.getElementById('prof-target-year').value,
        school: document.getElementById('prof-school').value,
        bio: document.getElementById('prof-bio').value,
        avatarPreset: draftAvatarPreset,
        avatarColor: draftAvatarColor,
        avatarFrameColor: draftAvatarFrameColor
      }, avatar);
      if (!res.ok) {
        PF_AUTH.showToast(res.th, res.en);
        return;
      }
      refreshHeader();
      try { PF_ANALYTICS.render(); } catch (err) {}
      document.getElementById('profile-modal').classList.add('hidden');
      if (res.schoolNotFound) {
        PF_AUTH.showToast('บันทึกแล้ว แต่ไม่พบชื่อโรงเรียนในรายชื่อ กรุณาเลือกจากรายการที่ขึ้นมา', 'Saved, but the school was not found. Please pick one from the suggestions.');
      } else {
        PF_AUTH.showToast('อัปเดตโปรไฟล์เรียบร้อยแล้ว!', 'Profile updated!');
      }
    });
  }

  var profForm = document.getElementById('profile-edit-form');
  var profSaveBtn = document.getElementById('prof-save-btn');
  if (profForm) profForm.addEventListener('submit', saveProfileFromModal);
  if (profSaveBtn) profSaveBtn.addEventListener('click', saveProfileFromModal);

  // ---- 7. Account security: change password / delete account ----
  // accounts with a password confirm with it; demo accounts (no password) type DELETE instead
  function renderAccountSecurity(user) {
    var th = PF_STATE.lang === 'th';
    var form = document.getElementById('prof-password-form');
    var none = document.getElementById('prof-pw-unavailable');
    if (form) form.classList.toggle('hidden', !user.canChangePassword);
    if (none) none.classList.toggle('hidden', !!user.canChangePassword);
    ['prof-pw-current', 'prof-pw-new', 'prof-pw-confirm', 'prof-delete-confirm'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['prof-pw-msg', 'prof-delete-msg'].forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = ''; });
    var del = document.getElementById('prof-delete-confirm');
    if (del) {
      del.type = user.canChangePassword ? 'password' : 'text';
      del.placeholder = user.canChangePassword ? (th ? 'พิมพ์รหัสผ่านเพื่อยืนยัน' : 'Type your password to confirm') : (th ? 'พิมพ์ DELETE เพื่อยืนยัน' : 'Type DELETE to confirm');
    }
  }

  var pwForm = document.getElementById('prof-password-form');
  if (pwForm) {
    pwForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('prof-pw-msg');
      var cur = document.getElementById('prof-pw-current').value;
      var next = document.getElementById('prof-pw-new').value;
      var again = document.getElementById('prof-pw-confirm').value;
      var th = PF_STATE.lang === 'th';
      if (next.length < 8) { msg.textContent = th ? 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' : 'New password must be at least 8 characters'; return; }
      if (next !== again) { msg.textContent = th ? 'รหัสผ่านใหม่ 2 ช่องไม่ตรงกัน' : "The two new passwords don't match"; return; }
      if (next === cur) { msg.textContent = th ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม' : 'The new password must differ from the current one'; return; }
      withBusy(document.getElementById('prof-pw-submit'), async function () {
        try {
          await PF_API.request('/auth/change-password', { method: 'POST', auth: true, body: { current_password: cur, new_password: next } });
          msg.textContent = th ? 'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นจะถูกออกจากระบบ' : 'Password changed. Other devices are signed out.';
          pwForm.reset();
        } catch (err) {
          msg.textContent = PF_API.errorText(err);
        }
      });
    });
  }

  var delBtn = document.getElementById('prof-delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', function () {
      var user = PF_AUTH.getCurrentUser();
      var msg = document.getElementById('prof-delete-msg');
      var input = document.getElementById('prof-delete-confirm');
      var th = PF_STATE.lang === 'th';
      if (!user) return;
      var val = (input.value || '').trim();
      if (user.canChangePassword ? !val : val !== 'DELETE') {
        msg.textContent = user.canChangePassword ? (th ? 'กรุณาพิมพ์รหัสผ่านเพื่อยืนยัน' : 'Type your password to confirm') : (th ? 'กรุณาพิมพ์ DELETE เพื่อยืนยัน' : 'Type DELETE to confirm');
        return;
      }
      if (!window.confirm(th ? 'ลบบัญชีและข้อมูลทั้งหมดถาวร? กู้คืนไม่ได้' : 'Delete the account and all its data permanently? This cannot be undone.')) return;
      withBusy(delBtn, async function () {
        try {
          await PF_API.request('/account', { method: 'DELETE', auth: true, body: user.canChangePassword ? { password: val } : { confirm: 'DELETE' } });
          // the account is gone: drop the session locally (no /auth/logout call - the token is dead)
          PF_API.clearSession();
          PF_SYNC.reset();
          await PF_AUTH.forgetLocalUser();
          var modal = document.getElementById('profile-modal');
          if (modal) modal.classList.add('hidden');
          PF_AUTH.showToast('ลบบัญชีและข้อมูลทั้งหมดเรียบร้อยแล้ว', 'Account and all data deleted');
        } catch (err) {
          msg.textContent = PF_API.errorText(err);
        }
      });
    });
  }

  if (document.getElementById('prof-export-json-btn')) {
    document.getElementById('prof-export-json-btn').addEventListener('click', function () {
      var user = PF_AUTH.getCurrentUser();
      if (!user) return;
      var wrap = document.getElementById('prof-json-preview-wrap');
      var ta = document.getElementById('prof-json-textarea');
      // everything the server holds about this account (PDPA export)
      PF_API.request('/account/export', { auth: true }).then(function (data) {
        if (ta) ta.value = JSON.stringify(data, null, 2);
        if (wrap) wrap.classList.remove('hidden');
      }).catch(function (err) {
        var msg = PF_API.errorText(err);
        PF_AUTH.showToast(msg, msg);
      });
    });
  }
  if (document.getElementById('prof-copy-json-btn')) {
    document.getElementById('prof-copy-json-btn').addEventListener('click', function () {
      var ta = document.getElementById('prof-json-textarea');
      if (ta && navigator.clipboard) {
        navigator.clipboard.writeText(ta.value);
        PF_AUTH.showToast('คัดลอกข้อมูล JSON แล้ว!', 'JSON backup copied!');
      }
    });
  }
  if (document.getElementById('prof-reset-plan-btn')) {
    document.getElementById('prof-reset-plan-btn').addEventListener('click', function () {
      PF_STATE.checkedWaypoints = {};
      PF_STATE.weeklyHours = 6;
      if (typeof renderRoadmap === 'function') renderRoadmap(PF_STATE.lockedMajorId);
      PF_ANALYTICS.recordSnapshot('reroute');
      PF_AUTH.showToast('รีเซ็ตแผนการเรียนเรียบร้อยแล้ว', 'Study plan reset');
    });
  }

  // Auto-record longitudinal snapshots on key user milestones
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.hasAttribute('data-waypoint-check')) {
      PF_ANALYTICS.recordSnapshot('waypoint_complete');
    } else if (t.id === 'hours-slider') {
      PF_ANALYTICS.recordSnapshot('checkin');
    }
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.closest('[data-lock-btn]')) {
      setTimeout(function () { PF_ANALYTICS.recordSnapshot('major_locked'); }, 80);
    } else if (t.closest('#apply-reroute-btn')) {
      setTimeout(function () { PF_ANALYTICS.recordSnapshot('reroute'); }, 80);
    }
  });

  renderSignupAvatarPicker();
  PF_REF.attachSchoolAutocomplete(document.getElementById('signup-school'));
  PF_REF.attachSchoolAutocomplete(document.getElementById('prof-school'));
  return {
    refreshHeader: refreshHeader,
    openAuthModal: openAuthModal,
    openProfileModal: openProfileModal,
    openResetPassword: openResetPassword
  };
})();

PF_AUTH.init();

/* Single namespace index of the shared PathFinder modules (read-only aliases). */
window.PF = window.PF || {};
window.PF.STATE = PF_STATE;
window.PF.REF = PF_REF;
window.PF.API = PF_API;
window.PF.ANALYTICS = PF_ANALYTICS;
window.PF.AUTH = PF_AUTH;
window.PF.PROFILE_UI = PF_PROFILE_UI;
window.PF.goToPage = goToPage;
window.PF.setLang = setLang;

// profile modal menu: [data-profile-close] closes it, [data-profile-go="N"] then opens page N
// (attributes instead of inline onclick, which the backend's Content-Security-Policy blocks)
document.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('[data-profile-close]') : null;
  if (!btn) return;
  var modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('hidden');
  var page = btn.getAttribute('data-profile-go');
  if (page) goToPage(page);
});

// refresh keeps you where you were (page + form step, kept in sessionStorage for this tab).
// a new tab, or typing / opening the address again, starts on the home page
(function restoreTabPosition() {
  var nav = (window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  // only a real refresh (or back/forward) restores; opening the address again starts on the home page
  if (!nav || (nav.type !== 'reload' && nav.type !== 'back_forward')) {
    try { sessionStorage.removeItem('pf_page'); sessionStorage.removeItem('pf_step'); } catch (e) {}
    return;
  }
  var page = null, step = null;
  try { page = sessionStorage.getItem('pf_page'); step = Number(sessionStorage.getItem('pf_step')); } catch (e) {}
  var picked = document.querySelectorAll('[data-interest-key][aria-pressed="true"]').length;
  if (step >= 2 && step <= 3 && picked >= (window.MIN_INTERESTS || 2) && typeof renderStep === 'function') renderStep(step);
  if (page && page !== '1' && document.querySelector('[data-page-view="' + page + '"]')) goToPage(page);
})();
