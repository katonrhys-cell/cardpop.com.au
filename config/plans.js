/**
 * Account plans — single source of truth for CardPop's membership tiers.
 *
 * There are two free-standing concepts in this codebase; don't conflate them:
 *
 *   1. ACCOUNT PLAN (this file) — Hobby (free) and the four paid tiers:
 *      Pro, Premium, Elite and Ultimate. Stored on `profiles.subscription_tier`
 *      ('free' = Hobby; 'pro' | 'premium' | 'elite' | 'ultimate' = the paid
 *      ladder). Paid tiers are billed through the Stripe/PayPal subscription
 *      machinery, whose lifecycle is mirrored onto
 *      `profiles.subscription_status` — see `config/subscription.js` for the
 *      price / trial knobs.
 *
 *   2. SELLER REPUTATION (`profiles.seller_tier`) — an *earned* ladder
 *      (Verified → Trusted → Top Rated → Power) based on sales/rating. Unrelated
 *      to what the account pays for. Leave it alone here.
 *
 * The model:
 *   • Hobby is FREE, forever. Anyone can browse and buy immediately. To list,
 *     sell or trade, a Hobby user must complete Stripe Identity verification
 *     (`profiles.is_verified`) — after that they can list up to
 *     5 cards each calendar month and pay only the per-transaction fee (see
 *     `commissionService`). Hobby accounts never get a storefront on the
 *     Local Traders directory.
 *   • The paid tiers cost money each month (see TIER_PRICES_AUD in
 *     `config/subscription.js`). They require ID verification and a payment
 *     method too, and unlock a bigger monthly listing allowance, the branded
 *     storefront on Local Traders, and progressively fancier Vault display
 *     styles (see `lib/displayStyles.js` — access is cumulative by tier).
 *     Every tier pays the SAME per-transaction fees as Hobby — the
 *     subscription is for access, not fees.
 *
 * The MONTHLY LISTING LIMITS declared here are mirrored in the database by
 * the `enforce_monthly_listing_quota` trigger on `public.listings` (see the
 * migration that created it). Change a limit in BOTH places or the UI and the
 * database will disagree.
 *
 * This file is intentionally dependency-free so it imports cleanly from the
 * React SPA (via the `@/` alias) and from the Express backend (relative path).
 */

import {
  TIER_PRICES_AUD,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_INTERVAL,
  TRIAL_DAYS,
} from './subscription.js';

/** Canonical plan keys used across the UI and copy. */
export const PLAN_HOBBY = 'hobby';
export const PLAN_PRO = 'pro';
export const PLAN_PREMIUM = 'premium';
export const PLAN_ELITE = 'elite';
export const PLAN_ULTIMATE = 'ultimate';

/** All plan keys in ascending order (Hobby first). */
export const PLAN_ORDER = [PLAN_HOBBY, PLAN_PRO, PLAN_PREMIUM, PLAN_ELITE, PLAN_ULTIMATE];

/** The `profiles.subscription_tier` values that count as paid, ascending. */
export const PAID_TIERS = ['pro', 'premium', 'elite', 'ultimate'];

/**
 * How many NEW listings each tier may create per calendar month.
 * `null` = unlimited. Keyed by `profiles.subscription_tier` value.
 * Mirrored in the DB by the `enforce_monthly_listing_quota` trigger — keep
 * the two in sync.
 */
export const LISTINGS_PER_MONTH = {
  free: 5,
  pro: 15,
  premium: 30,
  elite: 50,
  ultimate: null, // unlimited
};

/** Monthly listing allowance for a tier (unknown tiers get the Hobby limit). */
export function listingsPerMonthForTier(tier) {
  return Object.prototype.hasOwnProperty.call(LISTINGS_PER_MONTH, tier)
    ? LISTINGS_PER_MONTH[tier]
    : LISTINGS_PER_MONTH.free;
}

/**
 * Map a `profiles.subscription_tier` value onto its plan key. The tier
 * column's CHECK allows 'free' | 'pro' | 'premium' | 'elite' | 'ultimate'
 * (see `lib/displayStyles.js`). 'free' is Hobby; the paid values map 1:1.
 * An unknown value is treated as the safest default (Hobby / free).
 */
export function planKeyFromTier(tier) {
  return PAID_TIERS.includes(tier) ? tier : PLAN_HOBBY;
}

/**
 * Back-compat coarse mapping: Hobby vs "Pro-or-better". Call sites that only
 * care whether the account pays at all (badge, gating) keep working unchanged.
 */
export function planFromTier(tier) {
  return tier && tier !== 'free' ? PLAN_PRO : PLAN_HOBBY;
}

/** True when the given subscription_tier counts as a paid account. */
export function isProTier(tier) {
  return planFromTier(tier) === PLAN_PRO;
}

/**
 * Paid membership is "active" when EITHER the tier column says so (mirrored by
 * the subscription webhook) OR the live subscription status is entitled — belt
 * and braces so a brief mismatch between the two never locks a paying member
 * out.
 */
export function isProAccount({ subscriptionTier, subscriptionStatus } = {}) {
  return (
    isProTier(subscriptionTier) ||
    ['trialing', 'active', 'grandfathered'].includes(subscriptionStatus)
  );
}

/**
 * Does this account get a storefront (a /dealer store page listed on Local
 * Traders)? Every paid tier does; Hobby never does. Same belt-and-braces
 * status fallback as isProAccount.
 */
export function hasStorefront({ subscriptionTier, subscriptionStatus } = {}) {
  return isProAccount({ subscriptionTier, subscriptionStatus });
}

/**
 * Listing Whatnot live shows on the community directory is a Premium-and-up
 * perk (Hobby and Pro don't get it). No status fallback here — the status
 * only says "paid", not WHICH tier, so it can't distinguish Pro from
 * Premium. Mirrored in the DB by the `whatnot_shows_insert_access` policy —
 * keep the two in sync.
 */
export const WHATNOT_SHOWS_MIN_TIER = PLAN_PREMIUM;
export const WHATNOT_SHOW_TIERS = ['premium', 'elite', 'ultimate'];
export function canListWhatnotShows(tier) {
  return WHATNOT_SHOW_TIERS.includes(tier);
}

/**
 * Feature / limit matrix. `listingsPerMonth: null` means unlimited. Kept
 * declarative so the pricing page and any server-side quota check read from
 * the same table. `vaultDisplayStyles` names the ladder step in
 * `lib/displayStyles.js` each tier unlocks (access is cumulative).
 */
export const PLANS = {
  [PLAN_HOBBY]: {
    key: PLAN_HOBBY,
    name: 'Hobby',
    tier: 'free',
    tagline: 'Free forever — collect, buy and sell casually.',
    priceAud: 0,
    interval: null,
    limits: {
      listingsPerMonth: LISTINGS_PER_MONTH.free,
      imagesPerListing: 6,
      // Cosmetic vault display styles the tier can pick (see displayStyles.js).
      vaultDisplayStyles: 'classic',
      storefront: false,
      analytics: 'basic',
    },
    features: [
      'Browse and buy instantly — no membership needed',
      `List up to ${LISTINGS_PER_MONTH.free} cards a month once your ID is verified`,
      'Pay only a small fee when a sale or trade completes',
      'Card on file required to sell or trade — never charged until you transact',
      'Trade with other verified collectors',
      'Community, wishlists and price tracking',
    ],
  },
  [PLAN_PRO]: {
    key: PLAN_PRO,
    name: 'Pro',
    tier: 'pro',
    tagline: 'Your own store page and the Pro display styles.',
    priceAud: TIER_PRICES_AUD.pro,
    currency: SUBSCRIPTION_CURRENCY,
    interval: SUBSCRIPTION_INTERVAL,
    trialDays: TRIAL_DAYS,
    limits: {
      listingsPerMonth: LISTINGS_PER_MONTH.pro,
      imagesPerListing: 20,
      vaultDisplayStyles: 'pro',
      storefront: true,
      analytics: 'advanced',
    },
    features: [
      'Everything in Hobby, plus:',
      `${LISTINGS_PER_MONTH.pro} listings a month`,
      'Your own branded store page on Local Traders',
      'Pro display styles — Premium Stand, Floating and Neon Glow',
      'Pro seller badge for extra buyer trust',
      'Advanced sales analytics and price insights',
      'Up to 20 images per listing',
    ],
  },
  [PLAN_PREMIUM]: {
    key: PLAN_PREMIUM,
    name: 'Premium',
    tier: 'premium',
    tagline: 'More listings and the Premium showcase styles.',
    priceAud: TIER_PRICES_AUD.premium,
    currency: SUBSCRIPTION_CURRENCY,
    interval: SUBSCRIPTION_INTERVAL,
    trialDays: TRIAL_DAYS,
    limits: {
      listingsPerMonth: LISTINGS_PER_MONTH.premium,
      imagesPerListing: 20,
      vaultDisplayStyles: 'premium',
      storefront: true,
      analytics: 'advanced',
    },
    features: [
      'Everything in Pro, plus:',
      `${LISTINGS_PER_MONTH.premium} listings a month`,
      'Premium display styles — Glass Museum, Slab Display and Spotlight',
      'Advertise your Whatnot live shows on the community directory',
      'Your cards fill the homepage Featured Cards spots',
      'Priority placement in the Local Traders directory',
    ],
  },
  [PLAN_ELITE]: {
    key: PLAN_ELITE,
    name: 'Elite',
    tier: 'elite',
    tagline: 'High-volume selling with the Elite showcase.',
    priceAud: TIER_PRICES_AUD.elite,
    currency: SUBSCRIPTION_CURRENCY,
    interval: SUBSCRIPTION_INTERVAL,
    trialDays: TRIAL_DAYS,
    limits: {
      listingsPerMonth: LISTINGS_PER_MONTH.elite,
      imagesPerListing: 20,
      vaultDisplayStyles: 'elite',
      storefront: true,
      analytics: 'advanced',
    },
    features: [
      'Everything in Premium, plus:',
      `${LISTINGS_PER_MONTH.elite} listings a month`,
      'Elite display styles — Rotating Premium and Prism showcases',
      'Priority support',
    ],
  },
  [PLAN_ULTIMATE]: {
    key: PLAN_ULTIMATE,
    name: 'Ultimate',
    tier: 'ultimate',
    tagline: 'No limits. The full CardPop experience.',
    priceAud: TIER_PRICES_AUD.ultimate,
    currency: SUBSCRIPTION_CURRENCY,
    interval: SUBSCRIPTION_INTERVAL,
    trialDays: TRIAL_DAYS,
    limits: {
      listingsPerMonth: LISTINGS_PER_MONTH.ultimate,
      imagesPerListing: 20,
      vaultDisplayStyles: 'ultimate',
      storefront: true,
      analytics: 'advanced',
    },
    features: [
      'Everything in Elite, plus:',
      'Unlimited listings',
      'Ultimate display styles — interactive Holographic showcase',
      'Featured Seller placement on the CardPop homepage',
      'Top placement in search and Local Traders',
    ],
  },
};

/** Convenience: the Hobby monthly listing allowance. */
export const HOBBY_LISTINGS_PER_MONTH = LISTINGS_PER_MONTH.free;

/** The top of the ladder — nothing to upgrade to from here. */
export const TOP_PLAN = PLAN_ULTIMATE;

/**
 * Position on the plan ladder (Hobby = 0 … Ultimate = 4). Accepts a plan key
 * or a `profiles.subscription_tier` value; anything unknown ranks as Hobby.
 */
export function planRank(keyOrTier) {
  const index = PLAN_ORDER.indexOf(planKeyFromTier(keyOrTier));
  return index < 0 ? 0 : index;
}

/** True when the account is already on the top plan (no upgrade to offer). */
export function isTopPlan(keyOrTier) {
  return planKeyFromTier(keyOrTier) === TOP_PLAN;
}

/** Plan keys above the given one, ascending — empty on the top plan. */
export function upgradePlansFor(keyOrTier) {
  return PLAN_ORDER.slice(planRank(keyOrTier) + 1);
}

/** The next step up the ladder, or null on the top plan. */
export function nextPlanFor(keyOrTier) {
  return upgradePlansFor(keyOrTier)[0] || null;
}

export default {
  PLAN_HOBBY,
  PLAN_PRO,
  PLAN_PREMIUM,
  PLAN_ELITE,
  PLAN_ULTIMATE,
  PLAN_ORDER,
  PAID_TIERS,
  PLANS,
  LISTINGS_PER_MONTH,
  listingsPerMonthForTier,
  planKeyFromTier,
  planFromTier,
  isProTier,
  isProAccount,
  hasStorefront,
  WHATNOT_SHOWS_MIN_TIER,
  WHATNOT_SHOW_TIERS,
  canListWhatnotShows,
  HOBBY_LISTINGS_PER_MONTH,
  TOP_PLAN,
  planRank,
  isTopPlan,
  upgradePlansFor,
  nextPlanFor,
};
