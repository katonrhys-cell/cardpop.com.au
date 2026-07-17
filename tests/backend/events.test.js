import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockSendEventSubmitted = vi.hoisted(() => vi.fn());
const mockGetAdminEmail = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next(); },
}));
vi.mock('../../src/utils/emailService.js', () => ({ sendEventSubmitted: mockSendEventSubmitted }));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmail: mockGetAdminEmail }));

import eventsRouter from '../../src/routes/events.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', eventsRouter);
  return app;
}
const app = makeApp();

function makeBuilder(result = { data: null, error: null }) {
  const b = {};
  for (const m of ['select', 'eq']) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  return b;
}

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
  mockGetAdminEmail.mockResolvedValue('notifications@cardpop.com.au');
  builders = [];
  mockSupabase.from.mockImplementation(() => {
    const next = builders.shift();
    if (!next) throw new Error('Unexpected supabase query');
    return next;
  });
});

describe('POST /events/notify-submission', () => {
  it('emails the resolved admin notification address for the submitter\'s pending event', async () => {
    builders.push(makeBuilder({ data: pendingEvent, error: null }));

    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockSendEventSubmitted).toHaveBeenCalledWith({
      to: 'notifications@cardpop.com.au',
      event: pendingEvent,
    });
  });

  it('requires an eventId', async () => {
    const res = await request(app).post('/notify-submission').send({});
    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('404s when the event does not exist', async () => {
    builders.push(makeBuilder({ data: null, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'nope' });
    expect(res.status).toBe(404);
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });

  it('forbids notifying for an event the caller did not submit', async () => {
    builders.push(makeBuilder({ data: { ...pendingEvent, organiser_id: 'someone-else' }, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.status).toBe(403);
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });

  it('skips (no email) when the event is not pending review', async () => {
    builders.push(makeBuilder({ data: { ...pendingEvent, status: 'approved' }, error: null }));
    const res = await request(app).post('/notify-submission').send({ eventId: 'evt-1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, skipped: 'not_pending' });
    expect(mockSendEventSubmitted).not.toHaveBeenCalled();
  });
});
