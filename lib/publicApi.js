// The server's edge-cached public read endpoints (src/routes/public.js).
//
// Anonymous visitors used to query Supabase directly for the home page and
// the shop grids, which made database compute the one cost that grew with
// traffic. These endpoints run the same queries once a minute on the server
// under the anon key (so RLS still decides what is visible) and answer with
// `Cache-Control: s-maxage`, so Cloudflare serves every repeat from its edge.
// The browser tries them first and falls back to the direct Supabase query
// when they are unreachable — the page never depends on the API being up.
//
// Requests go out with no credentials on purpose: a cookie or bearer would
// make the response uncacheable at the edge, and the data is the anon view
// for everyone.

const API_BASE = '/hcgi/api/public';

export const PUBLIC_HOME_URL = `${API_BASE}/home`;
export const PUBLIC_SHOP_FACETS_URL = `${API_BASE}/shop/facets`;
export const PUBLIC_SETTINGS_URL = `${API_BASE}/settings`;

// Generous for a cached JSON blob, short enough that a dead origin doesn't
// hold the page past the fallback's own round trip.
const TIMEOUT_MS = 4000;

/**
 * GET a public endpoint and return its JSON. Rejects on a network error, a
 * non-2xx status or a body that isn't JSON, so callers can fall back.
 */
export async function fetchPublicJson(url) {
  if (typeof fetch !== 'function') throw new Error('fetch unavailable');
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', signal });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
