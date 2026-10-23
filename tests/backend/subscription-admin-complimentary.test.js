import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Admins hold the Ultimate plan free and are never charged for it. The
// database trigger (tests/db/run-admin-membership-migration.sh) flips the plan
// columns; this covers the server half in subscriptionService.js:
//   • grantAdminComplimentaryMembership — cancels the Stripe subscription a
//     newly promoted admin was paying for, then marks the profile complimentary
//   • revokeAdminComplimentaryMembership — a demoted admin goes back to Hobby
//   • the paid checkout routes refuse to sell a plan to an admin / comped member

const mockRetrieve = vi.hoisted(() => vi.fn());
const mockCancel = vi.hoisted(() => vi.fn());
const mockCheckoutCreate = vi.hoisted(() => vi.fn());
const mockCustomersCreate = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpdateEq = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({
  default: {
    subscriptions: { retrieve: mockRetrieve, cancel: mockCancel },
    checkout: { sessions: { create: mockCheckoutCreate } },
    customers: { create: mockCustomersCreate, retrieve: vi.fn() },
    prices: { retrieve: vi.fn() },
    coupons: { create: vi.fn() },
  },
}));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      update: mockUpdate,
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
  isPaypalConfigured: vi.fn(() => true),
  createPaypalSubscription: vi.fn(async () => ({ id: 'I-1', approveUrl: 'https://paypal.example/approve' })),
  getPaypalSubscription: vi.fn(),
  verifyPaypalWebhook: vi.fn(),
}));

import subscriptionRouter from '../../src/routes/subscription.js';
import {
  grantAdminComplimentaryMembership,
  revokeAdminComplimentaryMembership,
  ADMIN_COMPLIMENTARY_TIER,
  COMPLIMENTARY_STATUS,
} from '../../src/services/subscriptionService.js';

const app = express();
app.use(express.json());
app.use('/subscription', subscriptionRouter);

const RETURN = { successUrl: 'https://cardpop.com.au/account/membership', cancelUrl: 'https://cardpop.com.au/account/membership' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'https://cardpop.com.au';
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID = 'price_pro';
  // update(...).eq(...) resolves; a second .eq (the revoke's status filter) too.
  mockUpdateEq.mockImplementation(() => ({ eq: mockUpdateEq, then: (resolve) => resolve({ data: null, error: null }) }));
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockCancel.mockResolvedValue({ id: 'sub_paid', status: 'canceled' });
  mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });
  mockCheckoutCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });
});

describe('grantAdminComplimentaryMembership', () => {
  it('cancels a live Stripe subscription at once, with no final invoice, then marks the profile complimentary Ultimate', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {
      subscription_status: 'active', subscription_provider: 'stripe', subscription_tier: 'premium',
      stripe_subscription_id: 'sub_paid', paypal_subscription_id: null,
    }, error: null });
    mockRetrieve.mockResolvedValue({ id: 'sub_paid', status: 'active' });

    const result = await grantAdminComplimentaryMembership('user-1');

    expect(result).toEqual({ cancelledStripeSubscription: 'sub_paid' });
    expect(mockCancel).toHaveBeenCalledWith('sub_paid', { invoice_now: false, prorate: false });
    expect(mockUpdate).toHaveBeenCalledWith({
      subscription_tier: ADMIN_COMPLIMENTARY_TIER,
      subscription_status: COMPLIMENTARY_STATUS,
      trial_ends_at: null,
      stripe_subscription_id: null,
    });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('grants the plan to a Hobby member without touching Stripe', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {
      subscription_status: 'none', subscription_provider: null, subscription_tier: 'free',
      stripe_subscription_id: null, paypal_subscription_id: null,
    }, error: null });

    const result = await grantAdminComplimentaryMembership('user-1');

    expect(result).toEqual({ cancelledStripeSubscription: null });
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      subscription_tier: 'ultimate', subscription_status: 'grandfathered', trial_ends_at: null,
    });
  });

  it('leaves an already-complimentary member alone apart from re-asserting the columns', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {
      subscription_status: 'grandfathered', subscription_provider: null, subscription_tier: 'ultimate',
      stripe_subscription_id: 'sub_old', paypal_subscription_id: null,
    }, error: null });

    await grantAdminComplimentaryMembership('user-1');

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'ultimate' }));
  });

  it('does not cancel a subscription Stripe already shows as canceled', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {
      subscription_status: 'canceled', subscription_provider: 'stripe', subscription_tier: 'free',
      stripe_subscription_id: 'sub_done', paypal_subscription_id: null,
    }, error: null });
    mockRetrieve.mockResolvedValue({ id: 'sub_done', status: 'canceled' });

    const result = await grantAdminComplimentaryMembership('user-1');

    expect(mockCancel).not.toHaveBeenCalled();
    expect(result.cancelledStripeSubscription).toBeNull();
  });

  it('tolerates a subscription id Stripe no longer knows', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {
      subscription_status: 'active', subscription_provider: 'stripe', subscription_tier: 'pro',
      stripe_subscription_id: 'sub_gone', paypal_subscription_id: null,
    }, error: null });
    mockRetrieve.mockRejectedValue(Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 }));

    const result = await grantAdminComplimentaryMembership('user-1');

    expect(result.cancelledStripeSubscription).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'grandfathered' }));
  });

  it('fails rather than marking the profile complimentary when Stripe refuses the cancel', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {
      subscription_status: 'active', subscription_provider: 'stripe', subscription_tier: 'pro',
      stripe_subscription_id: 'sub_paid', paypal_subscription_id: null,
    }, error: null });
    mockRetrieve.mockResolvedValue({ id: 'sub_paid', status: 'active' });
    mockCancel.mockRejectedValue(new Error('Stripe is down'));

    await expect(grantAdminComplimentaryMembership('user-1')).rejects.toThrow('Stripe is down');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('404s on an unknown profile', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(grantAdminComplimentaryMembership('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('revokeAdminComplimentaryMembership', () => {
  it('returns a complimentary member to Hobby, filtering on the complimentary status so a paid plan is never touched', async () => {
    await revokeAdminComplimentaryMembership('user-1');
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_tier: 'free', subscription_status: 'none' });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1');
    expect(mockUpdateEq).toHaveBeenCalledWith('subscription_status', COMPLIMENTARY_STATUS);
  });
});

describe('paid checkout refuses accounts that hold the plan free', () => {
  it('answers 409 to an admin starting a Stripe plan and never creates a session', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: true, subscription_status: 'grandfathered' }, error: null });
    const res = await request(app).post('/subscription/stripe/checkout').send({ ...RETURN, tier: 'pro' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/admin accounts include the ultimate plan/i);
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('answers 409 to a complimentary (non-admin) member', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: false, subscription_status: 'grandfathered' }, error: null });
    const res = await request(app).post('/subscription/stripe/checkout').send({ ...RETURN, tier: 'pro' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/complimentary membership/i);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('still sells a plan to an ordinary Hobby member', async () => {
    // First maybeSingle: the gate's profile read; second: getOrCreateStripeCustomer.
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { is_admin: false, subscription_status: 'none' }, error: null })
      .mockResolvedValueOnce({ data: { stripe_customer_id: null, display_name: 'Col' }, error: null });
    const res = await request(app).post('/subscription/stripe/checkout').send({ ...RETURN, tier: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/x');
    expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
  });

  it('answers 409 to an admin starting a PayPal plan', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: true, subscription_status: 'grandfathered' }, error: null });
    const res = await request(app).post('/subscription/paypal/create').send({ returnUrl: RETURN.successUrl, cancelUrl: RETURN.cancelUrl, tier: 'pro' });
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
