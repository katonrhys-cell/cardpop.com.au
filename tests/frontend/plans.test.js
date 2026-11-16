import { describe, it, expect } from 'vitest';
import {
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
  canListWhatnotShows,
  WHATNOT_SHOW_TIERS,
  hasEventSpotlight,
  TOP_PLAN,
  planRank,
  isTopPlan,
  upgradePlansFor,
  nextPlanFor,
} from '@/config/plans.js';
import {
  TIER_PRICES_AUD, SUBSCRIPTION_PRICE_AUD, SUBSCRIPTION_INTERVAL, TRIAL_DAYS, PAID_TIER_ORDER,
  canonicalTier, normalizePaidTier,
} from '@/config/subscription.js';

describe('config/plans', () => {
  it('declares the three plans in ascending order', () => {
    expect(PLAN_ORDER).toEqual([PLAN_HOBBY, PLAN_PRO, PLAN_ULTIMATE]);
    expect(PAID_TIERS).toEqual(['pro', 'ultimate']);
    expect(PAID_TIER_ORDER).toEqual(['pro', 'ultimate']);
    PLAN_ORDER.forEach((key) => expect(PLANS[key]).toBeDefined());
  });

  it('maps subscription_tier values 1:1 onto plan keys', () => {
    expect(planKeyFromTier('free')).toBe(PLAN_HOBBY);
    expect(planKeyFromTier(null)).toBe(PLAN_HOBBY);
    expect(planKeyFromTier('garbage')).toBe(PLAN_HOBBY);
    expect(planKeyFromTier('pro')).toBe(PLAN_PRO);
    expect(planKeyFromTier('ultimate')).toBe(PLAN_ULTIMATE);
  });

  it('folds the retired Premium and Elite tiers into Pro and Ultimate', () => {
    expect(canonicalTier('premium')).toBe('pro');
    expect(canonicalTier('elite')).toBe('ultimate');
    expect(canonicalTier('pro')).toBe('pro');
    expect(canonicalTier('free')).toBe('free');
    expect(planKeyFromTier('premium')).toBe(PLAN_PRO);
    expect(planKeyFromTier('elite')).toBe(PLAN_ULTIMATE);
    expect(normalizePaidTier('premium')).toBe('pro');
    expect(normalizePaidTier('elite')).toBe('ultimate');
    expect(normalizePaidTier('garbage')).toBe('pro');
    expect(listingsPerMonthForTier('premium')).toBe(30);
    expect(listingsPerMonthForTier('elite')).toBeNull();
  });

  it('coarse planFromTier still maps any paid tier onto Pro-or-better', () => {
    expect(planFromTier('free')).toBe(PLAN_HOBBY);
    expect(planFromTier(null)).toBe(PLAN_HOBBY);
    expect(planFromTier(undefined)).toBe(PLAN_HOBBY);
    expect(planFromTier('pro')).toBe(PLAN_PRO);
    expect(planFromTier('ultimate')).toBe(PLAN_PRO);
  });

  it('isProTier is true only for paid tiers', () => {
    expect(isProTier('free')).toBe(false);
    expect(isProTier('pro')).toBe(true);
    expect(isProTier('ultimate')).toBe(true);
  });

  it('isProAccount trusts either the tier column or an entitled status', () => {
    expect(isProAccount({ subscriptionTier: 'pro', subscriptionStatus: 'none' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'ultimate', subscriptionStatus: 'none' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'trialing' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'active' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'grandfathered' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'none' })).toBe(false);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'canceled' })).toBe(false);
    expect(isProAccount({})).toBe(false);
  });

  it('every paid tier gets a storefront; Hobby never does', () => {
    expect(hasStorefront({ subscriptionTier: 'free', subscriptionStatus: 'none' })).toBe(false);
    PAID_TIERS.forEach((tier) => {
      expect(hasStorefront({ subscriptionTier: tier, subscriptionStatus: 'none' })).toBe(true);
      expect(PLANS[planKeyFromTier(tier)].limits.storefront).toBe(true);
    });
    expect(PLANS[PLAN_HOBBY].limits.storefront).toBe(false);
  });

  it('an admin-featured dealer keeps a storefront on the Hobby plan', () => {
    expect(hasStorefront({ subscriptionTier: 'free', subscriptionStatus: 'none', isFeaturedSeller: true })).toBe(true);
    expect(hasStorefront({ subscriptionTier: 'free', subscriptionStatus: 'none', isFeaturedSeller: false })).toBe(false);
    expect(hasStorefront({ subscriptionTier: 'free', subscriptionStatus: 'none', isFeaturedSeller: null })).toBe(false);
    // The list-query filter admits exactly the same accounts.
    expect(STOREFRONT_FILTER).toBe('subscription_tier.in.(pro,ultimate),is_featured_seller.eq.true');
  });

  it('Whatnot show listing is a paid-plan perk (Pro and Ultimate), never Hobby', () => {
    expect(WHATNOT_SHOW_TIERS).toEqual(['pro', 'ultimate']);
    expect(canListWhatnotShows('free')).toBe(false);
    expect(canListWhatnotShows('pro')).toBe(true);
    expect(canListWhatnotShows('ultimate')).toBe(true);
    expect(canListWhatnotShows(undefined)).toBe(false);
  });

  it('Calendar Spotlight on their events is for Ultimate members who are not admins', () => {
    expect(hasEventSpotlight({ subscriptionTier: 'ultimate', isAdmin: false })).toBe(true);
    expect(hasEventSpotlight({ subscriptionTier: 'ultimate' })).toBe(true);
    expect(hasEventSpotlight({ subscriptionTier: 'ultimate', isAdmin: true })).toBe(false);
    expect(hasEventSpotlight({ subscriptionTier: 'pro', isAdmin: false })).toBe(false);
    expect(hasEventSpotlight({ subscriptionTier: 'free' })).toBe(false);
    expect(hasEventSpotlight()).toBe(false);
    expect(PLANS[PLAN_ULTIMATE].limits.eventSpotlight).toBe(true);
    expect(PLANS[PLAN_PRO].limits.eventSpotlight).toBe(false);
  });

  it('declares the agreed monthly listing ladder (5/30/unlimited)', () => {
    expect(LISTINGS_PER_MONTH).toEqual({ free: 5, pro: 30, ultimate: null });
    expect(listingsPerMonthForTier('free')).toBe(5);
    expect(listingsPerMonthForTier('pro')).toBe(30);
    expect(listingsPerMonthForTier('ultimate')).toBeNull();
    // Unknown tiers get the safest (Hobby) allowance, never unlimited.
    expect(listingsPerMonthForTier('garbage')).toBe(5);
    expect(listingsPerMonthForTier(undefined)).toBe(5);
  });

  it('prices each plan from the subscription config ladder', () => {
    expect(PLANS[PLAN_HOBBY].priceAud).toBe(0);
    expect(PLANS[PLAN_PRO].priceAud).toBe(TIER_PRICES_AUD.pro);
    expect(PLANS[PLAN_ULTIMATE].priceAud).toBe(TIER_PRICES_AUD.ultimate);
    expect(TIER_PRICES_AUD).toEqual({ pro: 99, ultimate: 199 });
    expect(SUBSCRIPTION_PRICE_AUD).toBe(99);
  });

  it('bills both paid plans yearly, at sign-up, with no trial', () => {
    expect(SUBSCRIPTION_INTERVAL).toBe('year');
    expect(TRIAL_DAYS).toBe(0);
    [PLAN_PRO, PLAN_ULTIMATE].forEach((key) => {
      expect(PLANS[key].interval).toBe('year');
      expect(PLANS[key].trialDays).toBe(0);
    });
    expect(PLANS[PLAN_HOBBY].interval).toBeNull();
  });

  describe('plan ladder helpers (dashboard "Upgrade your plan")', () => {
    it('ranks every plan key and tier value on the ladder', () => {
      expect(planRank('free')).toBe(0);
      expect(planRank(PLAN_HOBBY)).toBe(0);
      expect(planRank(null)).toBe(0);
      expect(planRank('garbage')).toBe(0);
      expect(planRank('pro')).toBe(1);
      expect(planRank('ultimate')).toBe(2);
      // Retired names rank as the plan that absorbed them.
      expect(planRank('premium')).toBe(1);
      expect(planRank('elite')).toBe(2);
    });

    it('only Ultimate is the top plan', () => {
      expect(TOP_PLAN).toBe(PLAN_ULTIMATE);
      expect(isTopPlan('ultimate')).toBe(true);
      expect(isTopPlan('pro')).toBe(false);
      expect(isTopPlan('free')).toBe(false);
      expect(isTopPlan(undefined)).toBe(false);
    });

    it('lists the plans above the current one, ascending, and none on Ultimate', () => {
      expect(upgradePlansFor('free')).toEqual([PLAN_PRO, PLAN_ULTIMATE]);
      expect(upgradePlansFor('pro')).toEqual([PLAN_ULTIMATE]);
      expect(upgradePlansFor('ultimate')).toEqual([]);
    });

    it('nextPlanFor is the next step up, or null at the top', () => {
      expect(nextPlanFor('free')).toBe(PLAN_PRO);
      expect(nextPlanFor('pro')).toBe(PLAN_ULTIMATE);
      expect(nextPlanFor('ultimate')).toBeNull();
    });
  });
});
