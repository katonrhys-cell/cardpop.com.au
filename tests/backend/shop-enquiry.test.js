import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// sendShopEnquiry is the Resend send; stub it so tests never hit the network.
const mockSendShopEnquiry = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/emailService.js', () => ({
  sendShopEnquiry: mockSendShopEnquiry,
}));

// The route looks the product up with the service-role client so the email
// carries the real title (and a made-up id can't be used to spam admin).
const mockMaybeSingle = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({
  default: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
  },
}));

const mockVerifyTurnstile = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/turnstile.js', () => ({
  verifyTurnstileToken: mockVerifyTurnstile,
}));

import shopEnquiryRouter, { SHOP_ENQUIRY_EMAIL } from '../../src/routes/shop-enquiry.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', shopEnquiryRouter);
  return app;
}
const app = makeApp();

const PRODUCT_ID = '11111111-2222-4333-8444-555555555555';
const PRODUCT = { id: PRODUCT_ID, title: 'Palms Off 9-Pocket Binder', slug: 'binder', stock_quantity: 0, status: 'active' };

const VALID = {
  productId: PRODUCT_ID,
  name: 'Ash Ketchum',
  email: 'ash@example.com',
  message: 'When will this be back in stock?',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSendShopEnquiry.mockResolvedValue(true);
  mockMaybeSingle.mockResolvedValue({ data: PRODUCT, error: null });
  mockVerifyTurnstile.mockResolvedValue({ success: true });
});

describe('POST /shop-enquiry — validation', () => {
  it('rejects a non-uuid product id', async () => {
    const res = await request(app).post('/').send({ ...VALID, productId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });

  it('rejects a missing name', async () => {
    const res = await request(app).post('/').send({ ...VALID, name: 'A' });
    expect(res.status).toBe(400);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/').send({ ...VALID, email: 'nope' });
    expect(res.status).toBe(400);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });

  it('rejects an over-length message', async () => {
    const res = await request(app).post('/').send({ ...VALID, message: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });

  it('accepts an empty message (the shopper just wants a restock ping)', async () => {
    const res = await request(app).post('/').send({ ...VALID, message: '' });
    expect(res.status).toBe(200);
    expect(mockSendShopEnquiry).toHaveBeenCalledTimes(1);
  });
});

describe('POST /shop-enquiry — abuse controls', () => {
  it('silently accepts (200) and does not send when the honeypot is filled', async () => {
    const res = await request(app).post('/').send({ ...VALID, company: 'spammer inc' });
    expect(res.status).toBe(200);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });

  it('rejects when Turnstile verification fails', async () => {
    mockVerifyTurnstile.mockResolvedValue({ success: false });
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(400);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });
});

describe('POST /shop-enquiry — product lookup', () => {
  it('404s for an unknown product and sends nothing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(404);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });

  it('404s for a non-active (draft/archived) product', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...PRODUCT, status: 'archived' }, error: null });
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(404);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });
});

describe('POST /shop-enquiry — delivery', () => {
  it('emails admin@cardpop.com.au with the DB title and the shopper as reply-to', async () => {
    const res = await request(app).post('/').send({ ...VALID, name: '  Ash Ketchum  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(SHOP_ENQUIRY_EMAIL).toBe('admin@cardpop.com.au');
    expect(mockSendShopEnquiry).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@cardpop.com.au',
      productTitle: PRODUCT.title,
      productId: PRODUCT_ID,
      productUrl: expect.stringContaining(`/product/shop/${PRODUCT_ID}`),
      name: 'Ash Ketchum',
      email: 'ash@example.com',
      message: VALID.message,
    }));
  });

  it('returns 502 when the email provider refuses the send', async () => {
    mockSendShopEnquiry.mockResolvedValue(false);
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('admin@cardpop.com.au');
  });

  it('returns 500 when the product lookup throws', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('db down') });
    const res = await request(app).post('/').send(VALID);
    expect(res.status).toBe(500);
    expect(mockSendShopEnquiry).not.toHaveBeenCalled();
  });
});
