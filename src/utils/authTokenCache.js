import { createHash } from 'node:crypto';
import { supabase } from './supabaseClient.js';
import { createTtlCache } from './ttlCache.js';

// Resolve the user behind a Supabase access token, with a short cache.
//
// Every authenticated API request used to call `supabase.auth.getUser(token)`
// — a network round-trip to GoTrue — and several routes called it twice in
// one request (their own auth middleware plus an inline check). The SPA fires
// a burst of API calls per page with the same bearer token, so on a warm
// instance nearly all of those were re-verifying a token verified seconds
// earlier. This caches the verdict per token for AUTH_TOKEN_CACHE_TTL_MS
// (default 60 s), never past the token's own `exp`.
//
// What the cache changes: a user banned or deleted mid-window keeps API
// access for up to 60 s on an instance that already verified their token —
// the same window Supabase's own JWT verification gives any token until it
// expires. Sign-out does not revoke an access token server-side either, so
// nothing that was instant before is delayed now. Set the TTL to 0 to disable.
//
// The key is a hash of the token, never the token itself, so a heap dump or
// log of the cache can't replay a session. Invalid tokens are remembered for a
// few seconds (AUTH_TOKEN_NEGATIVE_TTL_MS) so a flood of bad bearers can't
// turn into a flood of GoTrue calls.

const positive = createTtlCache({ ttlMs: () => process.env.AUTH_TOKEN_CACHE_TTL_MS ?? 60_000 });
const negative = createTtlCache({ ttlMs: () => process.env.AUTH_TOKEN_NEGATIVE_TTL_MS ?? 5_000 });

const keyFor = (token) => createHash('sha256').update(token).digest('base64url');

/** Milliseconds until the JWT's `exp`, or undefined when unreadable. */
export function msUntilExpiry(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(exp)) return undefined;
    return exp * 1000 - Date.now();
  } catch {
    return undefined;
  }
}

/**
 * Same contract as `supabase.auth.getUser(token)`: resolves `{ data: { user },
 * error }`. Verified users are cached; a GoTrue failure is passed through
 * (and remembered briefly as "invalid").
 */
export async function getUserForToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return { data: { user: null }, error: { message: 'Missing token' } };
  }
  const key = keyFor(token);

  const cachedUser = positive.peek(key);
  if (cachedUser) return { data: { user: cachedUser }, error: null };
  const cachedFailure = negative.peek(key);
  if (cachedFailure) return cachedFailure;

  const result = await positive.get(
    key,
    async () => {
      const res = await supabase.auth.getUser(token);
      if (res?.error || !res?.data?.user) {
        negative.set(key, { data: { user: null }, error: res?.error ?? { message: 'Invalid or expired token' } });
        return undefined; // not cached as a positive
      }
      return res.data.user;
    },
    { maxTtlMs: msUntilExpiry(token) },
  );
  if (result) return { data: { user: result }, error: null };
  return negative.peek(key) ?? { data: { user: null }, error: { message: 'Invalid or expired token' } };
}

/** Forget every cached verdict (tests, or after a security event). */
export function clearAuthTokenCache() {
  positive.clear();
  negative.clear();
}
