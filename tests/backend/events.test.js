import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockSendEventSubmitted = vi.hoisted(() => vi.fn());
const mockSendOutcome = vi.hoisted(() => vi.fn());
const mockSendChangesMade = vi.hoisted(() => vi.fn());
const mockIsAdmin = vi.hoisted(() => ({ value: true }));
const mockGetAdminEmails = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAdmin: (_req, res, next) => (mockIsAdmin.value ? next() : res.status(403).json({ error: 'Admin access required' })),
}));
vi.mock('../../src/utils/emailService.js', () => ({
  sendEventSubmitted: mockSendEventSubmitted,
  sendEventReviewOutcome: mockSendOutcome,
  sendEventChangesMade: mockSendChangesMade,
}));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: mockGetAdminEmails }));

import eventsRouter from '../../src/routes/events.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', eventsRouter);
  return app;
}
const app = makeApp();

const pendingEvent = {
  id: 'evt-1',
  title: 'Sydney Card Show',
  event_type: 'card_show',
  status: 'pending_review',
  suburb: 'Parramatta',
  state: 'NSW',
  start_date: '2026-09-01',
  organiser_id: 'user-1',
  organizer_name: 'Jane',
  organizer_email: 'jane@example.com',
};

let builders;
beforeEach(() => {
  vi.clearAllMocks();
  mockSendEventSubmitted.mockResolvedValue(true);
  mockGetAdminEmails.mockResolvedValue(['notifications@cardpop.com.au']);
  builders = [];
  mockSupabase.from.mockImplementation(() => {
    const next = builders.shift();
    if (!next) throw new Error('Unexpected supabase query');
    return next;
  });
});

describe('POST /events/notify-submission', () => {
  // chain() is defined below (function declaration — hoisted).
  it('emails every admin notification address about the submitter\'s new event, once', async () => {
    const claim = chain({ data: [{ id: 'evt-1' }], error: null });
    builders.push(
      chain({ data: pendingEvent, error: null }),
      claim,
      chain({ data: { email: 'jane@example.com', display_name: 'Jane', is_admin: false }, error: null }),
    );

    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(claim.calls).toContainEqual(['is', 'admins_notified_at', null]);
    expect(mockSendEventSubmitted).toHaveBeenCalledWith({
      to: ['notifications@cardpop.com.au'],
      event: pendingEvent,
      addedBy: 'Jane',
      byAdmin: false,
    });
  });

  it('emails the other admins about an admin\'s own live event, not the admin who added it', async () => {
    mockGetAdminEmails.mockResolvedValue(['Rhys@cardpop.com.au', 'second@cardpop.com.au', 'notifications@cardpop.com.au']);
    builders.push(
      chain({ data: { ...pendingEvent, status: 'approved' }, error: null }),
      chain({ data: [{ id: 'evt-1' }], error: null }),
      chain({ data: { email: 'rhys@cardpop.com.au', display_name: 'Rhys', is_admin: true }, error: null }),
    );
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.status).toBe(200);
    expect(mockSendEventSubmitted).toHaveBeenCalledWith(expect.objectContaining({
      to: ['second@cardpop.com.au', 'notifications@cardpop.com.au'],
      byAdmin: true,
    }));
  });

  it('requires an eventId', async () => {
    const res = await request(app).post('/notify-submission').send({});
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('404s when the event does not exist', async () => {
    builders.push(chain({ data: null, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'nope' });
    expect(res.status).toBe(404);
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });

  it('forbids notifying for an event the caller did not add', async () => {
    builders.push(chain({ data: { ...pendingEvent, organiser_id: 'someone-else' }, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.status).toBe(403);
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });

  it('does not email twice for the same submission', async () => {
    builders.push(chain({ data: { ...pendingEvent, admins_notified_at: '2026-11-10T00:00:00Z' }, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.body).toEqual({ ok: true, skipped: 'already_sent' });
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });

  it('loses the race quietly when another call claimed the send first', async () => {
    builders.push(chain({ data: pendingEvent, error: null }), chain({ data: [], error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.body).toEqual({ ok: true, skipped: 'already_sent' });
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });

  it('leaves the nightly scanner\'s finds to their own queue', async () => {
    builders.push(chain({ data: { ...pendingEvent, auto_discovered: true }, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.body).toEqual({ ok: true, skipped: 'auto_discovered' });
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });
});

// ─── Organiser review emails (docs/event-submissions.md) ──────────────────────

/** A chainable, awaitable query builder that records calls and resolves `result`. */
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

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';

describe('POST /events/:id/notify-decision', () => {
  beforeEach(() => { mockIsAdmin.value = true; mockSendOutcome.mockResolvedValue(true); });

  const decided = { id: EVENT_ID, title: 'CollectFest Sydney', slug: 'collectfest-sydney', status: 'rejected',
    organiser_id: 'org-1', rejection_reason: 'Already listed', organiser_notified_status: null };

  it('emails the organiser the rejection reason, once', async () => {
    const claim = chain({ data: [{ id: EVENT_ID }], error: null });
    builders.push(
      chain({ data: decided, error: null }),
      chain({ data: { id: 'org-1', email: 'bec@example.com', display_name: 'Bec' }, error: null }),
      chain({ data: null, error: null }),
      claim,
    );
    const res = await request(app).post(`/${EVENT_ID}/notify-decision`);
    expect(res.status).toBe(200);
    expect(claim.calls).toContainEqual(['update', { organiser_notified_status: 'rejected' }]);
    expect(mockSendOutcome).toHaveBeenCalledWith(expect.objectContaining({
      to: 'bec@example.com', name: 'Bec', approved: false, note: 'Already listed',
    }));
  });

  it('does not email twice for the same outcome', async () => {
    builders.push(chain({ data: { ...decided, organiser_notified_status: 'rejected' }, error: null }));
    const res = await request(app).post(`/${EVENT_ID}/notify-decision`);
    expect(res.body.skipped).toBe('already_sent');
    expect(mockSendOutcome).not.toHaveBeenCalled();
  });

  it('respects the organiser turning the email off', async () => {
    builders.push(
      chain({ data: { ...decided, status: 'approved' }, error: null }),
      chain({ data: { id: 'org-1', email: 'bec@example.com' }, error: null }),
      chain({ data: { email: false }, error: null }),
      chain({ data: [{ id: EVENT_ID }], error: null }),
    );
    const res = await request(app).post(`/${EVENT_ID}/notify-decision`);
    expect(res.body.skipped).toBe('no_recipient');
    expect(mockSendOutcome).not.toHaveBeenCalled();
  });

  it('is admin-only', async () => {
    mockIsAdmin.value = false;
    const res = await request(app).post(`/${EVENT_ID}/notify-decision`);
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('POST /events/:id/notify-changes', () => {
  beforeEach(() => { mockSendChangesMade.mockResolvedValue(true); });

  it('emails every admin exactly what the organiser changed, merged and once', async () => {
    const claim = chain({ data: [
      { id: 'log-1', created_at: '2026-11-10T01:00:00Z', changes: { start_time: { from: '10:00:00', to: '09:30:00' } } },
      { id: 'log-2', created_at: '2026-11-10T01:00:01Z', changes: { discount_code: { from: 'CARDPOP10', to: 'CARDPOP15' } } },
    ], error: null });
    builders.push(
      chain({ data: { id: EVENT_ID, title: 'CollectFest Sydney', slug: 'collectfest-sydney', organiser_id: 'user-1' }, error: null }),
      claim,
      chain({ data: { display_name: 'Bec' }, error: null }),
    );
    const res = await request(app).post(`/${EVENT_ID}/notify-changes`);
    expect(res.status).toBe(200);
    expect(claim.calls).toContainEqual(['eq', 'changed_by', 'user-1']);
    expect(claim.calls).toContainEqual(['is', 'admins_emailed_at', null]);
    expect(mockSendChangesMade).toHaveBeenCalledWith({
      to: ['notifications@cardpop.com.au'],
      event: expect.objectContaining({ title: 'CollectFest Sydney', url: 'https://cardpop.com.au/events/collectfest-sydney' }),
      editorName: 'Bec',
      rows: [
        { label: 'Start time', from: '10:00', to: '09:30' },
        { label: 'Member ticket code', from: 'CARDPOP10', to: 'CARDPOP15' },
      ],
    });
  });

  it('refuses someone else\'s event', async () => {
    builders.push(chain({ data: { id: EVENT_ID, organiser_id: 'someone-else' }, error: null }));
    const res = await request(app).post(`/${EVENT_ID}/notify-changes`);
    expect(res.status).toBe(403);
    expect(mockSendChangesMade).not.toHaveBeenCalled();
  });

  it('sends nothing when there is nothing new', async () => {
    builders.push(
      chain({ data: { id: EVENT_ID, organiser_id: 'user-1' }, error: null }),
      chain({ data: [], error: null }),
    );
    const res = await request(app).post(`/${EVENT_ID}/notify-changes`);
    expect(res.body.skipped).toBe('nothing_new');
    expect(mockSendChangesMade).not.toHaveBeenCalled();
  });
});
