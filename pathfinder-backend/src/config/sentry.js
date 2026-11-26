import { env } from './env.js';
import { log } from '../utils/log.js';

// Optional error reporting. Does nothing unless SENTRY_DSN is set.
// Only 5xx errors are sent, with the request id as a tag - no body, headers or user data.
let Sentry = null;

export async function initSentry() {
  if (!env.SENTRY_DSN) return;
  try {
    Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend(event) {
        // belt and braces: strip anything that might carry a token or personal data
        if (event.request) {
          delete event.request.headers;
          delete event.request.cookies;
          delete event.request.data;
          delete event.request.query_string;
        }
        delete event.user;
        return event;
      },
    });
    log.info('[sentry] enabled');
  } catch (err) {
    Sentry = null;
    log.warn('[sentry] SENTRY_DSN is set but @sentry/node could not be loaded:', err.message);
  }
}

export function reportError(err, req) {
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    if (req?.id) scope.setTag('request_id', req.id);
    if (req) scope.setTag('route', `${req.method} ${req.baseUrl ?? ''}${req.route?.path ?? req.path}`);
    if (err?.code) scope.setTag('error_code', err.code);
    Sentry.captureException(err);
  });
}
