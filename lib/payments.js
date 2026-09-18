// Central config for accelerated / buy-now-pay-later checkout messaging.
//
// Which payment methods actually appear at checkout is controlled server-side —
// the Checkout Session pins `payment_method_types` (see
// src/utils/checkoutPaymentMethods.js), so Stripe surfaces exactly that list.
// These constants only drive the *marketing copy* shown ahead of checkout (the
// "pay in 4" instalment line), so keep them in sync with what's pinned there.

// OFF by default. BNPL is no longer offered at checkout — Afterpay costs ~6% +
// $0.30 through Stripe, which sells an ordinary order at a loss against a
// card-rate processing fee (docs/order-pricing.md) — so promising "4
// interest-free payments" on every product card would advertise a method the
// buyer will not find. Set VITE_ENABLE_BNPL=true to bring the copy back, and
// only alongside adding the method to STRIPE_PAYMENT_METHOD_TYPES.
export const BNPL_ENABLED = import.meta.env.VITE_ENABLE_BNPL === 'true';

// Buy-now-pay-later provider named in the instalment message. Afterpay splits an
// eligible order into 4 equal, fortnightly, interest-free payments.
export const BNPL_PROVIDER = import.meta.env.VITE_BNPL_PROVIDER || 'Afterpay';
export const BNPL_INSTALMENTS = 4;

// Afterpay's Australian order-value limits. Outside this range Stripe hides the
// option at checkout, so we don't advertise it either.
export const BNPL_MIN_AUD = 1;
export const BNPL_MAX_AUD = 2000;

// True when a "pay in N with Afterpay" line should be shown for `amountAud`.
export const bnplEligible = (amountAud) => {
  const value = Number(amountAud);
  return (
    BNPL_ENABLED &&
    Number.isFinite(value) &&
    value >= BNPL_MIN_AUD &&
    value <= BNPL_MAX_AUD
  );
};
