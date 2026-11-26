import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isTest } from './config/env.js';
import { requestId } from './middlewares/requestId.js';
import { requestTimeout } from './middlewares/timeout.js';
import { generalLimiter, ipCeiling } from './middlewares/rateLimit.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import apiRoutes from './routes/index.js';
import { detectLang } from './utils/i18n.js';
import { deepHealth } from './services/health.service.js';

// frontend/UI/PC UI next to the backend repo (overridable with FRONTEND_DIR)
const DEFAULT_FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/UI/PC UI');
export const frontendDir = () => path.resolve(env.FRONTEND_DIR || DEFAULT_FRONTEND_DIR);

// what the pages load: their own files (Tailwind is built locally: css/tailwind.css), Google Fonts, uni logos / avatars (https images).
// no inline scripts or onclick= (scripts are files); inline style attributes are allowed (the JS builds them)
const pageCsp = helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    // plain http on localhost must stay http
    'upgrade-insecure-requests': null,
  },
});

export function createApp() {
  const app = express();

  // behind Render/Railway's proxy - without this every request looks like the same IP
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // first, so everything after it (logs, errors) knows the id
  app.use(requestId);
  // th | en for error messages and AI answers (see utils/i18n.js)
  app.use((req, res, next) => {
    req.lang = detectLang(req);
    res.set({ 'Content-Language': req.lang, Vary: 'X-Lang, Accept-Language' });
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      // only send CORS headers for an exact FRONTEND_URL (or CORS_ORIGINS) match
      origin: (origin, cb) => cb(null, origin === env.FRONTEND_URL || env.CORS_ORIGINS.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // X-Lang: th | en, picks the language of error messages and AI answers
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Lang'],
      // let the frontend read these
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );
  // chat may carry attachments (≤ 8 MB of files, base64): a bigger limit for that one route only
  const jsonSmall = express.json({ limit: '1mb' });
  const jsonChat = express.json({ limit: '12mb' });
  app.use((req, res, next) => (req.path === '/api/chat' ? jsonChat : jsonSmall)(req, res, next));

  // id + method + path + status. no query string, headers or body
  if (!isTest) {
    morgan.token('id', (req) => req.id);
    morgan.token('path', (req) => req.originalUrl.split('?')[0]);
    app.use(morgan('[:id] :method :path :status :response-time ms'));
  }

  // outside the rate limiter, the host pings this a lot
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  // db / auth keys / AI status for the team and uptime monitors. 503 when the db is down.
  // cached 10s inside, so polling it is cheap. no personal data in it
  app.get('/api/health/deep', async (req, res) => {
    const data = await deepHealth();
    res.set('Cache-Control', 'no-store').status(data.status === 'down' ? 503 : 200).json(data);
  });

  app.use('/api', requestTimeout, ipCeiling, generalLimiter, apiRoutes);

  // the PC UI itself: / -> index.html, /share.html, /js/..., /data/... (dotfiles are never served)
  const dir = frontendDir();
  if (env.SERVE_FRONTEND && existsSync(path.join(dir, 'index.html'))) {
    // no-cache = the browser re-checks every file (cheap 304 via ETag), so an edited page or script is never
    // mixed with an old cached copy (new HTML + old JS left buttons without their handlers)
    app.use(
      pageCsp,
      express.static(dir, {
        index: 'index.html',
        dotfiles: 'ignore',
        setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
      }),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
