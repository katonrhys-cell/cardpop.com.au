// Who has to prove what before buying marketplace (peer-to-peer) cards.
//
// Dependency-free so the SPA (checkout page, cart drawer, product page) and the
// Express middleware (src/middleware/requireIdentityForPurchase.js) make the
// same decision from the same rule:
//
//   - CardPop Shop items: guest checkout, nothing to prove.
//   - Any marketplace listing in the order: a signed-in account with a confirmed
//     email (sellers are real, verified people; buyers must be reachable too).
//   - Marketplace items totalling AT OR ABOVE the threshold: Stripe Identity
//     (ID + selfie) as well. The threshold is the admin-editable
//     `marketplace_identity_threshold_aud` platform setting; 0 means every
//     marketplace order needs ID (the pre-threshold behaviour).

export const DEFAULT_MARKETPLACE_IDENTITY_THRESHOLD_AUD = 500;

/** Coerce an admin setting (string / number / nothing) to a usable threshold. */
export function normaliseIdentityThreshold(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_MARKETPLACE_IDENTITY_THRESHOLD_AUD;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MARKETPLACE_IDENTITY_THRESHOLD_AUD;
  return n;
}

/**
 * Sum of marketplace listing lines, in AUD. Accepts the cart-entry shape
 * ({ product: { type, price }, quantity }) and the flat shape ({ type, price,
 * quantity }); listings are one-of-a-kind so quantity is always 1.
 */
export function marketplaceSubtotalAud(lines = []) {
  let total = 0;
  for (const line of lines) {
    if (!line) continue;
    const p = line.product || line;
    const type = p.type || 'listing';
    if (type !== 'listing') continue;
    total += Number(p.price ?? p.price_aud ?? 0) || 0;
  }
  return Math.round(total * 100) / 100;
}

export function hasMarketplaceLine(lines = []) {
  return lines.some((line) => line && ((line.product || line).type || 'listing') === 'listing');
}

/** True when an order of this marketplace value needs Stripe Identity. */
export function identityRequiredForAmount(marketplaceAud, thresholdAud) {
  const threshold = normaliseIdentityThreshold(thresholdAud);
  if (threshold === 0) return true;
  return Number(marketplaceAud) >= threshold;
}

/**
 * The gate a buyer meets at checkout:
 *   'open'     — nothing to do
 *   'account'  — sign in / create a free account (marketplace item, no user)
 *   'identity' — verify ID with Stripe (marketplace value at/above threshold)
 */
export function marketplaceGate({ lines = [], thresholdAud, isAuthenticated, isIdentityVerified }) {
  if (!hasMarketplaceLine(lines)) return 'open';
  if (!isAuthenticated) return 'account';
  if (!isIdentityVerified && identityRequiredForAmount(marketplaceSubtotalAud(lines), thresholdAud)) return 'identity';
  return 'open';
}
