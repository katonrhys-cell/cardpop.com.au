import { vi, describe, it, expect, beforeEach } from 'vitest';

// subscriptionService pulls in the Stripe SDK, the Supabase client and a few
// sibling services at import time. Stub them so we can unit-test the pure
// status-mapping logic (and the thin getSubscriptionStatus reader) in isolation.
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/utils/stripeClient.js', () => ({ default: {} }));
vi.mock('../../../src/services/welcomeOfferService.js', () => ({ markTrialRedeemed: vi.fn() }));
vi.mock('../../../src/services/partnerService.js', () => ({ recordSubscriptionReferral: vi.fn() }));

import {
  mapStripeStatus,
  mapPaypalStatus,
  getSubscriptionStatus,
  tierFromStripeSubscription,
  tierFromPaypalPlanId,
} from '../../../src/services/subscriptionService.js';

beforeEach(() => vi.clearAllMocks());

describe('mapStripeStatus', () => {
  it('maps entitling states to their internal equivalents', () => {
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('active')).toBe('active');
  });

  it('maps past_due through unchanged', () => {
    expect(mapStripeStatus('past_due')).toBe('past_due');
  });

  it('collapses every terminal/failed state to canceled', () => {
    expect(mapStripeStatus('canceled')).toBe('canceled');
    expect(mapStripeStatus('unpaid')).toBe('canceled');
    expect(mapStripeStatus('incomplete_expired')).toBe('canceled');
  });

  it('treats not-yet-paid / unknown states as none (not entitled)', () => {
    // incomplete/paused must not open the can_sell gate.
    expect(mapStripeStatus('incomplete')).toBe('none');
    expect(mapStripeStatus('paused')).toBe('none');
    expect(mapStripeStatus(undefined)).toBe('none');
    expect(mapStripeStatus('')).toBe('none');
  });
});

describe('mapPaypalStatus', () => {
  it('entitles only genuinely active/approved subscriptions', () => {
    expect(mapPaypalStatus('ACTIVE')).toBe('active');
    expect(mapPaypalStatus('APPROVED')).toBe('trialing');
  });

  it('is case-insensitive on the incoming status', () => {
    expect(mapPaypalStatus('active')).toBe('active');
    expect(mapPaypalStatus('Approved')).toBe('trialing');
  });

  it('does NOT entitle an unapproved (APPROVAL_PENDING) subscription', () => {
    // Guards the replay attack called out in the source: a created-but-never
    // -approved subscription id must not open the can_sell gate for free.
    expect(mapPaypalStatus('APPROVAL_PENDING')).toBe('none');
  });

  it('maps suspended to past_due and terminal states to canceled', () => {
    expect(mapPaypalStatus('SUSPENDED')).toBe('past_due');
    expect(mapPaypalStatus('CANCELLED')).toBe('canceled');
    expect(mapPaypalStatus('EXPIRED')).toBe('canceled');
  });

  it('falls back to none for unknown / empty input', () => {
    expect(mapPaypalStatus('WHATEVER')).toBe('none');
    expect(mapPaypalStatus('')).toBe('none');
    expect(mapPaypalStatus(null)).toBe('none');
    expect(mapPaypalStatus(undefined)).toBe('none');
  });
});

describe('tierFromStripeSubscription', () => {
  it('trusts a valid tier stamped into the subscription metadata', () => {
    expect(tierFromStripeSubscription({ metadata: { tier: 'premium' } })).toBe('premium');
    expect(tierFromStripeSubscription({ metadata: { tier: 'ultimate' } })).toBe('ultimate');
  });

  it('ignores a bogus metadata tier and falls back to the price-id match', () => {
    vi.stubEnv('STRIPE_SUBSCRIPTION_PRICE_ID_ELITE', 'price_elite_123');
    try {
      expect(tierFromStripeSubscription({
        metadata: { tier: 'god-mode' },
        items: { data: [{ price: { id: 'price_elite_123' } }] },
      })).toBe('elite');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('falls back to pro for legacy subscriptions with no metadata or matching price', () => {
    expect(tierFromStripeSubscription({})).toBe('pro');
    expect(tierFromStripeSubscription({ items: { data: [{ price: { id: 'price_unknown' } }] } })).toBe('pro');
  });
});

describe('tierFromPaypalPlanId', () => {
  it('resolves a configured per-tier plan id', () => {
    vi.stubEnv('PAYPAL_SUBSCRIPTION_PLAN_ID_PREMIUM', 'P-PREMIUM');
    try {
      expect(tierFromPaypalPlanId('P-PREMIUM')).toBe('premium');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('falls back to pro for unknown or missing plan ids', () => {
    expect(tierFromPaypalPlanId('P-UNKNOWN')).toBe('pro');
    expect(tierFromPaypalPlanId(null)).toBe('pro');
    expect(tierFromPaypalPlanId(undefined)).toBe('pro');
  });
});

describe('getSubscriptionStatus', () => {
  function builder(result) {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
    };
    return b;
  }

  it('returns the entitlement snapshot row for a user', async () => {
    const row = { subscription_status: 'active', subscription_provider: 'stripe', trial_ends_at: null };
    mockSupabase.from.mockReturnValueOnce(builder({ data: row, error: null }));
    await expect(getSubscriptionStatus('user-1')).resolves.toEqual(row);
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('returns null when no profile row exists', async () => {
    mockSupabase.from.mockReturnValueOnce(builder({ data: null, error: null }));
    await expect(getSubscriptionStatus('missing')).resolves.toBeNull();
  });
});
