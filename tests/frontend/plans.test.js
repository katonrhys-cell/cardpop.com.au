import { describe, it, expect } from 'vitest';
import {
  PLAN_HOBBY,
  PLAN_PRO,
  PLANS,
  planFromTier,
  isProTier,
  isProAccount,
} from '@/config/plans.js';
import { SUBSCRIPTION_PRICE_AUD } from '@/config/subscription.js';

describe('config/plans', () => {
  it('maps subscription_tier values onto plan keys', () => {
    expect(planFromTier('free')).toBe(PLAN_HOBBY);
    expect(planFromTier(null)).toBe(PLAN_HOBBY);
    expect(planFromTier(undefined)).toBe(PLAN_HOBBY);
    expect(planFromTier('pro')).toBe(PLAN_PRO);
    // Any tier above free counts as Pro for account-plan purposes.
    expect(planFromTier('premium')).toBe(PLAN_PRO);
    expect(planFromTier('ultimate')).toBe(PLAN_PRO);
  });

  it('isProTier is true only for paid tiers', () => {
    expect(isProTier('free')).toBe(false);
    expect(isProTier('pro')).toBe(true);
  });

  it('isProAccount trusts either the tier column or an entitled status', () => {
    expect(isProAccount({ subscriptionTier: 'pro', subscriptionStatus: 'none' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'trialing' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'active' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'grandfathered' })).toBe(true);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'none' })).toBe(false);
    expect(isProAccount({ subscriptionTier: 'free', subscriptionStatus: 'canceled' })).toBe(false);
    expect(isProAccount({})).toBe(false);
  });

  it('Hobby is free and Pro is priced from the subscription config', () => {
    expect(PLANS[PLAN_HOBBY].priceAud).toBe(0);
    expect(PLANS[PLAN_PRO].priceAud).toBe(SUBSCRIPTION_PRICE_AUD);
    expect(SUBSCRIPTION_PRICE_AUD).toBe(20);
  });
});
