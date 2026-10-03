// CardPop Buyer Protection — the ONE place the marketplace refund rules live.
//
// Every page that states the policy (Returns, Trust & Safety, Safe Buying,
// Shipping, FAQ), every component that summarises it (BuyerProtection,
// CheckoutReassurance, RefundPolicyNote, Account → Orders) and both ends of the
// refund flow (routes/refunds.js request gate, the buyer's Request Refund
// button) read these numbers and this window logic, so they can never
// disagree again. (They did: trust pages promised "14 days, full refund", the
// returns page enforced 30 days and kept half the platform fee, the checkout
// strip offered change-of-mind returns the marketplace excludes.)
//
// Dependency-free so the SPA, api/prerender.js and the Express API share it.
//
// The rules, as decided 2026-10-03:
//   - A marketplace sale is binding. No change-of-mind returns on another
//     collector's card — if the card is as advertised, the sale stands.
//   - A buyer can claim when the card is not as described, damaged in transit,
//     counterfeit, never sent, or never arrived. Approved claims are refunded
//     IN FULL — item, postage, service fee and processing fee — and the
//     seller's payout is reversed. The seller carries a lost parcel: they
//     choose the service and should post tracked.
//   - The claim window is CLAIM_WINDOW_DAYS_FROM_DELIVERY days from delivery
//     (carrier tracking, the buyer's "Received it", or auto-delivery
//     AUTO_DELIVERED_DAYS_AFTER_SHIPPED days after the seller marks it posted).
//   - If the seller hasn't marked it posted after NOT_SHIPPED_CLAIM_AFTER_DAYS
//     days, the buyer can claim "not received". Nothing can be opened more than
//     HARD_CAP_DAYS_FROM_PURCHASE days after purchase.
//
// Shop (CardPop's own new stock) is different — change of mind is fine, the
// buyer posts it back — and lives in utils/shopReturnPolicy.js because Google
// Merchant Center mirrors it.

import { SHOP_RETURN_POLICY } from './shopReturnPolicy.js';

export const MARKETPLACE_PROTECTION = Object.freeze({
  name: 'CardPop Buyer Protection',
  claimWindowDaysFromDelivery: 7,
  notShippedClaimAfterDays: 7,
  autoDeliveredDaysAfterShipped: 10,
  hardCapDaysFromPurchase: 45,
  changeOfMind: false,
  fullRefund: true,
  reviewBusinessDays: 2,
  refundArrivalBusinessDays: '5–10',
  eligibleReasons: Object.freeze([
    'The card is significantly not as described (wrong card, wrong condition or grade, undisclosed damage).',
    'The card arrived damaged in transit (photos of the packaging required).',
    'The card is counterfeit or altered.',
    'The seller never posted it, or it never arrived.',
    'The seller cancelled after you paid.',
  ]),
  ineligibleReasons: Object.freeze([
    'Change of mind or buyer’s remorse — a marketplace sale is binding once the card is as advertised.',
    'The market price moving after you bought.',
    'Minor, subjective condition opinions on raw (ungraded) cards that match the photos and description.',
  ]),
});

export const SHOP_PROTECTION = SHOP_RETURN_POLICY;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function isShopOrderLines(order) {
  const lines = Array.isArray(order?.order_items) ? order.order_items : [];
  return lines.length > 0 && lines.every((l) => l?.type === 'shop');
}

/**
 * When the order counts as delivered: carrier/buyer-confirmed `delivered_at`
 * if recorded, else `shipped_at` + the auto-delivery allowance, else null.
 */
export function effectiveDeliveredAt(order) {
  const delivered = toDate(order?.delivered_at);
  if (delivered) return delivered;
  const shipped = toDate(order?.shipped_at);
  if (shipped) return addDays(shipped, MARKETPLACE_PROTECTION.autoDeliveredDaysAfterShipped);
  return null;
}

/**
 * Is a refund claim open on this order right now, and if not, why?
 *
 * @returns {{ state: 'open' | 'not_yet' | 'closed', opensAt: Date|null, closesAt: Date|null, reason: string }}
 *   - open:    the buyer may lodge a claim; `closesAt` is when it shuts.
 *   - not_yet: too early (an unshipped marketplace order under the not-shipped
 *              allowance, or a shop order not yet delivered); `opensAt` says when.
 *   - closed:  the window has passed.
 */
export function refundWindow(order, now = new Date()) {
  const purchased = toDate(order?.created_at) || now;
  const cap = addDays(purchased, MARKETPLACE_PROTECTION.hardCapDaysFromPurchase);
  const delivered = effectiveDeliveredAt(order);
  const shipped = toDate(order?.shipped_at);

  if (isShopOrderLines(order)) {
    // Shop: the return window runs from delivery. Until delivery is known we
    // let the buyer report a problem from day one (it's our own parcel).
    const closes = delivered ? addDays(delivered, SHOP_PROTECTION.windowDays) : cap;
    if (now > closes) return { state: 'closed', opensAt: null, closesAt: closes, reason: `The ${SHOP_PROTECTION.windowDays}-day return window has closed.` };
    return { state: 'open', opensAt: purchased, closesAt: closes, reason: `Returns accepted for ${SHOP_PROTECTION.windowDays} days from delivery.` };
  }

  if (now > cap) {
    return { state: 'closed', opensAt: null, closesAt: cap, reason: `Claims close ${MARKETPLACE_PROTECTION.hardCapDaysFromPurchase} days after purchase.` };
  }

  if (delivered) {
    const closes = new Date(Math.min(addDays(delivered, MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery).getTime(), cap.getTime()));
    if (now > closes) return { state: 'closed', opensAt: null, closesAt: closes, reason: `The ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery}-day window after delivery has closed.` };
    // Posted but not yet delivered: a not-received claim opens a week after
    // posting; once delivered, any eligible reason applies for the window.
    if (shipped && !toDate(order?.delivered_at) && now < delivered) {
      const opens = addDays(shipped, MARKETPLACE_PROTECTION.notShippedClaimAfterDays);
      if (now < opens) return { state: 'not_yet', opensAt: opens, closesAt: closes, reason: 'Your card is on its way. If it hasn’t arrived a week after posting, you can report it.' };
    }
    return { state: 'open', opensAt: null, closesAt: closes, reason: `Claims open for ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days from delivery.` };
  }

  // Not posted yet.
  const opens = addDays(purchased, MARKETPLACE_PROTECTION.notShippedClaimAfterDays);
  if (now < opens) return { state: 'not_yet', opensAt: opens, closesAt: cap, reason: `Sellers have ${MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days to post. You can report an unsent order after that.` };
  return { state: 'open', opensAt: opens, closesAt: cap, reason: 'The seller hasn’t marked this as posted — you can report it as not received.' };
}

/** Whole days until the window closes (0 when closed / unknown). */
export function daysLeftInWindow(window, now = new Date()) {
  if (!window?.closesAt || window.state === 'closed') return 0;
  return Math.max(0, Math.ceil((window.closesAt.getTime() - now.getTime()) / DAY_MS));
}

// ── Copy shared by the pages and components ─────────────────────────────────
// One short line for the buy box / checkout strip, and the policy sentences
// the long-form pages and the prerendered copies both use (keep them here, not
// in the pages, so the bot and the browser read the same words).

export const PROTECTION_COPY = Object.freeze({
  marketplaceOneLine: 'Full refund if the card isn’t as described or doesn’t arrive.',
  marketplaceWindowLine: `Report a problem within ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days of delivery.`,
  marketplaceNoChangeOfMind: 'Marketplace sales are binding — no change-of-mind returns on another collector’s card.',
  shopOneLine: `${SHOP_PROTECTION.windowDays}-day returns on shop products, change of mind included.`,
  marketplaceSummary:
    `Every marketplace order is covered by ${MARKETPLACE_PROTECTION.name}. If the card is significantly not as described, arrives damaged, is counterfeit, or never arrives, report it within ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days of delivery and, once approved, you’re refunded in full — the card’s price, postage and every fee — to your original payment method. A marketplace sale is binding when the card is as advertised, so there are no change-of-mind returns on cards bought from other collectors.`,
  notShippedSummary:
    `Sellers are expected to post within ${MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days. If your order hasn’t been marked as posted by then you can report it as not received, and if a tracked parcel goes missing the seller — not you — carries the loss. No claim can be opened more than ${MARKETPLACE_PROTECTION.hardCapDaysFromPurchase} days after purchase.`,
  processSummary:
    `Go to My Account → Orders, choose Request Refund on the order, pick the reason and add photos. CardPop reviews every claim within ${MARKETPLACE_PROTECTION.reviewBusinessDays} business days and tells you the outcome by email and in the app. Approved refunds are issued through Stripe and take ${MARKETPLACE_PROTECTION.refundArrivalBusinessDays} business days to appear on your statement.`,
  shopSummary:
    `New products bought from the CardPop Shop can be returned or exchanged within ${SHOP_PROTECTION.windowDays} days of delivery for any reason, including change of mind, as long as they’re unused and in their original packaging. You post the item back (a tracked service is recommended); there’s no restocking fee, and your refund is processed within ${SHOP_PROTECTION.refundProcessingDays} days of the return arriving.`,
});
