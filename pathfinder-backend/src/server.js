import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSentry, reportError } from './config/sentry.js';
import { warmJwks } from './services/token.service.js';
import { warmMatchData } from './services/match.service.js';

await initSentry();

// last line of defence - these would otherwise just vanish (or kill the process)
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message ?? err);
  reportError(err);
});

const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k]);
if (!env.USE_MOCK_AI && !env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
if (missing.length) {
  console.warn(`[warn] not set: ${missing.join(', ')} (endpoints that need them will return 500)`);
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`PathFinder API on port ${env.PORT}${env.USE_MOCK_AI ? ' (mock AI)' : ''}`);
  // fetch the token-signing keys now, not on the first student's request
  warmJwks();
  warmMatchData();
});

// free hosts (Render free) sleep after ~15 min without traffic and the next visitor waits 30-60s.
// Pinging our own public url counts as traffic. An outside monitor on /api/health/deep is still
// better (it also wakes a box that already fell asleep) - see README.
if (env.KEEP_ALIVE_URL) {
  const ping = () =>
    fetch(`${env.KEEP_ALIVE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) }).catch((err) =>
      console.warn('[keep-alive] ping failed:', err?.cause?.code ?? err?.message ?? err),
    );
  setInterval(ping, 10 * 60 * 1000).unref();
  console.log(`[keep-alive] pinging ${env.KEEP_ALIVE_URL}/api/health every 10 minutes`);
}

// let in-flight requests finish on redeploy
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
