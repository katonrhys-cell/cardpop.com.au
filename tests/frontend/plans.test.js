import { describe, it, expect } from 'vitest';
import {
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
  canListWhatnotShows,
  WHATNOT_SHOW_TIERS,
} from '@/config/plans.js';
import { TIER_PRICES_AUD, SUBSCRIPTION_PRICE_AUD } from '@/config/subscription.js';

describe('config/plans', () => {
  it('declares the five plans in ascending order', () => {
    expect(PLAN_ORDER).toEqual([PLAN_HOBBY, PLAN_PRO, PLAN_PREMIUM, PLAN_ELITE, PLAN_ULTIMATE]);
    expect(PAID_TIERS).toEqual(['pro', 'premium', 'elite', 'ultimate']);
    PLAN_ORDER.forEach((key) => expect(PLANS[key]).toBeDefined());
  });

  it('maps subscription_tier values 1:1 onto plan keys', () => {
    expect(planKeyFromTier('free')).toBe(PLAN_HOBBY);
    expect(planKeyFromTier(null)).toBe(PLAN_HOBBY);
    expect(planKeyFromTier('garbage')).toBe(PLAN_HOBBY);
    expect(planKeyFromTier('pro')).toBe(PLAN_PRO);
    expect(planKeyFromTier('premium')).toBe(PLAN_PREMIUM);
    expect(planKeyFromTier('elite')).toBe(PLAN_ELITE);
    expect(planKeyFromTier('ultimate')).toBe(PLAN_ULTIMATE);
  });

  it('coarse planFromTier still maps any paid tier onto Pro-or-better', () => {
    expect(planFromTier('free')).toBe(PLAN_HOBBY);
    expect(planFromTier(null)).toBe(PLAN_HOBBY);
    expect(planFromTier(undefined)).toBe(PLAN_HOBBY);
    expect(planFromTier('pro')).toBe(PLAN_PRO);
    expect(planFromTier('premium')).toBe(PLAN_PRO);
    expect(planFromTier('ultimate')).toBe(PLAN_PRO);
  });

  it('isProTier is true only for paid tiers', () => {
    expect(isProTier('free')).toBe(false);
    expect(isProTier('pro')).toBe(true);
    expect(isProTier('elite')).toBe(true);
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

  it('Whatnot show listing is Premium-and-up only', () => {
    expect(WHATNOT_SHOW_TIERS).toEqual(['premium', 'elite', 'ultimate']);
    expect(canListWhatnotShows('free')).toBe(false);
    expect(canListWhatnotShows('pro')).toBe(false);
    expect(canListWhatnotShows('premium')).toBe(true);
    expect(canListWhatnotShows('elite')).toBe(true);
    expect(canListWhatnotShows('ultimate')).toBe(true);
    expect(canListWhatnotShows(undefined)).toBe(false);
  });

  it('declares the agreed monthly listing ladder (5/15/30/50/unlimited)', () => {
    expect(LISTINGS_PER_MONTH).toEqual({ free: 5, pro: 15, premium: 30, elite: 50, ultimate: null });
    expect(listingsPerMonthForTier('free')).toBe(5);
    expect(listingsPerMonthForTier('pro')).toBe(15);
    expect(listingsPerMonthForTier('premium')).toBe(30);
    expect(listingsPerMonthForTier('elite')).toBe(50);
    expect(listingsPerMonthForTier('ultimate')).toBeNull();
    // Unknown tiers get the safest (Hobby) allowance, never unlimited.
    expect(listingsPerMonthForTier('garbage')).toBe(5);
    expect(listingsPerMonthForTier(undefined)).toBe(5);
  });

  it('prices each plan from the subscription config ladder', () => {
    expect(PLANS[PLAN_HOBBY].priceAud).toBe(0);
    expect(PLANS[PLAN_PRO].priceAud).toBe(TIER_PRICES_AUD.pro);
    expect(PLANS[PLAN_PREMIUM].priceAud).toBe(TIER_PRICES_AUD.premium);
    expect(PLANS[PLAN_ELITE].priceAud).toBe(TIER_PRICES_AUD.elite);
    expect(PLANS[PLAN_ULTIMATE].priceAud).toBe(TIER_PRICES_AUD.ultimate);
    expect(TIER_PRICES_AUD).toEqual({ pro: 20, premium: 40, elite: 80, ultimate: 150 });
    expect(SUBSCRIPTION_PRICE_AUD).toBe(20);
  });
});
