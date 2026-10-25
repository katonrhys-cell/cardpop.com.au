import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Membership self-service + the failed-trial-conversion clean-up. Support case
// 2026-10-25: two members whose first post-trial charge failed were dropped to
// Hobby while Stripe kept retrying their cards, and there was no way to cancel
// from the app at all.

const stripeMock = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
  invoices: { list: vi.fn(), voidInvoice: vi.fn(), pay: vi.fn() },
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  setupIntents: { retrieve: vi.fn() },
  customers: { update: vi.fn() },
}));
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockProfileUpdate = vi.hoisted(() => vi.fn());
const mockSendTrialEnding = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: stripeMock }));
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
vi.mock('../../src/middleware/requireAal2.js', () => ({ requireAal2: (_req, _res, next) => next() }));
vi.mock('../../src/services/welcomeOfferService.js', () => ({ markTrialRedeemed: vi.fn() }));
vi.mock('../../src/services/partnerService.js', () => ({
  validatePartnerCode: vi.fn(),
  recordSubscriptionReferral: vi.fn(),
}));
vi.mock('../../src/utils/emailService.js', () => ({ sendMembershipTrialEnding: mockSendTrialEnding }));
vi.mock('../../src/utils/paypalClient.js', () => ({
  isPaypalConfigured: vi.fn(() => false),
  createPaypalSubscription: vi.fn(),
  getPaypalSubscription: vi.fn(),
  verifyPaypalWebhook: vi.fn(),
}));

import subscriptionRouter from '../../src/routes/subscription.js';
import {
  applyStripeSubscription,
  handleSubscriptionInvoiceFailed,
  sendTrialEndingReminder,
  invoiceSubscriptionId,
} from '../../src/services/subscriptionService.js';

const app = express();
app.use(express.json());
app.use('/subscription', subscriptionRouter);

const sub = (overrides = {}) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'trialing',
  trial_end: 1_800_000_000,
  cancel_at_period_end: false,
  cancel_at: null,
  metadata: { userId: 'user-1', tier: 'pro' },
  items: { data: [{ id: 'si_1', current_period_end: 1_800_000_000, price: { id: 'price_pro', unit_amount: 2000 } }] },
  ...overrides,
});

const billedProfile = {
  subscription_status: 'trialing',
  subscription_provider: 'stripe',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: billedProfile, error: null });
  mockProfileUpdate.mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [{ id: 'user-1' }], error: null }),
  });
  stripeMock.invoices.list.mockResolvedValue({ data: [] });
  stripeMock.subscriptions.update.mockImplementation(async (id, params) => sub({ ...params, cancel_at: params.cancel_at_period_end ? 1_800_000_000 : null }));
  stripeMock.subscriptions.cancel.mockImplementation(async () => sub({ status: 'canceled' }));
});

describe('POST /subscription/stripe/cancel', () => {
  it('cancels a trial at its end — the card is never charged', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub());
    const res = await request(app).post('/subscription/stripe/cancel');
    expect(res.status).toBe(200);
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true });
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
    expect(res.body.membership).toEqual(expect.objectContaining({ cancelAtPeriodEnd: true, tier: 'pro' }));
  });

  it('cancels a past_due membership immediately and voids the unpaid invoice', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub({ status: 'past_due' }));
    stripeMock.invoices.list.mockImplementation(async ({ status }) => ({ data: status === 'open' ? [{ id: 'in_open' }] : [] }));
    const res = await request(app).post('/subscription/stripe/cancel');
    expect(res.status).toBe(200);
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub_1', { invoice_now: false, prorate: false });
    expect(stripeMock.invoices.voidInvoice).toHaveBeenCalledWith('in_open');
    expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'canceled', subscription_tier: 'free' }));
  });

  it('refuses complimentary, PayPal and Hobby accounts', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { ...billedProfile, subscription_status: 'grandfathered' }, error: null });
    expect((await request(app).post('/subscription/stripe/cancel')).status).toBe(409);
    mockMaybeSingle.mockResolvedValueOnce({ data: { ...billedProfile, subscription_provider: 'paypal' }, error: null });
    expect((await request(app).post('/subscription/stripe/cancel')).status).toBe(409);
    mockMaybeSingle.mockResolvedValueOnce({ data: { ...billedProfile, stripe_subscription_id: null }, error: null });
    expect((await request(app).post('/subscription/stripe/cancel')).status).toBe(409);
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe('POST /subscription/stripe/resume', () => {
  it('undoes a scheduled cancellation', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub({ cancel_at_period_end: true, cancel_at: 1_800_000_000 }));
    const res = await request(app).post('/subscription/stripe/resume');
    expect(res.status).toBe(200);
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: false });
    expect(res.body.membership.cancelAtPeriodEnd).toBe(false);
  });

  it('refuses once the membership has ended', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub({ status: 'canceled' }));
    expect((await request(app).post('/subscription/stripe/resume')).status).toBe(409);
  });
});

describe('GET /subscription/stripe/details', () => {
  it('returns the live billing state', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub());
    const res = await request(app).get('/subscription/stripe/details');
    expect(res.body.membership).toEqual({
      status: 'trialing', tier: 'pro', cancelAtPeriodEnd: false,
      periodEndsAt: new Date(1_800_000_000 * 1000).toISOString(), amountAud: 20,
    });
  });

  it('is null for a member with no Stripe subscription', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...billedProfile, stripe_subscription_id: null }, error: null });
    expect((await request(app).get('/subscription/stripe/details')).body).toEqual({ membership: null });
  });
});

describe('Update card (in-site, no Stripe portal)', () => {
  const urls = { successUrl: 'https://cardpop.com.au/account/membership?card=updated&session_id={CHECKOUT_SESSION_ID}', cancelUrl: 'https://cardpop.com.au/account/membership?card=cancelled' };
  const completed = (overrides = {}) => ({
    id: 'cs_1', status: 'complete', customer: 'cus_1', setup_intent: 'seti_1',
    metadata: { userId: 'user-1', membershipCard: 'true', subscriptionId: 'sub_1' }, ...overrides,
  });

  beforeEach(() => {
    stripeMock.setupIntents.retrieve.mockResolvedValue({ id: 'seti_1', payment_method: 'pm_new' });
    stripeMock.subscriptions.update.mockImplementation(async () => sub({ status: 'active' }));
  });

  it('starts a no-charge card setup tied to the membership', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub({ status: 'active' }));
    stripeMock.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' });
    const res = await request(app).post('/subscription/stripe/update-card').send(urls);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/c/cs_1');
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'setup', customer: 'cus_1',
      metadata: expect.objectContaining({ userId: 'user-1', membershipCard: 'true', subscriptionId: 'sub_1' }),
    }));
  });

  it('rejects return URLs off the site', async () => {
    const res = await request(app).post('/subscription/stripe/update-card').send({ ...urls, successUrl: 'https://evil.example/' });
    expect(res.status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('makes the new card the membership\'s payment method on return', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(completed());
    const res = await request(app).post('/subscription/stripe/update-card/confirm').send({ sessionId: 'cs_1' });
    expect(res.status).toBe(200);
    expect(stripeMock.customers.update).toHaveBeenCalledWith('cus_1', { invoice_settings: { default_payment_method: 'pm_new' } });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('sub_1', { default_payment_method: 'pm_new' });
    expect(stripeMock.invoices.pay).not.toHaveBeenCalled();
  });

  it('retries an overdue invoice on the new card straight away', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(completed());
    stripeMock.subscriptions.update.mockResolvedValue(sub({ status: 'past_due' }));
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub({ status: 'active' }));
    stripeMock.invoices.list.mockResolvedValue({ data: [{ id: 'in_overdue' }] });
    const res = await request(app).post('/subscription/stripe/update-card/confirm').send({ sessionId: 'cs_1' });
    expect(stripeMock.invoices.pay).toHaveBeenCalledWith('in_overdue', { payment_method: 'pm_new' });
    expect(res.body.membership.status).toBe('active');
  });

  it('refuses another member\'s session', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(completed({ metadata: { userId: 'someone-else', membershipCard: 'true', subscriptionId: 'sub_9' } }));
    const res = await request(app).post('/subscription/stripe/update-card/confirm').send({ sessionId: 'cs_1' });
    expect(res.status).toBe(404);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });
});

describe('failed first charge after a trial', () => {
  it('is cancelled instead of retried when the member has never paid', async () => {
    await applyStripeSubscription(sub({ status: 'past_due' }));
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub_1', { invoice_now: false, prorate: false });
    expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'canceled', subscription_tier: 'free' }));
  });

  it('leaves a renewal that failed on Stripe\'s retries when the member has paid before', async () => {
    stripeMock.invoices.list.mockResolvedValue({ data: [{ id: 'in_paid', amount_paid: 2000 }] });
    await applyStripeSubscription(sub({ status: 'past_due' }));
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
    expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'past_due' }));
  });

  it('still records past_due when Stripe refuses the cancel', async () => {
    stripeMock.subscriptions.cancel.mockRejectedValue(new Error('stripe down'));
    await applyStripeSubscription(sub({ status: 'past_due' }));
    expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'past_due' }));
  });

  it('runs on invoice.payment_failed retries too (no status change → no subscription.updated)', async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub({ status: 'past_due' }));
    await handleSubscriptionInvoiceFailed({ parent: { subscription_details: { subscription: 'sub_1' } } });
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith('sub_1');
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalled();
  });

  it('ignores invoices that are not for a subscription', async () => {
    await handleSubscriptionInvoiceFailed({ id: 'in_order' });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('reads the subscription id from either invoice shape', () => {
    expect(invoiceSubscriptionId({ subscription: 'sub_old' })).toBe('sub_old');
    expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } })).toBe('sub_new');
    expect(invoiceSubscriptionId({})).toBeNull();
  });
});

describe('trial-ending reminder', () => {
  it('emails the charge date, plan and price', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { email: 'm@example.com', display_name: 'Max', subscription_status: 'trialing' }, error: null });
    await sendTrialEndingReminder(sub());
    expect(mockSendTrialEnding).toHaveBeenCalledWith({
      to: 'm@example.com', name: 'Max', planName: 'Pro', amountAud: 20,
      chargeDate: new Date(1_800_000_000 * 1000).toISOString(),
    });
  });

  it('is skipped once the member has cancelled', async () => {
    await sendTrialEndingReminder(sub({ cancel_at_period_end: true }));
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });
});
