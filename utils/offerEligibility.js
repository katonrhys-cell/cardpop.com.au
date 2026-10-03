// Which marketplace listings take cash offers — one rule shared by the product
// page (whether to show "Make an Offer"), POST /offers (src/routes/offers.js)
// and mirrored in the database by the offers_set_seller_from_listing insert
// trigger (supabase/migrations/20260928071648_binding_offers_lifecycle.sql).
// Dependency-free so both the SPA and the backend can import it.

/** How long an offer (and a seller's counter) binds before it lapses. */
export const OFFER_WINDOW_HOURS = 48;

/**
 * @param {{ listing_type?: string|null, accepts_offers?: boolean|null, status?: string|null,
 *   offers_open_at?: string|null, offers_close_at?: string|null }} listing
 *   A `listings` row — `listing_type` is the raw enum ('fixed', 'trade',
 *   'auction', 'expression_of_interest', …), not the UI label.
 * @returns {boolean}
 */
export function listingTakesOffers(listing, now = new Date()) {
  if (!listing) return false;
  if (listing.status != null && listing.status !== 'active') return false;
  // Expression of Interest has no price — offers are the only way to buy, but
  // only while its (optional) offer window is open.
  if (listing.listing_type === 'expression_of_interest') return offerWindowState(listing, now) === 'open';
  // Buy-now listings take offers alongside Buy Now unless the seller switched
  // Accept Offers off (the column defaults on; null = not yet backfilled).
  // Trade-only and auction listings never take cash offers.
  return (listing.listing_type ?? 'fixed') === 'fixed' && listing.accepts_offers !== false;
}

const isPast = (ts, now) => Boolean(ts) && new Date(ts) <= now;

/**
 * Where an Expression of Interest listing's offer window stands. Both ends are
 * optional (`offers_open_at` null = open now, `offers_close_at` null = no
 * closing date), so a listing with neither is always 'open'. Mirrored by the
 * offers insert trigger (20261003034818_eoi_offer_window_and_open_ended_range.sql).
 *
 * @returns {'upcoming'|'open'|'closed'}
 */
export function offerWindowState(listing, now = new Date()) {
  if (listing?.offers_open_at && new Date(listing.offers_open_at) > now) return 'upcoming';
  if (isPast(listing?.offers_close_at, now)) return 'closed';
  return 'open';
}

const money = (n) => `$${Number(n).toFixed(2)}`;

/**
 * The seller's indicative EOI price as display text: "$80.00 – $120.00" for a
 * range, "From $80.00" when there's no ceiling, "Up to $120.00" when there's
 * no floor. Null when neither is set.
 */
export function formatOfferRange(min, max) {
  const hasMin = min != null && min !== '' && Number(min) > 0;
  const hasMax = max != null && max !== '' && Number(max) > 0;
  if (hasMin && hasMax) return `${money(min)} – ${money(max)}`;
  if (hasMin) return `From ${money(min)}`;
  if (hasMax) return `Up to ${money(max)}`;
  return null;
}

/**
 * The state an offer is really in right now. The expire_stale_offers() sweep
 * only runs every 15 minutes, so a row can still say 'pending' / 'countered'
 * past expires_at, or 'accepted' past its payment window (payment_due_at),
 * for a few minutes — show those as expired, never as live. A paid offer
 * (paid_at, stamped by the Stripe webhook) is 'paid'.
 *
 * @returns {'pending'|'countered'|'accepted'|'paid'|'declined'|'expired'|'withdrawn'}
 */
export function offerDisplayStatus(offer, now = new Date()) {
  if (!offer) return 'expired';
  if (offer.paid_at) return 'paid';
  if ((offer.status === 'pending' || offer.status === 'countered') && isPast(offer.expires_at, now)) return 'expired';
  if (offer.status === 'accepted' && isPast(offer.payment_due_at, now)) return 'expired';
  return offer.status;
}
