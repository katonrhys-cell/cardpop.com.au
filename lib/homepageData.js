import { supabase } from '@/lib/supabaseClient.js';
import { cachedQuery } from '@/lib/queryCache.js';
import { fetchPublicJson, PUBLIC_HOME_URL } from '@/lib/publicApi.js';
import {
  queryFeaturedCards as queryFeaturedCardsWith,
  queryFeaturedSellers as queryFeaturedSellersWith,
  queryPlatformStats as queryPlatformStatsWith,
  queryTrafficSummary as queryTrafficSummaryWith,
  queryHomepageEvents as queryHomepageEventsWith,
  HOMEPAGE_BUNDLE_PARTS,
} from '@/lib/homepageQueries.js';

// The homepage's reads, in one place so they can be STARTED from main.jsx the
// moment the bundle executes — before React mounts — and then READ by
// pages/HomePage.jsx when it renders. lib/queryCache de-dupes the two callers
// onto one in-flight request per key, so the page never fetches twice; it
// merely finds the promise (or the cached result) already waiting.
//
// Where the data comes from: one request to the server's edge-cached
// `/public/home` endpoint (lib/publicApi.js), which carries all four parts.
// Cloudflare answers most visitors from its cache, so Supabase sees one set
// of queries a minute instead of eight PostgREST calls per visitor. If that
// request fails, or a part of it failed on the server, the SAME query runs
// directly against Supabase from the browser (lib/homepageQueries.js) — the
// page is never worse off than before the endpoint existed.
//
// Why start early: these queries used to begin only inside HomePage's mount
// effect, i.e. after entry parse → provider mount → route chunk → first
// commit. On a mid-range phone that is ~0.5–1 s in which the network sat
// idle, and because every "Just Listed" photo depends on the query that names
// it, the React mount was the critical path of the longest network chain on
// the page.

const TTL_MS = 5 * 60 * 1000;

export { FEATURED_SELLERS_LIMIT } from '@/lib/homepageQueries.js';

export const HOMEPAGE_KEYS = {
  cards: 'homepage_featured_cards',
  sellers: 'homepage_featured_sellers',
  stats: 'homepage_stats',
  traffic: 'homepage_traffic',
  events: 'homepage_events',
};
const BUNDLE_KEY = 'homepage_bundle';

// Direct-to-Supabase versions, bound to the browser client (the fallback, and
// what the page used before the public endpoint).
export const queryFeaturedCards = () => queryFeaturedCardsWith(supabase);
export const queryFeaturedSellers = () => queryFeaturedSellersWith(supabase);
export const queryPlatformStats = () => queryPlatformStatsWith(supabase);
export const queryTrafficSummary = () => queryTrafficSummaryWith(supabase);
export const queryHomepageEvents = () => queryHomepageEventsWith(supabase);

const DIRECT = {
  cards: queryFeaturedCards,
  sellers: queryFeaturedSellers,
  stats: queryPlatformStats,
  traffic: queryTrafficSummary,
  events: queryHomepageEvents,
};

// One fetch of the whole bundle, shared by the four getters. A rejection is
// not cached (queryCache only stores successes), so the next read retries.
const getHomeBundle = () => cachedQuery(BUNDLE_KEY, async () => {
  const bundle = await fetchPublicJson(PUBLIC_HOME_URL);
  if (!bundle || typeof bundle !== 'object' || !HOMEPAGE_BUNDLE_PARTS.every((p) => p in bundle)) {
    throw new Error('public/home: unexpected shape');
  }
  return bundle;
}, TTL_MS);

// The part from the shared bundle when it is sound, else the direct query.
const partOrDirect = (part) => async () => {
  const bundle = await getHomeBundle().catch(() => null);
  const slice = bundle?.[part];
  if (slice && !slice.error && slice.data !== undefined) return { data: slice.data, error: null };
  return DIRECT[part]();
};

export const getFeaturedCards = () => cachedQuery(HOMEPAGE_KEYS.cards, partOrDirect('cards'), TTL_MS);
export const getFeaturedSellers = () => cachedQuery(HOMEPAGE_KEYS.sellers, partOrDirect('sellers'), TTL_MS);
export const getPlatformStats = () => cachedQuery(HOMEPAGE_KEYS.stats, partOrDirect('stats'), TTL_MS);
export const getTrafficSummary = () => cachedQuery(HOMEPAGE_KEYS.traffic, partOrDirect('traffic'), TTL_MS);
export const getHomepageEvents = () => cachedQuery(HOMEPAGE_KEYS.events, partOrDirect('events'), TTL_MS);

/**
 * Kick off every homepage read without waiting for any of them. Rejections
 * are swallowed here — HomePage handles (and logs) failures when it reads the
 * same keys — so an early network blip can never surface as an unhandled
 * rejection at boot.
 */
export function prefetchHomepageData() {
  for (const get of [getFeaturedCards, getFeaturedSellers, getPlatformStats, getTrafficSummary, getHomepageEvents]) {
    try { get().catch(() => {}); } catch { /* ignore */ }
  }
}
