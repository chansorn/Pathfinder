/* =========================================================================
 * PathFinder — js/hero.js
 * Home page goal card: real myTCAS data for the student's program.
 *   program = the locked one (Page 3 "ล็อกเป้าหมาย") → else the first saved (heart) → else the top match
 *   nothing yet = an honest "not chosen yet" card that points to the form (no made-up numbers)
 * Depends on : js/api.js, js/state-i18n.js (PF_STATE, currentLang, pfSubjectLabel), js/matches.js (optional)
 * Provides   : window.PF_HERO.refresh()
 * ========================================================================= */
var PF_HERO = window.PF_HERO = (function () {
  var cache = {};
  var seq = 0;
  var shownId = null;

  function T(th, en) { return currentLang === 'th' ? th : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // text that follows the TH/EN switch (setLang reads data-th / data-en)
  function bi(el, th, en) {
    if (!el) return;
    el.setAttribute('data-th', th);
    el.setAttribute('data-en', en);
    el.textContent = T(th, en);
  }
  function biSpan(th, en, cls) {
    return '<span class="' + cls + '" data-th="' + esc(th) + '" data-en="' + esc(en) + '">' + esc(T(th, en)) + '</span>';
  }
  function get(path) {
    if (!cache[path]) {
      cache[path] = PF_API.request(path, { auth: false });
      cache[path].catch(function () { delete cache[path]; });
    }
    return cache[path];
  }
  function day(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmt(d, lang) { return d ? d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function isPast(iso) {
    var d = day(iso); if (!d) return false;
    var n = new Date(); return d < new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  // which program to show, and why
  function pick() {
    var lp = PF_STATE.lockedProgram;
    if (lp && lp.id) return { id: lp.id, kind: 'locked', pct: PF_STATE.lockedMatchPct || null };
    var sv = (PF_STATE.savedPrograms || [])[0];
    if (sv && sv.id) return { id: sv.id, kind: 'saved', pct: null };
    var top = window.PF_MATCHES && typeof window.PF_MATCHES.items === 'function' ? window.PF_MATCHES.items()[0] : null;
    if (top && top.id) return { id: top.id, kind: 'top', pct: top.match_pct ? top.match_pct + '%' : null };
    return null;
  }

  var LABEL = {
    locked: ['เป้าหมายหลัก (ล็อกไว้)', 'Locked goal'],
    saved: ['หลักสูตรที่บันทึกไว้', 'Saved program'],
    top: ['อันดับ 1 ที่ตรงกับคุณ', 'Your top match']
  };

  function setMatch(th, en) { bi($('hero-match'), th, en); }

  function paintEmpty() {
    shownId = null;
    bi($('hero-label'), 'เป้าหมายหลัก', 'Destination');
    bi($('hero-title'), 'ยังไม่ได้เลือกเป้าหมาย', 'No goal chosen yet');
    setMatch('ยังไม่มีข้อมูล', 'No data yet');
    bi($('hero-gpax'), '—', '—');
    bi($('hero-weights'), '—', '—');
    bi($('hero-docs'), '—', '—');
    bi($('hero-footer'), 'เลือกเป้าหมายเพื่อดูแผนของคุณ', 'Pick a goal to see your plan');
    var msg = biSpan('กรอกความสนใจในหน้า "ค้นหาตัวเอง" แล้วระบบจะดึงเกณฑ์ เอกสาร และวันปิดรับจริงจาก myTCAS มาแสดงตรงนี้',
      'Fill in your interests and this card will show real criteria, documents and closing dates from myTCAS', 'font-body text-body-md text-on-surface-variant');
    var cta = '<button type="button" data-go-page="2" class="self-start inline-flex items-center gap-1 px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-md">' +
      '<span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>' + biSpan('เริ่มกรอกความสนใจ', 'Start the form', '') + '</button>';
    eachPanel(function (panel) {
      panel.innerHTML = '<div class="flex flex-col gap-gutter-sm p-gutter-md rounded-lg bg-surface-container-lowest border border-outline-variant">' + msg + cta + '</div>';
    });
  }

  function paintLoading() {
    eachPanel(function (panel) {
      panel.innerHTML = '<div class="p-gutter-md rounded-lg bg-surface-container-lowest border border-outline-variant">' +
        biSpan('กำลังโหลดข้อมูลจาก myTCAS…', 'Loading myTCAS data…', 'font-body text-body-md text-on-surface-variant') + '</div>';
    });
  }

  function eachPanel(fn) {
    ['hr1', 'hr2', 'hr3', 'hr4'].forEach(function (id, i) {
      var p = document.querySelector('[data-round-panel="' + id + '"]');
      if (p) fn(p, i + 1);
    });
  }

  function row(icon, titleTh, titleEn, subTh, subEn, sideTh, sideEn, accent) {
    return '<div class="flex items-start justify-between gap-gutter-md p-gutter-md rounded-lg ' + (accent ? 'bg-tertiary-container' : 'bg-surface-container-lowest') + ' border border-outline-variant">' +
      '<div class="flex items-start gap-gutter-sm min-w-0">' +
        '<span class="material-symbols-outlined text-[20px] ' + (accent ? 'text-tertiary-text' : 'text-secondary-text') + ' mt-0.5" aria-hidden="true">' + icon + '</span>' +
        '<div class="flex flex-col gap-0.5 min-w-0">' +
          biSpan(titleTh, titleEn, 'font-title text-title-md ' + (accent ? 'text-on-tertiary-container' : 'text-on-surface')) +
          (subTh ? biSpan(subTh, subEn, 'font-body text-body-md ' + (accent ? 'text-on-tertiary-container' : 'text-on-surface-variant')) : '') +
        '</div>' +
      '</div>' +
      (sideTh ? biSpan(sideTh, sideEn, 'font-label text-label-sm text-tertiary-text shrink-0 text-right') : '') +
    '</div>';
  }

  function paintProgram(p, docs, choice) {
    var fresh = shownId !== p.id;
    shownId = p.id;
    // real data replacing "loading…" / another program: fade the card in (css/transitions.css 2.10)
    if (fresh && window.pfMotion) window.pfMotion($('hero-title').closest('article'), 'pf-fade-in');
    var L = LABEL[choice.kind];
    bi($('hero-label'), L[0], L[1]);
    var title = String(p.program).replace(/วิชาเอก\s*วิชาเอก/g, 'วิชาเอก') + ' • ' + p.university;
    bi($('hero-title'), title, title);
    if (choice.pct) setMatch('ตรงกัน ' + choice.pct, choice.pct + ' match');
    else setMatch('ข้อมูลจริง myTCAS', 'Real myTCAS data');

    var adms = p.admissions || [];
    // lowest GPAX any project asks for (the easiest door), or "not set"
    var gp = adms.map(function (a) { return a.min_gpax; }).filter(function (v) { return v != null && Number(v) > 0; }).map(Number);
    if (gp.length) { var g = Math.min.apply(null, gp).toFixed(2) + '+'; bi($('hero-gpax'), g, g); }
    else bi($('hero-gpax'), 'ไม่ระบุ', 'Not set');

    // weights: the round 3 (Admission) project with exam weights, else any with weights
    var withW = adms.filter(function (a) { return a.score_weights && Object.keys(a.score_weights).length; });
    var main = withW.find(function (a) { return a.round === 3; }) || withW[0];
    if (main) {
      var top = Object.keys(main.score_weights).map(function (k) { return { k: k, w: Number(main.score_weights[k]) || 0 }; })
        .sort(function (a, b) { return b.w - a.w; }).slice(0, 2);
      var th = top.map(function (x) { return pfSubjectLabel(x.k, 'th') + (x.w ? ' ' + x.w + '%' : ''); }).join(' + ');
      var en = top.map(function (x) { return pfSubjectLabel(x.k, 'en') + (x.w ? ' ' + x.w + '%' : ''); }).join(' + ');
      bi($('hero-weights'), th, en);
    } else bi($('hero-weights'), 'ไม่ระบุ', 'Not set');

    var r1 = adms.filter(function (a) { return a.round === 1; });
    var r1docs = (((docs && docs.rounds) || []).find(function (x) { return x.round === 1; }) || {}).recommended_docs || [];
    var topDoc = r1docs.slice().sort(function (a, b) { return (b.projects || 0) - (a.projects || 0); })[0];
    if (!r1.length) bi($('hero-docs'), 'ไม่เปิดรอบ 1', 'No Round 1');
    else if (topDoc) bi($('hero-docs'), topDoc.label_th, topDoc.label_en);
    else bi($('hero-docs'), 'ดูประกาศโครงการ', 'See announcement');

    var rounds = [1, 2, 3, 4].filter(function (r) { return adms.some(function (a) { return a.round === r; }); }).length;
    bi($('hero-footer'), adms.length + ' โครงการใน ' + rounds + ' รอบ • ข้อมูล myTCAS', adms.length + ' project(s) in ' + rounds + ' round(s) • myTCAS data');
    eachPanel(function (panel, round) {
      var list = adms.filter(function (a) { return a.round === round; });
      if (!list.length) {
        panel.innerHTML = row('block', 'หลักสูตรนี้ไม่เปิดรับรอบ ' + round, 'No Round ' + round + ' projects for this program',
          'ข้อมูลจาก myTCAS', 'From myTCAS', '', '', false);
        return;
      }
      // same project name listed twice (e.g. one per track) = one row
      var seen = {};
      var uniq = list.filter(function (a) { var k = a.project_name + '|' + (a.apply_end || ''); if (seen[k]) return false; seen[k] = 1; return true; });
      var open = uniq.filter(function (a) { return !isPast(a.apply_end); });
      var show = (open.length ? open : uniq).slice().sort(function (a, b) {
        return String(a.apply_end || '9') < String(b.apply_end || '9') ? -1 : 1;
      }).slice(0, 2);
      var html = show.map(function (a, i) {
        var bitsTh = [], bitsEn = [];
        if (a.seats) { bitsTh.push('รับ ' + a.seats + ' คน'); bitsEn.push(a.seats + ' seats'); }
        if (a.min_gpax != null && Number(a.min_gpax) > 0) { bitsTh.push('GPAX ขั้นต่ำ ' + Number(a.min_gpax).toFixed(2)); bitsEn.push('min GPAX ' + Number(a.min_gpax).toFixed(2)); }
        var d = day(a.apply_end);
        var past = isPast(a.apply_end);
        var sideTh = d ? (past ? 'ปิดแล้ว ' : 'ปิด ') + fmt(d, 'th') : 'ตามประกาศ';
        var sideEn = d ? (past ? 'Closed ' : 'Closes ') + fmt(d, 'en') : 'See announcement';
        return row(past ? 'event_busy' : 'event', a.project_name, a.project_name, bitsTh.join(' • '), bitsEn.join(' • '), sideTh, sideEn, i === 0 && !past);
      }).join('');
      var more = uniq.length - show.length;
      var docsRound = (((docs && docs.rounds) || []).find(function (x) { return x.round === round; }) || {}).recommended_docs || [];
      var docNames = docsRound.slice(0, 3);
      if (docNames.length) {
        html += row('description', 'เอกสารที่ใช้บ่อยในรอบนี้', 'Common documents this round',
          docNames.map(function (x) { return x.label_th; }).join(' • '), docNames.map(function (x) { return x.label_en; }).join(' • '), '', '', false);
      }
      html += '<button type="button" data-go-page="4" class="self-start inline-flex items-center gap-1 font-label text-label-md text-primary">' +
        biSpan(more > 0 ? 'ดูแผนเต็ม (+' + more + ' โครงการ)' : 'ดูแผนเต็ม', more > 0 ? 'Full plan (+' + more + ' projects)' : 'Full plan', '') +
        '<span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span></button>';
      panel.innerHTML = html;
    });
  }

  async function refresh() {
    if (!$('hero-title')) return;
    var choice = pick();
    var my = ++seq;
    if (!choice) { paintEmpty(); return; }
    if (choice.id !== shownId) paintLoading();
    try {
      var res = await Promise.all([
        get('/tcas/programs/' + encodeURIComponent(choice.id)),
        get('/tcas/programs/' + encodeURIComponent(choice.id) + '/documents').catch(function () { return null; })
      ]);
      if (my !== seq) return;
      paintProgram(res[0], res[1], choice);
    } catch (err) {
      if (my !== seq) return;
      shownId = null;
      eachPanel(function (panel) {
        panel.innerHTML = row('error', 'โหลดข้อมูลหลักสูตรไม่สำเร็จ', 'Could not load the program', PF_API.errorText(err), PF_API.errorText(err), '', '', false);
      });
    }
  }

  // the panels' buttons are added later, so route their clicks here
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-round-panel] [data-go-page]') : null;
    if (b && typeof goToPage === 'function') goToPage(b.getAttribute('data-go-page'));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else setTimeout(refresh, 0);

  return { refresh: refresh };
})();
