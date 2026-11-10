// The homepage's Supabase reads as pure functions of a client. Both callers
// share them: the browser (lib/homepageData.js, as the fallback when the API
// is unreachable) and the server (src/routes/public.js, which runs them once
// a minute under the anon key and lets Cloudflare serve every repeat). Keep
// this file free of the `@/` alias — Node imports it as a plain relative path.
//
// Every function resolves to Supabase's `{ data, error }` shape and never
// throws, so a bundle can carry a partial failure per part.

import { PROFILE_CARD_COLUMNS } from './profileColumns.js';
import { VAULT_ITEM_CARD_COLUMNS, VAULT_IMAGE_CARD_COLUMNS, VAULT_ITEM_LISTING_EMBED } from './listingCardColumns.js';

export const FEATURED_LIMIT = 4;

// Featured Sellers = admin-flagged accounts plus every Ultimate member
// (homepage placement is an Ultimate membership perk). The strip is a
// carousel (components/FeaturedSellersCarousel.jsx) that pages through them,
// so the cap is the most it will rotate through, not the number on screen.
export const FEATURED_SELLERS_LIMIT = 12;

// vault_items has more than one FK to profiles, so the embed must use the
// explicit constraint-name hint (!vault_items_owner_id_fkey) — the bare
// !owner_id hint returns a PostgREST 400. The listing embed is what lets a
// featured card that has sold say so — the vault row keeps its "For Sale"
// listing_type after a sale.
const FEATURED_SELECT = `${VAULT_ITEM_CARD_COLUMNS}, owner:profiles!vault_items_owner_id_fkey(id, display_name, username, avatar_url, is_admin, profile_photo_or_character, is_verified, seller_tier, rating, reviews_count), vault_images(${VAULT_IMAGE_CARD_COLUMNS}), ${VAULT_ITEM_LISTING_EMBED}`;
const PREMIUM_SELECT = `${VAULT_ITEM_CARD_COLUMNS}, owner:profiles!vault_items_owner_id_fkey!inner(id, display_name, username, avatar_url, is_admin, profile_photo_or_character, is_verified, seller_tier, rating, reviews_count, subscription_tier), vault_images(${VAULT_IMAGE_CARD_COLUMNS}), ${VAULT_ITEM_LISTING_EMBED}`;

// Admin-curated picks (Marketplace Management → Featured) first, then
// Premium-and-up sellers' newest public cards, then the newest public cards.
//
// The three tiers are fetched IN PARALLEL and merged in priority order. They
// used to run one after another, each only if the previous left a gap — on the
// usual homepage (few or no admin picks) that was a three-deep waterfall in
// front of the "Just Listed" photos, the longest network chain on the page.
export async function queryFeaturedCards(supabase) {
  // `is_featured` is admin-only, so it means "show this on the home page" —
  // surface it regardless of the per-card is_public flag. A card can be live
  // in the marketplace (active listing) yet have is_public = false, in which
  // case requiring is_public here made featuring it save successfully but
  // never appear. Still exclude Private listings. (Anon visibility is granted
  // by the matching vault_items_public_featured_select RLS policy.)
  //
  // Membership perk: Premium-and-up sellers' newest public cards fill the
  // remaining slots ahead of everyone else's. The !inner join makes the
  // owner-tier filter drop non-matching rows instead of null-ing the embed.
  // Best-effort — an error there just falls through to the generic backfill,
  // which keeps the grid no emptier than before curation existed.
  const [featuredRes, premiumRes, fillRes] = await Promise.all([
    supabase.from('vault_items').select(FEATURED_SELECT)
      .eq('is_featured', true).neq('listing_type', 'Private')
      .order('created_at', { ascending: false }).limit(FEATURED_LIMIT),
    supabase.from('vault_items').select(PREMIUM_SELECT)
      .eq('is_public', true).neq('listing_type', 'Private')
      .in('owner.subscription_tier', ['premium', 'elite', 'ultimate'])
      .order('created_at', { ascending: false }).limit(FEATURED_LIMIT),
    supabase.from('vault_items').select(FEATURED_SELECT)
      .eq('is_public', true).neq('listing_type', 'Private')
      .order('created_at', { ascending: false }).limit(FEATURED_LIMIT * 2),
  ]);
  if (featuredRes.error) return featuredRes;

  const seen = new Set();
  const merged = [];
  for (const tier of [featuredRes.data, premiumRes.data, fillRes.data]) {
    for (const card of tier ?? []) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      merged.push(card);
      if (merged.length >= FEATURED_LIMIT) return { data: merged, error: null };
    }
  }
  return { data: merged, error: null };
}

export function queryFeaturedSellers(supabase) {
  return supabase.from('profiles').select(PROFILE_CARD_COLUMNS)
    .or('is_featured_seller.eq.true,subscription_tier.eq.ultimate')
    .eq('is_active', true)
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(FEATURED_SELLERS_LIMIT);
}

// Real platform counts for the stats strip. `estimated` is exact while a table
// is small (PostgREST counts up to its row cap, 1,000) and switches to the
// planner's estimate above that — right for a decorative "N cards" figure, and
// it stops the strip from forcing a full RLS-checked scan of vault_items per
// visitor once the vaults grow. RLS-scoped, so anon sees only what's public.
export async function queryPlatformStats(supabase) {
  const [sellers, vaultCards, events] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'estimated', head: true }).eq('is_active', true),
    supabase.from('vault_items').select('id', { count: 'estimated', head: true }),
    supabase.from('events_public').select('id', { count: 'estimated', head: true }).eq('status', 'approved'),
  ]);
  const error = sellers.error || vaultCards.error || events.error;
  if (error) return { data: null, error };
  return {
    data: {
      sellers: sellers.count || 0,
      vaultCards: vaultCards.count || 0,
      events: events.count || 0,
    },
    error: null,
  };
}

// "Found on Google" panel: GA4 visitors plus Search Console impressions and
// clicks, last 30 days + since launch, from the nightly sync.
export function queryTrafficSummary(supabase) {
  return supabase.from('site_traffic_summary')
    .select('visitors_30d, visitors_all_time, pageviews_30d, pageviews_all_time, since_date, synced_at, search_impressions_30d, search_clicks_30d, search_impressions_all_time, search_clicks_all_time, search_since_date, search_synced_at')
    .eq('id', true)
    .maybeSingle();
}

/** The four parts the home page needs, keyed the way the page reads them. */
// ── Live activity ticker (homepage + marketplace) ─────────────────────────────
export const TICKER_SELECT = 'id, price_aud, status, created_at, updated_at, vault_item:vault_items!inner(card_name, card_image, vault_images(storage_path))';

/** The newest active and sold listings, as raw rows. Never throws. */
export async function queryTickerRows(supabase) {
  try {
    const [listed, sold] = await Promise.all([
      supabase.from('listings').select(TICKER_SELECT)
        .eq('status', 'active').order('created_at', { ascending: false }).limit(10),
      supabase.from('listings').select(TICKER_SELECT)
        .eq('status', 'sold').order('updated_at', { ascending: false }).limit(6),
    ]);
    return { listed: listed.data || [], sold: sold.data || [], error: listed.error || sold.error || null };
  } catch (error) {
    return { listed: [], sold: [], error };
  }
}

// ── Hero showcase cards (admin-configured) ───────────────────────────────────
export const SHOWCASE_COLUMNS = 'id, image_url, accent, name, subtitle, rarity, value';

/** The active hero showcase rows, in display order. Resolves to { data, error }. */
export async function queryShowcaseRows(supabase) {
  try {
    return await supabase
      .from('hero_showcase_cards')
      .select(SHOWCASE_COLUMNS)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(24);
  } catch (error) {
    return { data: null, error };
  }
}

export const HOMEPAGE_BUNDLE_PARTS = Object.freeze(['cards', 'sellers', 'stats', 'traffic']);

// A Supabase result made safe to send over the wire: PostgrestError carries
// only plain fields, but keep the contract explicit so a client can rely on
// `{ data, error: { message, code } | null }`.
const serialisable = ({ data, error }) => ({
  data: data ?? null,
  error: error ? { message: String(error.message || error), code: error.code ?? null } : null,
});

/**
 * All four homepage reads in parallel, as one JSON-ready object. Each part
 * carries its own `{ data, error }`, so one failing query never empties the
 * others.
 */
export async function queryHomepageBundle(supabase) {
  const [cards, sellers, stats, traffic] = await Promise.all([
    queryFeaturedCards(supabase).catch((error) => ({ data: null, error })),
    Promise.resolve(queryFeaturedSellers(supabase)).catch((error) => ({ data: null, error })),
    queryPlatformStats(supabase).catch((error) => ({ data: null, error })),
    Promise.resolve(queryTrafficSummary(supabase)).catch((error) => ({ data: null, error })),
  ]);
  return {
    cards: serialisable(cards),
    sellers: serialisable(sellers),
    stats: serialisable(stats),
    traffic: serialisable(traffic),
  };
}

/** Whether any part of a bundle failed. */
export const bundleHasErrors = (bundle) =>
  HOMEPAGE_BUNDLE_PARTS.some((part) => !bundle?.[part] || bundle[part].error);
