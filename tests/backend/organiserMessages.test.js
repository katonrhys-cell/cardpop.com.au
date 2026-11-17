import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockAlert = vi.hoisted(() => vi.fn());
const mockSendMessage = vi.hoisted(() => vi.fn());
const mockScan = vi.hoisted(() => vi.fn());
const userRef = vi.hoisted(() => ({ current: null }));

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = userRef.current; next(); },
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAdmin: (_req, _res, next) => next(),
}));
vi.mock('../../src/services/adminReviewAlerts.js', () => ({ alertAdminsToReview: mockAlert }));
vi.mock('../../src/utils/emailService.js', () => ({ sendOrganiserMessage: mockSendMessage }));
vi.mock('../../src/utils/organiserMessageScan.js', () => ({ scanOrganiserMessage: mockScan }));

import router from '../../src/routes/organiser-messages.js';

const app = express();
app.use(express.json());
app.use('/', router);

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
const ok = (data) => ({ data, error: null });
const counted = (count) => ({ count, error: null });
const callsOn = (table, method) => builders
  .filter((x) => x.table === table).flatMap((x) => x.b.calls.filter((c) => c[0] === method));

const ORG_ID = '33333333-3333-4333-8333-333333333333';
const MSG_ID = '44444444-4444-4444-8444-444444444444';
const sender = { id: 'user-1', email: 'maya@example.com', email_confirmed_at: '2026-11-01T00:00:00Z', user_metadata: { full_name: 'Maya Chen' } };
const ownedOrg = { id: ORG_ID, name: 'Collect-It Con', slug: 'collect-it-con', owner_id: 'owner-9' };
const unownedOrg = { ...ownedOrg, owner_id: null };
const body = { organiserId: ORG_ID, topic: 'feedback', message: 'Loved the show, but the queue to get in was far too long.' };
const savedRow = (over = {}) => ({
  id: MSG_ID, organiser_id: ORG_ID, sender_id: 'user-1', sender_name: 'Maya', sender_email: 'maya@example.com',
  topic: 'feedback', body: body.message, status: 'delivered', scan_verdict: 'clean', ...over,
});
const CLEAN = { verdict: 'clean', category: null, reason: null };

// The queries a successful send makes, in order, per table.
const sendQueue = (org, saved, extra = {}) => ({
  event_organisers: [ok(org)],
  organiser_messages: [counted(0), counted(0), ok(saved)],
  profiles: [ok({ display_name: 'Maya', username: 'maya' }), ok({ email: 'owner@show.com.au', display_name: 'Sam' })],
  notifications: [{ error: null }],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  userRef.current = sender;
  mockScan.mockResolvedValue(CLEAN);
  mockSendMessage.mockResolvedValue(true);
  mockAlert.mockResolvedValue({ belled: 1, emailed: true });
});

describe('POST /organiser-messages', () => {
  it('delivers a clean message to the page owner: saved, belled and emailed with reply-to the sender', async () => {
    queue(sendQueue(ownedOrg, savedRow()));
    const res = await request(app).post('/').send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    const [, row] = callsOn('organiser_messages', 'insert')[0];
    expect(row).toMatchObject({
      organiser_id: ORG_ID, sender_id: 'user-1', sender_email: 'maya@example.com', sender_name: 'Maya',
      status: 'delivered', recipient_id: 'owner-9', scan_verdict: 'clean',
    });
    const [, bell] = callsOn('notifications', 'insert')[0];
    expect(bell).toMatchObject({ user_id: 'owner-9', type: 'organiser_message', link: '/events/organisers/collect-it-con#messages' });
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@show.com.au', senderEmail: 'maya@example.com', organiserName: 'Collect-It Con', message: body.message,
    }));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('sends a clean message for an unclaimed page to the CardPop admins instead', async () => {
    queue(sendQueue(unownedOrg, savedRow({ status: 'forwarded' })));
    const res = await request(app).post('/').send(body);

    expect(res.status).toBe(201);
    expect(callsOn('organiser_messages', 'insert')[0][1]).toMatchObject({ status: 'forwarded', recipient_id: null });
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'organiser_message_review', path: '/admin/organiser-messages', relatedId: MSG_ID,
    }));
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(callsOn('notifications', 'insert')).toHaveLength(0);
  });

  it('holds a flagged message: the organiser hears nothing, admins are told why, the sender gets the same answer', async () => {
    mockScan.mockResolvedValue({ verdict: 'flagged', category: 'harassment', reason: 'Personal insults aimed at the organiser.' });
    queue(sendQueue(ownedOrg, savedRow({ status: 'held', scan_verdict: 'flagged' })));
    const res = await request(app).post('/').send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(callsOn('organiser_messages', 'insert')[0][1]).toMatchObject({
      status: 'held', recipient_id: null, scan_verdict: 'flagged', scan_category: 'harassment',
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(callsOn('notifications', 'insert')).toHaveLength(0);
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'organiser_message_review', title: 'Organiser message held for review' }));
  });

  it('fails closed: a message the screen could not check is held, not delivered', async () => {
    mockScan.mockResolvedValue({ verdict: 'unscanned', category: null, reason: 'The screen could not run.' });
    queue(sendQueue(ownedOrg, savedRow({ status: 'held', scan_verdict: 'unscanned' })));
    const res = await request(app).post('/').send(body);

    expect(res.status).toBe(201);
    expect(callsOn('organiser_messages', 'insert')[0][1]).toMatchObject({ status: 'held', scan_verdict: 'unscanned' });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('refuses an unconfirmed email, the page owner writing to themselves, and an unknown organiser', async () => {
    userRef.current = { ...sender, email_confirmed_at: null };
    queue({});
    expect((await request(app).post('/').send(body)).status).toBe(403);

    userRef.current = { ...sender, id: 'owner-9' };
    queue({ event_organisers: [ok(ownedOrg)] });
    expect((await request(app).post('/').send(body)).status).toBe(400);

    userRef.current = sender;
    queue({ event_organisers: [ok(null)] });
    expect((await request(app).post('/').send(body)).status).toBe(404);
    expect(mockScan).not.toHaveBeenCalled();
  });

  it('limits messages per organiser and per day before spending a screen on them', async () => {
    queue({ event_organisers: [ok(ownedOrg)], organiser_messages: [counted(3), counted(3)] });
    const perOrganiser = await request(app).post('/').send(body);
    expect(perOrganiser.status).toBe(429);
    expect(perOrganiser.body.error).toMatch(/3 messages a day/);

    queue({ event_organisers: [ok(ownedOrg)], organiser_messages: [counted(0), counted(10)] });
    expect((await request(app).post('/').send(body)).status).toBe(429);
    expect(mockScan).not.toHaveBeenCalled();
  });

  it('validates the body', async () => {
    queue({});
    expect((await request(app).post('/').send({ ...body, message: 'too short' })).status).toBe(400);
    expect((await request(app).post('/').send({ ...body, topic: 'rant' })).status).toBe(400);
    expect((await request(app).post('/').send({ ...body, organiserId: 'nope' })).status).toBe(400);
  });
});

describe('GET /organiser-messages/inbox', () => {
  it('returns only delivered and released messages addressed to the caller', async () => {
    userRef.current = { ...sender, id: 'owner-9' };
    queue({
      event_organisers: [ok(ownedOrg)],
      organiser_messages: [ok([{ id: MSG_ID, sender_name: 'Maya', sender_email: 'maya@example.com', topic: 'feedback', body: 'Hi', created_at: '2026-11-16T00:00:00Z' }])],
    });
    const res = await request(app).get('/inbox');

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(callsOn('organiser_messages', 'in')[0]).toEqual(['in', 'status', ['delivered', 'released']]);
    expect(callsOn('organiser_messages', 'eq')).toContainEqual(['eq', 'recipient_id', 'owner-9']);
    // No screening detail in what the organiser reads.
    expect(callsOn('organiser_messages', 'select')[0][1]).not.toMatch(/scan_/);
  });

  it('is empty for a member who owns no organiser page', async () => {
    queue({ event_organisers: [ok(null)] });
    const res = await request(app).get('/inbox');
    expect(res.body).toEqual({ organiser: null, messages: [] });
  });
});

describe('PATCH /organiser-messages/admin/:id', () => {
  beforeEach(() => { userRef.current = { ...sender, id: 'admin-1' }; });
  const held = savedRow({ status: 'held', scan_verdict: 'flagged' });

  it('release delivers a held message to the page owner', async () => {
    queue({
      organiser_messages: [ok(held), ok([{ id: MSG_ID }])],
      event_organisers: [ok(ownedOrg)],
      notifications: [{ error: null }],
      profiles: [ok({ email: 'owner@show.com.au', display_name: 'Sam' })],
    });
    const res = await request(app).patch(`/admin/${MSG_ID}`).send({ action: 'release' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('released');
    expect(callsOn('organiser_messages', 'update')[0][1]).toMatchObject({ status: 'released', recipient_id: 'owner-9', reviewed_by: 'admin-1' });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it('release on an unclaimed page keeps it with CardPop', async () => {
    queue({ organiser_messages: [ok(held), ok([{ id: MSG_ID }])], event_organisers: [ok(unownedOrg)] });
    const res = await request(app).patch(`/admin/${MSG_ID}`).send({ action: 'release' });
    expect(res.body.status).toBe('forwarded');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('dismiss closes it without telling anyone', async () => {
    queue({ organiser_messages: [ok(held), ok([{ id: MSG_ID }])] });
    const res = await request(app).patch(`/admin/${MSG_ID}`).send({ action: 'dismiss' });
    expect(res.body.status).toBe('dismissed');
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(callsOn('notifications', 'insert')).toHaveLength(0);
  });

  it('refuses a message that is not held, or that another admin just decided', async () => {
    queue({ organiser_messages: [ok(savedRow())] });
    expect((await request(app).patch(`/admin/${MSG_ID}`).send({ action: 'dismiss' })).status).toBe(409);

    queue({ organiser_messages: [ok(held), ok([])] });
    expect((await request(app).patch(`/admin/${MSG_ID}`).send({ action: 'dismiss' })).status).toBe(409);
  });
});
