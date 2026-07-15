import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockGetPaypalSubscription = vi.hoisted(() => vi.fn());
const mockApplyPaypalSubscription = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: {} }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));
vi.mock('../../src/services/subscriptionService.js', () => ({
  getOrCreateStripeCustomer: vi.fn(),
  applyPaypalSubscription: mockApplyPaypalSubscription,
  mapPaypalStatus: vi.fn(() => 'active'),
  getSubscriptionStatus: vi.fn(),
}));
vi.mock('../../src/utils/paypalClient.js', () => ({
  isPaypalConfigured: vi.fn(() => true),
  createPaypalSubscription: vi.fn(),
  getPaypalSubscription: mockGetPaypalSubscription,
  verifyPaypalWebhook: vi.fn(),
}));
vi.mock('../../src/services/partnerService.js', () => ({ validatePartnerCode: vi.fn() }));

import subscriptionRouter from '../../src/routes/subscription.js';

const app = express();
app.use(express.json());
app.use('/subscription', subscriptionRouter);

const activate = () => request(app).post('/subscription/paypal/activate').send({ subscriptionId: 'I-SUB' });

beforeEach(() => {
  vi.clearAllMocks();
  mockApplyPaypalSubscription.mockResolvedValue(undefined);
});

describe('POST /subscription/paypal/activate ownership guard', () => {
  it('activates when custom_id matches the caller', async () => {
    mockGetPaypalSubscription.mockResolvedValue({ status: 'ACTIVE', custom_id: 'user-1', billing_info: {} });
    const res = await activate();
    expect(res.status).toBe(200);
    expect(mockApplyPaypalSubscription).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('rejects when custom_id belongs to another user', async () => {
    mockGetPaypalSubscription.mockResolvedValue({ status: 'ACTIVE', custom_id: 'someone-else' });
    const res = await activate();
    expect(res.status).toBe(403);
    expect(mockApplyPaypalSubscription).not.toHaveBeenCalled();
  });

  it('rejects when custom_id is missing (no longer skips the ownership check)', async () => {
    mockGetPaypalSubscription.mockResolvedValue({ status: 'ACTIVE' });
    const res = await activate();
    expect(res.status).toBe(403);
    expect(mockApplyPaypalSubscription).not.toHaveBeenCalled();
  });
});
