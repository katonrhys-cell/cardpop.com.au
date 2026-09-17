// Which payment methods a Checkout Session may offer.
//
// Stripe Checkout has no "everything except X" option: either you omit
// `payment_method_types` and the Dashboard decides (which is how Afterpay came
// to be offered), or you pin an explicit list. We pin one, because the buyer's
// processing-fee line (src/utils/processingFee.js) is sized for card-rate
// pricing — a BNPL method at ~6% + $0.30 turns an ordinary sale into a loss,
// and nothing in the Dashboard stops someone re-enabling it later.
//
// 'card' also covers Apple Pay, Google Pay and saved cards — they are card
// payment methods wearing a wallet, not separate types.
//
// IMPORTANT: every type in the list must be ACTIVE on the Stripe account.
// Pinning an inactive type makes `sessions.create` throw, which takes down
// checkout — hence the env override, so the list can be corrected in Vercel
// without waiting for a deploy.
const DEFAULT_TYPES = ['card', 'paypal'];

/**
 * @returns {string[]|null} the types to pin, or null to let Stripe/the
 *                          Dashboard decide (set STRIPE_PAYMENT_METHOD_TYPES=auto)
 */
export function checkoutPaymentMethodTypes() {
  const raw = process.env.STRIPE_PAYMENT_METHOD_TYPES;
  if (typeof raw !== 'string' || raw.trim() === '') return [...DEFAULT_TYPES];

  const list = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  // Explicit opt-out: hand control back to the Dashboard's dynamic selection.
  if (list.length === 1 && list[0] === 'auto') return null;
  return list.length > 0 ? list : [...DEFAULT_TYPES];
}

export { DEFAULT_TYPES };
