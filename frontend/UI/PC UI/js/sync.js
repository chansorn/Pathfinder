/* =========================================================================
 * PathFinder — PF_SYNC: keeps the logged-in account in step with PF_STATE
 *
 *   PF_SYNC.schedule()            call after any PF_STATE change (savePFState does) - debounced
 *   PF_SYNC.flush()               push now (also runs when the tab is hidden)
 *   PF_SYNC.statePatch()          PF_STATE -> PATCH /me/state body
 *   PF_SYNC.planItem(key, done, meta)  one roadmap checkbox -> PATCH /my-plan/items/:key
 *   PF_SYNC.reset()               forget what was sent (login / logout)
 *
 * Guests: everything is a no-op, PF_STATE stays in localStorage only.
 * Only what changed since the last successful push is sent.
 * Load after js/api.js. Uses window.PF_AUTH lazily.
 * ========================================================================= */
var PF_SYNC = window.PF_SYNC = (function () {
  var DEBOUNCE_MS = 1500;
  var lastState = null; // JSON of the last state body the server accepted
  var lastProfile = null;
  var timer = null;

  function loggedIn() {
    return !!(window.PF_AUTH && window.PF_AUTH.getCurrentUser());
  }

  function str(v) { return String(v).trim().slice(0, 100); }
  function list(arr, max) {
    return (Array.isArray(arr) ? arr : []).map(str).filter(Boolean).slice(0, max);
  }
  function warn(what, err) {
    if (window.console) console.warn('[sync] ' + what + ' failed:', err && err.code);
  }

  // the locked program (not whatever the roadmap shows: "อันดับ 2 • สำรอง" must not replace it)
  function lockedProgramId() {
    var id = (PF_STATE.lockedProgram && PF_STATE.lockedProgram.id) ||
      (PF_STATE.lockedMajorId && window.PF_RM_REAL ? window.PF_RM_REAL.programId(PF_STATE.lockedMajorId) : null);
    return /^[0-9a-f-]{36}$/i.test(String(id || '')) ? String(id) : null;
  }

  function statePatch() {
    var cw = PF_STATE.checkedWaypoints || {};
    var out = {
      lang: PF_STATE.lang === 'en' ? 'en' : 'th',
      beyond_4: !!PF_STATE.beyond400,
      target_universities: list((PF_STATE.targetUnis || []).concat(PF_STATE.otherUnis || []), 10),
      target_faculties: list(PF_STATE.targetFaculties, 3),
      province: PF_STATE.province ? String(PF_STATE.province) : null,
      locked_major: PF_STATE.lockedMajorId ? str(PF_STATE.lockedMajorId) : null,
      // the real tcas_programs id the roadmap card uses for that major (js/roadmap-real.js)
      locked_program_id: lockedProgramId(),
      checked_waypoints: list(Object.keys(cw).filter(function (k) { return cw[k]; }), 200),
      liked_majors: list(PF_STATE.acceptedMajors, 100),
      ignored_majors: list(PF_STATE.ignoredMajors, 100),
      custom_keywords: PF_STATE.customInterestText
        ? String(PF_STATE.customInterestText).split(/[,\n]/).map(function (s) { return s.trim().slice(0, 50); }).filter(Boolean).slice(0, 10)
        : []
    };
    // only values the student actually set (an untouched slider's start position isn't an answer)
    if (PF_STATE.hoursSet) out.weekly_hours = Math.min(80, Math.max(0, Number(PF_STATE.weeklyHours) || 0));
    return out;
  }

  // the two profile fields the discovery wizard edits
  function profilePatch() {
    var out = {};
    if (PF_STATE.gpaxSet && typeof PF_STATE.gpax === 'number' && isFinite(PF_STATE.gpax)) out.gpax = Math.min(4, Math.max(0, PF_STATE.gpax));
    if (Array.isArray(PF_STATE.interests)) out.interests = list(PF_STATE.interests, 30);
    return out;
  }

  async function flush(opts) {
    clearTimeout(timer);
    if (!loggedIn()) return;
    var keepalive = !!(opts && opts.keepalive);
    var jobs = [];

    var s = statePatch();
    var sj = JSON.stringify(s);
    if (sj !== lastState) {
      var prevState = lastState;
      lastState = sj;
      jobs.push(PF_API.request('/me/state', { method: 'PATCH', auth: true, body: s, keepalive: keepalive }).catch(function (err) {
        lastState = prevState; // try again next time
        warn('state', err);
      }));
    }

    var p = profilePatch();
    var pj = JSON.stringify(p);
    if (Object.keys(p).length && pj !== lastProfile) {
      var prevProfile = lastProfile;
      lastProfile = pj;
      jobs.push(PF_API.request('/profile', { method: 'PUT', auth: true, body: p, keepalive: keepalive }).catch(function (err) {
        lastProfile = prevProfile;
        warn('profile', err);
      }));
    }
    await Promise.all(jobs);
  }

  function schedule() {
    if (!loggedIn()) return;
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  // mark what the server already has as sent, so a fresh login doesn't push it straight back
  function markSynced() {
    lastState = JSON.stringify(statePatch());
    lastProfile = JSON.stringify(profilePatch());
  }

  function reset() {
    clearTimeout(timer);
    lastState = null;
    lastProfile = null;
  }

  // roadmap checkbox. title/round/tier go along every time: the first PATCH creates the item
  function planItem(key, done, meta) {
    if (!loggedIn() || !/^[a-z0-9:_.-]{1,100}$/.test(String(key))) return;
    meta = meta || {};
    var body = { status: done ? 'done' : 'todo' };
    if (meta.title) body.title = String(meta.title).slice(0, 300);
    var round = Number(String(meta.round || '').replace(/^r/, ''));
    if (round >= 1 && round <= 4) body.round = round;
    if (meta.tier === 'required' || meta.tier === 'recommended' || meta.tier === 'optional') body.tier = meta.tier;
    if (meta.source) body.source = meta.source;
    PF_API.request('/my-plan/items/' + encodeURIComponent(key), { method: 'PATCH', auth: true, body: body }).catch(function (err) {
      warn('plan item', err);
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush({ keepalive: true });
  });

  return { schedule: schedule, flush: flush, statePatch: statePatch, planItem: planItem, markSynced: markSynced, reset: reset };
})();
