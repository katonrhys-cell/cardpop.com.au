import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// POST /subscription/stripe/change-tier — the in-place upgrade behind the
// membership page's "Change your plan" (up or down). It must re-price the member's EXISTING
// subscription (no second subscription, no second trial) and refuse anyone
// without a Stripe subscription to change.

const mockRetrieve = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockProfileUpdate = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({
  default: { subscriptions: { retrieve: mockRetrieve, update: mockUpdate } },
}));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      update: mockProfileUpdate,
    })),
  },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1', email: 'u@example.com' }; next(); },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
}));
vi.mock('../../src/services/welcomeOfferService.js', () => ({ markTrialRedeemed: vi.fn() }));
vi.mock('../../src/services/partnerService.js', () => ({
  validatePartnerCode: vi.fn(),
  recordSubscriptionReferral: vi.fn(),
}));
vi.mock('../../src/utils/paypalClient.js', () => ({
  isPaypalConfigured: vi.fn(() => false),
  createPaypalSubscription: vi.fn(),
  getPaypalSubscription: vi.fn(),
  verifyPaypalWebhook: vi.fn(),
}));

import subscriptionRouter from '../../src/routes/subscription.js';

const app = express();
app.use(express.json());
app.use('/subscription', subscriptionRouter);

const change = (tier) => request(app).post('/subscription/stripe/change-tier').send({ tier });

const proProfile = {
  subscription_status: 'active',
  subscription_provider: 'stripe',
  subscription_tier: 'pro',
  stripe_subscription_id: 'sub_123',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID = 'price_pro';
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID_PREMIUM = 'price_premium';
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID_ELITE = 'price_elite';
  delete process.env.STRIPE_SUBSCRIPTION_PRICE_ID_ULTIMATE;
  mockMaybeSingle.mockResolvedValue({ data: proProfile, error: null });
  mockRetrieve.mockResolvedValue({
    id: 'sub_123',
    status: 'active',
    customer: 'cus_1',
    metadata: { userId: 'user-1', tier: 'pro' },
    items: { data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
  });
  mockUpdate.mockImplementation(async (id, params) => ({
    id,
    status: 'active',
    customer: 'cus_1',
    trial_end: null,
    metadata: params.metadata,
    items: { data: [{ id: 'si_1', price: { id: params.items[0].price } }] },
  }));
  // applyStripeSubscription's profile write.
  mockProfileUpdate.mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [{ id: 'user-1' }], error: null }),
  });
});

describe('POST /subscription/stripe/change-tier', () => {
  it('re-prices the existing subscription in place and mirrors the new tier', async () => {
    const res = await change('premium');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tier: 'premium', status: 'active' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [id, params] = mockUpdate.mock.calls[0];
    expect(id).toBe('sub_123');
    expect(params.items).toEqual([{ id: 'si_1', price: 'price_premium' }]);
    expect(params.proration_behavior).toBe('create_prorations');
    expect(params.metadata).toEqual(expect.objectContaining({ userId: 'user-1', tier: 'premium' }));
    // No trial is ever re-granted on an upgrade.
    expect(params.trial_period_days).toBeUndefined();
    expect(params.trial_end).toBeUndefined();

    expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      subscription_tier: 'premium',
      stripe_subscription_id: 'sub_123',
    }));
  });

  it('refuses a move to the plan the member is already on', async () => {
    expect((await change('pro')).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('downgrades in place with prorations, crediting the unused part of the dearer plan', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...proProfile, subscription_tier: 'elite' }, error: null });
    mockRetrieve.mockResolvedValue({
      id: 'sub_123', status: 'active', customer: 'cus_1',
      metadata: { userId: 'user-1', tier: 'elite' },
      items: { data: [{ id: 'si_1', price: { id: 'price_elite' } }] },
    });
    const res = await change('premium');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tier: 'premium', status: 'active' });
    const [, params] = mockUpdate.mock.calls[0];
    expect(params.items).toEqual([{ id: 'si_1', price: 'price_premium' }]);
    expect(params.proration_behavior).toBe('create_prorations');
    expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'premium' }));
  });

  it('refuses an unknown tier', async () => {
    expect((await change('platinum')).status).toBe(400);
    expect((await change(undefined)).status).toBe(400);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('answers 503 when the target tier has no Stripe price configured', async () => {
    const res = await change('ultimate');
    expect(res.status).toBe(503);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('answers 409 for a Hobby member with no subscription to change', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { subscription_status: 'none', subscription_provider: null, subscription_tier: 'free', stripe_subscription_id: null },
      error: null,
    });
    const res = await change('premium');
    expect(res.status).toBe(409);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('answers 409 for a complimentary or PayPal-billed membership', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...proProfile, subscription_status: 'grandfathered' }, error: null });
    expect((await change('premium')).status).toBe(409);
    mockMaybeSingle.mockResolvedValue({ data: { ...proProfile, subscription_provider: 'paypal' }, error: null });
    expect((await change('premium')).status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('answers 409 when the Stripe subscription is no longer active', async () => {
    mockRetrieve.mockResolvedValue({ id: 'sub_123', status: 'canceled', items: { data: [{ id: 'si_1' }] } });
    expect((await change('premium')).status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('answers 500 (not a leak) when Stripe throws', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'));
    const res = await change('premium');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Could not change your plan');
  });
});
