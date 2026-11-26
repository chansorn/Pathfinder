import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from 'node:crypto';
import { env } from '../config/env.js';
import { log } from '../utils/log.js';

// Checks Supabase access tokens right here instead of calling Supabase Auth (getUser) on every
// request. Faster, and a Supabase Auth hiccup / rate limit no longer touches students who are
// already logged in.
//
//   ES256 / RS256 (asymmetric signing keys, the default for new projects): public keys come from
//   the project's JWKS endpoint, cached. Nothing secret is needed.
//   HS256 (legacy JWT secret): only if SUPABASE_JWT_SECRET is set.
//
// verifyAccessToken() returns the claims, throws InvalidTokenError for a bad token, or returns null
// when it can't decide locally (not a JWT, unknown algorithm, no secret, keys unreachable) - the
// caller then asks Supabase like before.
//
// Trade-off: a token that is still within its lifetime (1h by default) is accepted even if the
// session was ended somewhere we don't see (ban / delete in the dashboard). Our own logout,
// password change/reset and account deletion are tracked below. In memory, so per instance.

export class InvalidTokenError extends Error {}

const b64 = (s) => Buffer.from(s, 'base64url');

function decode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(b64(parts[0]).toString('utf8')),
      payload: JSON.parse(b64(parts[1]).toString('utf8')),
      signed: `${parts[0]}.${parts[1]}`,
      signature: b64(parts[2]),
    };
  } catch {
    return null;
  }
}

const issuer = () => `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`;

// --- JWKS (public keys) ---

const JWKS_TTL_MS = 10 * 60 * 1000;
// an unknown kid triggers a refetch (key rotation), but at most this often - so a made-up kid
// can't turn us into a Supabase hammer
const JWKS_RETRY_MS = 30 * 1000;

let jwks = { keys: new Map(), at: 0, tried: 0, loading: null };
let http = (url, init) => fetch(url, init);

export function setJwksFetchForTests(fn) {
  http = fn ?? ((url, init) => fetch(url, init));
  jwks = { keys: new Map(), at: 0, tried: 0, loading: null };
}

function loadJwks() {
  if (!jwks.loading) {
    const state = jwks;
    state.tried = Date.now();
    state.loading = (async () => {
      const res = await http(`${issuer()}/.well-known/jwks.json`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`jwks http ${res.status}`);
      const body = await res.json();
      const keys = new Map();
      for (const k of body.keys ?? []) {
        if (!k.kid) continue;
        try {
          keys.set(k.kid, createPublicKey({ key: k, format: 'jwk' }));
        } catch {
          // a key type node can't read - skip it, the others still work
        }
      }
      state.keys = keys;
      state.at = Date.now();
    })().finally(() => {
      state.loading = null;
    });
  }
  return jwks.loading;
}

async function publicKey(kid) {
  const fresh = Date.now() - jwks.at < JWKS_TTL_MS;
  if (fresh && jwks.keys.has(kid)) return jwks.keys.get(kid);
  if (!fresh || Date.now() - jwks.tried > JWKS_RETRY_MS) {
    try {
      await loadJwks();
    } catch (err) {
      // keep using the keys we already have
      log.warn('[auth] could not load JWKS:', err?.message ?? err);
    }
  }
  return jwks.keys.get(kid) ?? null;
}

// load the keys ahead of the first request (server start, /api/health/deep). never throws
export async function warmJwks() {
  if (!env.AUTH_LOCAL_VERIFY || !env.SUPABASE_URL || Date.now() - jwks.at < JWKS_TTL_MS) return;
  if (Date.now() - jwks.tried < JWKS_RETRY_MS) return;
  await loadJwks().catch((err) => log.warn('[auth] could not load JWKS:', err?.message ?? err));
}

// for /api/health/deep
export const jwksStatus = () => ({ keys: jwks.keys.size, loaded_at: jwks.at ? new Date(jwks.at).toISOString() : null });

// --- tokens we ended ourselves ---

const REVOKE_TTL_S = 24 * 3600; // access tokens live 1h by default, keep the entries well past that
const revokedSessions = new Map(); // session_id -> forget after (s)
const revokedUsers = new Map(); // user id -> { before (s), keep: session_id | null, until (s) }
const nowS = () => Math.floor(Date.now() / 1000);

function prune(map, now) {
  if (map.size < 5000) return;
  for (const [k, v] of map) if ((v.until ?? v) < now) map.delete(k);
}

// logout: this session only
export function revokeToken(token) {
  const sid = decode(token ?? '')?.payload?.session_id;
  if (!sid) return;
  const now = nowS();
  prune(revokedSessions, now);
  revokedSessions.set(sid, now + REVOKE_TTL_S);
}

// password change / reset, account deletion: every token of the user issued before now,
// optionally except the session that made the change
export function revokeUserTokens(userId, { keepToken } = {}) {
  const now = nowS();
  prune(revokedUsers, now);
  revokedUsers.set(userId, { before: now, keep: keepToken ? (decode(keepToken)?.payload?.session_id ?? null) : null, until: now + REVOKE_TTL_S });
}

function isRevoked(c) {
  if (c.session_id && revokedSessions.has(c.session_id)) return true;
  const u = revokedUsers.get(c.sub);
  return Boolean(u && c.iat < u.before && !(u.keep && c.session_id === u.keep));
}

// --- verify ---

export async function verifyAccessToken(token) {
  if (!env.AUTH_LOCAL_VERIFY || !env.SUPABASE_URL) return null;
  const jwt = decode(token);
  if (!jwt) return null;
  const { header, payload } = jwt;

  let valid;
  if (header.alg === 'HS256') {
    if (!env.SUPABASE_JWT_SECRET) return null;
    const expected = createHmac('sha256', env.SUPABASE_JWT_SECRET).update(jwt.signed).digest();
    valid = expected.length === jwt.signature.length && timingSafeEqual(expected, jwt.signature);
  } else if (header.alg === 'ES256' || header.alg === 'RS256') {
    if (!header.kid) return null;
    const key = await publicKey(header.kid);
    if (!key) return null;
    // a JWT's ES256 signature is raw r||s, not DER
    const verifyKey = header.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key;
    valid = cryptoVerify('sha256', Buffer.from(jwt.signed), verifyKey, jwt.signature);
  } else {
    return null;
  }

  if (!valid) throw new InvalidTokenError('bad signature');
  if (typeof payload.exp !== 'number' || payload.exp <= nowS()) throw new InvalidTokenError('expired');
  if (payload.iss !== issuer()) throw new InvalidTokenError('wrong issuer');
  // anon / service_role keys are JWTs from the same project too - only real user sessions get in
  if (payload.role !== 'authenticated' || !payload.sub) throw new InvalidTokenError('not a user session');
  if (isRevoked(payload)) throw new InvalidTokenError('revoked');
  return payload;
}
