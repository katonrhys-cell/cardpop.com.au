import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { admin: { updateUserById: vi.fn(() => Promise.resolve({ data: {}, error: null })) } },
}));
const mockIsAdminUser = vi.hoisted(() => vi.fn());
const mockPayoutSeller = vi.hoisted(() => vi.fn());
const mockSendOrderShipped = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: { transfers: { create: vi.fn() } } }));
vi.mock('../../src/services/payoutService.js', () => ({ payoutSeller: mockPayoutSeller }));
// Keep the refund arithmetic real; only the platform_settings lookup is stubbed
// so it doesn't consume a queued supabase builder.
vi.mock('../../src/services/refundAmounts.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getRefundRetentionPct: vi.fn(async () => 50),
}));
vi.mock('../../src/utils/emailService.js', () => ({ sendOrderShipped: mockSendOrderShipped }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));
// The server-side MFA (AAL2) gate is covered by its own unit test
// (requireAal2.test.js); stub it to a pass-through here so these tests stay
// focused on the admin authorization logic.
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  default: (_req, _res, next) => next(),
}));


import adminRouter from '../../src/routes/admin.js';

// GET /admin/offers — the admin Offers page's data source.

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

/** A chainable query builder that records filter calls and resolves `result`. */
function makeBuilder(result) {
  const calls = [];
  const b = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); return b; };
    },
  });
  return b;
}

let builders;
beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
  builders = [];
  mockSupabase.from.mockImplementation(() => {
    // First builder is the list; the next four are the counts, in order:
    // open, awaiting_payment, paid, expired.
    const i = builders.length;
    const result = i === 0
      ? { data: [{ id: 'o1', status: 'pending' }, { id: 'o2', status: 'accepted' }], error: null }
      : { count: [3, 2, 5, 1][i - 1], error: null };
    const b = makeBuilder(result);
    builders.push(b);
    return b;
  });
});

describe('GET /admin/offers', () => {
  it('lists offers with both parties and returns the stat counts', async () => {
    const res = await request(app).get('/admin/offers');
    expect(res.status).toBe(200);
    expect(res.body.offers).toHaveLength(2);
    expect(res.body.counts).toEqual({ open: 3, awaiting_payment: 2, paid: 5, expired: 1 });
    const select = builders[0].calls.find(([m]) => m === 'select')[1];
    expect(select).toMatch(/buyer:profiles!buyer_id\(.*email/s);
    expect(select).toMatch(/seller:profiles!seller_id\(.*email/s);
    expect(select).toMatch(/payment_due_at/);
    expect(builders[0].calls).toContainEqual(['limit', 200]);
  });

  it.each([
    ['open', [['in', 'status', ['pending', 'countered']]]],
    ['awaiting_payment', [['eq', 'status', 'accepted'], ['is', 'paid_at', null]]],
    ['paid', [['not', 'paid_at', 'is', null]]],
    ['expired', [['eq', 'status', 'expired']]],
  ])('filters the list for ?status=%s', async (status, expected) => {
    await request(app).get(`/admin/offers?status=${status}`);
    for (const call of expected) expect(builders[0].calls).toContainEqual(call);
  });

  it('applies no status filter for "all"', async () => {
    await request(app).get('/admin/offers?status=all');
    const filters = builders[0].calls.filter(([m]) => ['eq', 'in', 'is', 'not'].includes(m));
    expect(filters).toEqual([]);
  });

  it('400s an unknown status filter', async () => {
    const res = await request(app).get('/admin/offers?status=bogus');
    expect(res.status).toBe(400);
  });

  it('rejects non-admins', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).get('/admin/offers');
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('500s (without leaking the error) when the list query fails', async () => {
    mockSupabase.from.mockImplementation(() => makeBuilder({ data: null, error: { message: 'relation boom' } }));
    const res = await request(app).get('/admin/offers');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to load offers');
  });
});
