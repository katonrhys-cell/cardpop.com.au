/**
 * CardPop membership configuration — single source of truth for billing.
 *
 * There are two paid plans (see `config/plans.js` for the feature matrix):
 *
 *   • Pro      — $99 a year.  Vendors and avid traders.
 *   • Ultimate — $199 a year. Show organisers (Calendar Spotlight on every
 *                event they run) and unlimited-volume sellers.
 *
 * Both are yearly, auto-renewing Stripe subscriptions charged IN FULL AT
 * SIGN-UP — there is no free trial. The price is flat and GST-inclusive: the
 * member pays exactly $99 / $199 and nothing is added on top. Which plan a
 * member is on is decided by WHICH price their subscription bills against
 * (see the ENV map below). This file is intentionally dependency-free so it
 * can be imported from the React SPA (via the `@/` alias) and from the Express
 * backend (via a relative path).
 *
 * History: until 2026-11 there were four monthly tiers (Pro $20, Premium $40,
 * Elite $80, Ultimate $150) with a 30-day trial. Premium was folded into Pro
 * and Elite into Ultimate — `canonicalTier()` maps the retired names, and the
 * Stripe price env vars were RENAMED so a leftover monthly price id can never
 * be billed against a plan the site now sells by the year.
 *
 * IMPORTANT: the paid subscription does not gate *selling* outright. Any
 * ID-verified account (Hobby included) may list and sell — the DB `can_sell()`
 * gate keys off identity verification, not the subscription. What the paid
 * plans change is the monthly listing allowance, the storefront, the
 * display-style ladder and (Ultimate) event featuring.
 *
 * NOTE: Stripe/PayPal identifiers (price ids, plan ids, secrets) live in
 * environment variables — never hard-code them here. See the ENV map below.
 */

/**
 * Length of a free trial before the first charge, in days. `0` = none: the
 * member is charged at sign-up. The trial plumbing (Stripe `trialing` status,
 * `trial_ends_at`) is still understood everywhere, so setting a number here
 * brings the trial back.
 */
export const TRIAL_DAYS = 0;

/** A payment method is always collected at sign-up (it is charged there). */
export const REQUIRE_CARD_AT_SIGNUP = true;

/**
 * The paid plans in ascending order, and what each bills per year (AUD,
 * GST-inclusive). These MUST match the recurring prices configured in Stripe —
 * the checkout route refuses (503) a price whose amount or interval differs.
 */
export const PAID_TIER_ORDER = ['pro', 'ultimate'];
export const TIER_PRICES_AUD = {
  pro: 99,
  ultimate: 199,
};

/** Retired tier names → the plan that absorbed them. */
export const LEGACY_TIER_MAP = { premium: 'pro', elite: 'ultimate' };

/** Map a stored / requested tier onto a current one (retired names folded in). */
export function canonicalTier(tier) {
  return LEGACY_TIER_MAP[tier] || tier;
}

/** Back-compat: the entry-level (Pro) price. Prefer TIER_PRICES_AUD[tier]. */
export const SUBSCRIPTION_PRICE_AUD = TIER_PRICES_AUD.pro;
export const SUBSCRIPTION_CURRENCY = 'aud';
export const SUBSCRIPTION_INTERVAL = 'year';

/**
 * Payment providers offered for the paid upgrade, in display order.
 * Memberships are billed through STRIPE ONLY. The PayPal subscription
 * machinery (routes, client, webhook) is still in the codebase and fails safe
 * while unconfigured — add 'paypal' back here (and configure its env vars) to
 * re-enable it.
 */
export const PAYMENT_PROVIDERS = ['stripe'];

/**
 * What the paid subscription unlocks. Kept here so the meaning of an entitlement
 * is documented in one place: the paid plans (higher monthly listing
 * allowances, the storefront on Local Traders, the display-style ladder, the
 * badge and — on Ultimate — Calendar Spotlight on the member's events). Browsing, buying, selling and community are available to free Hobby
 * accounts (selling requires ID verification, not a paid tier).
 */
export const GATED_CAPABILITY = 'pro';

/**
 * Subscription statuses mirrored onto `profiles.subscription_status`.
 * `trialing` and `active` grant the paid tier; everything else denies it.
 * `grandfathered` is a complimentary membership (admins, comped accounts).
 */
export const ENTITLED_STATUSES = ['trialing', 'active', 'grandfathered'];

/**
 * Names of the environment variables the backend reads (documented for setup).
 * Each paid plan bills against its own yearly Stripe price. A plan whose price
 * id is unset simply can't be purchased (the checkout route answers 503 for
 * it). The old monthly `STRIPE_SUBSCRIPTION_PRICE_ID*` variables are no longer
 * read and can be deleted.
 */
export const ENV = {
  // Stripe yearly recurring prices (price_...), one per paid plan.
  stripePriceIds: {
    pro: 'STRIPE_MEMBERSHIP_PRICE_ID_PRO',
    ultimate: 'STRIPE_MEMBERSHIP_PRICE_ID_ULTIMATE',
  },
  // PayPal
  paypalClientId: 'PAYPAL_CLIENT_ID',
  paypalSecret: 'PAYPAL_CLIENT_SECRET',
  // PayPal billing plans (P-...), one per paid plan (PayPal is switched off).
  paypalPlanIds: {
    pro: 'PAYPAL_SUBSCRIPTION_PLAN_ID',
    ultimate: 'PAYPAL_SUBSCRIPTION_PLAN_ID_ULTIMATE',
  },
  paypalWebhookId: 'PAYPAL_WEBHOOK_ID',
  paypalEnv: 'PAYPAL_ENV',                          // 'sandbox' | 'live'
};

/** Coerce any requested tier onto a purchasable paid plan (default 'pro'). */
export function normalizePaidTier(tier) {
  const canonical = canonicalTier(tier);
  return PAID_TIER_ORDER.includes(canonical) ? canonical : 'pro';
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
  LEGACY_TIER_MAP,
  canonicalTier,
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
