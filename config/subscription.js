/**
 * CardPop Pro subscription / free-trial configuration — single source of truth.
 *
 * This is the billing config for the paid **Pro** account plan (see
 * `config/plans.js` for the Hobby-vs-Pro feature matrix). Change the trial
 * length, toggle whether a card is required to start, or adjust pricing here and
 * both the frontend and backend pick it up. This file is intentionally
 * dependency-free so it can be imported from the React SPA (via the `@/` alias)
 * and from the Express backend (via a relative path).
 *
 * IMPORTANT: the Pro subscription no longer gates *selling*. Any ID-verified
 * account (Hobby or Pro) may list and sell — the DB `can_sell()` gate keys off
 * identity verification, not the subscription. Pro is an optional upgrade that
 * unlocks premium features, higher limits and the Pro storefront/badge.
 *
 * NOTE: Stripe/PayPal identifiers (price id, plan id, secrets) live in
 * environment variables — never hard-code them here. See the ENV map below.
 */

/** Length of the Pro free trial, in days. Change this to change the offer. */
export const TRIAL_DAYS = 30;

/**
 * When true, upgrading to Pro captures a card / PayPal up front and starts a
 * trialing subscription immediately (no charge until the trial ends). When
 * false, the trial is tracked purely by `trial_ends_at` (no payment method).
 */
export const REQUIRE_CARD_AT_SIGNUP = true;

/** Recurring Pro price billed once the trial ends (AUD). Display + Stripe/PayPal must match. */
export const SUBSCRIPTION_PRICE_AUD = 20;
export const SUBSCRIPTION_CURRENCY = 'aud';
export const SUBSCRIPTION_INTERVAL = 'month';

/** Payment providers offered for the Pro upgrade, in display order. */
export const PAYMENT_PROVIDERS = ['stripe', 'paypal'];

/**
 * What the paid subscription unlocks. Kept here so the meaning of an entitlement
 * is documented in one place. Now: the **Pro** account tier (premium features,
 * higher limits, storefront/badge). Browsing, buying, selling and community are
 * available to free Hobby accounts (selling requires ID verification, not Pro).
 */
export const GATED_CAPABILITY = 'pro';

/**
 * Subscription statuses mirrored onto `profiles.subscription_status`.
 * `trialing` and `active` grant Pro; everything else denies it.
 * `grandfathered` is a synonym for active used for legacy paid accounts.
 */
export const ENTITLED_STATUSES = ['trialing', 'active', 'grandfathered'];

/** Names of the environment variables the backend reads (documented for setup). */
export const ENV = {
  // Stripe
  stripePriceId: 'STRIPE_SUBSCRIPTION_PRICE_ID',   // price_... for the recurring plan
  // PayPal
  paypalClientId: 'PAYPAL_CLIENT_ID',
  paypalSecret: 'PAYPAL_CLIENT_SECRET',
  paypalPlanId: 'PAYPAL_SUBSCRIPTION_PLAN_ID',     // P-... billing plan with the trial
  paypalWebhookId: 'PAYPAL_WEBHOOK_ID',
  paypalEnv: 'PAYPAL_ENV',                          // 'sandbox' | 'live'
};

/** True if a subscription status counts as an entitled (Pro) member. */
export function isEntitled(status) {
  return ENTITLED_STATUSES.includes(status);
}

export default {
  TRIAL_DAYS,
  REQUIRE_CARD_AT_SIGNUP,
  SUBSCRIPTION_PRICE_AUD,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_INTERVAL,
  PAYMENT_PROVIDERS,
  GATED_CAPABILITY,
  ENTITLED_STATUSES,
  ENV,
  isEntitled,
};
