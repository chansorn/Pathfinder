import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .string()
  .default('false')
  .transform((v) => v.trim().toLowerCase() === 'true');

const num = (def) => z.coerce.number().int().positive().default(def);

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: num(4000),
  // strip trailing slash, otherwise the CORS origin check never matches
  FRONTEND_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .transform((v) => v.replace(/\/+$/, '')),
  // the backend also serves the PC UI pages (one origin: no CORS). FRONTEND_DIR defaults to
  // ../frontend/UI/PC UI next to this repo; nothing is served if index.html isn't there
  SERVE_FRONTEND: z.string().default('true').transform((v) => v.trim().toLowerCase() === 'true'),
  FRONTEND_DIR: z.string().optional(),
  // extra allowed origins, comma separated (local dev e.g. http://127.0.0.1:5500). FRONTEND_URL is always allowed
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)),

  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash'),
  // real calls with the big JSON schemas took 15-26s, so 30s was too tight
  GEMINI_TIMEOUT_MS: num(60_000),
  // non-AI requests. AI routes get longer, chat streams have none
  REQUEST_TIMEOUT_MS: num(15_000),
  // reuse an AI result if nothing about the student changed. 0 = off
  AI_CACHE_DAYS: z.coerce.number().int().min(0).default(7),

  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  // check access tokens here (JWKS / JWT secret) instead of asking Supabase Auth every request
  AUTH_LOCAL_VERIFY: z.string().default('true').transform((v) => v.trim().toLowerCase() === 'true'),
  // only for projects still on the legacy HS256 JWT secret (Supabase > Project Settings > JWT Keys)
  SUPABASE_JWT_SECRET: z.string().default(''),

  USE_MOCK_AI: bool,
  // let Gemini google things (mytcas, university sites) when our TCAS table has nothing
  TCAS_WEB_SEARCH: z.string().default('true').transform((v) => v.trim().toLowerCase() === 'true'),

  RATE_LIMIT_GENERAL_PER_15MIN: num(100),
  RATE_LIMIT_AI_PER_HOUR: num(20),
  RATE_LIMIT_REGISTER_PER_HOUR: num(5),
  RATE_LIMIT_AUTH_PER_15MIN: num(10), // per IP + email
  RATE_LIMIT_AUTH_IP_PER_15MIN: num(100), // per IP, all emails together
  RATE_LIMIT_IP_PER_15MIN: num(1500), // everything from one IP, flood guard only
  // venue / school public IPs (comma list, CIDR ok): per-IP limits above are multiplied for these
  RATE_LIMIT_SHARED_IPS: z.string().default(''),
  RATE_LIMIT_SHARED_MULTIPLIER: num(30),
  AI_DAILY_LIMIT: num(1000), // whole app, per Bangkok day
  // Gemini down / out of quota / daily cap hit: answer with the student's last result or a labelled
  // sample instead of an error page at the booth
  AI_FALLBACK: z.string().default('true').transform((v) => v.trim().toLowerCase() === 'true'),
  // ping this url's /api/health every 10 minutes so a free host doesn't fall asleep (e.g. Render free)
  KEEP_ALIVE_URL: z
    .string()
    .url()
    .transform((s) => s.replace(/\/+$/, ''))
    .optional(),

  PASSWORD_RESET_REDIRECT_URL: z.string().url().optional(),

  // groups smaller than this are hidden in /api/stats so nobody can be singled out
  STATS_MIN_GROUP: num(3),
  // share links / QR: where the link points (defaults to FRONTEND_URL/share.html?t={token}) and how long it lives
  SHARE_BASE_URL: z
    .string()
    .url()
    .transform((s) => s.replace(/\/+$/, ''))
    .optional(),
  SHARE_DAYS: num(30),
  // POST /api/auth/demo: throwaway accounts with sample data, deleted after DEMO_TTL_HOURS
  DEMO_LOGIN: z.string().default('true').transform((v) => v.trim().toLowerCase() === 'true'),
  DEMO_TTL_HOURS: num(6),
  DEMO_DAILY_LIMIT: num(300),
  RATE_LIMIT_DEMO_PER_HOUR: num(10),
  // optional error reporting
  SENTRY_DSN: z.string().default(''),
  TERMS_VERSION: z.string().min(1).max(20).default('1.0'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // only print the names, values could be secrets
  const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  console.error(`Invalid .env values: ${fields}`);
  process.exit(1);
}

export const env = parsed.data;
export const isTest = env.NODE_ENV === 'test';
