import { createClient } from '@supabase/supabase-js';

// These are public anon credentials — safe to ship in client-side code.
// Security is enforced by Supabase Row Level Security policies, not by keeping these secret.
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://vrfsaazuqjxotnieqlkd.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnNhYXp1cWp4b3RuaWVxbGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDM0MTEsImV4cCI6MjEwMTExOTQxMX0.R4JqdifHRVBUjPleXqtJ963h6Q8eVosrjDtpGynw8Fo';

// Clear any stale sessionStorage tokens from previous sessions so users
// are not left in a half-authenticated state after the storage change.
try {
  Object.keys(sessionStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => sessionStorage.removeItem(k));
} catch { /* sessionStorage unavailable in some envs */ }

// Transient failures — a Supabase instance restart (minor-version patching)
// bounces the whole stack for a few seconds: PostgREST answers 502/503/504
// while it can't reach Postgres, and in-flight connections get reset. Without
// a retry, a visitor loading the site during that window sees a hard-broken
// page (the homepage bootstrap reads — platform_settings, categories, hero
// cards, profiles, vault_items, events_public — all throw at once).
//
// Retry those transient failures with exponential backoff + jitter so the
// blip self-heals. Only idempotent reads (GET/HEAD) are retried — a POST /
// PATCH / DELETE is never replayed, so no write can be silently duplicated,
// even though a connection-level failure usually means the write never
// landed. Aborted requests (caller cancellation / .abortSignal()) are never
// retried.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 4000;

const backoffDelay = (attempt) => {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return exp / 2 + Math.random() * (exp / 2); // full-ceiling with jitter
};

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); },
        { once: true },
      );
    }
  });

const retryingFetch = async (input, init = {}) => {
  const method = (init.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
  const idempotent = method === 'GET' || method === 'HEAD';
  const signal = init.signal;

  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(input, init);
      if (idempotent && RETRYABLE_STATUS.has(res.status) && attempt <= MAX_RETRIES) {
        await sleep(backoffDelay(attempt), signal);
        continue;
      }
      return res;
    } catch (err) {
      // Never retry a deliberate cancellation.
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
      // Network-level failure (connection reset, offline). Retry idempotent reads.
      if (idempotent && attempt <= MAX_RETRIES) {
        await sleep(backoffDelay(attempt), signal);
        continue;
      }
      throw err;
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      // Use localStorage (Supabase default) — sessions persist across tabs
      // and browser restarts until the refresh token expires (~60 days).
    },
    global: {
      fetch: retryingFetch,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

export default supabase;
