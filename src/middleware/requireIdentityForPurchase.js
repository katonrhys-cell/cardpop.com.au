import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Buy-side identity gate for the MARKETPLACE (peer-to-peer `listing` items).
//
// Buying a marketplace listing requires the buyer to have completed Stripe
// Identity verification (`profiles.is_verified`). CardPop Shop (`shop`) items
// are platform retail and stay open to guest checkout, so a cart with no
// listing items — a shop-only order — passes straight through untouched.
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
