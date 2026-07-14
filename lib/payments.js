// Central config for accelerated / buy-now-pay-later checkout messaging.
//
// Which payment methods actually appear at checkout is controlled entirely by
// the Stripe Dashboard (Settings → Payment methods) plus per-order eligibility —
// the Checkout Session in src/routes/stripe.js omits `payment_method_types` so
// Stripe surfaces whatever is enabled there. These constants only
// drive the *marketing copy* shown ahead of checkout (the "pay in 4" instalment
// line), so keep them in sync with what's enabled in Stripe.

// Afterpay is offered inside the embedded checkout and already advertised in the
// payment-method trust row. Set VITE_ENABLE_BNPL=false to hide the "pay in 4"
// copy site-wide (e.g. if Afterpay is temporarily switched off in Stripe)
// without editing any component.
export const BNPL_ENABLED = import.meta.env.VITE_ENABLE_BNPL !== 'false';

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
