/* =========================================================================
 * PathFinder — PF_API: the one place that talks to the backend
 *
 *   PF_API.request(path, { method, body, auth, timeoutMs, signal })  -> data (the "data" of { success, data })
 *   PF_API.stream(path, { body, onProgress, onEvent, signal })      -> data of the final "done" event (SSE)
 *   PF_API.setSession(session, remember) / clearSession() / hasSession()
 *   PF_API.errorText(err)                                            -> message to show the user
 *
 * - base URL from window.PF_API_URL (js/config.js)
 * - Bearer token added automatically; on 401 it refreshes once and retries
 * - 429 / 503 / network errors never log the user out (the token is still fine), they just throw
 * - X-Lang follows PF_STATE.lang so error messages and AI answers come back in the UI language
 * - a refresh that fails for real fires window event "pf:auth-expired"
 *
 * Tokens live in localStorage ("remember me") or sessionStorage (until the tab closes).
 * Never log them.
 *
 * Classic script: load after js/config.js and before any script that calls the API.
 * ========================================================================= */
var PF_API = window.PF_API = (function () {
  var BASE = String(window.PF_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
  var KEY = 'pf_auth_v1';
  var DEFAULT_TIMEOUT_MS = 20000;
  var REFRESH_EARLY_S = 60; // refresh a bit before expiry instead of eating a 401

  var session = null; // { access_token, refresh_token, expires_at, remember }
  var refreshing = null; // single-flight refresh promise

  function store(remember) {
    try { return remember ? window.localStorage : window.sessionStorage; } catch (e) { return null; }
  }

  function loadSession() {
    [true, false].some(function (remember) {
      var s = store(remember);
      if (!s) return false;
      try {
        var raw = s.getItem(KEY);
        if (!raw) return false;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.access_token && parsed.refresh_token) {
          session = parsed;
          return true;
        }
      } catch (e) {}
      return false;
    });
  }

  function writeSession() {
    [true, false].forEach(function (remember) {
      var s = store(remember);
      if (!s) return;
      try {
        if (session && session.remember === remember) s.setItem(KEY, JSON.stringify(session));
        else s.removeItem(KEY);
      } catch (e) {}
    });
  }

  // accepts a login / refresh / register.session / demo / google callback response
  function setSession(s, remember) {
    if (!s || !s.access_token) return;
    session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: Number(s.expires_at) || Math.floor(Date.now() / 1000) + Number(s.expires_in || 3600),
      remember: remember === undefined ? (session ? session.remember : true) : !!remember
    };
    writeSession();
  }

  function clearSession() {
    session = null;
    writeSession();
  }

  function ApiError(status, code, message, extra) {
    var err = new Error(message || code || 'API error');
    err.name = 'ApiError';
    err.status = status;
    err.code = code;
    extra = extra || {};
    err.requestId = extra.requestId || null;
    err.details = extra.details || null;
    err.retryAfter = extra.retryAfter || null;
    return err;
  }

  function lang() {
    return (window.PF_STATE && window.PF_STATE.lang) || 'th';
  }

  function isBinary(body) {
    return (typeof Blob !== 'undefined' && body instanceof Blob) || (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer);
  }

  async function rawFetch(path, opts, token) {
    var headers = { 'X-Lang': lang() };
    var body = opts.body;
    if (body !== undefined && body !== null) {
      if (isBinary(body)) {
        headers['Content-Type'] = opts.contentType || body.type || 'application/octet-stream';
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }
    }
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.accept) headers.Accept = opts.accept;

    var ctrl = new AbortController();
    var timedOut = false;
    var timer = opts.timeoutMs === 0 ? null : setTimeout(function () { timedOut = true; ctrl.abort(); }, opts.timeoutMs || DEFAULT_TIMEOUT_MS);
    if (opts.signal) {
      if (opts.signal.aborted) ctrl.abort();
      else opts.signal.addEventListener('abort', function () { ctrl.abort(); });
    }
    try {
      return await fetch(BASE + path, { method: opts.method || 'GET', headers: headers, body: body, signal: ctrl.signal, keepalive: !!opts.keepalive });
    } catch (e) {
      if (timedOut) throw ApiError(0, 'NETWORK_TIMEOUT', null);
      if (opts.signal && opts.signal.aborted) throw ApiError(0, 'ABORTED', null);
      throw ApiError(0, 'NETWORK_ERROR', null);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function toError(res) {
    var json = null;
    try { json = await res.json(); } catch (e) {}
    var e = (json && json.error) || {};
    return ApiError(res.status, e.code || 'HTTP_' + res.status, e.message, {
      requestId: e.request_id || res.headers.get('X-Request-Id'),
      details: e.details,
      retryAfter: Number(res.headers.get('Retry-After')) || null
    });
  }

  // one refresh at a time, every caller waiting on a 401 shares it
  function refresh() {
    if (!session || !session.refresh_token) return Promise.reject(ApiError(401, 'UNAUTHORIZED', null));
    if (refreshing) return refreshing;
    var rt = session.refresh_token;
    refreshing = (async function () {
      var res = await rawFetch('/auth/refresh', { method: 'POST', body: { refresh_token: rt } });
      if (!res.ok) {
        var err = await toError(res);
        // only a real "this refresh token is dead" ends the session; 429/503/network keep it
        if (res.status === 401) {
          clearSession();
          window.dispatchEvent(new CustomEvent('pf:auth-expired'));
        }
        throw err;
      }
      var json = await res.json();
      setSession(json.data);
      return session.access_token;
    })();
    refreshing.finally(function () { refreshing = null; }).catch(function () {});
    return refreshing;
  }

  async function validToken() {
    if (!session) return null;
    if (session.expires_at && session.expires_at - REFRESH_EARLY_S < Date.now() / 1000) {
      try { return await refresh(); } catch (e) {
        if (e.status === 401) return null;
        return session ? session.access_token : null; // refresh hiccup: try the old token anyway
      }
    }
    return session.access_token;
  }

  // auth: true = needs login (401 locally if there is no session), false = never send the token,
  // undefined = send it when we have one
  async function send(path, opts) {
    opts = opts || {};
    if (opts.auth === true && !session) throw ApiError(401, 'UNAUTHORIZED', null);
    var token = opts.auth === false ? null : await validToken();
    if (opts.auth === true && !token) throw ApiError(401, 'UNAUTHORIZED', null);
    var res = await rawFetch(path, opts, token);
    if (res.status === 401 && token && session) {
      var err = await toError(res);
      if (err.code !== 'INVALID_TOKEN' && err.code !== 'UNAUTHORIZED') throw err;
      var fresh = await refresh();
      res = await rawFetch(path, opts, fresh);
    }
    return res;
  }

  async function request(path, opts) {
    var res = await send(path, opts);
    if (!res.ok) throw await toError(res);
    if (res.status === 204) return null;
    var type = res.headers.get('Content-Type') || '';
    if (type.indexOf('application/json') === -1) return res.blob();
    var json = await res.json();
    return json && 'data' in json ? json.data : json;
  }

  // AI endpoints with "Accept: text/event-stream": progress events while Gemini works,
  // resolves with the data of the final "done" event, rejects with an ApiError on "error"
  async function stream(path, opts) {
    opts = opts || {};
    var res = await send(path, { method: opts.method || 'POST', body: opts.body, auth: opts.auth, accept: 'text/event-stream', timeoutMs: 0, signal: opts.signal });
    if (!res.ok) throw await toError(res);
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    var result;
    var failure;
    function handle(block) {
      var event = 'message';
      var data = '';
      block.split('\n').forEach(function (line) {
        if (line.indexOf('event:') === 0) event = line.slice(6).trim();
        else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
      });
      var payload = null;
      try { payload = data ? JSON.parse(data) : null; } catch (e) { payload = data; }
      if (opts.onEvent) opts.onEvent(event, payload);
      if (event === 'progress' && opts.onProgress) opts.onProgress(payload);
      else if (event === 'done') result = payload;
      else if (event === 'error') {
        var p = payload && typeof payload === 'object' ? payload : {};
        failure = ApiError(p.status || 0, p.code || 'STREAM_ERROR', p.message, { requestId: p.request_id });
      }
    }
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      // CRLF from a proxy would otherwise break the blank-line split
      buf += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
      var parts = buf.split('\n\n');
      buf = parts.pop();
      parts.forEach(handle);
    }
    buf += decoder.decode();
    if (buf.trim()) handle(buf); // last event without a trailing blank line
    if (failure) throw failure;
    if (!result) throw ApiError(0, 'STREAM_CLOSED', null);
    return result.data !== undefined ? result.data : result;
  }

  // what to show the user. Backend messages are already in the UI language (X-Lang)
  function errorText(err) {
    var th = lang() === 'th';
    if (!err) return th ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : 'Something went wrong, please try again';
    if (err.code === 'NETWORK_ERROR') return th ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' : 'Cannot reach the server. Check your connection and try again.';
    if (err.code === 'NETWORK_TIMEOUT') return th ? 'เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่' : 'The server took too long. Please try again.';
    if (err.message && err.message !== err.code) return err.message;
    return th ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : 'Something went wrong, please try again';
  }

  loadSession();

  return {
    BASE: BASE,
    request: request,
    stream: stream,
    refresh: refresh,
    setSession: setSession,
    clearSession: clearSession,
    hasSession: function () { return !!session; },
    errorText: errorText,
    ApiError: ApiError
  };
})();
