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

// GET /admin/events/:id/rsvps — the admin "Who's going" list.

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

let builders;
function queue(...results) {
  builders = [];
  mockSupabase.from.mockImplementation((table) => {
    const b = makeBuilder(results[builders.length]);
    builders.push({ table, b });
    return b;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
});

describe('GET /admin/events/:id/rsvps', () => {
  it('lists every RSVP for the event with name and email', async () => {
    queue(
      { data: [
        { user_id: 'u1', role: 'buyer', created_at: '2026-09-01T00:00:00Z', updated_at: null },
        { user_id: 'u2', role: 'vendor', created_at: '2026-09-02T00:00:00Z', updated_at: null },
      ], error: null },
      { data: [
        { id: 'u1', username: 'ash', display_name: 'Ash K', avatar_url: null, email: 'ash@example.com' },
        { id: 'u2', username: 'misty', display_name: null, avatar_url: 'a.png', email: 'misty@example.com' },
      ], error: null },
    );

    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);

    expect(res.status).toBe(200);
    expect(builders.map((x) => x.table)).toEqual(['event_rsvps', 'profiles']);
    expect(builders[0].b.calls).toContainEqual(['eq', 'event_id', EVENT_ID]);
    expect(builders[1].b.calls).toContainEqual(['in', 'id', ['u1', 'u2']]);
    expect(res.body.rsvps).toEqual([
      expect.objectContaining({ user_id: 'u1', role: 'buyer', display_name: 'Ash K', email: 'ash@example.com' }),
      expect.objectContaining({ user_id: 'u2', role: 'vendor', username: 'misty', email: 'misty@example.com' }),
    ]);
  });

  it('returns an empty list without a profile lookup when nobody has RSVP\'d', async () => {
    queue({ data: [], error: null });
    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);
    expect(res.status).toBe(200);
    expect(res.body.rsvps).toEqual([]);
    expect(builders).toHaveLength(1);
  });

  it('rejects a non-uuid event id', async () => {
    queue();
    const res = await request(app).get('/admin/events/not-a-uuid/rsvps');
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('is admin-only', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    queue();
    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('answers 500 when the lookup fails', async () => {
    queue({ data: null, error: { message: 'boom' } });
    const res = await request(app).get(`/admin/events/${EVENT_ID}/rsvps`);
    expect(res.status).toBe(500);
  });
});
