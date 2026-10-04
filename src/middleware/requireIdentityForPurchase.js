import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getPlatformSetting } from '../services/commissionService.js';
import {
  DEFAULT_MARKETPLACE_IDENTITY_THRESHOLD_AUD,
  identityRequiredForAmount,
} from '../../utils/marketplaceIdentity.js';

// Buy-side identity gate for the MARKETPLACE (peer-to-peer `listing` items).
//
// Buying a marketplace listing requires a signed-in buyer, and — once the
// marketplace items in the order reach the `marketplace_identity_threshold_aud`
// platform setting (default $500; 0 = every order) — Stripe Identity
// verification (`profiles.is_verified`). CardPop Shop (`shop`) items are
// platform retail and stay open to guest checkout, so a cart with no listing
// items — a shop-only order — passes straight through untouched.
//
// The threshold keeps the ID + selfie step for the orders where a fraudulent
// buyer or chargeback actually hurts, instead of putting it in front of every
// $20 card. The same rule drives the checkout UI (utils/marketplaceIdentity.js)
// so the buyer is told before they reach the till, not by this 403.
//
// It does NOT require a card on file: a buyer pays at checkout, so there is no
// deferred fee to collect (that requirement is sell/trade-only).
//
// Must run AFTER optionalAuthMiddleware (needs req.user when present). Detects a
// marketplace purchase from either request shape:
//   - /create-cart-checkout → req.body.items[] with an item of type 'listing'
//   - /create-checkout      → req.body.listingId (single listing, always P2P)
//
// Outcomes for a marketplace purchase:
//   - no account                          → 401 IDENTITY_REQUIRED (sign in to buy)
//   - account, under threshold            → pass
//   - account, at/over threshold, no ID   → 403 IDENTITY_NOT_VERIFIED
// Fails OPEN on an unexpected error so a transient DB blip never blocks an
// otherwise-legitimate, authenticated buyer at the till.

/** AUD value of the marketplace listings in the request, priced from the DB. */
async function marketplaceValueAud(items, listingId) {
  const ids = new Set();
  for (const it of items) if (it && it.type === 'listing' && typeof it.id === 'string') ids.add(it.id);
  if (typeof listingId === 'string' && listingId) ids.add(listingId);
  if (ids.size === 0) return 0;
  const { data, error } = await supabase.from('listings').select('id, price_aud').in('id', [...ids]);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + (Number(row.price_aud) || 0), 0);
}

export async function requireIdentityForMarketplacePurchase(req, res, next) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const listingId = typeof req.body?.listingId === 'string' && req.body.listingId.length > 0 ? req.body.listingId : null;
    const hasMarketplaceItem = items.some((it) => it && it.type === 'listing') || !!listingId;

    // Shop-only (or empty) order — no marketplace listing to gate.
    if (!hasMarketplaceItem) return next();

    if (!req.user) {
      return res.status(401).json({
        error: 'Sign in to buy marketplace items — a free account takes a minute.',
        code: 'IDENTITY_REQUIRED',
      });
    }

    // Under the threshold a signed-in, email-verified buyer is enough. A
    // pricing read error falls through to the ID check (never cheaper than
    // the old rule), and the ID check itself fails open below.
    let value = null;
    try {
      value = await marketplaceValueAud(items, listingId);
    } catch (priceErr) {
      logger.error(`[IDENTITY_GATE] listing price read failed for ${req.user.id}: ${priceErr.message}`);
    }
    const threshold = await getPlatformSetting('marketplace_identity_threshold_aud', DEFAULT_MARKETPLACE_IDENTITY_THRESHOLD_AUD);
    if (value !== null && !identityRequiredForAmount(value, threshold)) return next();

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

    logger.warn(`[IDENTITY_GATE] ID-unverified user ${req.user.id} blocked from a $${value ?? '?'} marketplace purchase (threshold $${threshold})`);
    return res.status(403).json({
      error: 'Verify your identity before buying marketplace items of this value.',
      code: 'IDENTITY_NOT_VERIFIED',
      message: 'A quick ID + selfie check via Stripe is required for marketplace orders at or above the identity threshold.',
      thresholdAud: Number(threshold),
    });
  } catch (err) {
    logger.error(`[IDENTITY_GATE] failed open: ${err.message}`);
    return next();
  }
}
