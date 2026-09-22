import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// The Resend send. Stubbed so tests never hit the network.
const mockSendOfferReceived = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/emailService.js', () => ({
  sendOfferReceived: mockSendOfferReceived,
}));

// authMiddleware validates the bearer token via supabase.auth.getUser.
const mockGetUser = vi.hoisted(() => vi.fn());
// Service-role reads: the listing (card name) and both profiles.
const mockListing = vi.hoisted(() => vi.fn());
const mockProfiles = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => {
  const client = {
    auth: { getUser: mockGetUser },
    from: (table) => {
      if (table === 'listings') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockListing }) }) };
      }
      return { select: () => ({ in: mockProfiles }) };
    },
  };
  return { default: client, supabase: client };
});

// The caller-scoped client that performs the actual insert.
const mockInsertSingle = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn(() => ({ select: () => ({ single: mockInsertSingle }) })));
vi.mock('../../src/utils/userScopedSupabase.js', () => ({
  default: () => ({ from: () => ({ insert: mockInsert }) }),
  createUserScopedClient: () => ({ from: () => ({ insert: mockInsert }) }),
}));

import offersRouter from '../../src/routes/offers.js';

const app = express();
app.use(express.json());
app.use('/', offersRouter);

const BUYER = '11111111-1111-4111-8111-111111111111';
const SELLER = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const OFFER = '44444444-4444-4444-8444-444444444444';

const VALID = { listingId: LISTING, sellerId: SELLER, amountAud: 600, message: 'Would you take $600?' };

const post = (body) => request(app).post('/').set('Authorization', 'Bearer tok').send(body);

const createdOffer = {
  id: OFFER,
  listing_id: LISTING,
  buyer_id: BUYER,
  seller_id: SELLER,
  amount_aud: 600,
  message: 'Would you take $600?',
  status: 'pending',
  expires_at: '2026-09-08T07:00:00.000Z',
  created_at: '2026-09-06T07:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: BUYER } }, error: null });
  mockInsertSingle.mockResolvedValue({ data: createdOffer, error: null });
  mockListing.mockResolvedValue({
    data: { id: LISTING, seller_id: SELLER, status: 'active', listing_type: 'Expression of Interest', vault_item: { card_name: 'Nikola Jokic' } },
  });
  mockProfiles.mockResolvedValue({
    data: [
      { id: SELLER, email: 'seller@example.com', display_name: 'Kat', username: 'kat' },
      { id: BUYER, email: 'buyer@example.com', display_name: 'Ash', username: 'ash' },
    ],
  });
  mockSendOfferReceived.mockResolvedValue(true);
});

// ─── auth ─────────────────────────────────────────────────────────────────────

describe('POST /offers — auth', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ─── validation ───────────────────────────────────────────────────────────────

describe('POST /offers — validation', () => {
  it.each([
    ['a non-uuid listingId', { listingId: 'nope' }],
    ['a non-uuid sellerId', { sellerId: 'nope' }],
    ['a zero amount', { amountAud: 0 }],
    ['a negative amount', { amountAud: -5 }],
    ['a non-numeric amount', { amountAud: 'six hundred' }],
  ])('rejects %s', async (_label, patch) => {
    const res = await post({ ...VALID, ...patch });
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendOfferReceived).not.toHaveBeenCalled();
  });

  it('rejects an offer on the caller’s own listing (seller from the listing, not the body)', async () => {
    mockListing.mockResolvedValue({ data: { id: LISTING, seller_id: BUYER, status: 'active' } });
    const res = await post({ ...VALID, sellerId: SELLER });
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // The forged-seller attack: name an accomplice as the seller of a stranger's
  // listing, have them accept, then check out at a self-chosen price.
  it('rejects a sellerId that is not the listing’s seller', async () => {
    const ACCOMPLICE = '55555555-5555-4555-8555-555555555555';
    const res = await post({ ...VALID, sellerId: ACCOMPLICE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not match/);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendOfferReceived).not.toHaveBeenCalled();
  });

  it('rejects an offer on an inactive or unknown listing', async () => {
    mockListing.mockResolvedValueOnce({ data: { id: LISTING, seller_id: SELLER, status: 'sold' } });
    expect((await post(VALID)).status).toBe(404);
    mockListing.mockResolvedValueOnce({ data: null });
    expect((await post(VALID)).status).toBe(404);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects an over-long message', async () => {
    const res = await post({ ...VALID, message: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ─── the write ────────────────────────────────────────────────────────────────

describe('POST /offers — the offer row', () => {
  it('writes the offer with the caller as buyer, ignoring any buyerId sent', async () => {
    const res = await post({ ...VALID, buyerId: SELLER });
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith({
      listing_id: LISTING,
      buyer_id: BUYER,
      seller_id: SELLER,
      amount_aud: 600,
      message: 'Would you take $600?',
    });
  });

  it('derives the seller from the listing when no sellerId is sent', async () => {
    const { sellerId: _omit, ...body } = VALID;
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ seller_id: SELLER }));
  });

  it('stores an empty message as null', async () => {
    await post({ ...VALID, message: '   ' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ message: null }));
  });

  it('surfaces an RLS rejection as a 400 and sends no email', async () => {
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } });
    const res = await post(VALID);
    expect(res.status).toBe(400);
    expect(mockSendOfferReceived).not.toHaveBeenCalled();
  });
});

// ─── the seller email ─────────────────────────────────────────────────────────

describe('POST /offers — seller email', () => {
  it('emails the seller with the card, amount, buyer and message', async () => {
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(res.body.emailed).toBe(true);
    expect(mockSendOfferReceived).toHaveBeenCalledWith(expect.objectContaining({
      sellerEmail: 'seller@example.com',
      sellerName: 'Kat',
      buyerName: 'Ash',
      cardName: 'Nikola Jokic',
      listingType: 'Expression of Interest',
      amountAud: 600,
      message: 'Would you take $600?',
    }));
  });

  it('still succeeds when the seller has no email on file', async () => {
    mockProfiles.mockResolvedValue({ data: [{ id: SELLER, email: null, display_name: 'Kat' }] });
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(res.body.emailed).toBe(false);
    expect(mockSendOfferReceived).not.toHaveBeenCalled();
  });

  // The offer is already committed and already in the seller's notification
  // bell by this point — an email outage must never report failure to the buyer.
  it('still succeeds when the email send throws', async () => {
    mockSendOfferReceived.mockRejectedValue(new Error('Resend is down'));
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(res.body.offer.id).toBe(OFFER);
    expect(res.body.emailed).toBe(false);
  });

  it('still succeeds when the post-commit listing lookup (for the email) fails', async () => {
    // First call resolves the seller (must succeed); the second, inside
    // loadOfferContext, is best-effort.
    mockListing
      .mockResolvedValueOnce({ data: { id: LISTING, seller_id: SELLER, status: 'active' } })
      .mockRejectedValueOnce(new Error('timeout'));
    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(res.body.offer.id).toBe(OFFER);
  });
});
