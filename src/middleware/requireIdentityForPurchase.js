import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Buy-side identity gate for the MARKETPLACE (peer-to-peer `listing` items).
//
// Buying a marketplace listing requires the buyer to have completed Stripe
// Identity verification (`profiles.is_verified`). CardPop Shop (`shop`) items
// are platform retail and stay open to guest checkout, so a cart with no
// listing items — a shop-only order — passes straight through untouched.
//
// Listings sold by the Official CardPop Store (seller `is_admin`, see
// lib/sellerIdentity.js) are platform stock too, so they get the same open
// checkout as the Shop: anyone, guests included, can buy them at the Buy Now
// price. The exemption is decided here from the DB — never from the client —
// and only when EVERY listing in the order is official; one peer-to-peer
// listing gates the whole order exactly as before. If the seller lookup
// fails, the order falls through to the normal identity gate (fail closed
// for the exemption). Exempt orders are marked `req.officialStoreOrder` so the
// checkout handlers also skip the new-buyer purchase limits for them.
//
// This mirrors, on the buy side, the identity requirement the trade/sell paths
// already enforce (verifyTradeAccess / DB can_sell()). It does NOT require a
// card on file: a buyer pays at checkout, so there is no deferred fee to
// collect (that requirement is sell/trade-only).
//
// Must run AFTER optionalAuthMiddleware (needs req.user when present). Detects a
// marketplace purchase from either request shape:
//   - /create-cart-checkout → req.body.items[] with an item of type 'listing'
//   - /create-checkout      → req.body.listingId (single listing, always P2P)
//
// Outcomes for a marketplace purchase:
//   - no account             → 401 IDENTITY_REQUIRED (sign in + verify to buy)
//   - account, unverified ID → 403 IDENTITY_NOT_VERIFIED
//   - only official-store listings → passes, signed in or not
// Fails OPEN on an unexpected error so a transient DB blip never blocks an
// otherwise-legitimate, authenticated buyer at the till.
export async function requireIdentityForMarketplacePurchase(req, res, next) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const hasMarketplaceItem =
      items.some((it) => it && it.type === 'listing') ||
      (typeof req.body?.listingId === 'string' && req.body.listingId.length > 0);

    // Shop-only (or empty) order — no marketplace listing to gate.
    if (!hasMarketplaceItem) return next();

    if (await onlyOfficialStoreListings(req.body, items)) {
      // Downstream handlers skip the new-buyer purchase limits for these
      // orders (checkPurchaseVelocity) — CardPop's own cards are open to all.
      req.officialStoreOrder = true;
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        error: 'Sign in and verify your identity to buy marketplace items.',
        code: 'IDENTITY_REQUIRED',
      });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', req.user.id)
      .maybeSingle();

    // Fail open on a read error — the buyer is authenticated and a rare DB blip
    // must not block a paying customer.
    if (error) {
      logger.error(`[IDENTITY_GATE] profile read failed open for ${req.user.id}: ${error.message}`);
      return next();
    }

    if (profile?.is_verified === true) return next();

    logger.warn(`[IDENTITY_GATE] ID-unverified user ${req.user.id} blocked from a marketplace purchase`);
    return res.status(403).json({
      error: 'Verify your identity before buying marketplace items.',
      code: 'IDENTITY_NOT_VERIFIED',
      message: 'A quick ID + selfie check via Stripe is required before buying on the marketplace.',
    });
  } catch (err) {
    logger.error(`[IDENTITY_GATE] failed open: ${err.message}`);
    return next();
  }
}

// True when every listing in the order is sold by the platform's own storefront
// account (seller `is_admin`). Any lookup problem, an unknown id or a single
// community seller returns false, so the normal identity gate applies.
async function onlyOfficialStoreListings(body, items) {
  try {
    const ids = [...new Set([
      ...items.filter((it) => it && it.type === 'listing').map((it) => it.id),
      ...(typeof body?.listingId === 'string' && body.listingId ? [body.listingId] : []),
    ])];
    if (ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id)) return false;

    const { data, error } = await supabase
      .from('listings')
      .select('id, seller:profiles!seller_id(is_admin)')
      .in('id', ids);
    if (error || !Array.isArray(data) || data.length !== ids.length) return false;
    return data.every((l) => l.seller?.is_admin === true);
  } catch (err) {
    logger.warn(`[IDENTITY_GATE] official-store check failed, applying the normal gate: ${err.message}`);
    return false;
  }
}
