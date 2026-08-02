/**
 * CardPop membership subscription / free-trial configuration — single source
 * of truth for billing.
 *
 * There are four paid tiers (see `config/plans.js` for the full feature
 * matrix): Pro, Premium, Elite and Ultimate. Every paid tier is billed
 * monthly through the same Stripe/PayPal subscription machinery; which tier a
 * member is on is decided by WHICH price/plan their subscription bills
 * against (see the ENV map below). Change the trial length, toggle whether a
 * card is required to start, or adjust pricing here and both the frontend and
 * backend pick it up. This file is intentionally dependency-free so it can be
 * imported from the React SPA (via the `@/` alias) and from the Express
 * backend (via a relative path).
 *
 * IMPORTANT: the paid subscription does not gate *selling* outright. Any
 * ID-verified account (Hobby included) may list and sell — the DB `can_sell()`
 * gate keys off identity verification, not the subscription. What the paid
 * tiers change is the monthly listing allowance, the storefront and the
 * display-style ladder (see `config/plans.js`).
 *
 * NOTE: Stripe/PayPal identifiers (price ids, plan ids, secrets) live in
 * environment variables — never hard-code them here. See the ENV map below.
 */

/** Length of the paid-tier free trial, in days. Change this to change the offer. */
export const TRIAL_DAYS = 30;

/**
 * When true, upgrading to a paid tier captures a card / PayPal up front and
 * starts a trialing subscription immediately (no charge until the trial ends).
 * When false, the trial is tracked purely by `trial_ends_at` (no payment method).
 */
export const REQUIRE_CARD_AT_SIGNUP = true;

/**
 * The paid tiers in ascending order, and what each bills per month (AUD).
 * These MUST match the recurring prices configured in Stripe / PayPal — the
 * providers charge what their price/plan says, this map is what the UI shows.
 */
export const PAID_TIER_ORDER = ['pro', 'premium', 'elite', 'ultimate'];
export const TIER_PRICES_AUD = {
  pro: 20,
  premium: 40,
  elite: 80,
  ultimate: 150,
};

/** Back-compat: the entry-level (Pro) price. Prefer TIER_PRICES_AUD[tier]. */
export const SUBSCRIPTION_PRICE_AUD = TIER_PRICES_AUD.pro;
export const SUBSCRIPTION_CURRENCY = 'aud';
export const SUBSCRIPTION_INTERVAL = 'month';

/** Payment providers offered for the paid upgrade, in display order. */
export const PAYMENT_PROVIDERS = ['stripe', 'paypal'];

/**
 * What the paid subscription unlocks. Kept here so the meaning of an entitlement
 * is documented in one place: the paid account tiers (higher monthly listing
 * allowances, the storefront on Local Traders, the display-style ladder and the
 * badge). Browsing, buying, selling and community are available to free Hobby
 * accounts (selling requires ID verification, not a paid tier).
 */
export const GATED_CAPABILITY = 'pro';

/**
 * Subscription statuses mirrored onto `profiles.subscription_status`.
 * `trialing` and `active` grant the paid tier; everything else denies it.
 * `grandfathered` is a synonym for active used for legacy paid accounts.
 */
export const ENTITLED_STATUSES = ['trialing', 'active', 'grandfathered'];

/**
 * Names of the environment variables the backend reads (documented for setup).
 * Each paid tier bills against its own Stripe price / PayPal plan; the Pro
 * identifiers keep their original un-suffixed names for back-compat. A tier
 * whose price/plan id is unset simply can't be purchased (the checkout route
 * answers 503 for it) — existing subscriptions are unaffected.
 */
export const ENV = {
  // Stripe recurring prices (price_...), one per paid tier.
  stripePriceIds: {
    pro: 'STRIPE_SUBSCRIPTION_PRICE_ID',
    premium: 'STRIPE_SUBSCRIPTION_PRICE_ID_PREMIUM',
    elite: 'STRIPE_SUBSCRIPTION_PRICE_ID_ELITE',
    ultimate: 'STRIPE_SUBSCRIPTION_PRICE_ID_ULTIMATE',
  },
  // Back-compat alias (Pro).
  stripePriceId: 'STRIPE_SUBSCRIPTION_PRICE_ID',
  // PayPal
  paypalClientId: 'PAYPAL_CLIENT_ID',
  paypalSecret: 'PAYPAL_CLIENT_SECRET',
  // PayPal billing plans (P-...) with the trial, one per paid tier.
  paypalPlanIds: {
    pro: 'PAYPAL_SUBSCRIPTION_PLAN_ID',
    premium: 'PAYPAL_SUBSCRIPTION_PLAN_ID_PREMIUM',
    elite: 'PAYPAL_SUBSCRIPTION_PLAN_ID_ELITE',
    ultimate: 'PAYPAL_SUBSCRIPTION_PLAN_ID_ULTIMATE',
  },
  // Back-compat alias (Pro).
  paypalPlanId: 'PAYPAL_SUBSCRIPTION_PLAN_ID',
  paypalWebhookId: 'PAYPAL_WEBHOOK_ID',
  paypalEnv: 'PAYPAL_ENV',                          // 'sandbox' | 'live'
};

/** Coerce any requested tier onto a purchasable paid tier (default 'pro'). */
export function normalizePaidTier(tier) {
  return PAID_TIER_ORDER.includes(tier) ? tier : 'pro';
}

/** True if a subscription status counts as an entitled (paid) member. */
export function isEntitled(status) {
  return ENTITLED_STATUSES.includes(status);
}

export default {
  TRIAL_DAYS,
  REQUIRE_CARD_AT_SIGNUP,
  PAID_TIER_ORDER,
  TIER_PRICES_AUD,
  SUBSCRIPTION_PRICE_AUD,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_INTERVAL,
  PAYMENT_PROVIDERS,
  GATED_CAPABILITY,
  ENTITLED_STATUSES,
  ENV,
  normalizePaidTier,
  isEntitled,
};
