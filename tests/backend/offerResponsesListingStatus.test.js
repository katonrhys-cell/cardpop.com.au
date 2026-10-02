import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// PATCH /offers/:id must refuse accept / counter / accept_counter once the
// listing has sold or been taken down, but still let a dead offer be closed
// (decline / decline_counter / withdraw).

vi.mock('../../src/utils/emailService.js', () => ({
  sendOfferReceived: vi.fn(),
  sendOfferPlaced: vi.fn(),
  sendOfferAdminNotice: vi.fn(),
  sendOfferUpdate: vi.fn(async () => true),
}));
vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({ getAdminNotificationEmails: vi.fn(async () => []) }));

const mockGetUser = vi.hoisted(() => vi.fn());
const mockOfferRead = vi.hoisted(() => vi.fn());
const mockListing = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => {
  const client = {
    auth: { getUser: mockGetUser },
    from: (table) => {
      if (table === 'offers') return { select: () => ({ eq: () => ({ maybeSingle: mockOfferRead }) }) };
      if (table === 'listings') return { select: () => ({ eq: () => ({ maybeSingle: mockListing }) }) };
      return { select: () => ({ in: async () => ({ data: [] }) }) };
    },
  };
  return { default: client, supabase: client };
});

const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpdateResult = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/userScopedSupabase.js', () => {
  const chain = () => {
    const c = { eq: () => c, select: () => ({ maybeSingle: mockUpdateResult }) };
    return c;
  };
  const client = { from: () => ({ update: (payload) => { mockUpdate(payload); return chain(); } }) };
  return { default: () => client, createUserScopedClient: () => client };
});

import offersRouter from '../../src/routes/offers.js';

const app = express();
app.use(express.json());
app.use('/', offersRouter);

const BUYER = '11111111-1111-4111-8111-111111111111';
const SELLER = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const OFFER = '44444444-4444-4444-8444-444444444444';

const row = (status) => ({
  id: OFFER, listing_id: LISTING, buyer_id: BUYER, seller_id: SELLER, amount_aud: 40,
  counter_amount_aud: status === 'countered' ? 45 : null, status,
});
const as = (userId) => mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
const patch = (body) => request(app).patch(`/${OFFER}`).set('Authorization', 'Bearer tok').send(body);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateResult.mockImplementation(async () => ({ data: row('declined'), error: null }));
});

describe.each(['sold', 'archived', 'pending'])('listing is %s', (listingStatus) => {
  beforeEach(() => {
    mockListing.mockResolvedValue({ data: { status: listingStatus }, error: null });
  });

  it.each([
    ['accept', SELLER, 'pending', {}],
    ['counter', SELLER, 'pending', { counterAmountAud: 45 }],
    ['accept_counter', BUYER, 'countered', {}],
  ])('refuses %s with 409', async (action, who, offerStatus, extra) => {
    as(who);
    mockOfferRead.mockResolvedValue({ data: row(offerStatus), error: null });
    const res = await patch({ action, ...extra });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no longer available/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['decline', SELLER, 'pending'],
    ['decline_counter', BUYER, 'countered'],
    ['withdraw', BUYER, 'pending'],
  ])('still allows %s', async (action, who, offerStatus) => {
    as(who);
    mockOfferRead.mockResolvedValue({ data: row(offerStatus), error: null });
    const res = await patch({ action });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

it('allows accept while the listing is active', async () => {
  as(SELLER);
  mockOfferRead.mockResolvedValue({ data: row('pending'), error: null });
  mockListing.mockResolvedValue({ data: { status: 'active' }, error: null });
  mockUpdateResult.mockResolvedValue({ data: row('accepted'), error: null });
  const res = await patch({ action: 'accept' });
  expect(res.status).toBe(200);
  expect(mockUpdate).toHaveBeenCalledWith({ status: 'accepted' });
});
