import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Toggle admin per test; authMiddleware always authenticates a fixed user.
const adminFlag = vi.hoisted(() => ({ value: true }));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'admin-1', email: 'admin@example.com' };
    next();
  },
  isAdminUser: async () => adminFlag.value,
}));

const mockSendSupplierOrder = vi.hoisted(() => vi.fn(async () => {}));
const mockSendOrderShipped = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../src/utils/emailService.js', () => ({
  sendSupplierOrder: mockSendSupplierOrder,
  sendOrderShipped: mockSendOrderShipped,
}));

// Queue-based supabase mock: maybeSingle() and awaited chains (thenables) pull
// from their own queues so each test scripts the exact DB responses in order.
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockThen = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => {
  const chain = () => {
    const q = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'update', 'insert', 'delete']) {
      q[m] = () => q;
    }
    q.single = () => mockMaybeSingle();
    q.maybeSingle = () => mockMaybeSingle();
    q.then = (resolve, reject) => Promise.resolve(mockThen()).then(resolve, reject);
    q.catch = () => q;
    return q;
  };
  const sb = { from: () => chain() };
  return { supabase: sb, default: sb };
});

import suppliesRouter from '../../src/routes/supplies.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', suppliesRouter);
  return app;
}

const app = makeApp();

const FULFILMENT = {
  id: 'abcd1234-0000-0000-0000-000000000000',
  order_id: 'order-1',
  buyer_id: 'buyer-1',
  supplier_id: 'sup-1',
  status: 'awaiting_fulfilment',
  items: [{ product_id: 'p1', title: 'Toploaders 25ct', supplier_sku: 'TL-25', quantity: 2, unit_price_aud: 9.95, cost_price_aud: 5.5 }],
  shipping_name: 'Jess Buyer',
  shipping_address: '1 Example St',
  shipping_suburb: 'Brisbane',
  shipping_state: 'QLD',
  shipping_postcode: '4000',
  supplier: { id: 'sup-1', name: 'AU Supplies Co', contact_email: 'orders@ausupplies.example', supports_blind_shipping: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  adminFlag.value = true;
  // Default: settings lookups miss (code defaults apply)
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockThen.mockResolvedValue({ data: [], error: null });
});

describe('GET /settings/public', () => {
  it('returns the default shipping rules without auth', async () => {
    const res = await request(app).get('/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.freeShippingThresholdAud).toBe(50);
    expect(res.body.flatShippingFeeAud).toBe(10);
  });
});

describe('admin authorisation', () => {
  it('rejects non-admins from every admin endpoint', async () => {
    adminFlag.value = false;
    for (const [method, path] of [
      ['get', '/admin/settings'],
      ['put', '/admin/settings'],
      ['get', '/admin/suppliers'],
      ['post', '/admin/suppliers'],
      ['get', '/admin/fulfilments'],
      ['post', `/admin/fulfilments/${FULFILMENT.id}/approve`],
      ['post', `/admin/fulfilments/${FULFILMENT.id}/tracking`],
    ]) {
      const res = await request(app)[method](path).send({});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });
});

describe('PUT /admin/settings', () => {
  it('rejects a negative shipping fee', async () => {
    const res = await request(app).put('/admin/settings').send({ flat_shipping_fee_aud: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects a payload with no recognised settings', async () => {
    const res = await request(app).put('/admin/settings').send({ bogus: 1 });
    expect(res.status).toBe(400);
  });

  it('saves valid settings and echoes the new values', async () => {
    // update() chains resolve with a matched row, so no insert fallback runs
    mockThen.mockResolvedValue({ data: [{ key: 'x' }], error: null });
    const res = await request(app).put('/admin/settings').send({
      free_shipping_threshold_aud: 60,
      flat_shipping_fee_aud: 9.95,
      business_abn: '12 345 678 901',
    });
    expect(res.status).toBe(200);
  });
});

describe('suppliers CRUD', () => {
  it('requires a name to create a supplier', async () => {
    const res = await request(app).post('/admin/suppliers').send({ contact_email: 'x@y.z' });
    expect(res.status).toBe(400);
  });

  it('creates a supplier with valid fields', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'sup-1', name: 'AU Supplies Co' }, error: null });
    const res = await request(app).post('/admin/suppliers').send({ name: 'AU Supplies Co', supports_blind_shipping: true });
    expect(res.status).toBe(201);
    expect(res.body.supplier.name).toBe('AU Supplies Co');
  });
});

describe('fulfilment queue', () => {
  it('returns 404 approving a fulfilment that does not exist', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await request(app).post(`/admin/fulfilments/${FULFILMENT.id}/approve`).send({});
    expect(res.status).toBe(404);
  });

  it('approves an awaiting fulfilment and emails the pre-filled supplier order', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: FULFILMENT, error: null });
    // transitionFulfilment guarded update returns the updated row
    mockThen.mockResolvedValueOnce({ data: [{ ...FULFILMENT, status: 'ordered_with_supplier' }], error: null });

    const res = await request(app).post(`/admin/fulfilments/${FULFILMENT.id}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.fulfilment.status).toBe('ordered_with_supplier');
    expect(res.body.supplierOrder.to).toBe('orders@ausupplies.example');
    expect(res.body.supplierOrder.text).toContain('2 x [TL-25] Toploaders 25ct');
    expect(res.body.supplierOrder.text).toContain('blind-ship');
    expect(res.body.supplierOrder.csv).toContain('TL-25');
    expect(res.body.emailSent).toBe(true);
    expect(mockSendSupplierOrder).toHaveBeenCalledOnce();
  });

  it('returns 409 when the fulfilment already moved past approval', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { ...FULFILMENT, status: 'shipped' }, error: null });
    // guarded update matches no rows
    mockThen.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app).post(`/admin/fulfilments/${FULFILMENT.id}/approve`).send({});
    expect(res.status).toBe(409);
  });

  it('requires a tracking number to mark shipped', async () => {
    const res = await request(app).post(`/admin/fulfilments/${FULFILMENT.id}/tracking`).send({});
    expect(res.status).toBe(400);
  });

  it('records tracking, marks shipped and emails the buyer', async () => {
    mockThen.mockResolvedValueOnce({
      data: [{ ...FULFILMENT, status: 'shipped', tracking_number: 'AP123456789AU' }],
      error: null,
    });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { email: 'jess@example.com', display_name: 'Jess' }, error: null });

    const res = await request(app)
      .post(`/admin/fulfilments/${FULFILMENT.id}/tracking`)
      .send({ trackingNumber: 'AP123456789AU', trackingCarrier: 'Australia Post' });

    expect(res.status).toBe(200);
    expect(res.body.fulfilment.status).toBe('shipped');
    expect(mockSendOrderShipped).toHaveBeenCalledWith(expect.objectContaining({
      buyerEmail: 'jess@example.com',
      trackingNumber: 'AP123456789AU',
    }));
  });
});
