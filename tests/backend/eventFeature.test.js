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
import {
  handleEventFeaturePaid, handleEventFeatureExpired, EVENT_FEATURE_KIND, FEATURING_PACKAGES,
} from '../../src/services/eventFeatureService.js';
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
const body = { package: 'spotlight', successUrl: 'https://cardpop.com.au/account/events?featured=success', cancelUrl: 'https://cardpop.com.au/account/events' };

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
    expect(insertArgs).toMatchObject({ event_id: EVENT_ID, organiser_id: 'org-1', package: 'spotlight', amount_aud: 49, early_bird: false, status: 'pending' });
    const session = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items[0].price_data.unit_amount).toBe(4900);
    expect(session.metadata).toMatchObject({ kind: EVENT_FEATURE_KIND, purchaseId: 'pur-1', eventId: EVENT_ID, package: 'spotlight' });
    expect(stamp.calls).toContainEqual(['eq', 'id', 'pur-1']);
  });

  it('takes 20% off four or more weeks out', async () => {
    const insert = chain({ data: { id: 'pur-1' }, error: null });
    builders.push(chain({ data: event({ start_date: addDays(40) }), error: null }), chain({ data: [], error: null }), insert, chain({ error: null }));

    const res = await request(app).post(`/${EVENT_ID}/feature-checkout`).send(body);

    expect(res.status).toBe(200);
    expect(mockStripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(3920);
    expect(insert.calls.find((c) => c[0] === 'insert')[1]).toMatchObject({ base_aud: 49, discount_aud: 9.8, amount_aud: 39.2, early_bird: true });
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

  it('is not blocked by a paid promotion extra: only a paid featuring counts', async () => {
    // The "already paid?" lookup is scoped to the featuring packages, so a
    // paid Instagram story on the event never reads as "already featured".
    const paidLookup = chain({ data: [], error: null });
    builders.push(chain({ data: event(), error: null }), paidLookup, chain({ data: { id: 'pur-1' }, error: null }), chain({ error: null }));

    const res = await request(app).post(`/${EVENT_ID}/feature-checkout`).send(body);

    expect(res.status).toBe(200);
    expect(paidLookup.calls).toContainEqual(['in', 'package', FEATURING_PACKAGES]);
    expect(FEATURING_PACKAGES).not.toEqual(expect.arrayContaining(['story', 'post', 'review']));
  });

  it('no longer sells the retired Instagram and Full Feature packages', async () => {
    for (const retired of ['spotlight_instagram', 'full']) {
      expect((await request(app).post(`/${EVENT_ID}/feature-checkout`).send({ ...body, package: retired })).status).toBe(400);
    }
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

describe('POST /events/:id/extra-checkout', () => {
  const extraBody = { extra: 'post', successUrl: 'https://cardpop.com.au/account/events?extra=success', cancelUrl: 'https://cardpop.com.au/account/events' };

  it('prices the extra server-side, with no early bird, and opens a Stripe session', async () => {
    const insert = chain({ data: { id: 'pur-9' }, error: null });
    const stamp = chain({ error: null });
    // 40 days out: featuring would be early bird, an extra never is.
    builders.push(
      chain({ data: event({ start_date: addDays(40), is_featured: true, membership_featured: true }), error: null }),
      chain({ data: [{ package: 'story' }, { package: 'spotlight' }], error: null }),
      insert,
      stamp,
    );

    const res = await request(app).post(`/${EVENT_ID}/extra-checkout`).send({ ...extraBody, amount: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/c/cs_123' });
    expect(insert.calls.find((c) => c[0] === 'insert')[1]).toMatchObject({
      event_id: EVENT_ID, organiser_id: 'org-1', package: 'post', base_aud: 99, discount_aud: 0, amount_aud: 99, early_bird: false, status: 'pending',
    });
    const session = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(session.mode).toBe('payment');
    expect(session.line_items[0].price_data.unit_amount).toBe(9900);
    expect(session.line_items[0].price_data.product_data.name).toBe('Event promotion: Instagram post');
    expect(session.metadata).toMatchObject({ kind: EVENT_FEATURE_KIND, purchaseId: 'pur-9', eventId: EVENT_ID, package: 'post' });
    expect(stamp.calls).toContainEqual(['eq', 'id', 'pur-9']);
  });

  it('charges $49 for a story and $199 for the review', async () => {
    for (const [extra, cents] of [['story', 4900], ['review', 19900]]) {
      mockStripe.checkout.sessions.create.mockClear();
      builders.push(chain({ data: event(), error: null }), chain({ data: [], error: null }), chain({ data: { id: 'p' }, error: null }), chain({ error: null }));
      expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send({ ...extraBody, extra })).status).toBe(200);
      expect(mockStripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(cents);
    }
  });

  it("refuses someone else's event", async () => {
    builders.push(chain({ data: event({ organiser_id: 'someone-else' }), error: null }));
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send(extraBody)).status).toBe(403);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses an extra already booked for the event, or an event that has started', async () => {
    builders.push(chain({ data: event(), error: null }), chain({ data: [{ package: 'post' }], error: null }));
    const dup = await request(app).post(`/${EVENT_ID}/extra-checkout`).send(extraBody);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatch(/already booked/);
    builders.push(chain({ data: event({ start_date: addDays(-1) }), error: null }), chain({ data: [], error: null }));
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send(extraBody)).status).toBe(409);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('answers 404 for a missing event', async () => {
    builders.push(chain({ data: null, error: null }));
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send(extraBody)).status).toBe(404);
  });

  it('rejects an unknown extra, a featuring package, and foreign or missing return URLs', async () => {
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send({ ...extraBody, extra: 'gold' })).status).toBe(400);
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send({ ...extraBody, extra: 'spotlight' })).status).toBe(400);
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send({ extra: 'post' })).status).toBe(400);
    mockReturnUrl.bad = 'successUrl must be on cardpop.com.au';
    expect((await request(app).post(`/${EVENT_ID}/extra-checkout`).send(extraBody)).status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe('Stripe webhook for a promotion extra', () => {
  const session = { id: 'cs_x', payment_status: 'paid', payment_intent: 'pi_x', metadata: { kind: EVENT_FEATURE_KIND, purchaseId: 'pur-9' } };
  const row = (pkg, amount) => ({ id: 'pur-9', event_id: EVENT_ID, organiser_id: 'org-1', package: pkg, amount_aud: amount, early_bird: false, status: 'pending' });
  const run = async (purchase) => {
    const claim = chain({ data: [{ id: 'pur-9' }], error: null });
    const eventQuery = chain({ data: event(), error: null });
    const bells = chain({ error: null });
    builders.push(
      chain({ data: purchase, error: null }),
      claim,
      eventQuery,
      chain({ data: [{ id: 'admin-1' }], error: null }),
      bells,
      chain({ data: { display_name: 'Jane' }, error: null }),
    );
    await handleEventFeaturePaid(session);
    return { claim, eventQuery, bells };
  };

  it('marks it paid and tells the team what to do, without touching the featuring', async () => {
    const { claim, eventQuery, bells } = await run(row('post', 99));

    expect(claim.calls).toContainEqual(['update', expect.objectContaining({ status: 'paid', stripe_session_id: 'cs_x' })]);
    // The event is only read: is_featured is never written for an extra.
    expect(eventQuery.calls.some((c) => c[0] === 'update')).toBe(false);
    expect(eventQuery.calls).toContainEqual(['eq', 'id', EVENT_ID]);
    const rows = bells.calls.find((c) => c[0] === 'insert')[1];
    expect(rows.map((r) => [r.user_id, r.title])).toEqual([
      ['org-1', 'Instagram post booked'], ['admin-1', 'Event extra paid'],
    ]);
    expect(rows[1].body).toMatch(/To do: Instagram post before the show/);
    expect(mockSendFeaturePaid).toHaveBeenCalledWith(expect.objectContaining({
      isExtra: true, packageName: 'Instagram post', amountAud: 99, extras: ['Instagram post before the show'],
    }));
  });

  it('lists the attendance and free-entry work for the full event review', async () => {
    await run(row('review', 199));
    const sent = mockSendFeaturePaid.mock.calls[0][0];
    expect(sent).toMatchObject({ isExtra: true, packageName: 'Full event review' });
    expect(sent.extras.join(' | ')).toMatch(/free entry/);
    expect(sent.extras.join(' | ')).toMatch(/on the day/);
  });

  it('still features the event for a Calendar Spotlight row', async () => {
    const { eventQuery, bells } = await run(row('spotlight', 49));
    expect(eventQuery.calls).toContainEqual(['update', { is_featured: true }]);
    expect(bells.calls.find((c) => c[0] === 'insert')[1][0].title).toBe('Your event is featured');
    expect(mockSendFeaturePaid).toHaveBeenCalledWith(expect.objectContaining({ isExtra: false, packageName: 'Calendar Spotlight', extras: [] }));
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
    expect(feature.calls).toContainEqual(['update', { is_featured: true, homepage_featured: true }]);
    const rows = bells.calls.find((c) => c[0] === 'insert')[1];
    expect(rows.map((r) => [r.user_id, r.type])).toEqual([['org-1', 'event_featured'], ['admin-1', 'event_featured']]);
    expect(mockSendFeaturePaid).toHaveBeenCalledWith(expect.objectContaining({
      packageName: 'Full Feature',
      extras: expect.not.arrayContaining(['Homepage Featured events spot']),
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

describe('POST /events/feature-bundle-checkout', () => {
  const ID2 = '22222222-2222-4222-8222-222222222222';
  const ID3 = '33333333-3333-4333-8333-333333333333';
  const three = () => [
    event(),
    event({ id: ID2, title: 'Melbourne Card Show', start_date: addDays(40) }),
    event({ id: ID3, title: 'Brisbane Card Show', start_date: addDays(12) }),
  ];
  const packBody = { ...body, package: 'spotlight', eventIds: [EVENT_ID, ID2, ID3] };

  it('prices the pack server-side, writes three rows and opens one session', async () => {
    const insert = chain({ data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], error: null });
    const stamp = chain({ error: null });
    builders.push(chain({ data: three(), error: null }), chain({ data: [], error: null }), insert, stamp);

    const res = await request(app).post('/feature-bundle-checkout').send({ ...packBody, amount: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/c/cs_123', sessionId: 'cs_123' });
    const rows = insert.calls.find((c) => c[0] === 'insert')[1];
    expect(rows).toHaveLength(3);
    const bundleId = rows[0].bundle_id;
    expect(bundleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows.every((r) => r.bundle_id === bundleId && r.package === 'spotlight' && r.base_aud === 49 && r.status === 'pending')).toBe(true);
    // $119 split 39.67 / 39.67 / 39.66, early bird off the Melbourne share only.
    expect(rows.map((r) => [r.event_id, r.amount_aud, r.early_bird])).toEqual([
      [EVENT_ID, 39.67, false], [ID2, 31.73, true], [ID3, 39.66, false],
    ]);
    const session = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items.map((l) => l.price_data.unit_amount)).toEqual([3967, 3173, 3966]);
    expect(session.metadata).toMatchObject({ kind: EVENT_FEATURE_KIND, bundleId, package: 'spotlight', eventIds: `${EVENT_ID},${ID2},${ID3}` });
    expect(stamp.calls).toContainEqual(['eq', 'bundle_id', bundleId]);
  });

  it('needs three different events', async () => {
    const two = await request(app).post('/feature-bundle-checkout').send({ ...packBody, eventIds: [EVENT_ID, ID2] });
    expect(two.status).toBe(400);
    const dup = await request(app).post('/feature-bundle-checkout').send({ ...packBody, eventIds: [EVENT_ID, EVENT_ID, ID2] });
    expect(dup.status).toBe(400);
    const junk = await request(app).post('/feature-bundle-checkout').send({ ...packBody, eventIds: [EVENT_ID, ID2, 'x'] });
    expect(junk.status).toBe(400);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("refuses someone else's event, a missing one, or one already featured", async () => {
    builders.push(chain({ data: [three()[0], three()[1], event({ id: ID3, organiser_id: 'someone-else' })], error: null }));
    expect((await request(app).post('/feature-bundle-checkout').send(packBody)).status).toBe(403);

    builders.push(chain({ data: three().slice(0, 2), error: null }));
    expect((await request(app).post('/feature-bundle-checkout').send(packBody)).status).toBe(404);

    builders.push(chain({ data: three(), error: null }), chain({ data: [{ event_id: ID2 }], error: null }));
    const res = await request(app).post('/feature-bundle-checkout').send(packBody);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Melbourne Card Show/);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown package', async () => {
    expect((await request(app).post('/feature-bundle-checkout').send({ ...packBody, package: 'gold' })).status).toBe(400);
  });
});

describe('Stripe webhook for a 3-event pack', () => {
  const session = { id: 'cs_pack', payment_status: 'paid', payment_intent: 'pi_2', metadata: { kind: EVENT_FEATURE_KIND, bundleId: 'b-1' } };
  const rows = ['e1', 'e2', 'e3'].map((e, i) => ({
    id: `p${i + 1}`, event_id: e, organiser_id: 'org-1', package: 'spotlight', amount_aud: 39.67, early_bird: false, status: 'pending',
  }));
  const notifyBuilders = () => [
    chain({ data: [], error: null }), // admins
    chain({ error: null }), // bells
    chain({ data: { display_name: 'Jane' }, error: null }), // organiser
  ];

  it('features all three events', async () => {
    const lookup = chain({ data: rows, error: null });
    const features = [];
    builders.push(lookup);
    for (const r of rows) {
      const feature = chain({ data: event({ id: r.event_id, is_featured: true }), error: null });
      features.push(feature);
      builders.push(chain({ data: [{ id: r.id }], error: null }), feature, ...notifyBuilders());
    }

    await handleEventFeaturePaid(session);

    expect(lookup.calls).toContainEqual(['eq', 'bundle_id', 'b-1']);
    features.forEach((f, i) => {
      expect(f.calls).toContainEqual(['update', { is_featured: true }]);
      expect(f.calls).toContainEqual(['eq', 'id', rows[i].event_id]);
    });
    expect(mockSendFeaturePaid).toHaveBeenCalledTimes(3);
    expect(mockSendFeaturePaid).toHaveBeenCalledWith(expect.objectContaining({ packageName: 'Calendar Spotlight (3-event pack)' }));
  });

  it('skips an event another payment already featured instead of failing the webhook', async () => {
    builders.push(
      chain({ data: rows, error: null }),
      chain({ data: [{ id: 'p1' }], error: null }), chain({ data: event({ id: 'e1' }), error: null }), ...notifyBuilders(),
      chain({ data: null, error: { code: '23505', message: 'duplicate key' } }),
      chain({ data: [{ id: 'p3' }], error: null }), chain({ data: event({ id: 'e3' }), error: null }), ...notifyBuilders(),
    );

    await expect(handleEventFeaturePaid(session)).resolves.toBeUndefined();
    expect(mockSendFeaturePaid).toHaveBeenCalledTimes(2);
  });

  it('expires every pending row of a lapsed pack', async () => {
    const expires = rows.map(() => chain({ error: null }));
    builders.push(chain({ data: rows, error: null }), ...expires);
    await handleEventFeatureExpired(session);
    expires.forEach((e, i) => expect(e.calls).toContainEqual(['eq', 'id', rows[i].id]));
  });
});
