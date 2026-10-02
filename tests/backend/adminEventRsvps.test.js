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

// GET /admin/events/:id/rsvps — the admin "Who's going" list — plus the
// organiser-access routes it drives (link organiser, verify / unverify).

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

/** A chainable query builder that records calls and resolves `result`. */
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

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

// Results are queued per table (queries on different tables run in parallel,
// so their relative order isn't meaningful); each from(table) takes the next.
let byTable;
let builders;
function queue(results) {
  byTable = Object.fromEntries(Object.entries(results).map(([t, list]) => [t, [...list]]));
  builders = [];
  mockSupabase.from.mockImplementation((table) => {
    const next = byTable[table]?.shift();
    if (!next) throw new Error(`Unexpected query on ${table}`);
    const b = makeBuilder(next);
    builders.push({ table, b });
    return b;
  });
}
const built = (table) => builders.filter((x) => x.table === table).map((x) => x.b);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
});

describe('GET /admin/events/:id/rsvps', () => {
  it('lists every RSVP for the event with name and email, plus the organiser', async () => {
    queue({
      event_rsvps: [{ data: [
        { user_id: 'u1', role: 'buyer', created_at: '2026-09-01T00:00:00Z', updated_at: null },
        { user_id: 'u2', role: 'vendor', created_at: '2026-09-02T00:00:00Z', updated_at: null },
      ], error: null }],
      events: [{ data: { id: EVENT_ID, organiser_id: ORG_ID }, error: null }],
      profiles: [
        { data: [
          { id: 'u1', username: 'ash', display_name: 'Ash K', avatar_url: null, email: 'ash@example.com' },
          { id: 'u2', username: 'misty', display_name: null, avatar_url: 'a.png', email: 'misty@example.com' },
        ], error: null },
        { data: { id: ORG_ID, username: 'collectors', display_name: "Collector's Paradise", is_admin: false }, error: null },
      ],
      event_organiser_verifications: [{ data: { user_id: ORG_ID }, error: null }],
    });

    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);

    expect(res.status).toBe(200);
    expect(built('event_rsvps')[0].calls).toContainEqual(['eq', 'event_id', EVENT_ID]);
    expect(built('profiles')[0].calls).toContainEqual(['in', 'id', ['u1', 'u2']]);
    expect(res.body.rsvps).toEqual([
      expect.objectContaining({ user_id: 'u1', role: 'buyer', display_name: 'Ash K', email: 'ash@example.com' }),
      expect.objectContaining({ user_id: 'u2', role: 'vendor', username: 'misty', email: 'misty@example.com' }),
    ]);
    expect(res.body.organiser).toEqual({
      id: ORG_ID, username: 'collectors', display_name: "Collector's Paradise", is_admin: false, verified: true,
    });
  });

  it('returns an empty list and no organiser without extra lookups', async () => {
    queue({
      event_rsvps: [{ data: [], error: null }],
      events: [{ data: { id: EVENT_ID, organiser_id: null }, error: null }],
    });
    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ organiser: null, rsvps: [] });
    expect(builders).toHaveLength(2);
  });

  it('rejects a non-uuid event id', async () => {
    queue({});
    const res = await request(app).get('/admin/events/not-a-uuid/rsvps');
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('is admin-only', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    queue({});
    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('answers 500 when the lookup fails', async () => {
    queue({
      event_rsvps: [{ data: null, error: { message: 'boom' } }],
      events: [{ data: null, error: null }],
    });
    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /admin/events/:id/organiser', () => {
  it('links the account matching a username', async () => {
    queue({
      profiles: [
        { data: [{ id: ORG_ID }], error: null },
        { data: { id: ORG_ID, username: 'collectors', display_name: null, is_admin: false }, error: null },
      ],
      events: [{ data: { id: EVENT_ID, organiser_id: ORG_ID }, error: null }],
      event_organiser_verifications: [{ data: null, error: null }],
    });

    const res = await request(app).patch(`/admin/events/${EVENT_ID}/organiser`).send({ identifier: '@collectors' });

    expect(res.status).toBe(200);
    expect(built('profiles')[0].calls).toContainEqual(['ilike', 'username', 'collectors']);
    expect(built('events')[0].calls).toContainEqual(['update', { organiser_id: ORG_ID }]);
    expect(built('events')[0].calls).toContainEqual(['eq', 'id', EVENT_ID]);
    expect(res.body.organiser).toMatchObject({ id: ORG_ID, verified: false });
  });

  it('looks up by email (lower-cased, LIKE wildcards escaped) when given one', async () => {
    queue({
      profiles: [
        { data: [{ id: ORG_ID }], error: null },
        { data: { id: ORG_ID, username: null, display_name: null, is_admin: false }, error: null },
      ],
      events: [{ data: { id: EVENT_ID, organiser_id: ORG_ID }, error: null }],
      event_organiser_verifications: [{ data: null, error: null }],
    });
    const res = await request(app).patch(`/admin/events/${EVENT_ID}/organiser`).send({ identifier: 'Jo_Shows@Example.com' });
    expect(res.status).toBe(200);
    expect(built('profiles')[0].calls).toContainEqual(['ilike', 'email', 'jo\\_shows@example.com']);
  });

  it('404s when no account matches', async () => {
    queue({ profiles: [{ data: [], error: null }] });
    const res = await request(app).patch(`/admin/events/${EVENT_ID}/organiser`).send({ identifier: 'nobody' });
    expect(res.status).toBe(404);
  });

  it('refuses an ambiguous match', async () => {
    queue({ profiles: [{ data: [{ id: 'a' }, { id: 'b' }], error: null }] });
    const res = await request(app).patch(`/admin/events/${EVENT_ID}/organiser`).send({ identifier: 'dupe' });
    expect(res.status).toBe(409);
  });

  it('requires an identifier', async () => {
    queue({});
    const res = await request(app).patch(`/admin/events/${EVENT_ID}/organiser`).send({ identifier: '  ' });
    expect(res.status).toBe(400);
  });
});

describe('PUT / DELETE /admin/event-organisers/:userId', () => {
  it('verifies an organiser, recording the admin', async () => {
    queue({ event_organiser_verifications: [{ data: null, error: null }] });
    const res = await request(app).put(`/admin/event-organisers/${ORG_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verified: true });
    expect(built('event_organiser_verifications')[0].calls[0]).toEqual([
      'upsert', { user_id: ORG_ID, verified_by: 'admin-1' }, { onConflict: 'user_id', ignoreDuplicates: true },
    ]);
  });

  it('removes a verification', async () => {
    queue({ event_organiser_verifications: [{ data: null, error: null }] });
    const res = await request(app).delete(`/admin/event-organisers/${ORG_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verified: false });
    expect(built('event_organiser_verifications')[0].calls).toContainEqual(['eq', 'user_id', ORG_ID]);
  });

  it('is admin-only', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    queue({});
    const res = await request(app).put(`/admin/event-organisers/${ORG_ID}`);
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
