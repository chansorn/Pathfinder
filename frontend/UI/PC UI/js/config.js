/* =========================================================================
 * PathFinder — runtime config: where the backend API lives
 *
 * Normal case: the backend serves these pages itself (npm start, then open http://localhost:4000),
 * so the API is on the same origin at /api - no CORS, nothing to set.
 *
 * Pages served by something else (VS Code Live Server on :5500, a separate static host):
 *   - local dev servers on the ports below talk to http://localhost:4000/api
 *   - a separate production host: set SEPARATE_API_URL to the backend's /api URL
 *   and allow the page's origin on the backend (FRONTEND_URL / CORS_ORIGINS).
 * Don't open index.html as file:// - the browser sends Origin "null" and every call is blocked.
 * ========================================================================= */
(function () {
  var SEPARATE_API_URL = ''; // e.g. 'https://pathfinder-api.onrender.com/api' when hosted apart
  var LOCAL_API_URL = 'http://localhost:4000/api';
  var DEV_STATIC_PORTS = ['5500', '5501', '8080', '3000'];
  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  var url = location.origin + '/api';
  if (isLocal && DEV_STATIC_PORTS.indexOf(location.port) !== -1) url = LOCAL_API_URL;
  else if (SEPARATE_API_URL) url = SEPARATE_API_URL;
  window.PF_API_URL = window.PF_API_URL || url;
})();
