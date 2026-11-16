/**
 * Account plans — single source of truth for CardPop's membership plans.
 *
 * There are two free-standing concepts in this codebase; don't conflate them:
 *
 *   1. ACCOUNT PLAN (this file) — Hobby (free), Pro and Ultimate. Stored on
 *      `profiles.subscription_tier` ('free' = Hobby; 'pro' | 'ultimate' = the
 *      paid plans). Paid plans are yearly Stripe subscriptions whose lifecycle
 *      is mirrored onto `profiles.subscription_status` — see
 *      `config/subscription.js` for the price knobs.
 *
 *   2. SELLER REPUTATION (`profiles.seller_tier`) — an *earned* ladder
 *      (Verified → Trusted → Top Rated → Power) based on sales/rating. Unrelated
 *      to what the account pays for. Leave it alone here.
 *
 * The model:
 *   • Hobby is FREE, and always will be. Anyone can browse and buy
 *     immediately. To list, sell or trade, a Hobby user must complete Stripe
 *     Identity verification (`profiles.is_verified`) — after that they can
 *     list up to 5 cards each calendar month and pay only the per-transaction
 *     fee (see `commissionService`). Hobby accounts never get a storefront on
 *     the Local Traders directory.
 *   • Pro ($99 a year) is for vendors and avid traders: 30 listings a month,
 *     the store page, the Pro display styles, Whatnot show listings and the
 *     homepage Featured Cards spots. (It absorbed the old Premium tier.)
 *   • Ultimate ($199 a year) is for show organisers and unlimited-volume
 *     sellers: everything in Pro, unlimited listings, every display style, and
 *     Calendar Spotlight on every event the member runs (the
 *     `sync_membership_event_spotlight` triggers switch `events.is_featured`
 *     on for them). (It absorbed the old Elite tier.)
 *   Every plan pays the SAME per-transaction fees as Hobby — the membership
 *   buys access, not lower fees. Those per-sale costs (payment processing,
 *   GST) are carried by the sale itself, never by the membership.
 *
 * The MONTHLY LISTING LIMITS declared here are mirrored in the database by
 * the `enforce_monthly_listing_quota` trigger on `public.listings` (see the
 * migration that last replaced it). Change a limit in BOTH places or the UI
 * and the database will disagree.
 *
 * This file is intentionally dependency-free so it imports cleanly from the
 * React SPA (via the `@/` alias) and from the Express backend (relative path).
 */

import {
  TIER_PRICES_AUD,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_INTERVAL,
  TRIAL_DAYS,
  PAID_TIER_ORDER,
  canonicalTier,
} from './subscription.js';

/** Canonical plan keys used across the UI and copy. */
export const PLAN_HOBBY = 'hobby';
export const PLAN_PRO = 'pro';
export const PLAN_ULTIMATE = 'ultimate';

/** All plan keys in ascending order (Hobby first). */
export const PLAN_ORDER = [PLAN_HOBBY, PLAN_PRO, PLAN_ULTIMATE];

/** The `profiles.subscription_tier` values that count as paid, ascending. */
export const PAID_TIERS = [...PAID_TIER_ORDER];

/**
 * How many NEW listings each plan may create per calendar month.
 * `null` = unlimited. Keyed by `profiles.subscription_tier` value.
 * Mirrored in the DB by the `enforce_monthly_listing_quota` trigger — keep
 * the two in sync.
 */
export const LISTINGS_PER_MONTH = {
  free: 5,
  pro: 30,
  ultimate: null, // unlimited
};

/** Monthly listing allowance for a tier (unknown tiers get the Hobby limit). */
export function listingsPerMonthForTier(tier) {
  const key = canonicalTier(tier);
  return Object.prototype.hasOwnProperty.call(LISTINGS_PER_MONTH, key)
    ? LISTINGS_PER_MONTH[key]
    : LISTINGS_PER_MONTH.free;
}

/**
 * Map a `profiles.subscription_tier` value onto its plan key. The tier
 * column's CHECK allows 'free' | 'pro' | 'ultimate'. 'free' is Hobby; the paid
 * values map 1:1, and the retired 'premium' / 'elite' names resolve to the
 * plan that absorbed them. An unknown value is treated as the safest default
 * (Hobby / free).
 */
export function planKeyFromTier(tier) {
  const key = canonicalTier(tier);
  return PAID_TIERS.includes(key) ? key : PLAN_HOBBY;
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
 * Traders)? Every paid tier does; Hobby doesn't — unless an admin has flagged
 * the account as a featured seller (`profiles.is_featured_seller`): the
 * homepage's Trusted Sellers strip is hand-picked, and a dealer picked for it
 * must have a store to send visitors to. Same belt-and-braces status fallback
 * as isProAccount. The PostgREST equivalent for list queries is
 * STOREFRONT_FILTER — keep the two in step.
 */
export function hasStorefront({ subscriptionTier, subscriptionStatus, isFeaturedSeller } = {}) {
  return isFeaturedSeller === true || isProAccount({ subscriptionTier, subscriptionStatus });
}

/**
 * `.or()` filter selecting the profiles hasStorefront() admits, for the
 * directory / sitemap / prerender queries that list dealer stores. (The
 * status fallback is deliberately not mirrored here — those lists have only
 * ever keyed on the tier column, which the subscription webhook keeps current.)
 */
export const STOREFRONT_FILTER = `subscription_tier.in.(${PAID_TIERS.join(',')}),is_featured_seller.eq.true`;

/**
 * Listing Whatnot live shows on the community directory is a paid-plan perk
 * (Pro and Ultimate; Hobby doesn't get it). No status fallback here — it keys
 * on the tier column only. Mirrored in the DB by the
 * `whatnot_shows_insert_access` policy — keep the two in sync.
 */
export const WHATNOT_SHOWS_MIN_TIER = PLAN_PRO;
export const WHATNOT_SHOW_TIERS = [...PAID_TIERS];
export function canListWhatnotShows(tier) {
  return WHATNOT_SHOW_TIERS.includes(canonicalTier(tier));
}

/**
 * Calendar Spotlight on every event the member runs is the Ultimate perk.
 * Mirrored in the DB by `membership_spotlight_applies()` (which also excludes
 * admins — their Ultimate is complimentary, and they enter most of the
 * calendar on other organisers' behalf). Keep the two in sync.
 */
export const EVENT_SPOTLIGHT_TIER = PLAN_ULTIMATE;
export function hasEventSpotlight({ subscriptionTier, isAdmin } = {}) {
  return !isAdmin && canonicalTier(subscriptionTier) === EVENT_SPOTLIGHT_TIER;
}

/**
 * Feature / limit matrix. `listingsPerMonth: null` means unlimited. Kept
 * declarative so the pricing page and any server-side quota check read from
 * the same table. `vaultDisplayStyles` names the ladder step in
 * `lib/displayStyles.js` each plan unlocks (access is cumulative).
 */
export const PLANS = {
  [PLAN_HOBBY]: {
    key: PLAN_HOBBY,
    name: 'Hobby',
    tier: 'free',
    tagline: 'Free, and always will be — collect, buy and sell casually.',
    audience: 'Collectors',
    priceAud: 0,
    interval: null,
    limits: {
      listingsPerMonth: LISTINGS_PER_MONTH.free,
      imagesPerListing: 6,
      // Cosmetic vault display styles the tier can pick (see displayStyles.js).
      vaultDisplayStyles: 'classic',
      storefront: false,
      analytics: 'basic',
      eventSpotlight: false,
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
    tagline: 'For vendors and avid traders — your own store and room to sell.',
    audience: 'Vendors and avid traders',
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
      eventSpotlight: false,
    },
    features: [
      'Everything in Hobby, plus:',
      `${LISTINGS_PER_MONTH.pro} listings a month`,
      'Your own branded store page on Local Traders',
      'Pro display styles — Premium Stand, Floating, Neon Glow, Glass Museum, Slab Display and Spotlight',
      'Advertise your Whatnot live shows on the community directory',
      'Your cards fill the homepage Featured Cards spots',
    ],
  },
  [PLAN_ULTIMATE]: {
    key: PLAN_ULTIMATE,
    name: 'Ultimate',
    tier: 'ultimate',
    tagline: 'For show organisers — every event you run, featured.',
    audience: 'Show organisers',
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
      eventSpotlight: true,
    },
    features: [
      'Everything in Pro, plus:',
      'Calendar Spotlight on every show you run — the Featured events strip, first in its month and a Featured badge',
      'Unlimited listings',
      'Every display style — Rotating, Spinning Stand, Prism and the interactive Holographic showcase',
      'Featured Seller placement on the CardPop homepage',
    ],
  },
};

/** Convenience: the Hobby monthly listing allowance. */
export const HOBBY_LISTINGS_PER_MONTH = LISTINGS_PER_MONTH.free;

/** The top of the ladder — nothing to upgrade to from here. */
export const TOP_PLAN = PLAN_ULTIMATE;

/**
 * Position on the plan ladder (Hobby = 0, Pro = 1, Ultimate = 2). Accepts a plan key
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
  STOREFRONT_FILTER,
  WHATNOT_SHOWS_MIN_TIER,
  WHATNOT_SHOW_TIERS,
  canListWhatnotShows,
  EVENT_SPOTLIGHT_TIER,
  hasEventSpotlight,
  HOBBY_LISTINGS_PER_MONTH,
  TOP_PLAN,
  planRank,
  isTopPlan,
  upgradePlansFor,
  nextPlanFor,
};
