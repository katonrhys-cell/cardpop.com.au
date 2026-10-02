import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockSendEventSubmitted = vi.hoisted(() => vi.fn());
const mockGetAdminEmails = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));
vi.mock('../../src/utils/emailService.js', () => ({ sendEventSubmitted: mockSendEventSubmitted }));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: mockGetAdminEmails }));

import eventsRouter from '../../src/routes/events.js';

// GET /events/:id/vendors — a verified organiser's vendor list.

const app = express();
app.use(express.json());
app.use('/', eventsRouter);

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

beforeEach(() => { vi.clearAllMocks(); });

const ownEvent = { data: { id: EVENT_ID, organiser_id: 'user-1' }, error: null };
const verified = { data: { user_id: 'user-1' }, error: null };
const notVerified = { data: null, error: null };

describe('GET /events/:id/vendors', () => {
  it('lists vendors (no emails) for a verified organiser of the event', async () => {
    queue({
      events: [ownEvent],
      event_organiser_verifications: [verified],
      event_rsvps: [{ data: [{ user_id: 'v1', created_at: '2026-09-01T00:00:00Z' }], error: null }],
      profiles: [{ data: [{ id: 'v1', username: 'misty', display_name: 'Misty Cards', avatar_url: null }], error: null }],
    });

    const res = await request(app).get(`/${EVENT_ID}/vendors`);

    expect(res.status).toBe(200);
    expect(res.body.vendors).toEqual([
      { user_id: 'v1', created_at: '2026-09-01T00:00:00Z', username: 'misty', display_name: 'Misty Cards', avatar_url: null },
    ]);
    const rsvpQuery = builders.find((x) => x.table === 'event_rsvps').b.calls;
    expect(rsvpQuery).toContainEqual(['eq', 'event_id', EVENT_ID]);
    expect(rsvpQuery).toContainEqual(['eq', 'role', 'vendor']);
    const profileSelect = builders.find((x) => x.table === 'profiles').b.calls.find((c) => c[0] === 'select');
    expect(profileSelect[1]).not.toMatch(/email/);
  });

  it('403s for an organiser who is not verified', async () => {
    queue({ events: [ownEvent], event_organiser_verifications: [notVerified] });
    const res = await request(app).get(`/${EVENT_ID}/vendors`);
    expect(res.status).toBe(403);
    expect(builders.some((x) => x.table === 'event_rsvps')).toBe(false);
  });

  it('403s for a verified organiser of a different event', async () => {
    queue({
      events: [{ data: { id: EVENT_ID, organiser_id: 'someone-else' }, error: null }],
      event_organiser_verifications: [verified],
    });
    const res = await request(app).get(`/${EVENT_ID}/vendors`);
    expect(res.status).toBe(403);
    expect(builders.some((x) => x.table === 'event_rsvps')).toBe(false);
  });

  it('404s for an unknown event', async () => {
    queue({ events: [{ data: null, error: null }], event_organiser_verifications: [verified] });
    const res = await request(app).get(`/${EVENT_ID}/vendors`);
    expect(res.status).toBe(404);
  });

  it('400s on a non-uuid id', async () => {
    queue({});
    const res = await request(app).get('/not-a-uuid/vendors');
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
