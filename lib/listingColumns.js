// Column projection for the `listings` rows behind every browse grid.
//
// lib/listingCardColumns.js narrowed the vault_items EMBED in 2026-07; the
// listings base row itself still went out as `*` on the marketplace, search,
// collection, seller-store and "more from this seller" grids. The card only
// renders the fields below. Two columns are deliberately absent because they
// are the seller's business, not the buyer's: `reserve_price_aud` (an auction
// floor the bidders must not see) and `flag_reason` / `flagged` (moderation).
// Every name here exists on the live table (checked 2026-10-10); an explicit
// select of a missing column is a PostgREST 400, so add new columns only after
// their migration has been applied.
export const LISTING_CARD_COLUMNS = [
  'id',
  'vault_item_id',
  'seller_id',
  'listing_type',
  'status',
  'price_aud',
  'price_min_aud',
  'price_max_aud',
  'accepts_offers',
  'accepts_trade',
  'offers_open_at',
  'offers_close_at',
  'starting_bid_aud',
  'current_bid_aud',
  'bid_count',
  'auction_end_at',
  'shipping_cost_aud',
  'free_shipping',
  'ships_nationwide',
  'grading_company',
  'grading_number',
  'grading_verified',
  'slug',
  'tags',
  'sold_at',
  'created_at',
  'updated_at',
].join(',');

// The seller embed every listing grid shows (name, avatar, trust marks, store
// link). Kept here so the dozen grids that spell it out stay identical.
export const LISTING_SELLER_EMBED =
  'seller:profiles!seller_id(id, display_name, username, avatar_url, profile_photo_or_character, is_verified, is_admin, is_sole_trader, business_name, business_logo_url, store_slug, seller_tier, rating, reviews_count)';
