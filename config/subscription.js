/**
 * Subscription / free-trial configuration — single source of truth.
 *
 * Change the trial length, toggle whether a card is required at sign-up, or
 * adjust pricing here and both the frontend and backend pick it up. This file
 * is intentionally dependency-free so it can be imported from the React SPA
 * (via the `@/` alias) and from the Express backend (via a relative path).
 *
 * NOTE: Stripe/PayPal identifiers (price id, plan id, secrets) live in
 * environment variables — never hard-code them here. See the ENV map below.
 */

/** Length of the free trial, in days. Change this to change the offer. */
export const TRIAL_DAYS = 30;

/**
 * When true, new users must put a card / PayPal on file during registration
 * and a trialing subscription is started immediately (no charge until the
 * trial ends). When false, sign-up collects no payment method and the trial
 * is tracked purely by `trial_ends_at` (legacy "no card required" behaviour).
 */
export const REQUIRE_CARD_AT_SIGNUP = true;

/** Recurring price billed once the trial ends (AUD). Display + Stripe/PayPal must match. */
export const SUBSCRIPTION_PRICE_AUD = 9.99;
export const SUBSCRIPTION_CURRENCY = 'aud';
export const SUBSCRIPTION_INTERVAL = 'month';

/** Payment providers offered at registration, in display order. */
export const PAYMENT_PROVIDERS = ['stripe', 'paypal'];

/**
 * What the trial / subscription gates. Kept here so the meaning of an
 * entitlement is documented in one place. Currently: listing & selling cards.
 * Browsing, buying and community features are always free.
 */
export const GATED_CAPABILITY = 'selling';

/**
 * Subscription statuses mirrored onto `profiles.subscription_status`.
 * `trialing` and `active` grant the gated capability; everything else denies it.
 * `grandfathered` is a synonym for active used for accounts that predate the paywall.
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

/** True if a subscription status counts as "may sell". */
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
