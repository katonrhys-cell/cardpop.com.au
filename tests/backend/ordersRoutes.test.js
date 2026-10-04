import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// POST /orders/:id/ship (seller), POST /orders/:id/received (buyer) and the
// cron sweep guard. The shipment service is mocked; these pin the
// authorisation each route adds on top of it.
const user = vi.hoisted(() => ({ id: 'seller-1' }));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { ...user }; next(); },
}));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const svc = vi.hoisted(() => ({ markOrderShipped: vi.fn(), markOrderDelivered: vi.fn() }));
vi.mock('../../src/services/shipmentService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  markOrderShipped: svc.markOrderShipped,
  markOrderDelivered: svc.markOrderDelivered,
}));
const sweep = vi.hoisted(() => ({ run: vi.fn(async () => ({ scanned: 0 })) }));
vi.mock('../../src/services/deliverySweepService.js', () => ({ runDeliverySweep: sweep.run }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ supabase: { from: vi.fn() }, default: { from: vi.fn() } }));
vi.mock('../../src/utils/emailService.js', () => ({ sendOrderShipped: vi.fn(), sendOrderDelivered: vi.fn() }));

import ordersRouter from '../../src/routes/orders.js';

const app = express();
app.use(express.json());
app.use('/orders', ordersRouter);

const ORDER = '11111111-2222-4333-8444-555555555555';

beforeEach(() => {
  vi.clearAllMocks();
  user.id = 'seller-1';
  delete process.env.CRON_SECRET;
});

// Runs the route's authorize callback against a given order to assert ownership rules.
const authorizeWith = (order) => {
  svc.markOrderShipped.mockImplementation(async ({ authorize }) => { authorize?.(order); return { order: { id: ORDER, status: 'shipped' }, emailed: true, emailError: null, trackingNumber: '33AB1234567' }; });
};

describe('POST /orders/:id/ship (seller)', () => {
  it('lets the order’s seller mark it shipped and emails the buyer', async () => {
    authorizeWith({ id: ORDER, seller_id: 'seller-1', order_items: null });
    const res = await request(app).post(`/orders/${ORDER}/ship`).send({ carrier: 'auspost', tracking_number: '33ab 1234 567' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, emailed: true });
    expect(svc.markOrderShipped).toHaveBeenCalledWith(expect.objectContaining({ orderId: ORDER, carrier: 'auspost', trackingNumber: '33ab 1234 567', notify: true }));
  });

  it('lets the seller of a cart line mark a single-seller cart order shipped', async () => {
    authorizeWith({ id: ORDER, seller_id: null, order_items: [{ type: 'listing', seller_id: 'seller-1' }, { type: 'shop' }] });
    const res = await request(app).post(`/orders/${ORDER}/ship`).send({ carrier: 'sendle', tracking_number: 'SXYZ123' });
    expect(res.status).toBe(200);
  });

  it('403s anyone who is not the seller', async () => {
    authorizeWith({ id: ORDER, seller_id: 'someone-else', order_items: null });
    const res = await request(app).post(`/orders/${ORDER}/ship`).send({ carrier: 'auspost', tracking_number: '33AB1234567' });
    expect(res.status).toBe(403);
  });

  it('409s a cart with several sellers (one tracking slot per order)', async () => {
    authorizeWith({ id: ORDER, seller_id: null, order_items: [{ type: 'listing', seller_id: 'seller-1' }, { type: 'listing', seller_id: 'seller-2' }] });
    const res = await request(app).post(`/orders/${ORDER}/ship`).send({ carrier: 'auspost', tracking_number: '33AB1234567' });
    expect(res.status).toBe(409);
  });

  it('400s a bad tracking number or carrier', async () => {
    expect((await request(app).post(`/orders/${ORDER}/ship`).send({ carrier: 'auspost', tracking_number: 'x' })).status).toBe(400);
    expect((await request(app).post(`/orders/${ORDER}/ship`).send({ carrier: 'pigeon', tracking_number: '33AB1234567' })).status).toBe(400);
    expect(svc.markOrderShipped).not.toHaveBeenCalled();
  });
});

describe('POST /orders/:id/received (buyer)', () => {
  it('records delivery for the buyer with source "buyer"', async () => {
    user.id = 'buyer-1';
    svc.markOrderDelivered.mockImplementation(async ({ authorize, source }) => { authorize?.({ buyer_id: 'buyer-1' }); return { changed: true, order: { id: ORDER, status: 'completed', delivery_source: source } }; });
    const res = await request(app).post(`/orders/${ORDER}/received`);
    expect(res.status).toBe(200);
    expect(res.body.order.delivery_source).toBe('buyer');
  });

  it('403s someone who is not the buyer', async () => {
    user.id = 'stranger';
    svc.markOrderDelivered.mockImplementation(async ({ authorize }) => { authorize?.({ buyer_id: 'buyer-1' }); return { changed: true }; });
    expect((await request(app).post(`/orders/${ORDER}/received`)).status).toBe(403);
  });
});

describe('GET /orders/delivery-sweep (cron)', () => {
  it('refuses without CRON_SECRET (fail closed) and with the wrong bearer', async () => {
    expect((await request(app).get('/orders/delivery-sweep')).status).toBe(401);
    process.env.CRON_SECRET = 's3cret';
    expect((await request(app).get('/orders/delivery-sweep').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect(sweep.run).not.toHaveBeenCalled();
  });

  it('runs the sweep with the right bearer', async () => {
    process.env.CRON_SECRET = 's3cret';
    const res = await request(app).get('/orders/delivery-sweep').set('Authorization', 'Bearer s3cret');
    expect(res.status).toBe(200);
    expect(sweep.run).toHaveBeenCalledTimes(1);
  });
});
