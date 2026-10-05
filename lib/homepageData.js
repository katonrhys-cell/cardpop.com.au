import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { VAULT_ITEM_CARD_COLUMNS, VAULT_IMAGE_CARD_COLUMNS, VAULT_ITEM_LISTING_EMBED } from '@/lib/listingCardColumns.js';
import { cachedQuery } from '@/lib/queryCache.js';

// The homepage's Supabase reads, in one place so they can be STARTED from
// main.jsx the moment the bundle executes — before React mounts — and then
// READ by pages/HomePage.jsx when it renders. lib/queryCache de-dupes the two
// callers onto one in-flight request per key, so the page never fetches twice;
// it merely finds the promise (or the cached result) already waiting.
//
// Why: these queries used to begin only inside HomePage's mount effect, i.e.
// after entry parse → provider mount → route chunk → first commit. On a
// mid-range phone that is ~0.5–1 s in which the network sat idle, and because
// every "Just Listed" photo depends on the query that names it, the React
// mount was the critical path of the longest network chain on the page.

const TTL_MS = 5 * 60 * 1000;
const FEATURED_LIMIT = 4;

// vault_items has more than one FK to profiles, so the embed must use the
// explicit constraint-name hint (!vault_items_owner_id_fkey) — the bare
// !owner_id hint returns a PostgREST 400. The listing embed is what lets a
// featured card that has sold say so — the vault row keeps its "For Sale"
// listing_type after a sale.
const FEATURED_SELECT = `${VAULT_ITEM_CARD_COLUMNS}, owner:profiles!vault_items_owner_id_fkey(id, display_name, username, avatar_url, is_admin, profile_photo_or_character, is_verified, seller_tier, rating, reviews_count), vault_images(${VAULT_IMAGE_CARD_COLUMNS}), ${VAULT_ITEM_LISTING_EMBED}`;
const PREMIUM_SELECT = `${VAULT_ITEM_CARD_COLUMNS}, owner:profiles!vault_items_owner_id_fkey!inner(id, display_name, username, avatar_url, is_admin, profile_photo_or_character, is_verified, seller_tier, rating, reviews_count, subscription_tier), vault_images(${VAULT_IMAGE_CARD_COLUMNS}), ${VAULT_ITEM_LISTING_EMBED}`;

export const HOMEPAGE_KEYS = {
  cards: 'homepage_featured_cards',
  sellers: 'homepage_featured_sellers',
  stats: 'homepage_stats',
  traffic: 'homepage_traffic',
};

// Admin-curated picks (Marketplace Management → Featured) first, then
// Premium-and-up sellers' newest public cards, then the newest public cards.
export async function queryFeaturedCards() {
  // Fresh builder per call — a Supabase query builder is single-use.
  const publicBase = () => supabase.from('vault_items').select(FEATURED_SELECT).eq('is_public', true).neq('listing_type', 'Private');

  // `is_featured` is admin-only, so it means "show this on the home page" —
  // surface it regardless of the per-card is_public flag. A card can be live
  // in the marketplace (active listing) yet have is_public = false, in which
  // case requiring is_public here made featuring it save successfully but
  // never appear. Still exclude Private listings. (Anon visibility is granted
  // by the matching vault_items_public_featured_select RLS policy.)
  const featuredRes = await supabase.from('vault_items').select(FEATURED_SELECT)
    .eq('is_featured', true).neq('listing_type', 'Private')
    .order('created_at', { ascending: false }).limit(FEATURED_LIMIT);
  if (featuredRes.error) return featuredRes;
  const featured = featuredRes.data ?? [];
  if (featured.length >= FEATURED_LIMIT) return { data: featured.slice(0, FEATURED_LIMIT), error: null };

  const seen = new Set(featured.map((c) => c.id));
  const merged = [...featured];

  // Membership perk: Premium-and-up sellers' newest public cards fill the
  // remaining slots ahead of everyone else's. The !inner join makes the
  // owner-tier filter drop non-matching rows instead of null-ing the embed.
  // Best-effort — any error just falls through to the generic backfill.
  const premiumRes = await supabase.from('vault_items').select(PREMIUM_SELECT)
    .eq('is_public', true).neq('listing_type', 'Private')
    .in('owner.subscription_tier', ['premium', 'elite', 'ultimate'])
    .order('created_at', { ascending: false }).limit(FEATURED_LIMIT);
  for (const card of premiumRes.data ?? []) {
    if (!seen.has(card.id)) { seen.add(card.id); merged.push(card); }
  }
  if (merged.length >= FEATURED_LIMIT) return { data: merged.slice(0, FEATURED_LIMIT), error: null };

  // Backfill with the most recent cards so the grid is never emptier than
  // before curation existed (empty selection = previous behaviour).
  const fillRes = await publicBase().order('created_at', { ascending: false }).limit(FEATURED_LIMIT + merged.length);
  if (fillRes.error) return { data: merged, error: null };
  const backfill = (fillRes.data ?? []).filter((c) => !seen.has(c.id));
  return { data: [...merged, ...backfill].slice(0, FEATURED_LIMIT), error: null };
}

// Featured Sellers = admin-flagged accounts plus every Ultimate member
// (homepage placement is an Ultimate membership perk).
export function queryFeaturedSellers() {
  return supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS)
    .or('is_featured_seller.eq.true,subscription_tier.eq.ultimate')
    .eq('is_active', true)
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(4);
}

// Real platform counts for the stats strip (cheap head-count queries,
// RLS-scoped so anon sees only what's public anyway).
export async function queryPlatformStats() {
  const [listings, sellers, vaultCards, events] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('vault_items').select('id', { count: 'exact', head: true }),
    supabase.from('events_public').select('id', { count: 'exact', head: true }),
  ]);
  const error = listings.error || sellers.error || vaultCards.error || events.error;
  if (error) return { data: null, error };
  return {
    data: {
      listings: listings.count || 0,
      sellers: sellers.count || 0,
      vaultCards: vaultCards.count || 0,
      events: events.count || 0,
    },
    error: null,
  };
}

// Visitors tile: last 30 days + since launch, from the nightly GA4 sync.
export function queryTrafficSummary() {
  return supabase.from('site_traffic_summary')
    .select('visitors_30d, visitors_all_time, since_date, synced_at')
    .eq('id', true)
    .maybeSingle();
}

export const getFeaturedCards = () => cachedQuery(HOMEPAGE_KEYS.cards, queryFeaturedCards, TTL_MS);
export const getFeaturedSellers = () => cachedQuery(HOMEPAGE_KEYS.sellers, queryFeaturedSellers, TTL_MS);
export const getPlatformStats = () => cachedQuery(HOMEPAGE_KEYS.stats, queryPlatformStats, TTL_MS);
export const getTrafficSummary = () => cachedQuery(HOMEPAGE_KEYS.traffic, queryTrafficSummary, TTL_MS);

/**
 * Kick off every homepage read without waiting for any of them. Rejections
 * are swallowed here — HomePage handles (and logs) failures when it reads the
 * same keys — so an early network blip can never surface as an unhandled
 * rejection at boot.
 */
export function prefetchHomepageData() {
  for (const get of [getFeaturedCards, getFeaturedSellers, getPlatformStats, getTrafficSummary]) {
    try { get().catch(() => {}); } catch { /* ignore */ }
  }
}
