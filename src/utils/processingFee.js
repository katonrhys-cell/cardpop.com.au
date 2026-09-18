// Payment-processing fee — the buyer-paid line that covers Stripe's cut.
//
// CardPop is the merchant of record (the buyer is charged on the *platform*
// account and the seller is paid by transfer — see docs/stripe-connect.md), so
// Stripe's processing fee comes out of platform funds. Before this existed it
// was silently absorbed by the commission, which meant small orders and
// higher-rate payment methods could complete at a loss.
//
// The gross-up is the whole point. Stripe charges its percentage on the amount
// actually captured, and that amount *includes this fee* — so charging a flat
// `rate × subtotal + fixed` always under-collects by `rate × fee`. Solving
//
//     fee = rate × (subtotal + fee) + fixed
//
// for fee gives the formula below, which self-funds exactly.
//
// Rounding is deliberately UP to the cent: a half-cent rounded down is a
// half-cent of loss on every single order.

// A rate at or above this is a misconfiguration (the gross-up divisor explodes
// as it approaches 1, and a typo'd "19" instead of "1.9" would otherwise bill
// the buyer a fortune). Clamped rather than thrown so a bad settings row can
// never take checkout down.
const MAX_RATE_PCT = 50;

/**
 * @param subtotalCents  everything the buyer is charged BEFORE this fee
 *                       (items + commission + GST + shipping), in cents
 * @param pct            percentage rate, e.g. 1.9 for 1.9%
 * @param fixedCents     fixed component, in cents
 * @returns the fee in whole cents — 0 when there is nothing to charge
 */
export function processingFeeCents(subtotalCents, { pct = 0, fixedCents = 0 } = {}) {
  const sub = Number(subtotalCents);
  if (!Number.isFinite(sub) || sub <= 0) return 0;

  const safePct = Math.min(Math.max(Number(pct) || 0, 0), MAX_RATE_PCT);
  const fixed = Math.max(Number(fixedCents) || 0, 0);
  if (safePct <= 0 && fixed <= 0) return 0;

  const rate = safePct / 100;
  return Math.ceil((sub * rate + fixed) / (1 - rate));
}

export { MAX_RATE_PCT };
