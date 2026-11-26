/* =========================================================================
 * PathFinder — PF_RM_REAL: the Page 4 target card from real myTCAS data
 *
 *   PF_RM_REAL.render(majorId)   fill the card for this major (loads what it needs)
 *   PF_RM_REAL.datesBar(roundId) apply / results / confirm dates of one round
 *   PF_RM_REAL.central()         "ปฏิทินกลาง TCAS" view
 *   PF_RM_REAL.programId(majorId)  the real program planned for this major (or null)
 *
 * Sources (all public, no login):
 *   GET /tcas/faculty-groups/:key/programs   popular real programs of the major's group
 *   GET /tcas/programs/:id                   projects per round: min_gpax, score_weights, apply_end
 *   GET /tcas/programs/:id/documents         documents each round asks for
 *   GET /tcas/calendar?university=           ทปอ. central calendar (+ that university's)
 * Nothing is guessed: a value the data doesn't have is shown as "—" or "ไม่ได้ระบุ".
 *
 * Load after js/api.js and js/roadmap.js (uses rmEsc, PF_STATE, currentLang).
 * ========================================================================= */
var PF_RM_REAL = window.PF_RM_REAL = (function () {
  // the discovery majors (catalog ids) -> backend faculty groups
  var GROUP_OF_MAJOR = { '1': 'computer-eng', '2': 'comm-arts', '3': 'architecture-design', '4': 'bba', '5': 'computer-eng', '6': 'comm-arts' };
  var SIM_KEY_OF_GROUP = { 'computer-eng': 'comp-eng', 'medicine': 'med', 'bba': 'bba', 'architecture-design': 'arch-ux', 'comm-arts': 'comm-arts', 'law': 'law' };

  var cache = {};
  function get(path) {
    if (!cache[path]) {
      cache[path] = PF_API.request(path, { auth: false });
      cache[path].catch(function () { delete cache[path]; });
    }
    return cache[path];
  }

  var cur = { majorId: null, programs: [], programId: null, program: null, docs: null, calendar: null, error: null };
  var seq = 0;

  function T(th, en) { return currentLang === 'th' ? th : en; }
  function $(id) { return document.getElementById(id); }
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function bi(el, th, en) {
    if (!el) return;
    el.setAttribute('data-th', th);
    el.setAttribute('data-en', en);
    el.textContent = T(th, en);
  }

  // 'YYYY-MM-DD' as a local date (no timezone shift)
  function day(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function daysUntil(d) { return Math.round((d - today()) / 86400000); }
  function fmtDay(d, lang) {
    return d ? d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short' }) : '';
  }
  function bothDay(d) { return { th: fmtDay(d, 'th'), en: fmtDay(d, 'en') }; }
  function range(a, b, lang) {
    var A = day(a), B = day(b);
    if (!A) return '';
    return B && +B !== +A ? fmtDay(A, lang) + ' – ' + fmtDay(B, lang) : fmtDay(A, lang);
  }

  // a calendar date is official when it comes from mytcas.com / ทปอ. (cupt.net) or the university's own .ac.th site;
  // dates from news sites are shown as "ไม่เป็นทางการ" until the official calendar confirms them
  function isOfficial(url) {
    var m = /^https?:\/\/([^\/]+)/i.exec(String(url || ''));
    // mytcas / ทปอ., or a Thai university's own site (.ac.th) for its own dates
    return !!m && /(^|\.)(mytcas\.com|cupt\.net)$|\.ac\.th$/i.test(m[1]);
  }
  function unofficialBadge() {
    return '<span class="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-[11px]" title="' + rmEsc(T('วันที่ยังไม่ยืนยันจาก mytcas.com (มาจากข่าว) อาจเปลี่ยน', 'Not confirmed by mytcas.com yet (from news), may change')) + '">' + T('ไม่เป็นทางการ', 'Unofficial') + '</span>';
  }

  function admissions() { return (cur.program && cur.program.admissions) || []; }

  // "TPAT3 วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์" -> "TPAT3", "A-Level คณิตศาสตร์ประยุกต์ 1" -> "A-Level คณิต 1"
  function shortSubject(name) { return pfSubjectLabel(String(name).replace(/\s+/g, ' ').trim()); }
  function isExam(name) { return /TGAT|TPAT|A-Level|GAT|PAT/i.test(name); }

  // the admission whose weights describe the program best: round 3 Admission, else the active round, else any
  function mainAdmission() {
    var withW = admissions().filter(function (a) { return a.score_weights && Object.keys(a.score_weights).length; });
    var exam = withW.filter(function (a) { return Object.keys(a.score_weights).some(isExam); });
    return exam.find(function (a) { return a.round === 3; }) || exam[0] || withW[0] || null;
  }

  function simFor() {
    var s = window.PF_SIM;
    return s && s.result && s.result.program && s.result.program.id === cur.programId ? s.result : null;
  }

  // ---------- loading ----------
  function chooseProgram(majorId, programs, group) {
    var saved = (PF_STATE.rmPrograms || {})[majorId];
    if (saved && programs.some(function (p) { return p.id === saved; })) return saved;
    // the program the student picked in the simulator, if it is in this group
    var simKey = SIM_KEY_OF_GROUP[group];
    if (PF_STATE.simFacultyKey === simKey && programs.some(function (p) { return p.id === PF_STATE.simProgramId; })) return PF_STATE.simProgramId;
    return programs[0] ? programs[0].id : null;
  }

  async function load(majorId, programId) {
    var my = ++seq;
    var group = GROUP_OF_MAJOR[majorId];
    cur.error = null;
    if (!group) { cur = { majorId: majorId, programs: [], programId: null, program: null, docs: null, calendar: null, error: null }; paint(); return; }
    try {
      var list = await get('/tcas/faculty-groups/' + group + '/programs?limit=10');
      if (my !== seq) return;
      var programs = (list.items || []).slice();
      var saved = (PF_STATE.rmPrograms || {})[majorId];
      if (saved && !programs.some(function (p) { return p.id === saved; })) {
        var extra = await get('/tcas/programs/' + encodeURIComponent(saved)).catch(function () { return null; });
        if (my !== seq) return;
        if (extra) programs.unshift({ id: extra.id, university: extra.university, program: extra.program, campus: extra.campus });
      }
      var pid = programId || chooseProgram(majorId, programs, group);
      var picked = programs.find(function (p) { return p.id === pid; });
      var res = await Promise.all([
        pid ? get('/tcas/programs/' + encodeURIComponent(pid)) : null,
        pid ? get('/tcas/programs/' + encodeURIComponent(pid) + '/documents').catch(function () { return null; }) : null,
        get('/tcas/calendar' + (picked ? '?university=' + encodeURIComponent(picked.university) : ''))
      ]);
      if (my !== seq) return;
      cur = { majorId: majorId, programs: programs, programId: pid, program: res[0], docs: res[1], calendar: res[2], error: null, group: list.group };
    } catch (err) {
      if (my !== seq) return;
      cur.majorId = majorId;
      cur.error = PF_API.errorText(err);
    }
    cur.loading = false;
    // the Page 4 task list is built from this program (tasksFor): redraw the whole roadmap once it arrives
    if (cur.program && lastTasksFor !== cur.program.id && typeof window.renderRoadmap === 'function') {
      lastTasksFor = cur.program.id;
      window.renderRoadmap(majorId);
    } else {
      paint();
    }
  }

  // ---------- painting ----------
  function paintProgramSelect() {
    var sel = $('rm-program-select');
    if (!sel) return;
    sel.innerHTML = cur.programs.map(function (p) {
      return '<option value="' + rmEsc(p.id) + '">' + rmEsc(p.university + ' • ' + p.program + (p.campus ? ' (' + p.campus + ')' : '')) + '</option>';
    }).join('');
    if (cur.programId) sel.value = cur.programId;
    var row = $('rm-program-row');
    if (row) row.classList.toggle('hidden', !cur.programs.length);
  }

  // "วท.บ. สาขาวิชาวิทยาการคอมพิวเตอร์ (ภาษาไทย ปกติ)" -> "วิทยาการคอมพิวเตอร์"
  function coreProgram(name) {
    return String(name || '').replace(/\s*\([^()]*(?:ภาษา|นานาชาติ|พิเศษ|ปกติ)[^()]*\)\s*$/, '')
      .replace(/^หลักสูตร/, '').replace(/^[ก-๙]{1,6}\.[ก-๙]{1,3}\.\s*/, '').replace(/^[ก-๙]+บัณฑิต\s*/, '').replace(/^(สาขาวิชา|สาขา)\s*/, '').trim() || name;
  }
  function paintTitle(p) {
    var el = $('roadmap-major-title');
    if (!el || !p) return;
    var name = coreProgram(p.program);
    var changed = el.getAttribute('data-th') !== name;
    el.setAttribute('data-th', name);
    el.setAttribute('data-en', name);
    // keep the pixel badge (js/visualizers.js) that sits in front of the text
    var badge = document.getElementById('roadmap-major-pixel-badge');
    el.textContent = name;
    if (badge) el.insertBefore(badge, el.firstChild);
    if (changed && window.pfMotion) window.pfMotion(el, 'pf-slide-in');
    if (changed) setTimeout(replayTimeline, 50);
  }

  function paintHeader() {
    var p = cur.program;
    setText('rm-uni-name', p ? p.university + (p.campus ? ' • ' + p.campus : '') : (cur.error || '—'));
    paintTitle(p);

    var badge = $('roadmap-match-badge');
    if (badge) {
      var pct = PF_STATE.lockedMatchPct;
      badge.classList.toggle('hidden', !pct);
      if (pct) bi(badge, 'ตรงกัน ' + pct, pct + ' Match');
    }

    // GPAX: only what the projects state
    var mins = admissions().map(function (a) { return a.min_gpax; }).filter(function (v) { return v !== null && v !== undefined; }).map(Number);
    var gp = $('rm-sub-gpax');
    if (!p) bi(gp, '—', '—');
    else if (!mins.length) bi(gp, 'myTCAS ไม่ได้ระบุขั้นต่ำ', 'No minimum on myTCAS');
    else {
      var lo = Math.min.apply(null, mins), hi = Math.max.apply(null, mins);
      var txt = 'GPAX ≥ ' + lo.toFixed(2) + (hi !== lo ? '–' + hi.toFixed(2) : '');
      bi(gp, txt + (hi !== lo ? ' (แล้วแต่โครงการ)' : ''), txt + (hi !== lo ? ' (varies by project)' : ''));
    }

    var main = mainAdmission();
    var w = $('rm-sub-weights');
    if (!main) bi(w, '—', '—');
    else {
      var parts = Object.keys(main.score_weights).map(function (k) { return [shortSubject(k), Number(main.score_weights[k])]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4)
        .map(function (x) { return x[0] + ' ' + x[1] + '%'; }).join(' • ');
      bi(w, parts + ' (รอบ ' + main.round + ')', parts + ' (Round ' + main.round + ')');
    }

    var dEl = $('rm-sub-docs');
    var rounds = (cur.docs && cur.docs.rounds) || [];
    var withDocs = rounds.filter(function (r) { return (r.recommended_docs || []).length; });
    var active = Number(String(PF_STATE.activeRound || 'r1').replace('r', ''));
    var dr = withDocs.find(function (r) { return r.round === active; }) || withDocs[0];
    if (!dr) bi(dEl, '—', '—');
    else {
      var docs = dr.recommended_docs.slice().sort(function (a, b) { return (b.projects || 0) - (a.projects || 0); }).slice(0, 3);
      bi(dEl, 'รอบ ' + dr.round + ': ' + docs.map(function (d) { return d.label_th; }).join(' • '),
        'Round ' + dr.round + ': ' + docs.map(function (d) { return d.label_en; }).join(' • '));
    }
  }

  // next date the student has to act on: a project deadline of this program or a round's application window
  function nextDeadline() {
    var c = [];
    admissions().forEach(function (a) {
      var d = day(a.apply_end);
      if (d && daysUntil(d) >= 0) c.push({ d: d, th: 'ปิดรับ ' + a.project_name, en: 'Closes: ' + a.project_name });
    });
    ((cur.calendar && cur.calendar.items) || []).forEach(function (it) {
      if (!it.round || !/รับสมัคร/.test(it.event)) return;
      var end = day(it.end_date), start = day(it.start_date);
      var u = isOfficial(it.source_url) ? '' : ' (ไม่เป็นทางการ)', ue = isOfficial(it.source_url) ? '' : ' (unofficial)';
      if (start && daysUntil(start) >= 0) c.push({ d: start, th: it.event + u, en: it.event + ue });
      else if (end && daysUntil(end) >= 0) c.push({ d: end, th: it.event + ' (วันสุดท้าย)' + u, en: it.event + ' (last day)' + ue });
    });
    c.sort(function (a, b) { return a.d - b.d; });
    return c[0] || null;
  }

  function paintCountdown() {
    var el = $('countdown-readout');
    var cap = $('countdown-caption');
    var n = cur.program ? nextDeadline() : null;
    if (!n) {
      bi(el, '—', '—');
      if (cap) cap.textContent = '';
      return;
    }
    var days = daysUntil(n.d);
    var th = days === 0 ? 'วันนี้' : (days <= 60 ? days + ' วัน' : Math.round(days / 30) + ' เดือน');
    var en = days === 0 ? 'Today' : (days <= 60 ? days + ' days' : Math.round(days / 30) + ' months');
    bi(el, th, en);
    // calendar events carry long notes in brackets; the caption keeps the event itself (full text in the tooltip)
    var short = function (t) { return t.replace(/\s*\((?!ไม่เป็นทางการ|unofficial)[^)]*\)/g, '').trim().slice(0, 80); };
    if (cap) {
      bi(cap, short(n.th) + ' • ' + fmtDay(n.d, 'th'), short(n.en) + ' • ' + fmtDay(n.d, 'en'));
      cap.title = n.th + ' • ' + fmtDay(n.d, currentLang);
    }
  }

  function paintWarnings() {
    var box = $('rm-warnings-box');
    if (!box) return;
    var w = [];
    if (cur.error) w.push({ th: 'โหลดเกณฑ์จริงไม่สำเร็จ: ' + cur.error, en: 'Could not load real criteria: ' + cur.error });
    admissions().forEach(function (a) {
      var d = day(a.apply_end);
      var n = d ? daysUntil(d) : -1;
      if (n >= 0 && n <= 30) {
        w.push({
          th: 'รอบ ' + a.round + ' "' + a.project_name + '" ปิดรับ ' + fmtDay(d, 'th') + ' (อีก ' + n + ' วัน)',
          en: 'Round ' + a.round + ' "' + a.project_name + '" closes ' + fmtDay(d, 'en') + ' (' + n + ' days left)'
        });
      }
    });
    var gpax = PF_STATE.gpaxSet ? Number(PF_STATE.gpax) : 0; // unknown GPAX: no 'below minimum' warning
    var mins = admissions().filter(function (a) { return a.min_gpax !== null && a.min_gpax !== undefined; });
    var below = mins.filter(function (a) { return gpax > 0 && gpax < Number(a.min_gpax); });
    if (below.length) {
      w.push({
        th: 'GPAX ' + gpax.toFixed(2) + ' ยังต่ำกว่าขั้นต่ำของ ' + below.length + ' โครงการ (ต่ำสุดที่ขอ ' + Math.min.apply(null, below.map(function (a) { return Number(a.min_gpax); })).toFixed(2) + ')',
        en: 'GPAX ' + gpax.toFixed(2) + ' is below the minimum of ' + below.length + ' project(s)'
      });
    }
    box.classList.toggle('hidden', !w.length);
    box.innerHTML = w.map(function (x) {
      return '<div class="flex items-start gap-2 font-body text-body-sm text-on-tertiary-container">' +
        '<span class="material-symbols-outlined text-[18px] text-tertiary-text shrink-0 mt-0.5" aria-hidden="true">warning</span>' +
        '<span data-th="' + rmEsc(x.th) + '" data-en="' + rmEsc(x.en) + '">' + rmEsc(T(x.th, x.en)) + '</span>' +
      '</div>';
    }).join('');
  }

  function paintRoundTabs() {
    var have = {};
    admissions().forEach(function (a) { have['r' + a.round] = true; });
    var sim = simFor();
    var best = sim && sim.best ? 'r' + sim.best.round : null;
    ['r1', 'r2', 'r3', 'r4'].forEach(function (r) {
      var tabBtn = document.querySelector('[data-rm-tab="' + r + '"]');
      var recDot = document.querySelector('[data-rm-rec-dot="' + r + '"]');
      // no program loaded yet: leave every round usable
      var unavailable = !!cur.program && !have[r];
      if (recDot) recDot.classList.toggle('hidden', r !== best);
      if (tabBtn) {
        tabBtn.disabled = unavailable;
        tabBtn.classList.toggle('opacity-45', unavailable);
        tabBtn.classList.toggle('cursor-not-allowed', unavailable);
        tabBtn.title = unavailable ? T('หลักสูตรนี้ไม่เปิดรับรอบนี้ (myTCAS)', 'This program has no projects in this round (myTCAS)') : '';
      }
    });
  }

  function examDate(subject) {
    var key = /^TGAT/.test(subject) ? 'TGAT' : (/^TPAT\d/.exec(subject) || [])[0] || String(subject).replace(/^A-Level\s*/, '');
    var hit = ((cur.calendar && cur.calendar.items) || []).find(function (it) { return !it.university && /^สอบ /.test(it.event) && it.event.indexOf(key) !== -1; });
    if (!hit) return null;
    var d = day(hit.start_date);
    if (d) d.unofficial = !isOfficial(hit.source_url);
    return d;
  }

  function paintExams() {
    var strip = $('rm-exams-strip');
    if (!strip) return;
    var main = mainAdmission();
    var subjects = main ? Object.keys(main.score_weights).filter(isExam) : [];
    if (!subjects.length) {
      strip.innerHTML = '<p class="font-body text-body-sm text-on-surface-variant">' +
        rmEsc(cur.program ? T('หลักสูตรนี้ไม่มีสัดส่วนวิชาสอบในข้อมูล myTCAS', 'No exam weights for this program on myTCAS') : (cur.error || '—')) + '</p>';
      return;
    }
    var sim = simFor();
    var simAdm = sim && (sim.admissions || []).find(function (a) { return a.round === main.round && a.project_name === main.project_name; });
    var simParts = (simAdm && simAdm.score && simAdm.score.parts) || [];
    var cards = subjects.sort(function (a, b) { return main.score_weights[b] - main.score_weights[a]; }).map(function (s) {
      var d = examDate(s);
      var part = simParts.find(function (p) { return p.subject === s; });
      var you = part && typeof part.your_percent === 'number' ? part.your_percent : null;
      var weight = Number(main.score_weights[s]);
      return '<div class="min-w-[210px] shrink-0 p-gutter-sm rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-1.5">' +
        '<div class="flex items-center justify-between gap-2">' +
          '<span class="font-title text-label-md font-semibold text-on-surface">' + rmEsc(shortSubject(s)) + '</span>' +
          (d ? '<span class="inline-flex items-center gap-1">' + (d.unofficial ? unofficialBadge() : '') + '<span class="px-2 py-0.5 rounded-full bg-surface-container-low font-metric text-[11px] text-on-surface-variant">' + rmEsc(T('สอบ ', '') + fmtDay(d, currentLang)) + '</span></span>' : '') +
        '</div>' +
        '<div class="flex items-center justify-between text-xs font-metric text-on-surface-variant">' +
          '<span>' + T('คะแนนจำลอง ', 'Simulated ') + (you === null ? '—' : you) + '</span>' +
          '<span class="text-primary font-semibold">' + T('น้ำหนัก ', 'Weight ') + weight + '%</span>' +
        '</div>' +
        '<div class="w-full h-2 rounded-full bg-surface-container overflow-hidden" title="' + rmEsc(T('สัดส่วนคะแนนของวิชานี้', 'Share of the total score')) + '"><div class="h-full rounded-full bg-secondary" style="width:' + Math.min(100, weight) + '%"></div></div>' +
      '</div>';
    });
    var lastMin = main.last_year_min_score;
    if (lastMin !== null && lastMin !== undefined) {
      cards.push('<div class="min-w-[180px] shrink-0 p-gutter-sm rounded-xl bg-surface-container-low border border-outline-variant flex flex-col gap-1">' +
        '<span class="font-label text-label-sm text-on-surface-variant">' + T('คะแนนต่ำสุดปีก่อน (รอบ ', 'Last year\'s lowest (Round ') + main.round + ')</span>' +
        '<span class="font-metric text-title-md text-on-surface">' + Number(lastMin).toFixed(2) + '</span>' +
        '<span class="font-label text-[11px] text-on-surface-variant">' + T('ที่มา: สถิติ ทปอ.', 'Source: official TCAS stats') + '</span>' +
      '</div>');
    }
    strip.innerHTML = cards.join('');
  }

  // Oct -> Jun of the admission cycle we are in, dots at real dates
  function paintTimeline() {
    var track = $('rm-timeline-track');
    if (!track) return;
    var t = today();
    var y = t.getMonth() >= 6 ? t.getFullYear() : t.getFullYear() - 1;
    var start = new Date(y, 9, 1), end = new Date(y + 1, 6, 1);
    var pos = function (d) { return Math.max(0, Math.min(100, ((d - start) / (end - start)) * 100)); };
    var dots = [];
    ((cur.calendar && cur.calendar.items) || []).forEach(function (it) {
      var d = day(it.start_date);
      if (!d || d < start || d >= end) return;
      var isApply = it.round && /รับสมัคร/.test(it.event) && !/เพิ่มเติม/.test(it.event);
      var isExamDay = !it.university && /^สอบ /.test(it.event);
      if (isApply || isExamDay) dots.push({ d: d, label: it.event + (isOfficial(it.source_url) ? '' : T(' (ไม่เป็นทางการ)', ' (unofficial)')), cls: isApply ? 'bg-primary' : 'bg-secondary' });
    });
    admissions().forEach(function (a) {
      var d = day(a.apply_end);
      if (d && d >= start && d < end) dots.push({ d: d, label: T('ปิดรับ ', 'Closes: ') + a.project_name, cls: 'bg-tertiary' });
    });
    // the next event gets data-next-dot; replayTimeline() animates when the page is actually seen (2.10)
    var nextDot = dots.filter(function (x) { return x.d >= t; }).sort(function (a, b) { return a.d - b.d; })[0];
    var months = currentLang === 'th' ? ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'] : ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    var inRange = t >= start && t < end;
    track.innerHTML =
      '<div class="min-w-[520px] relative px-2 pt-3">' +
        '<div class="h-2 rounded-full bg-surface-container relative">' +
          (inRange ? '<div data-today-line class="pf-today-line absolute top-[-10px] bottom-[-6px] w-0.5 bg-tertiary" style="left:' + pos(t).toFixed(1) + '%;" data-left="' + pos(t).toFixed(1) + '" title="' + rmEsc(fmtDay(t, currentLang)) + '">' +
            '<span class="absolute -top-5 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-tertiary text-on-tertiary text-[10px] font-label whitespace-nowrap">' + T('วันนี้', 'Today') + '</span>' +
          '</div>' : '') +
          dots.map(function (x) {
            return '<span class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full ' + x.cls + ' border-2 border-white"' + (x === nextDot ? ' data-next-dot' : '') + ' style="left:' + pos(x.d).toFixed(1) + '%;" title="' + rmEsc(x.label + ' • ' + fmtDay(x.d, currentLang)) + '"></span>';
          }).join('') +
        '</div>' +
        '<div class="grid grid-cols-9 gap-1 mt-2 text-center font-label text-[11px] text-on-surface-variant">' +
          months.map(function (m) { return '<span>' + m + '</span>'; }).join('') +
        '</div>' +
      '</div>';
  }
  // page 4 opened / program changed: "today" travels from the start to its date, the next event pings twice
  function replayTimeline() {
    var track = $('rm-timeline-track');
    if (!track || !track.offsetParent || (window.pfReducedMotion && window.pfReducedMotion())) return;
    var line = track.querySelector('[data-today-line]');
    if (line) {
      line.style.transition = 'none';
      line.style.left = '0%';
      void line.offsetWidth;
      line.style.transition = '';
      line.style.left = line.getAttribute('data-left') + '%';
    }
    if (window.pfMotion) window.pfMotion(track.querySelector('[data-next-dot]'), 'pf-ping-once');
  }

  // one round of the central calendar: apply / results / confirm (first matching event of each)
  function roundDates(r) {
    var items = ((cur.calendar && cur.calendar.items) || []).filter(function (it) { return it.round === r && !it.university; });
    var find = function (re) { return items.find(function (it) { return re.test(it.event); }); };
    var apply = find(/รับสมัคร/), ann = find(/ประกาศผล/), conf = find(/ยืนยันสิทธิ์/);
    var fmt = function (it, lang) {
      if (!it) return '—';
      var txt = range(it.start_date, it.end_date, lang);
      return /ตั้งแต่/.test(it.event) && !it.end_date ? (lang === 'th' ? 'ตั้งแต่ ' : 'From ') + txt : txt;
    };
    return {
      apply: { th: fmt(apply, 'th'), en: fmt(apply, 'en') },
      announce: { th: fmt(ann, 'th'), en: fmt(ann, 'en') },
      confirm: { th: fmt(conf, 'th'), en: fmt(conf, 'en') },
      source: (apply || ann || conf || {}).source_url || null,
      official: [apply, ann, conf].filter(Boolean).every(function (it) { return isOfficial(it.source_url); })
    };
  }

  function datesBar(roundId) {
    var bar = $('rm-round-dates-bar');
    if (!bar) return;
    var r = Number(String(roundId || 'r1').replace('r', '')) || 1;
    if (!cur.calendar) {
      bar.innerHTML = '<span class="text-xs font-label text-on-surface-variant">' + rmEsc(cur.error || T('กำลังโหลดปฏิทิน…', 'Loading calendar…')) + '</span>';
      return;
    }
    var d = roundDates(r);
    // this program's own deadlines in that round
    var own = admissions().filter(function (a) { return a.round === r && day(a.apply_end); })
      .map(function (a) { return day(a.apply_end); }).filter(function (x) { return daysUntil(x) >= 0; }).sort(function (a, b) { return a - b; })[0];
    var item = function (th, en, v) {
      return '<span>' + T(th, en) + '<strong class="text-on-surface">' + rmEsc(T(v.th, v.en)) + '</strong></span>';
    };
    bar.innerHTML =
      '<div class="flex flex-wrap items-center gap-3 text-xs font-label text-on-surface-variant">' +
        item('รับสมัคร: ', 'Apply: ', d.apply) +
        item('ประกาศผล: ', 'Results: ', d.announce) +
        item('ยืนยันสิทธิ์: ', 'Confirm: ', d.confirm) +
        (own ? item('หลักสูตรนี้ปิดรับ: ', 'This program closes: ', bothDay(own)) : '') +
      '</div>' +
      (d.source
        ? '<a href="' + rmEsc(d.source) + '" target="_blank" rel="noopener" class="px-2.5 py-0.5 rounded-full font-label text-label-sm ' + (d.official ? 'bg-secondary-container text-on-secondary-container">' + T('ปฏิทิน ทปอ.', 'Official calendar') : 'bg-tertiary-container text-on-tertiary-container">' + T('ไม่เป็นทางการ', 'Unofficial')) + '</a>'
        : '');
  }

  // one round for the selected program: apply = its own projects' windows (myTCAS), else its university's
  // calendar row, else the central date; results / confirm are TCAS system dates (the same for every faculty)
  function programRound(r) {
    var p = cur.program;
    var adms = admissions().filter(function (a) { return a.round === r; });
    if (!adms.length) return { none: true };
    var seen = {};
    var dated = adms.filter(function (a) { return a.apply_start || a.apply_end; }).filter(function (a) {
      var k = a.project_name + '|' + a.apply_start + '|' + a.apply_end; if (seen[k]) return false; seen[k] = 1; return true;
    }).sort(function (a, b) { return String(a.apply_start || a.apply_end) < String(b.apply_start || b.apply_end) ? -1 : 1; });
    var win = function (a, lang) {
      if (a.apply_start && a.apply_end) return range(a.apply_start, a.apply_end, lang);
      if (a.apply_end) return (lang === 'th' ? 'ปิด ' : 'Closes ') + fmtDay(day(a.apply_end), lang);
      return (lang === 'th' ? 'เปิด ' : 'Opens ') + fmtDay(day(a.apply_start), lang);
    };
    if (dated.length) {
      var open = dated.filter(function (a) { var e = day(a.apply_end || a.apply_start); return e && daysUntil(e) >= 0; });
      var main = open[0] || dated[dated.length - 1];
      var closed = !open.length;
      return {
        projects: adms.length,
        apply: { th: win(main, 'th') + (closed ? ' (ปิดแล้ว)' : ''), en: win(main, 'en') + (closed ? ' (closed)' : '') },
        applyFrom: { th: 'หลักสูตรนี้', en: 'This program' },
        // still-open projects first, then the ones that already closed
        list: open.concat(dated.filter(function (a) { return open.indexOf(a) === -1; })).slice(0, 4).map(function (a) { return { name: a.project_name, th: win(a, 'th'), en: win(a, 'en'), past: !!day(a.apply_end) && daysUntil(day(a.apply_end)) < 0 }; }),
        more: Math.max(0, dated.length - 4),
        source: (main.source_url) || null
      };
    }
    var uniRow = ((cur.calendar && cur.calendar.items) || []).find(function (it) {
      return it.round === r && it.university && p && it.university === p.university && /รับสมัคร/.test(it.event) &&
        (!p.campus || it.event.indexOf('(') === -1 || it.event.indexOf(p.campus) !== -1);
    });
    if (uniRow) {
      return { projects: adms.length, apply: { th: range(uniRow.start_date, uniRow.end_date, 'th'), en: range(uniRow.start_date, uniRow.end_date, 'en') },
        applyFrom: { th: 'ปฏิทินของมหาวิทยาลัย', en: 'University calendar' }, list: [], more: 0, source: uniRow.source_url };
    }
    var c = roundDates(r);
    return { projects: adms.length, apply: c.apply, applyFrom: r === 3 ? { th: 'ระบบ TCAS (ทุกคณะ)', en: 'TCAS system (all)' } : { th: 'ปฏิทินกลาง (หลักสูตรยังไม่ประกาศวัน)', en: 'Central (program dates not out yet)' }, list: [], more: 0, source: c.source };
  }

  function central() {
    var grid = $('rm-central-calendar-grid');
    if (!grid) return;
    var paintGrid = function () {
      if (!cur.calendar) { grid.textContent = cur.error || T('กำลังโหลดปฏิทิน…', 'Loading calendar…'); return; }
      var p = cur.program;
      // header: the program the plan is for, or the plain central calendar when none is chosen yet
      if (p) {
        bi($('rm-cal-pill'), 'ปฏิทินของหลักสูตรที่เลือก', 'Your program\'s calendar');
        var t = coreProgram(p.program) + ' • ' + p.university + (p.campus ? ' (' + p.campus + ')' : '');
        bi($('rm-cal-title'), t, t);
        bi($('rm-cal-note'), 'วันรับสมัครจากโครงการของหลักสูตรนี้ (myTCAS) • ประกาศผล/ยืนยันสิทธิ์ตามระบบ TCAS', 'Apply dates from this program\'s projects (myTCAS) • results/confirm from the TCAS system');
      } else {
        bi($('rm-cal-pill'), 'ปฏิทินกลาง TCAS70', 'TCAS70 Central Calendar');
        bi($('rm-cal-title'), 'กำหนดการรับสมัครทั้ง 4 รอบ (ทปอ.)', 'Official 4-Round Admission Schedule');
        bi($('rm-cal-note'), 'เลือกหรือล็อกหลักสูตรเพื่อดูวันของคณะนั้น', 'Pick or lock a program to see its own dates');
      }
      var names = { 1: ['รอบ 1 Portfolio', 'Round 1 Portfolio'], 2: ['รอบ 2 Quota', 'Round 2 Quota'], 3: ['รอบ 3 Admission', 'Round 3 Admission'], 4: ['รอบ 4 Direct Admission', 'Round 4 Direct Admission'] };
      var badge = function (src, official, okTh) {
        if (!src) return '';
        return '<a href="' + rmEsc(src) + '" target="_blank" rel="noopener" class="px-2.5 py-0.5 rounded-full font-label text-label-sm ' +
          (official ? 'bg-secondary-container text-on-secondary-container">' + T(okTh, 'Source') : 'bg-tertiary-container text-on-tertiary-container">' + T('ไม่เป็นทางการ', 'Unofficial')) + '</a>';
      };
      grid.innerHTML = [1, 2, 3, 4].map(function (r) {
        var d = roundDates(r);
        var cell = function (th, en, v, fromTh, fromEn) {
          return '<div><span class="block opacity-75">' + T(th, en) + '</span><strong class="text-on-surface">' + rmEsc(T(v.th, v.en)) + '</strong>' +
            (fromTh ? '<span class="block text-[10px] opacity-75">' + rmEsc(T(fromTh, fromEn)) + '</span>' : '') + '</div>';
        };
        var head = function (extra, b) {
          return '<div class="flex items-center justify-between gap-2">' +
            '<span class="font-title text-title-md text-on-surface">' + T(names[r][0], names[r][1]) + rmEsc(extra || '') + '</span>' + b + '</div>';
        };
        if (!p) {
          return '<article class="p-gutter-md rounded-xl bg-surface-container-low border border-outline-variant flex flex-col gap-1.5">' +
            head('', badge(d.source, d.official, 'ที่มา')) +
            '<div class="grid grid-cols-3 gap-2 pt-1 text-xs font-label text-on-surface-variant">' +
              cell('รับสมัคร', 'Apply', d.apply) + cell('ประกาศผล', 'Results', d.announce) + cell('ยืนยันสิทธิ์', 'Confirm', d.confirm) +
            '</div></article>';
        }
        var pr = programRound(r);
        if (pr.none) {
          return '<article class="p-gutter-md rounded-xl bg-surface-container-low/60 border border-dashed border-outline-variant flex flex-col gap-1.5 opacity-80">' +
            head('', '') +
            '<p class="text-xs font-label text-on-surface-variant">' + T('หลักสูตรนี้ไม่เปิดรับรอบนี้ (ข้อมูล myTCAS)', 'This program has no projects in this round (myTCAS)') + '</p></article>';
        }
        var list = pr.list.length
          ? '<ul class="flex flex-col gap-0.5 pt-1 border-t border-outline-variant/60 text-[11px] font-label text-on-surface-variant">' +
              pr.list.map(function (x) {
                return '<li class="flex justify-between gap-2' + (x.past ? ' opacity-60 line-through' : '') + '"><span class="truncate">' + rmEsc(x.name) + '</span><span class="shrink-0 tabular-nums">' + rmEsc(T(x.th, x.en)) + '</span></li>';
              }).join('') +
              (pr.more ? '<li class="opacity-75">' + T('และอีก ' + pr.more + ' โครงการ', '+' + pr.more + ' more') + '</li>' : '') +
            '</ul>'
          : '';
        return '<article class="p-gutter-md rounded-xl bg-surface-container-low border border-outline-variant flex flex-col gap-1.5">' +
          head(T(' • ' + pr.projects + ' โครงการ', ' • ' + pr.projects + ' project(s)'), badge(pr.source, isOfficial(pr.source) || /ac\.th|mytcas/i.test(String(pr.source || '')), 'ที่มา')) +
          '<div class="grid grid-cols-3 gap-2 pt-1 text-xs font-label text-on-surface-variant">' +
            cell('รับสมัคร', 'Apply', pr.apply, pr.applyFrom.th, pr.applyFrom.en) +
            cell('ประกาศผล', 'Results', d.announce, 'ระบบ TCAS (ทุกคณะ)', 'TCAS system (all)') +
            cell('ยืนยันสิทธิ์', 'Confirm', d.confirm, 'ระบบ TCAS (ทุกคณะ)', 'TCAS system (all)') +
          '</div>' + list +
        '</article>';
      }).join('');
    };
    paintGrid();
    // the central calendar doesn't need a program: load it on its own if the card hasn't yet
    if (!cur.calendar) {
      get('/tcas/calendar').then(function (c) { if (!cur.calendar) { cur.calendar = c; paintGrid(); } })
        .catch(function (err) { grid.textContent = PF_API.errorText(err); });
    }
  }

  function paintLoading() {
    ['rm-sub-gpax', 'rm-sub-weights', 'rm-sub-docs', 'countdown-readout'].forEach(function (id) { bi($(id), '…', '…'); });
    bi($('rm-uni-name'), 'กำลังโหลดหลักสูตรจริง…', 'Loading real programs…');
    setText('countdown-caption', '');
    var strip = $('rm-exams-strip');
    if (strip) strip.innerHTML = '';
  }


  // ---------- Page 4 task list from the real program (replaces the sample tasks once loaded) ----------
  // steps per document type of GET /tcas/programs/:id/documents (what each one asks the student to do)
  var DOC_STEPS = {
    portfolio: { th: 'แฟ้มสะสมผลงาน (Portfolio)', steps: [['รวบรวมผลงาน กิจกรรม และเกียรติบัตรที่เกี่ยวกับสาขานี้', 'Collect work, activities and certificates related to this program'], ['เรียงเป็นแฟ้มตามรูปแบบที่ประกาศของโครงการกำหนด (จำนวนหน้า / ขนาดไฟล์)', "Lay it out the way the project's announcement asks (pages / file size)"], ['ให้ครูหรือรุ่นพี่ช่วยอ่านทวนก่อนส่ง', 'Ask a teacher or senior to review it before sending']], deliverable: ['ไฟล์ Portfolio ตามรูปแบบของโครงการ', 'Portfolio file in the required format'] },
    interview: { th: 'เตรียมสอบสัมภาษณ์', steps: [['อ่านหลักสูตรและวิชาที่เรียนของสาขานี้ที่ mytcas / เว็บคณะ', 'Read what this program teaches (myTCAS / faculty site)'], ['เตรียมคำตอบ: ทำไมเลือกสาขานี้ จุดแข็ง และผลงานที่ภูมิใจ', 'Prepare answers: why this program, strengths, proudest work'], ['ซ้อมสัมภาษณ์กับครูหรือเพื่อน', 'Practise with a teacher or friend']], deliverable: ['บันทึกคำตอบสัมภาษณ์', 'Interview answer notes'] },
    transcript: { th: 'ใบแสดงผลการเรียน (ปพ.1)', steps: [['ขอ ปพ.1 จากฝ่ายทะเบียนของโรงเรียน', "Request your transcript from the school's registrar"], ['เช็กว่าจำนวนภาคเรียนตรงกับที่โครงการกำหนด', 'Check it covers the semesters the project asks for']], deliverable: ['ไฟล์ ปพ.1', 'Transcript file'] },
    english_test: { th: 'ผลสอบภาษาอังกฤษ', steps: [['ดูว่าโครงการรับผลสอบอะไรและคะแนนขั้นต่ำเท่าไร', 'See which tests and minimum scores the project accepts'], ['สมัครสอบให้ผลออกทันก่อนวันปิดรับ', 'Book a test date whose results arrive before the deadline']], deliverable: ['ผลสอบภาษาอังกฤษ', 'English test result'] },
    certificates: { th: 'เกียรติบัตร / รางวัล', steps: [['รวบรวมเกียรติบัตรที่เกี่ยวข้องกับสาขา', 'Gather certificates related to the program'], ['สแกนเป็นไฟล์ให้ชัดเจน', 'Scan them clearly']], deliverable: ['ไฟล์เกียรติบัตร', 'Certificate files'] },
    recommendation: { th: 'จดหมายรับรอง', steps: [['ขอจดหมายรับรองจากครูที่สอนวิชาที่เกี่ยวข้อง', 'Ask a teacher of a related subject for a letter'], ['ให้เวลาครูอย่างน้อย 1–2 สัปดาห์ก่อนวันส่ง', 'Give them at least 1–2 weeks before the deadline']], deliverable: ['จดหมายรับรอง', 'Recommendation letter'] },
    essay: { th: 'เรียงความ / Statement', steps: [['อ่านหัวข้อที่โครงการกำหนด', "Read the project's essay topic"], ['เขียนร่าง แล้วให้ครูช่วยอ่าน', 'Draft it and ask a teacher to read it']], deliverable: ['เรียงความ', 'Essay'] },
    sport: { th: 'หลักฐานผลงานด้านกีฬา', steps: [['รวบรวมผลการแข่งขันและหนังสือรับรองจากสมาคม/โรงเรียน', 'Gather results and letters from your club / school']], deliverable: ['หลักฐานผลงานกีฬา', 'Sports records'] },
    health: { th: 'ใบรับรองแพทย์ / ตรวจสุขภาพ', steps: [['ตรวจสุขภาพตามรายการที่โครงการกำหนด', 'Get the health check the project lists']], deliverable: ['ใบรับรองแพทย์', 'Medical certificate'] },
    talent_test: { th: 'สอบปฏิบัติ / ทดสอบความสามารถ', steps: [['ดูรูปแบบการสอบปฏิบัติในประกาศของโครงการ', 'Read the format of the practical test'], ['ซ้อมตามรูปแบบนั้น', 'Practise that format']], deliverable: ['พร้อมสอบปฏิบัติ', 'Ready for the practical test'] }
  };
  function stepsOf(pairs, i) { return pairs.map(function (p) { return p[i]; }); }

  // "จุดเด่น Beyond 4.00": what this program's projects ask for besides grades / exam scores (myTCAS announcements)
  var BEYOND_TIPS = {
    portfolio: ['เลือกผลงานที่ตรงกับสาขา เล่าโจทย์ วิธีทำ และสิ่งที่ได้เรียนรู้', 'Pick work that fits the field: the problem, how you did it, what you learned'],
    certificates: ['รวบรวมเกียรติบัตร/รางวัลที่เกี่ยวกับสาขา เรียงจากระดับสูงสุด', 'Collect field-related certificates and awards, highest level first'],
    english_test: ['ดูว่าโครงการรับผลสอบแบบไหน และวางแผนสอบให้ผลออกก่อนปิดรับ', 'Check which tests are accepted and book one whose result arrives before the deadline'],
    essay: ['ร่างเรียงความว่าทำไมอยากเรียนสาขานี้ ยกตัวอย่างจากประสบการณ์จริง', 'Draft why you want this field, with examples from your own experience'],
    recommendation: ['ขอจดหมายรับรองจากครูที่รู้จักผลงานคุณ ล่วงหน้าอย่างน้อย 2 สัปดาห์', 'Ask a teacher who knows your work for a letter, well before the deadline'],
    sport: ['เตรียมหลักฐานผลงานกีฬาตามระดับที่โครงการกำหนด', 'Prepare proof of sports results at the level the project asks for'],
    talent_test: ['ดูรูปแบบการสอบปฏิบัติในประกาศ แล้วซ้อมตามรูปแบบนั้น', 'Read the practical test format and practise it'],
    interview: ['ซ้อมเล่าว่าทำไมเลือกสาขานี้ และผลงานที่ภูมิใจที่สุด', 'Practise explaining why this field and the work you are proudest of']
  };
  function beyond(majorId) {
    if (String(majorId) !== cur.majorId || !cur.program || cur.loading) return null;
    var byType = {};
    ((cur.docs && cur.docs.rounds) || []).forEach(function (r) {
      (r.recommended_docs || []).forEach(function (d) {
        if (!BEYOND_TIPS[d.type]) return;
        var b = byType[d.type] || (byType[d.type] = { type: d.type, th: d.label_th, en: d.label_en, projects: 0, rounds: [], evidence: d.evidence });
        b.projects += d.projects || 0;
        if (b.rounds.indexOf(r.round) === -1) b.rounds.push(r.round);
      });
    });
    var items = Object.keys(byType).map(function (k) { return byType[k]; })
      .sort(function (a, b) { return b.projects - a.projects; }).slice(0, 4)
      .map(function (b) {
        var rs = b.rounds.sort().join(', ');
        return {
          titleTh: b.th, titleEn: b.en,
          descTh: 'ใช้ใน ' + b.projects + ' โครงการ (รอบ ' + rs + ') • ' + BEYOND_TIPS[b.type][0],
          descEn: 'Used by ' + b.projects + ' project(s) (round ' + rs + ') • ' + BEYOND_TIPS[b.type][1]
        };
      });
    return { program: cur.program, items: items };
  }

  var lastTasksFor = null; // program id the task list was last built for (re-render once when it loads)

  function tasksFor(majorId, roundId) {
    if (String(majorId) !== cur.majorId || !cur.program || cur.loading) return null;
    var round = Number(String(roundId).replace('r', ''));
    var pid = String(cur.program.id).slice(0, 8);
    var adms = admissions().filter(function (a) { return a.round === round; });
    var t0 = today();
    var out = [];
    function add(t) {
      out.push(Object.assign({
        _idx: out.length, _key: pid + '-' + roundId + '-' + t.k, sourceKind: 'real',
        sourceLabelTh: 'จาก myTCAS', sourceLabelEn: 'From myTCAS', toolsTh: 'mytcas.com', toolsEn: 'mytcas.com'
      }, t));
    }
    // dates from news (not mytcas.com) say so: "(ไม่เป็นทางการ)"
    function dateText(start, end, src) {
      var u = src && !isOfficial(src);
      return { th: (range(start, end, 'th') || 'ตามประกาศ') + (u ? ' (ไม่เป็นทางการ)' : ''), en: (range(start, end, 'en') || 'See announcement') + (u ? ' (unofficial)' : '') };
    }
    function passed(iso) { var d = day(iso); return !!d && d < t0; }
    var calItems = ((cur.calendar && cur.calendar.items) || []).filter(function (it) { return it.round === round && !it.university; });
    var applyIt = calItems.find(function (it) { return /รับสมัคร/.test(it.event); });
    var confirmIt = calItems.find(function (it) { return /ยืนยันสิทธิ์/.test(it.event); });

    if (!adms.length) {
      add({ k: 'none', tier: 'optional', tag: 'R' + round, dateTh: '—', dateEn: '—',
        titleTh: 'หลักสูตรนี้ไม่เปิดรับรอบ ' + round + ' (ข้อมูล myTCAS)', titleEn: 'No Round ' + round + ' projects for this program (myTCAS)',
        descTh: 'ถ้าอยากมีทางเลือกในรอบนี้ ลองเปลี่ยนหลักสูตรที่ใช้วางแผน หรือดูหลักสูตรอื่นในหน้าคณะที่ใช่', descEn: 'For an option in this round, switch the program or look at other matches.',
        stepsTh: ['เทียบหลักสูตรอื่นในหน้า "คณะที่ใช่"'], stepsEn: ['Compare other programs on the matches page'] });
      return out;
    }

    // projects with their own closing date (mostly Round 1)
    var withEnd = adms.filter(function (a) { return a.apply_end; }).sort(function (a, b) { return a.apply_end < b.apply_end ? -1 : 1; });
    var nextEnd = withEnd.filter(function (a) { return !passed(a.apply_end); })[0];

    if (round === 1 || round === 2 || round === 4) {
      var docsRound = ((cur.docs && cur.docs.rounds) || []).find(function (x) { return x.round === round; });
      var docs = ((docsRound && docsRound.recommended_docs) || []).slice().sort(function (a, b) { return (b.projects || 0) - (a.projects || 0); }).slice(0, 5);
      var dueTh = nextEnd ? 'ก่อน ' + fmtDay(day(nextEnd.apply_end), 'th') : (applyIt ? range(applyIt.start_date, applyIt.end_date, 'th') : 'ตามประกาศ');
      var dueEn = nextEnd ? 'By ' + fmtDay(day(nextEnd.apply_end), 'en') : (applyIt ? range(applyIt.start_date, applyIt.end_date, 'en') : 'See announcement');
      docs.forEach(function (d) {
        var tpl = DOC_STEPS[d.type] || { steps: [['อ่านรายละเอียดในประกาศของโครงการ', "Read the project's announcement"]], deliverable: [d.label_th, d.label_en] };
        add({ k: 'doc-' + d.type, tier: (d.projects || 0) * 2 >= adms.length ? 'required' : 'recommended', tag: d.label_en, dateTh: dueTh, dateEn: dueEn,
          titleTh: 'เตรียม' + d.label_th, titleEn: 'Prepare: ' + d.label_en,
          descTh: 'ใช้ใน ' + (d.projects || 0) + ' จาก ' + adms.length + ' โครงการของรอบนี้ • ประกาศเขียนว่า "' + d.evidence + '"',
          descEn: 'Used by ' + (d.projects || 0) + ' of ' + adms.length + ' project(s) this round • the announcement says "' + d.evidence + '"',
          deliverableTh: tpl.deliverable[0], deliverableEn: tpl.deliverable[1], stepsTh: stepsOf(tpl.steps, 0), stepsEn: stepsOf(tpl.steps, 1) });
      });
      withEnd.filter(function (a) { return !passed(a.apply_end); }).slice(0, 4).forEach(function (a, i) {
        var bits = [];
        if (a.seats) bits.push({ th: 'รับ ' + a.seats + ' คน', en: a.seats + ' seats' });
        if (a.min_gpax != null) bits.push({ th: 'GPAX ขั้นต่ำ ' + Number(a.min_gpax).toFixed(2), en: 'min GPAX ' + Number(a.min_gpax).toFixed(2) });
        add({ k: 'apply-' + i + '-' + String(a.apply_end).replace(/-/g, ''), tier: 'required', tag: 'R' + round, dateTh: 'ปิด ' + fmtDay(day(a.apply_end), 'th'), dateEn: 'Closes ' + fmtDay(day(a.apply_end), 'en'),
          titleTh: 'สมัครโครงการ "' + a.project_name + '"', titleEn: 'Apply: "' + a.project_name + '"',
          descTh: 'ปิดรับ ' + fmtDay(day(a.apply_end), 'th') + (bits.length ? ' • ' + bits.map(function (b) { return b.th; }).join(' • ') : ''),
          descEn: 'Closes ' + fmtDay(day(a.apply_end), 'en') + (bits.length ? ' • ' + bits.map(function (b) { return b.en; }).join(' • ') : ''),
          stepsTh: ['อ่านประกาศรับสมัครของโครงการ (ลิงก์จาก mytcas.com)', 'เตรียมเอกสารตามรายการด้านบน', 'สมัครและชำระค่าสมัครก่อน ' + fmtDay(day(a.apply_end), 'th')],
          stepsEn: ["Read the project's announcement (linked from mytcas.com)", 'Prepare the documents above', 'Apply and pay before ' + fmtDay(day(a.apply_end), 'en')] });
      });
      var closed = withEnd.filter(function (a) { return passed(a.apply_end); }).length;
      if (!withEnd.length || (!nextEnd && applyIt)) {
        var dt = applyIt ? dateText(applyIt.start_date, applyIt.end_date) : { th: 'ตามประกาศ', en: 'See announcement' };
        // "รับสมัคร (มหาวิทยาลัยกำหนดเอง ตั้งแต่วันนี้เป็นต้นไป)": only a start date
        if (applyIt && !applyIt.end_date && /ตั้งแต่/.test(applyIt.event)) dt = { th: 'ตั้งแต่ ' + dt.th, en: 'From ' + dt.en };
        add({ k: 'apply-window', tier: 'required', tag: 'R' + round, dateTh: dt.th, dateEn: dt.en, overdue: applyIt && applyIt.end_date ? passed(applyIt.end_date) : false,
          titleTh: 'สมัครรอบ ' + round + ' (' + adms.length + ' โครงการ)', titleEn: 'Apply in Round ' + round + ' (' + adms.length + ' project(s))',
          descTh: (applyIt ? applyIt.event : 'มหาวิทยาลัยกำหนดวันรับสมัครเอง') + (closed ? ' • ปิดรับไปแล้ว ' + closed + ' โครงการ' : ''),
          descEn: (applyIt ? applyIt.event : 'Each university sets its own dates') + (closed ? ' • ' + closed + ' project(s) already closed' : ''),
          stepsTh: ['ดูโครงการของรอบนี้ที่ mytcas.com', 'เช็กคุณสมบัติและเอกสารของแต่ละโครงการ', 'สมัครในระบบของมหาวิทยาลัยตามวันที่ประกาศ'],
          stepsEn: ["See this round's projects on mytcas.com", "Check each project's requirements", "Apply on the university's system by its dates"] });
      }
    }

    if (round === 3) {
      var main = adms.find(function (a) { return a.score_weights && Object.keys(a.score_weights).length; });
      var parts = main ? Object.keys(main.score_weights).map(function (k) { return { s: k, w: Number(main.score_weights[k]) }; }).sort(function (a, b) { return b.w - a.w; }) : [];
      var exams = parts.filter(function (p) { return isExam(p.s); });
      var regTgat = ((cur.calendar && cur.calendar.items) || []).find(function (it) { return !it.university && /^รับสมัครสอบ TGAT/.test(it.event); });
      var regAlevel = ((cur.calendar && cur.calendar.items) || []).find(function (it) { return !it.university && /^รับสมัครสอบ A-Level$/.test(it.event); });
      if (regTgat && exams.some(function (p) { return /TGAT|TPAT/.test(p.s); })) {
        var d1 = dateText(regTgat.start_date, regTgat.end_date, regTgat.source_url);
        add({ k: 'reg-tgat', tier: 'required', tag: 'TGAT/TPAT', dateTh: d1.th, dateEn: d1.en, overdue: passed(regTgat.end_date || regTgat.start_date),
          titleTh: 'สมัครสอบ TGAT/TPAT', titleEn: 'Register for TGAT/TPAT',
          descTh: 'หลักสูตรนี้ใช้ ' + exams.filter(function (p) { return /TGAT|TPAT/.test(p.s); }).map(function (p) { return shortSubject(p.s); }).join(', '), descEn: 'This program uses ' + exams.filter(function (p) { return /TGAT|TPAT/.test(p.s); }).map(function (p) { return shortSubject(p.s); }).join(', '),
          stepsTh: ['สมัครสอบในระบบ mytcas.com', 'เลือกวิชาให้ครบตามที่หลักสูตรใช้', 'ชำระค่าสมัครสอบ'], stepsEn: ['Register on mytcas.com', 'Pick every subject this program uses', 'Pay the exam fee'] });
      }
      if (regAlevel && exams.some(function (p) { return /A-Level/.test(p.s); })) {
        var d2 = dateText(regAlevel.start_date, regAlevel.end_date, regAlevel.source_url);
        add({ k: 'reg-alevel', tier: 'required', tag: 'A-Level', dateTh: d2.th, dateEn: d2.en, overdue: passed(regAlevel.end_date || regAlevel.start_date),
          titleTh: 'สมัครสอบ A-Level', titleEn: 'Register for A-Level',
          descTh: 'หลักสูตรนี้ใช้ ' + exams.filter(function (p) { return /A-Level/.test(p.s); }).map(function (p) { return shortSubject(p.s); }).join(', '), descEn: 'This program uses ' + exams.filter(function (p) { return /A-Level/.test(p.s); }).map(function (p) { return shortSubject(p.s); }).join(', '),
          stepsTh: ['สมัครสอบในระบบ mytcas.com', 'เลือกวิชาให้ครบตามที่หลักสูตรใช้'], stepsEn: ['Register on mytcas.com', 'Pick every subject this program uses'] });
      }
      exams.forEach(function (p) {
        var d = examDate(p.s);
        add({ k: 'exam-' + shortSubject(p.s).replace(/[^A-Za-z0-9]/g, '').toLowerCase() + '-' + p.w, tier: p.w >= 20 ? 'required' : 'recommended', tag: shortSubject(p.s) + ' ' + p.w + '%',
          dateTh: d ? 'สอบ ' + fmtDay(d, 'th') : 'ตามประกาศ', dateEn: d ? 'Exam ' + fmtDay(d, 'en') : 'See announcement', overdue: d ? d < t0 : false,
          titleTh: 'เตรียมสอบ ' + shortSubject(p.s) + ' (น้ำหนัก ' + p.w + '%)', titleEn: 'Prepare ' + shortSubject(p.s) + ' (' + p.w + '% weight)',
          descTh: 'วิชานี้คิดเป็น ' + p.w + '% ของคะแนนรอบ 3' + (main && main.last_year_min_score != null ? ' • คะแนนต่ำสุดปีก่อน ' + Number(main.last_year_min_score).toFixed(2) : ''),
          descEn: 'Worth ' + p.w + '% of the Round 3 score' + (main && main.last_year_min_score != null ? " • last year's lowest " + Number(main.last_year_min_score).toFixed(2) : ''),
          deliverableTh: 'ทำข้อสอบเก่าจับเวลาครบอย่างน้อย 1 ชุด', deliverableEn: 'At least one timed past paper',
          stepsTh: ['ดูโครงสร้างข้อสอบ (blueprint) ที่ mytcas.com', 'ทำข้อสอบเก่าแบบจับเวลา แล้วจดบทที่ผิดบ่อย', 'ใส่คะแนนที่ทำได้ในหน้าจำลองคะแนนเพื่อดูผลต่อคะแนนรวม'],
          stepsEn: ['Read the exam blueprint on mytcas.com', 'Do timed past papers and note weak chapters', 'Put your scores in the simulator to see the total'] });
      });
      var d3 = applyIt ? dateText(applyIt.start_date, applyIt.end_date) : { th: 'ตามประกาศ', en: 'See announcement' };
      add({ k: 'apply', tier: 'required', tag: 'R3', dateTh: d3.th, dateEn: d3.en, overdue: applyIt ? passed(applyIt.end_date || applyIt.start_date) : false,
        titleTh: 'สมัครรอบ 3 Admission ที่ mytcas.com', titleEn: 'Apply for Round 3 Admission on mytcas.com',
        descTh: (main ? 'โครงการ "' + main.project_name + '"' : adms.length + ' โครงการ') + (main && main.seats ? ' • รับ ' + main.seats + ' คน' : ''),
        descEn: (main ? '"' + main.project_name + '"' : adms.length + ' project(s)') + (main && main.seats ? ' • ' + main.seats + ' seats' : ''),
        stepsTh: ['เรียงอันดับสาขาที่สมัคร (สูงสุด 10 อันดับ)', 'เช็กว่ามีคะแนนครบทุกวิชาที่หลักสูตรใช้', 'ยืนยันการสมัครและชำระเงิน'], stepsEn: ['Rank your choices (up to 10)', 'Check you have every score the program needs', 'Confirm and pay'] });
    }

    if (confirmIt) {
      var dc = dateText(confirmIt.start_date, confirmIt.end_date);
      add({ k: 'confirm', tier: 'required', tag: T('ยืนยันสิทธิ์', 'Confirm'), dateTh: dc.th, dateEn: dc.en, overdue: passed(confirmIt.end_date || confirmIt.start_date),
        titleTh: 'ยืนยันสิทธิ์ในระบบ (ถ้าผ่านการคัดเลือก)', titleEn: 'Confirm your seat (if selected)',
        descTh: confirmIt.event, descEn: confirmIt.event,
        stepsTh: ['เช็กประกาศผลที่ mytcas.com', 'กดยืนยันหรือสละสิทธิ์ภายในเวลาที่กำหนด'], stepsEn: ['Check results on mytcas.com', 'Confirm or decline within the window'] });
    }
    return out;
  }


  // ---------- 6. upcoming deadlines (next 60 days) ----------
  // the planned program's project deadlines + the official calendar; signed in, also GET /tcas/deadlines
  // (saved programs and profile targets). Each row links to Google Calendar with the real date.
  var acctDeadlines = { uid: null, items: [] };
  function loadAccountDeadlines() {
    var user = window.PF_AUTH && window.PF_AUTH.getCurrentUser();
    var uid = user ? String(user.userId || '') : null;
    if (!uid || acctDeadlines.uid === uid) return;
    acctDeadlines = { uid: uid, items: [] };
    PF_API.request('/tcas/deadlines?days=60', { auth: true }).then(function (d) {
      if (acctDeadlines.uid !== uid) return;
      acctDeadlines.items = (d && d.items) || [];
      paintDeadlines();
    }).catch(function () { /* the program + calendar rows still show */ });
  }
  function ymd(d) { return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function gcalLink(title, start, end) {
    var e = new Date((end || start).getTime() + 86400000); // all-day event: end date is exclusive
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
      '&dates=' + ymd(start) + '/' + ymd(e) + '&details=' + encodeURIComponent(T('จาก PathFinder • ตรวจสอบประกาศล่าสุดที่ mytcas.com', 'From PathFinder • check mytcas.com for the latest'));
  }
  function paintDeadlines() {
    var box = $('rm-deadlines');
    if (!box) return;
    loadAccountDeadlines();
    var t0 = today();
    var limit = new Date(t0.getTime() + 60 * 86400000);
    var rows = [];
    var seen = {};
    function add(title, start, end, tag) {
      if (!start) return;
      var last = end || start;
      if (last < t0 || start > limit) return;
      var key = title + '|' + ymd(start);
      if (seen[key]) return;
      seen[key] = 1;
      rows.push({ title: title, start: start, end: end, tag: tag });
    }
    admissions().forEach(function (a) {
      var d = day(a.apply_end);
      if (d) add(T('ปิดรับ ', 'Closes: ') + a.project_name + ' (' + T('รอบ ', 'R') + a.round + ')', d, null, T('หลักสูตรนี้', 'This program'));
    });
    ((cur.calendar && cur.calendar.items) || []).forEach(function (it) {
      var tag = it.university ? it.university : (isOfficial(it.source_url) ? T('ปฏิทินกลาง', 'Official') : T('ปฏิทินกลาง • ไม่เป็นทางการ', 'Central • unofficial'));
      add(it.event, day(it.start_date), day(it.end_date), tag);
    });
    acctDeadlines.items.forEach(function (it) {
      add(it.title + (it.university ? ' • ' + it.university : ''), day(it.start_date || it.date), day(it.end_date), T('ที่บันทึกไว้', 'Saved'));
    });
    rows.sort(function (a, b) { return a.start - b.start; });
    if (!rows.length) {
      box.innerHTML = '<p class="font-body text-body-sm text-on-surface-variant">' + rmEsc(cur.program ? T('ไม่มีกำหนดการใน 60 วันข้างหน้า', 'Nothing due in the next 60 days') : (cur.error || '—')) + '</p>';
      return;
    }
    box.innerHTML = rows.slice(0, 8).map(function (r) {
      var left = daysUntil(r.start);
      var when = left <= 0 ? T('วันนี้ / กำลังเปิด', 'Today / open now') : T('อีก ' + left + ' วัน', 'in ' + left + ' days');
      var dates = r.end && +r.end !== +r.start ? fmtDay(r.start, currentLang) + ' – ' + fmtDay(r.end, currentLang) : fmtDay(r.start, currentLang);
      return '<a href="' + rmEsc(gcalLink(r.title, r.start, r.end)) + '" target="_blank" rel="noopener" class="flex items-center gap-gutter-sm p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant hover:border-primary">' +
        '<span class="flex flex-col items-center justify-center w-14 shrink-0 rounded-md py-1 ' + (left <= 7 ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container') + '">' +
          '<span class="font-metric text-label-md">' + rmEsc(fmtDay(r.start, currentLang)) + '</span></span>' +
        '<span class="flex flex-col min-w-0">' +
          '<span class="font-label text-label-md text-on-surface truncate">' + rmEsc(r.title) + '</span>' +
          '<span class="font-label text-[11px] text-on-surface-variant">' + rmEsc(dates + ' • ' + when + ' • ' + r.tag) + '</span>' +
        '</span>' +
        '<span class="material-symbols-outlined text-[18px] text-primary ml-auto shrink-0" aria-hidden="true">event</span>' +
      '</a>';
    }).join('');
  }

  function paint() {
    if (cur.loading) { paintLoading(); datesBar(PF_STATE.activeRound || 'r1'); return; }
    paintProgramSelect();
    paintHeader();
    paintCountdown();
    paintWarnings();
    paintRoundTabs();
    paintExams();
    paintTimeline();
    paintDeadlines();
    datesBar(PF_STATE.activeRound || 'r1');
    central();
  }

  function render(majorId) {
    majorId = String(majorId || '');
    if (majorId === cur.majorId) {
      // same major but another program was locked / picked meanwhile (e.g. KU locked while KMITL was shown): load that one
      var want = (PF_STATE.rmPrograms || {})[majorId];
      if (want && want !== cur.programId) {
        cur.loading = true;
        paint();
        load(majorId, want);
        return;
      }
      paint();
      if (!cur.loading && !cur.program && !cur.error && GROUP_OF_MAJOR[majorId]) load(majorId);
      return;
    }
    cur = { majorId: majorId, programs: [], programId: null, program: null, docs: null, calendar: cur.calendar, error: null, loading: true };
    paint();
    load(majorId);
  }

  // the student picks another real program for this major
  document.addEventListener('change', function (e) {
    if (!e.target || e.target.id !== 'rm-program-select') return;
    var id = e.target.value;
    PF_STATE.rmPrograms = PF_STATE.rmPrograms || {};
    PF_STATE.rmPrograms[cur.majorId] = id;
    if (typeof window.savePFState === 'function') window.savePFState();
    cur.loading = true;
    paint();
    load(cur.majorId, id);
  });

  return {
    render: render,
    tasksFor: tasksFor,
    replayTimeline: replayTimeline,
    beyond: beyond,
    datesBar: datesBar,
    central: central,
    programId: function (majorId) { return (PF_STATE.rmPrograms || {})[String(majorId)] || (String(majorId) === cur.majorId ? cur.programId : null); },
    GROUP_OF_MAJOR: GROUP_OF_MAJOR
  };
})();
