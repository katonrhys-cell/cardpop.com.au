/**
 * Account plans — single source of truth for CardPop's Hobby vs Pro tiers.
 *
 * There are two free-standing concepts in this codebase; don't conflate them:
 *
 *   1. ACCOUNT PLAN (this file) — Hobby (free) vs Pro ($/mo). Stored on
 *      `profiles.subscription_tier` ('free' = Hobby, 'pro'+ = Pro). The Pro
 *      upgrade is billed through the Stripe/PayPal subscription machinery, whose
 *      lifecycle is mirrored onto `profiles.subscription_status` — see
 *      `config/subscription.js` for the price / trial knobs.
 *
 *   2. SELLER REPUTATION (`profiles.seller_tier`) — an *earned* ladder
 *      (Verified → Trusted → Top Rated → Power) based on sales/rating. Unrelated
 *      to what the account pays for. Leave it alone here.
 *
 * The model:
 *   • Hobby is FREE, forever. Anyone can browse and buy immediately. To list,
 *     sell or trade, a Hobby user must complete Stripe Identity verification
 *     (`profiles.is_verified`) — after that they sell for free and pay only the
 *     per-transaction fee (see `commissionService`). Hobby users are encouraged
 *     (never forced) to save a card on file so buying is one tap; the card is
 *     never charged unless they actually transact.
 *   • Pro costs money each month (see SUBSCRIPTION_PRICE_AUD). It requires ID
 *     verification and a Stripe customer too, and unlocks premium features,
 *     higher limits, and the Pro badge / full storefront. Pro pays the SAME
 *     per-transaction fees as Hobby — the subscription is for access, not fees.
 *
 * This file is intentionally dependency-free so it imports cleanly from the
 * React SPA (via the `@/` alias) and from the Express backend (relative path).
 */

import {
  SUBSCRIPTION_PRICE_AUD,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_INTERVAL,
  TRIAL_DAYS,
} from './subscription.js';

/** Canonical plan keys used across the UI and copy. */
export const PLAN_HOBBY = 'hobby';
export const PLAN_PRO = 'pro';

/**
 * Map a `profiles.subscription_tier` value onto a plan key. The tier column's
 * CHECK allows 'free' | 'pro' | 'premium' | 'elite' | 'ultimate' (see
 * `lib/displayStyles.js`). 'free' is Hobby; anything above it is Pro-or-better,
 * which for account-plan purposes is simply "Pro". An unknown value is treated
 * as the safest default (Hobby / free).
 */
export function planFromTier(tier) {
  return tier && tier !== 'free' ? PLAN_PRO : PLAN_HOBBY;
}

/** True when the given subscription_tier counts as a paid (Pro) account. */
export function isProTier(tier) {
  return planFromTier(tier) === PLAN_PRO;
}

/**
 * Pro is "active" when EITHER the tier column says so (mirrored by the
 * subscription webhook) OR the live subscription status is entitled — belt and
 * braces so a brief mismatch between the two never locks a paying member out.
 */
export function isProAccount({ subscriptionTier, subscriptionStatus } = {}) {
  return (
    isProTier(subscriptionTier) ||
    ['trialing', 'active', 'grandfathered'].includes(subscriptionStatus)
  );
}

/**
 * Feature / limit matrix. `limit: null` means unlimited. Kept declarative so the
 * pricing page and any server-side quota check read from the same table.
 */
export const PLANS = {
  [PLAN_HOBBY]: {
    key: PLAN_HOBBY,
    name: 'Hobby',
    tagline: 'Free forever — collect, buy and sell casually.',
    priceAud: 0,
    interval: null,
    limits: {
      activeListings: 25,
      imagesPerListing: 6,
      // Cosmetic vault display styles the tier can pick (see displayStyles.js).
      vaultDisplayStyles: 'basic',
      storefront: false,
      analytics: 'basic',
    },
    features: [
      'Browse and buy instantly — no membership needed',
      'List and sell up to 25 cards once your ID is verified',
      'Pay only a small fee when a sale or trade completes',
      'Save a card on file for one-tap checkout (never charged until you buy)',
      'Trade with other verified collectors',
      'Community, wishlists and price tracking',
    ],
  },
  [PLAN_PRO]: {
    key: PLAN_PRO,
    name: 'Pro',
    tagline: 'The full CardPop toolkit for serious sellers.',
    priceAud: SUBSCRIPTION_PRICE_AUD,
    currency: SUBSCRIPTION_CURRENCY,
    interval: SUBSCRIPTION_INTERVAL,
    trialDays: TRIAL_DAYS,
    limits: {
      activeListings: null, // unlimited
      imagesPerListing: 20,
      vaultDisplayStyles: 'premium',
      storefront: true,
      analytics: 'advanced',
    },
    features: [
      'Everything in Hobby, plus:',
      'Unlimited active listings',
      'Your own branded storefront and store URL',
      'Pro seller badge for extra buyer trust',
      'Advanced sales analytics and price insights',
      'Premium Vault display styles',
      'Priority placement in search and priority support',
      'Up to 20 images per listing',
    ],
  },
};

/** Convenience: the number of free-tier active listings before Pro is needed. */
export const HOBBY_MAX_ACTIVE_LISTINGS = PLANS[PLAN_HOBBY].limits.activeListings;

export default {
  PLAN_HOBBY,
  PLAN_PRO,
  PLANS,
  planFromTier,
  isProTier,
  isProAccount,
  HOBBY_MAX_ACTIVE_LISTINGS,
};
