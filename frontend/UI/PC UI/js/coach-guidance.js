/* =========================================================================
 * PathFinder — js/coach-guidance.js
 * AI coach page (6): "แนวทางจาก AI" card. POST /api/coach/guidance
 *   - every "ขอแนวทางใหม่" = another angle (safe / aim high / portfolio / exams / near home)
 *     and programs not suggested before (avoid_ids), so two students with the same answers
 *     (different variety_seed) and one student refreshing both get different guidance
 *   - only real myTCAS programs; the last guidance is kept in PF_STATE.coachGuidance
 * Depends on : js/api.js, js/state-i18n.js, js/matches.js (PF_MATCHES.requestBody / lock)
 * ========================================================================= */
var PF_GUIDANCE = window.PF_GUIDANCE = (function () {
  var box = document.getElementById('coach-guidance-body');
  var btn = document.getElementById('coach-guidance-refresh');
  if (!box || !btn) return { render: function () {} };
  var busy = false;

  function T(th, en) { return currentLang === 'th' ? th : en; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function signedIn() { return !!(window.PF_AUTH && window.PF_AUTH.getCurrentUser()); }
  function state() {
    PF_STATE.coachGuidance = PF_STATE.coachGuidance || { refresh: 0, avoid: [], data: null };
    return PF_STATE.coachGuidance;
  }
  function note(th, en, action) {
    box.innerHTML = '<div class="flex flex-col items-start gap-gutter-sm p-gutter-md rounded-lg bg-surface-container-low border border-outline-variant">' +
      '<p class="font-body text-body-md text-on-surface-variant">' + esc(T(th, en)) + '</p>' + (action || '') + '</div>';
  }

  function render() {
    var st = state();
    btn.disabled = busy;
    var label = btn.querySelector('[data-guidance-label]');
    if (label) label.textContent = busy ? T('AI กำลังคิดแนวทาง…', 'AI is thinking…') : (st.data ? T('ขอแนวทางใหม่', 'New guidance') : T('ขอแนวทางจาก AI', 'Get AI guidance'));
    if (busy) return;
    if (!(PF_STATE.interests || []).length) {
      note('เลือกความสนใจในขั้นที่ 1 ก่อน แล้ว AI จะวางแนวทางจากหลักสูตรจริงให้', 'Pick your interests in Step 1 first, then the AI can plan from real programs.',
        '<button type="button" data-go-page="2" data-guidance-go class="px-gutter-md py-1.5 rounded-full bg-primary text-on-primary font-label text-label-md">' + T('ไปเลือกความสนใจ', 'Pick interests') + '</button>');
      return;
    }
    var d = st.data;
    if (!d) {
      note('กด "ขอแนวทางจาก AI" แล้ว AI จะดูคำตอบของคุณกับข้อมูล myTCAS แล้วเสนอแนวทางพร้อมหลักสูตรจริง • กดขอใหม่ได้เรื่อยๆ จะได้มุมมองใหม่ทุกครั้ง',
        'Press "Get AI guidance": the AI reads your answers and myTCAS data and suggests a plan with real programs • every refresh brings a new angle');
      return;
    }
    var moves = (d.moves || []).map(function (m, i) {
      return '<li class="flex gap-gutter-sm"><span class="w-6 h-6 shrink-0 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm flex items-center justify-center">' + (i + 1) + '</span>' +
        '<span class="flex flex-col"><span class="font-title text-title-md text-on-surface">' + esc(m.title) + '</span><span class="font-body text-body-md text-on-surface-variant">' + esc(m.detail) + '</span></span></li>';
    }).join('');
    var progs = (d.programs || []).map(function (c) {
      return '<article class="flex flex-col gap-1.5 p-gutter-md rounded-lg bg-surface-container-low border border-outline-variant">' +
        '<div class="flex items-center justify-between gap-2"><span class="font-label text-label-sm text-on-surface-variant truncate">' + esc(c.university) + (c.campus ? ' • ' + esc(c.campus) : '') + '</span>' +
          '<span class="shrink-0 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-metric text-label-sm">' + T('ตรงกัน ', '') + esc(c.match_pct) + '%</span></div>' +
        '<span class="font-title text-title-md text-on-surface">' + esc(c.program) + '</span>' +
        (c.ai_reason ? '<span class="font-body text-body-sm text-on-surface-variant">' + esc(c.ai_reason) + '</span>' : '') +
        '<div class="flex flex-wrap items-center gap-2 pt-1">' +
          '<button type="button" data-guidance-lock="' + esc(c.id) + '" class="inline-flex items-center gap-1 px-gutter-sm py-1 rounded-full bg-primary text-on-primary font-label text-label-sm"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">lock_open</span>' + T('ล็อกเส้นทางนี้', 'Lock this path') + '</button>' +
          (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener" class="font-label text-label-sm text-primary hover:underline">' + T('ดูที่ myTCAS', 'View on myTCAS') + '</a>' : '') +
        '</div></article>';
    }).join('');
    box.innerHTML =
      '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="px-gutter-sm py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label text-label-sm">' + T('มุมมอง: ', 'Angle: ') + esc(T(d.angle.th, d.angle.en)) + '</span>' +
        (d.method === 'rules' ? '<span class="font-label text-label-sm text-on-surface-variant">' + T('AI ไม่ว่าง ใช้แนวทางจากข้อมูลแทน', 'AI busy: written from the data') + '</span>' : '') +
      '</div>' +
      '<p class="font-body text-body-lg text-on-surface">' + esc(d.headline) + '</p>' +
      (moves ? '<ol class="flex flex-col gap-gutter-sm">' + moves + '</ol>' : '') +
      (progs ? '<div class="grid grid-cols-1 md:grid-cols-3 gap-gutter-sm">' + progs + '</div>' : '') +
      '<p class="font-label text-label-sm text-on-surface-variant">' + T('หลักสูตรและตัวเลขมาจาก myTCAS • ตรวจประกาศล่าสุดที่ mytcas.com', 'Programs and numbers from myTCAS • check mytcas.com for the latest') + '</p>';
    if (window.pfMotion) window.pfMotion(box, 'pf-fade-in');
  }

  async function refresh() {
    if (busy) return;
    if (!(PF_STATE.interests || []).length) { render(); return; }
    if (!signedIn()) {
      if (window.PF_AUTH) window.PF_AUTH.showToast('เข้าสู่ระบบก่อนเพื่อขอแนวทางจาก AI', 'Sign in to get AI guidance');
      if (window.PF_PROFILE_UI) window.PF_PROFILE_UI.openAuthModal('login');
      return;
    }
    var st = state();
    var body = window.PF_MATCHES && window.PF_MATCHES.requestBody ? window.PF_MATCHES.requestBody() : { interests: (PF_STATE.interests || []).slice(0, 4) };
    body.refresh = st.data ? st.refresh + 1 : st.refresh;
    body.avoid_ids = (st.avoid || []).slice(-40);
    busy = true; render();
    try {
      var data = await PF_API.request('/coach/guidance', { method: 'POST', auth: true, body: body, timeoutMs: 90000 });
      st.refresh = body.refresh;
      st.data = data;
      st.avoid = (st.avoid || []).concat((data.programs || []).map(function (c) { return c.id; })).slice(-40);
      // everything suggested already: start the list over next time
      if (!(data.programs || []).length) st.avoid = [];
      if (typeof window.savePFState === 'function') window.savePFState();
    } catch (err) {
      if (window.PF_AUTH) window.PF_AUTH.showToast(PF_API.errorText(err), PF_API.errorText(err));
    } finally {
      busy = false; render();
    }
  }

  btn.addEventListener('click', refresh);
  box.addEventListener('click', function (e) {
    var go = e.target.closest ? e.target.closest('[data-guidance-go]') : null;
    if (go && typeof goToPage === 'function') { goToPage(go.getAttribute('data-go-page')); return; }
    var lk = e.target.closest ? e.target.closest('[data-guidance-lock]') : null;
    if (!lk) return;
    var id = lk.getAttribute('data-guidance-lock');
    var c = ((state().data || {}).programs || []).find(function (x) { return x.id === id; });
    if (c && window.PF_MATCHES) window.PF_MATCHES.lock(id, c);
  });
  render();
  return { render: render, refresh: refresh };
})();
