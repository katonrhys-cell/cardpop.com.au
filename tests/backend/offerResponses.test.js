import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// PATCH /offers/:id — every response to an offer goes through here so the
// other party is emailed. RLS + the lifecycle trigger still enforce the move;
// these tests cover who may do what, the race/expiry answers, and the emails.

const mockSendOfferUpdate = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/emailService.js', () => ({
  sendOfferReceived: vi.fn(),
  sendOfferPlaced: vi.fn(),
  sendOfferAdminNotice: vi.fn(),
  sendOfferUpdate: mockSendOfferUpdate,
}));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: vi.fn(async () => []) }));

const mockGetUser = vi.hoisted(() => vi.fn());
const mockOfferRead = vi.hoisted(() => vi.fn());
const mockListing = vi.hoisted(() => vi.fn());
const mockProfiles = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => {
  const client = {
    auth: { getUser: mockGetUser },
    from: (table) => {
      if (table === 'offers') return { select: () => ({ eq: () => ({ maybeSingle: mockOfferRead }) }) };
      if (table === 'listings') return { select: () => ({ eq: () => ({ maybeSingle: mockListing }) }) };
      return { select: () => ({ in: mockProfiles }) };
    },
  };
  return { default: client, supabase: client };
});

// The caller-scoped update: .update(payload).eq(id).eq(owner).eq(status).select().maybeSingle()
const mockUpdateResult = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEqs = vi.hoisted(() => []);
vi.mock('../../src/utils/userScopedSupabase.js', () => {
  const chain = () => {
    const c = {
      eq: (col, val) => { mockEqs.push([col, val]); return c; },
      select: () => ({ maybeSingle: mockUpdateResult }),
    };
    return c;
  };
  const client = { from: () => ({ update: (payload) => { mockUpdate(payload); return chain(); } }) };
  return { default: () => client, createUserScopedClient: () => client };
});

import offersRouter, { OFFER_ACTIONS } from '../../src/routes/offers.js';

const app = express();
app.use(express.json());
app.use('/', offersRouter);

const BUYER = '11111111-1111-4111-8111-111111111111';
const SELLER = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const OFFER = '44444444-4444-4444-8444-444444444444';

const row = (extra = {}) => ({
  id: OFFER, listing_id: LISTING, buyer_id: BUYER, seller_id: SELLER,
  amount_aud: 4000, counter_amount_aud: null, counter_message: null, message: null,
  status: 'pending', expires_at: '2026-10-01T07:00:00.000Z', payment_due_at: null, paid_at: null,
  created_at: '2026-09-29T07:00:00.000Z',
  ...extra,
});

const as = (userId) => mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
const patch = (body) => request(app).patch(`/${OFFER}`).set('Authorization', 'Bearer tok').send(body);

beforeEach(() => {
  vi.clearAllMocks();
  mockEqs.length = 0;
  mockListing.mockResolvedValue({ data: { status: 'active', listing_type: 'fixed', price_aud: 4999, vault_item: { card_name: 'Kevin Durant RC' } } });
  mockProfiles.mockResolvedValue({
    data: [
      { id: SELLER, email: 'seller@example.com', display_name: 'Kat' },
      { id: BUYER, email: 'buyer@example.com', display_name: 'Ash' },
    ],
  });
  mockSendOfferUpdate.mockResolvedValue(true);
});

describe('PATCH /offers/:id — who may do what', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).patch(`/${OFFER}`).send({ action: 'accept' });
    expect(res.status).toBe(401);
  });

  it.each([
    ['an unknown action', { action: 'buy_it_for_1' }],
    ['a prototype key as the action', { action: '__proto__' }],
    ['a counter without an amount', { action: 'counter' }],
    ['a zero counter', { action: 'counter', counterAmountAud: 0 }],
    ['an over-long counter message', { action: 'counter', counterAmountAud: 10, counterMessage: 'x'.repeat(1001) }],
  ])('400s %s', async (_label, body) => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row() });
    expect((await patch(body)).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('400s a malformed offer id', async () => {
    as(SELLER);
    const res = await request(app).patch('/nope').set('Authorization', 'Bearer tok').send({ action: 'accept' });
    expect(res.status).toBe(400);
  });

  it.each([
    ['the buyer accepting their own offer', BUYER, 'accept'],
    ['the buyer countering', BUYER, 'counter'],
    ['the seller withdrawing the buyer’s offer', SELLER, 'withdraw'],
    ['the seller accepting their own counter', SELLER, 'accept_counter'],
    ['a stranger', '99999999-9999-4999-8999-999999999999', 'accept'],
  ])('404s %s (same answer as a missing offer)', async (_label, user, action) => {
    as(user);
    mockOfferRead.mockResolvedValue({ data: row({ status: action.includes('counter') && action !== 'counter' ? 'countered' : 'pending' }) });
    const res = await patch({ action, counterAmountAud: 10 });
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('404s an offer that does not exist', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: null });
    expect((await patch({ action: 'accept' })).status).toBe(404);
  });

  it('409s a move from the wrong state (e.g. accepting an already-declined offer)', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row({ status: 'declined' }) });
    const res = await patch({ action: 'accept' });
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH /offers/:id — the write', () => {
  it('scopes the update to the offer, the caller’s side and the expected status', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row() });
    mockUpdateResult.mockResolvedValue({ data: row({ status: 'accepted', payment_due_at: '2026-10-01T09:00:00.000Z' }), error: null });
    const res = await patch({ action: 'accept' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'accepted' });
    expect(mockEqs).toEqual([['id', OFFER], ['seller_id', SELLER], ['status', 'pending']]);
  });

  it('sends a counter rounded to cents with the trimmed message, and nothing else', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row() });
    mockUpdateResult.mockResolvedValue({ data: row({ status: 'countered', counter_amount_aud: 4500.13 }), error: null });
    await patch({ action: 'counter', counterAmountAud: 4500.129, counterMessage: '  meet me here  ', payment_due_at: '2099-01-01' });
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'countered', counter_amount_aud: 4500.13, counter_message: 'meet me here' });
  });

  it('409s when the database says the offer has expired', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row() });
    mockUpdateResult.mockResolvedValue({ data: null, error: { message: 'This offer has expired' } });
    const res = await patch({ action: 'accept' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/expired/);
    expect(mockSendOfferUpdate).not.toHaveBeenCalled();
  });

  it('409s when the other side got there first (no row updated)', async () => {
    as(BUYER);
    mockOfferRead.mockResolvedValue({ data: row() });
    mockUpdateResult.mockResolvedValue({ data: null, error: null });
    const res = await patch({ action: 'withdraw' });
    expect(res.status).toBe(409);
    expect(mockSendOfferUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH /offers/:id — emails', () => {
  const sentTo = () => mockSendOfferUpdate.mock.calls.map(([a]) => [a.to, a.kind, a.audience]);

  it('accept → emails the buyer to pay, with the payment deadline', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row() });
    mockUpdateResult.mockResolvedValue({ data: row({ status: 'accepted', payment_due_at: '2026-10-01T09:00:00.000Z' }), error: null });
    const res = await patch({ action: 'accept' });
    expect(res.body.emailed).toEqual({ buyer: true });
    expect(sentTo()).toEqual([['buyer@example.com', 'accepted', 'buyer']]);
    const args = mockSendOfferUpdate.mock.calls[0][0];
    expect(args).toMatchObject({ cardName: 'Kevin Durant RC', amountAud: 4000, recipientName: 'Ash' });
    expect(args.deadline).toMatch(/2026/);
  });

  it('counter → emails the buyer the counter and the respond-by time', async () => {
    as(SELLER);
    mockOfferRead.mockResolvedValue({ data: row() });
    mockUpdateResult.mockResolvedValue({ data: row({ status: 'countered', counter_amount_aud: 4500, counter_message: 'meet me here', expires_at: '2026-10-02T01:00:00.000Z' }), error: null });
    await patch({ action: 'counter', counterAmountAud: 4500, counterMessage: 'meet me here' });
    expect(sentTo()).toEqual([['buyer@example.com', 'countered', 'buyer']]);
    expect(mockSendOfferUpdate.mock.calls[0][0]).toMatchObject({ counterAmountAud: 4500, counterMessage: 'meet me here', deadline: expect.stringMatching(/2026/) });
  });

  it('accept_counter → emails both sides: the seller that it’s agreed, the buyer to pay', async () => {
    as(BUYER);
    mockOfferRead.mockResolvedValue({ data: row({ status: 'countered', counter_amount_aud: 4500 }) });
    mockUpdateResult.mockResolvedValue({ data: row({ status: 'accepted', counter_amount_aud: 4500, payment_due_at: '2026-10-01T09:00:00.000Z' }), error: null });
    const res = await patch({ action: 'accept_counter' });
    expect(res.status).toBe(200);
    expect(sentTo()).toEqual([
      ['seller@example.com', 'counter_accepted', 'seller'],
      ['buyer@example.com', 'counter_accepted', 'buyer'],
    ]);
    expect(res.body.emailed).toEqual({ seller: true, buyer: true });
  });

  it.each([
    ['decline', SELLER, 'pending', 'declined', 'buyer@example.com'],
    ['decline_counter', BUYER, 'countered', 'counter_declined', 'seller@example.com'],
    ['withdraw', BUYER, 'pending', 'withdrawn', 'seller@example.com'],
  ])('%s → emails the other side (%s acting)', async (action, actor, from, kind, to) => {
    as(actor);
    mockOfferRead.mockResolvedValue({ data: row({ status: from }) });
    mockUpdateResult.mockResolvedValue({ data: row({ status: OFFER_ACTIONS[action].to }), error: null });
    await patch({ action });
    expect(sentTo()).toEqual([[to, kind, to.startsWith('buyer') ? 'buyer' : 'seller']]);
  });

  it('still succeeds when an email throws or the recipient has no address', async () => {
    as(BUYER);
    mockOfferRead.mockResolvedValue({ data: row({ status: 'countered', counter_amount_aud: 4500 }) });
    mockUpdateResult.mockResolvedValue({ data: row({ status: 'accepted', counter_amount_aud: 4500 }), error: null });
    mockProfiles.mockResolvedValue({ data: [{ id: BUYER, email: 'buyer@example.com' }] });
    mockSendOfferUpdate.mockRejectedValue(new Error('Resend down'));
    const res = await patch({ action: 'accept_counter' });
    expect(res.status).toBe(200);
    expect(res.body.emailed).toEqual({ seller: false, buyer: false });
  });
});
