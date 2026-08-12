// The Shop is the platform's own storefront, but the storefront account
// (admin@cardpop.com.au) lists its cards through the same vault → marketplace
// flow as everyone else — those rows live in `listings`, not `shop_products`.
// This module lets the shop pages union the platform account's live
// marketplace listings into their grids so an admin-listed card appears as an
// official shop product, not only as a community marketplace listing.
//
// `is_admin` is in PUBLIC_PROFILE_COLUMNS (client-readable), so the seller
// embed can be filtered with `!inner` and no separate profile lookup is
// needed. Rows come back tagged `source: 'official-listing'`; grids render
// them with MarketplaceListingCard (offer ranges, sold badges, watchlist) and
// they link to the normal marketplace detail page for checkout/offers.

import { LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';
import { escapeLike } from '@/src/utils/escapeLike.js';

export const OFFICIAL_LISTING_SOURCE = 'official-listing';

// Same seller columns the marketplace grid embeds, plus is_admin (the filter
// key). All are in the PUBLIC_PROFILE_COLUMNS grant.
const SELLER_EMBED =
  'seller:profiles!seller_id!inner(id, display_name, username, avatar_url, is_verified, is_admin, seller_tier, rating, reviews_count)';

/**
 * Fetch the platform account's live marketplace listings for a shop grid.
 * Failures resolve to [] so a broken union can never blank the shop itself.
 *
 * @param {object} supabase - the shared client (passed in so pure helpers in
 *   this module stay importable in tests without the client's side effects)
 * @param {object} [opts]
 * @param {string} [opts.searchTerm] - matched against the card name
 * @param {string|number} [opts.minPrice] - price_aud lower bound
 * @param {string|number} [opts.maxPrice] - price_aud upper bound
 * @param {number} [opts.limit]
 */
export async function fetchOfficialStoreListings(supabase, opts = {}) {
  const { searchTerm, minPrice, maxPrice, limit = 50 } = opts;
  try {
    let query = supabase
      .from('listings')
      .select(`*, ${LISTING_CARD_VAULT_EMBED_INNER}, ${SELLER_EMBED}`)
      .eq('status', 'active')
      .neq('listing_type', 'vault')
      .eq('seller.is_admin', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (searchTerm) {
      query = query.ilike('vault_item.card_name', `%${escapeLike(searchTerm)}%`);
    }
    // Price bounds only apply to fixed-price rows; expression-of-interest
    // listings have a null price_aud and drop out once a bound is set, which
    // is the honest behaviour for a price filter.
    if (minPrice !== undefined && minPrice !== '' && !isNaN(minPrice)) {
      query = query.gte('price_aud', Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '' && !isNaN(maxPrice)) {
      query = query.lte('price_aud', Number(maxPrice));
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((l) => ({ ...l, source: OFFICIAL_LISTING_SOURCE }));
  } catch {
    return [];
  }
}

/**
 * Effective unit price for sorting a mixed grid: shop rows and fixed-price
 * listings both carry price_aud; expression-of-interest listings sort by the
 * bottom of their offer range.
 */
export function gridPrice(item) {
  const value = item.price_aud ?? item.price_min_aud;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Merge shop products and official listings under the shop pages' sort keys
 * ('price_asc' | 'price_desc' | anything else = newest first).
 */
export function mergeShopAndListings(shopProducts, officialListings, sort) {
  const merged = [...(shopProducts || []), ...(officialListings || [])];
  if (sort === 'price_asc') {
    merged.sort((a, b) => gridPrice(a) - gridPrice(b));
  } else if (sort === 'price_desc') {
    merged.sort((a, b) => gridPrice(b) - gridPrice(a));
  } else {
    merged.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }
  return merged;
}
