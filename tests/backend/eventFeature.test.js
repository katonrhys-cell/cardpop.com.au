import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockStripe = vi.hoisted(() => ({ checkout: { sessions: { create: vi.fn() } } }));
const mockSendFeaturePaid = vi.hoisted(() => vi.fn());
const mockReturnUrl = vi.hoisted(() => ({ bad: null }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'org-1', email: 'org@example.com' }; next(); },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAdmin: (_req, _res, next) => next(),
  requireAal2: (_req, _res, next) => next(),
}));
vi.mock('../../src/utils/returnUrl.js', () => ({ invalidReturnUrl: () => mockReturnUrl.bad }));
vi.mock('../../src/utils/emailService.js', () => ({
  sendEventSubmitted: vi.fn(),
  sendEventReviewOutcome: vi.fn(),
  sendEventChangesMade: vi.fn(),
  sendEventFeaturePaid: mockSendFeaturePaid,
}));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({
  getAdminNotificationEmails: vi.fn().mockResolvedValue(['admin@cardpop.com.au']),
}));

import eventsRouter from '../../src/routes/events.js';
import { handleEventFeaturePaid, handleEventFeatureExpired, EVENT_FEATURE_KIND } from '../../src/services/eventFeatureService.js';
import { todayInAustralia } from '../../utils/featuredPackages.js';

const app = express();
app.use(express.json());
app.use('/', eventsRouter);

function chain(result) {
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

const addDays = (n) => {
  const d = new Date(`${todayInAustralia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const event = (over = {}) => ({
  id: EVENT_ID, title: 'Sydney Card Show', slug: 'sydney-card-show', status: 'approved',
  start_date: addDays(10), end_date: null, is_featured: false, organiser_id: 'org-1', organizer_name: 'Jane',
  ...over,
});
const body = { package: 'spotlight_instagram', successUrl: 'https://cardpop.com.au/account/events?featured=success', cancelUrl: 'https://cardpop.com.au/account/events' };

let builders;
beforeEach(() => {
  vi.clearAllMocks();
  mockReturnUrl.bad = null;
  builders = [];
  mockSupabase.from.mockImplementation(() => {
    const next = builders.shift();
    if (!next) throw new Error('Unexpected supabase query');
    return next;
  });
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.com/c/cs_123' });
});

describe('POST /events/:id/feature-checkout', () => {
  it('prices the package server-side and opens a Stripe session', async () => {
    const insert = chain({ data: { id: 'pur-1' }, error: null });
    const stamp = chain({ error: null });
    builders.push(chain({ data: event(), error: null }), chain({ data: [], error: null }), insert, stamp);

    const res = await request(app).post(`/${EVENT_ID}/feature-checkout`).send({ ...body, amount: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/c/cs_123', sessionId: 'cs_123' });
    const insertArgs = insert.calls.find((c) => c[0] === 'insert')[1];
    expect(insertArgs).toMatchObject({ event_id: EVENT_ID, organiser_id: 'org-1', package: 'spotlight_instagram', amount_aud: 99, early_bird: false, status: 'pending' });
    const session = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items[0].price_data.unit_amount).toBe(9900);
    expect(session.metadata).toMatchObject({ kind: EVENT_FEATURE_KIND, purchaseId: 'pur-1', eventId: EVENT_ID, package: 'spotlight_instagram' });
    expect(stamp.calls).toContainEqual(['eq', 'id', 'pur-1']);
  });

  it('takes 20% off four or more weeks out', async () => {
    const insert = chain({ data: { id: 'pur-1' }, error: null });
    builders.push(chain({ data: event({ start_date: addDays(40) }), error: null }), chain({ data: [], error: null }), insert, chain({ error: null }));

    const res = await request(app).post(`/${EVENT_ID}/feature-checkout`).send({ ...body, package: 'full' });

    expect(res.status).toBe(200);
    expect(mockStripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(11920);
    expect(insert.calls.find((c) => c[0] === 'insert')[1]).toMatchObject({ base_aud: 149, discount_aud: 29.8, amount_aud: 119.2, early_bird: true });
  });

  it("refuses someone else's event", async () => {
    builders.push(chain({ data: event({ organiser_id: 'someone-else' }), error: null }));
    const res = await request(app).post(`/${EVENT_ID}/feature-checkout`).send(body);
    expect(res.status).toBe(403);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses an event that is already featured or has started', async () => {
    builders.push(chain({ data: event(), error: null }), chain({ data: [{ id: 'paid-1' }], error: null }));
    expect((await request(app).post(`/${EVENT_ID}/feature-checkout`).send(body)).status).toBe(409);
    builders.push(chain({ data: event({ start_date: addDays(-1) }), error: null }), chain({ data: [], error: null }));
    expect((await request(app).post(`/${EVENT_ID}/feature-checkout`).send(body)).status).toBe(409);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown package and foreign return URLs', async () => {
    builders.push();
    expect((await request(app).post(`/${EVENT_ID}/feature-checkout`).send({ ...body, package: 'gold' })).status).toBe(400);
    mockReturnUrl.bad = 'successUrl must be on cardpop.com.au';
    expect((await request(app).post(`/${EVENT_ID}/feature-checkout`).send(body)).status).toBe(400);
    expect((await request(app).post('/not-a-uuid/feature-checkout').send(body)).status).toBe(400);
  });
});

describe('Stripe webhook for featuring', () => {
  const session = { id: 'cs_123', payment_status: 'paid', payment_intent: 'pi_1', metadata: { kind: EVENT_FEATURE_KIND, purchaseId: 'pur-1' } };
  const purchase = { id: 'pur-1', event_id: EVENT_ID, organiser_id: 'org-1', package: 'full', amount_aud: 149, early_bird: false, status: 'pending' };

  it('marks the purchase paid, features the event and tells the organiser and admins', async () => {
    const claim = chain({ data: [{ id: 'pur-1' }], error: null });
    const feature = chain({ data: event({ is_featured: true }), error: null });
    const bells = chain({ error: null });
    builders.push(
      chain({ data: purchase, error: null }),
      claim,
      feature,
      chain({ data: [{ id: 'admin-1' }], error: null }),
      bells,
      chain({ data: { display_name: 'Jane' }, error: null }),
    );

    await handleEventFeaturePaid(session);

    expect(claim.calls).toContainEqual(['neq', 'status', 'paid']);
    expect(feature.calls).toContainEqual(['update', { is_featured: true }]);
    const rows = bells.calls.find((c) => c[0] === 'insert')[1];
    expect(rows.map((r) => [r.user_id, r.type])).toEqual([['org-1', 'event_featured'], ['admin-1', 'event_featured']]);
    expect(mockSendFeaturePaid).toHaveBeenCalledWith(expect.objectContaining({
      packageName: 'Full Feature',
      extras: expect.arrayContaining(['Homepage Featured events spot']),
    }));
  });

  it('does nothing on a redelivery', async () => {
    builders.push(chain({ data: { ...purchase, status: 'paid' }, error: null }));
    await handleEventFeaturePaid(session);
    expect(mockSendFeaturePaid).not.toHaveBeenCalled();
  });

  it('waits for an unpaid session', async () => {
    await handleEventFeaturePaid({ ...session, payment_status: 'unpaid' });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('expires a pending purchase when the session lapses', async () => {
    const expire = chain({ error: null });
    builders.push(chain({ data: purchase, error: null }), expire);
    await handleEventFeatureExpired(session);
    expect(expire.calls).toContainEqual(['update', expect.objectContaining({ status: 'expired' })]);
  });
});
