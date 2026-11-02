import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const mockIsAdminUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: { transfers: { create: vi.fn() } } }));
vi.mock('../../src/services/payoutService.js', () => ({ payoutSeller: vi.fn() }));
vi.mock('../../src/utils/emailService.js', () => ({ sendOrderShipped: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (req, _res, next) => { req.user = { id: 'admin-1' }; next(); },
  isAdminUser: mockIsAdminUser,
}));
vi.mock('../../src/middleware/requireAal2.js', () => ({
  requireAal2: (_req, _res, next) => next(),
  default: (_req, _res, next) => next(),
}));
// The Xero coding comes from platform_settings; stub the lookup so it doesn't
// consume a queued supabase builder and the defaults are exercised.
vi.mock('../../src/utils/platformSettings.js', () => ({
  getPlatformSetting: vi.fn(async (_k, d) => d),
  getPlatformSettings: vi.fn(async () => ({})),
  invalidatePlatformSettings: vi.fn(),
}));

import adminRouter from '../../src/routes/admin.js';

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

/** A chainable query builder that records calls and resolves `result`. */
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

const INVOICE = {
  id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f', order_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'tax_invoice',
  number: 'INV-000001', sequence: 1, status: 'paid', invoice_date: '2026-10-05', due_date: '2026-10-05',
  buyer_name: 'Ash Buyer', buyer_email: 'ash@example.com', currency: 'AUD',
  ship_to: { address: '1 Collector St', suburb: 'Fitzroy', state: 'VIC', postcode: '3065' },
  subtotal_aud: 100, shipping_aud: 8, commission_aud: 3, processing_fee_aud: 2.5, discount_aud: 0, adjustment_aud: 0,
  total_aud: 113.5, gst_aud: 10.32, seller_gst_aud: 9.82, platform_gst_aud: 0.5, accounting_sync_status: 'pending',
  lines: [
    { kind: 'marketplace_item', description: 'Charizard Holo', quantity: 1, unit_amount_aud: 100, amount_aud: 100, gst_aud: 9.09 },
    { kind: 'seller_shipping', description: 'Postage', quantity: 1, unit_amount_aud: 8, amount_aud: 8, gst_aud: 0.73 },
    { kind: 'commission', description: 'Service fee', quantity: 1, unit_amount_aud: 3, amount_aud: 3, gst_aud: 0.27 },
    { kind: 'processing_fee', description: 'Payment processing', quantity: 1, unit_amount_aud: 2.5, amount_aud: 2.5, gst_aud: 0.23 },
  ],
  credits: null,
};

let builders;
const queue = (...results) => {
  builders = [];
  let i = 0;
  mockSupabase.from.mockImplementation(() => {
    const b = makeBuilder(results[Math.min(i, results.length - 1)]);
    i += 1;
    builders.push(b);
    return b;
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdminUser.mockResolvedValue(true);
  // Default: list query first, then the four stat counts.
  queue(
    { data: [INVOICE], error: null, count: 1 },
    { count: 7, error: null }, { count: 2, error: null }, { count: 1, error: null }, { count: 0, error: null },
  );
});

describe('GET /admin/invoices', () => {
  it('lists documents newest first with the credited-invoice number flattened, plus counts', async () => {
    const res = await request(app).get('/admin/invoices');
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].number).toBe('INV-000001');
    expect(res.body.invoices[0].credits_number).toBeNull();
    expect(res.body.invoices[0].credits).toBeUndefined();
    expect(res.body.total).toBe(1);
    expect(res.body.counts).toEqual({ issued: 7, pending_sync: 2, credit_notes: 1, failed_sync: 0 });
    const list = builders[0];
    expect(list.calls.find(([m]) => m === 'from' || m === 'select')?.[1]).toMatch(/credits:invoices!credits_invoice_id\(number\)/);
    expect(list.calls).toContainEqual(['order', 'invoice_date', { ascending: false }]);
    expect(list.calls).toContainEqual(['order', 'sequence', { ascending: false }]);
    expect(list.calls).toContainEqual(['range', 0, 99]);
  });

  it('applies the kind, status, sync, date and search filters', async () => {
    await request(app).get('/admin/invoices?kind=credit_note&status=issued&sync=pending&from=2026-07-01&to=2026-09-30&q=ash&limit=50&offset=50');
    const calls = builders[0].calls;
    expect(calls).toContainEqual(['eq', 'kind', 'credit_note']);
    expect(calls).toContainEqual(['eq', 'status', 'issued']);
    expect(calls).toContainEqual(['eq', 'accounting_sync_status', 'pending']);
    expect(calls).toContainEqual(['gte', 'invoice_date', '2026-07-01']);
    expect(calls).toContainEqual(['lte', 'invoice_date', '2026-09-30']);
    expect(calls.find(([m]) => m === 'or')[1]).toMatch(/number\.ilike\.%ash%.*buyer_email\.ilike\.%ash%/);
    expect(calls).toContainEqual(['range', 50, 99]);
  });

  it('treats a pasted order id as an exact match and strips pattern characters from text', async () => {
    await request(app).get('/admin/invoices?q=cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(builders[0].calls).toContainEqual(['eq', 'order_id', 'cccccccc-cccc-cccc-cccc-cccccccccccc']);
    queue({ data: [], error: null, count: 0 }, { count: 0, error: null });
    await request(app).get('/admin/invoices?q=%25ash%2C(x)');
    const or = builders[0].calls.find(([m]) => m === 'or')[1];
    expect(or).not.toMatch(/[(),]%/);
    expect(or).toMatch(/ilike\.%ash  x%/);
  });

  it('400s a bad filter', async () => {
    expect((await request(app).get('/admin/invoices?kind=receipt')).status).toBe(400);
    expect((await request(app).get('/admin/invoices?from=05/10/2026')).status).toBe(400);
    expect((await request(app).get('/admin/invoices?limit=0')).status).toBe(400);
  });

  it('rejects non-admins before touching the database', async () => {
    mockIsAdminUser.mockResolvedValue(false);
    const res = await request(app).get('/admin/invoices');
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('500s without leaking the error when the query fails', async () => {
    queue({ data: null, error: { message: 'relation boom' }, count: null });
    const res = await request(app).get('/admin/invoices');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to load invoices');
  });
});

describe('GET /admin/invoices/export', () => {
  it('downloads the register CSV by default', async () => {
    queue({ data: [INVOICE], error: null, count: 1 });
    const res = await request(app).get('/admin/invoices/export?from=2026-07-01');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/cardpop-invoices-\d{4}-\d{2}-\d{2}\.csv/);
    expect(res.headers['x-invoice-count']).toBe('1');
    const [header, row] = res.text.trim().split('\n');
    expect(header).toMatch(/^Number,Type,Status,Date,Order id/);
    expect(row).toMatch(/^INV-000001,Tax invoice,paid,2026-10-05/);
    expect(builders[0].calls).toContainEqual(['gte', 'invoice_date', '2026-07-01']);
    expect(builders[0].calls).toContainEqual(['range', 0, 4999]);
  });

  it('downloads Xero\'s sales-import CSV, one row per line, coded by kind', async () => {
    queue({ data: [INVOICE], error: null, count: 1 });
    const res = await request(app).get('/admin/invoices/export?format=xero');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/cardpop-xero-sales-import-/);
    const rows = res.text.trim().split('\n');
    expect(rows[0]).toMatch(/^\*ContactName,EmailAddress,/);
    expect(rows).toHaveLength(1 + INVOICE.lines.length);
    expect(rows[1]).toContain('Ash Buyer,ash@example.com,1 Collector St,,,,Fitzroy,VIC,3065,AU,INV-000001,Order cccccccc-cccc-cccc-cccc-cccccccccccc,05/10/2026,05/10/2026,,Charizard Holo,1,100.00,,835,BAS Excluded');
    expect(rows[3]).toContain(',Service fee,1,3.00,,260,GST on Income');
  });

  it('flags a truncated export', async () => {
    queue({ data: [INVOICE], error: null, count: 9000 });
    const res = await request(app).get('/admin/invoices/export');
    expect(res.headers['x-invoice-truncated']).toBe('true');
    expect(res.headers['x-invoice-total']).toBe('9000');
  });

  it('400s an unknown format', async () => {
    expect((await request(app).get('/admin/invoices/export?format=pdf')).status).toBe(400);
  });
});

describe('GET /admin/invoices/mapping', () => {
  it('returns the kind → account / tax coding with labels', async () => {
    const res = await request(app).get('/admin/invoices/mapping');
    expect(res.status).toBe(200);
    expect(res.body.accountCodes.shop_item).toBe('200');
    expect(res.body.accountCodes.marketplace_item).toBe('835');
    expect(res.body.taxTypes.marketplace_item).toBe('BASEXCLUDED');
    expect(res.body.kinds).toContainEqual({ kind: 'seller_shipping', label: 'Seller postage' });
    expect(res.body.taxTypeLabels.OUTPUT).toBe('GST on Income');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('POST /admin/invoices/issue-missing', () => {
  it('calls the database function and reports the count', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 3, error: null });
    const res = await request(app).post('/admin/invoices/issue-missing');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ issued: 3 });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('issue_missing_invoices');
  });

  it('500s when the function fails', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await request(app).post('/admin/invoices/issue-missing');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to issue missing invoices');
  });
});

describe('GET /admin/invoices/:id', () => {
  it('returns the document with its order and a Xero payload preview', async () => {
    queue({ data: { ...INVOICE, order: { id: INVOICE.order_id, status: 'completed' } }, error: null });
    const res = await request(app).get(`/admin/invoices/${INVOICE.id}`);
    expect(res.status).toBe(200);
    expect(res.body.invoice.number).toBe('INV-000001');
    expect(res.body.invoice.order.status).toBe('completed');
    expect(res.body.xero).toMatchObject({ Type: 'ACCREC', InvoiceNumber: 'INV-000001', LineAmountTypes: 'Inclusive' });
    expect(res.body.xero.LineItems[0]).toMatchObject({ Description: 'Charizard Holo', AccountCode: '835', TaxType: 'BASEXCLUDED' });
    expect(builders[0].calls).toContainEqual(['eq', 'id', INVOICE.id]);
  });

  it('404s an unknown id and 400s a non-uuid', async () => {
    queue({ data: null, error: null });
    expect((await request(app).get('/admin/invoices/0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f01')).status).toBe(404);
    expect((await request(app).get('/admin/invoices/not-a-uuid')).status).toBe(400);
  });
});

describe('PATCH /admin/invoices/:id/accounting', () => {
  it('records a Xero link as synced with a timestamp', async () => {
    queue({ data: { ...INVOICE, accounting_sync_status: 'synced', accounting_number: 'INV-0042' }, error: null });
    const res = await request(app)
      .patch(`/admin/invoices/${INVOICE.id}/accounting`)
      .send({ status: 'synced', invoiceId: 'xero-uuid', number: 'INV-0042', url: 'https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=xero-uuid' });
    expect(res.status).toBe(200);
    expect(res.body.invoice.accounting_sync_status).toBe('synced');
    const update = builders[0].calls.find(([m]) => m === 'update')[1];
    expect(update).toMatchObject({
      accounting_sync_status: 'synced', accounting_provider: 'xero', accounting_invoice_id: 'xero-uuid',
      accounting_number: 'INV-0042', accounting_sync_error: null,
    });
    expect(update.accounting_synced_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(builders[0].calls).toContainEqual(['eq', 'id', INVOICE.id]);
  });

  it('keeps the error only on a failed sync and clears the synced timestamp', async () => {
    queue({ data: INVOICE, error: null });
    await request(app).patch(`/admin/invoices/${INVOICE.id}/accounting`).send({ status: 'failed', error: 'Contact not found' });
    const update = builders[0].calls.find(([m]) => m === 'update')[1];
    expect(update).toMatchObject({ accounting_sync_status: 'failed', accounting_sync_error: 'Contact not found', accounting_synced_at: null });
  });

  it('400s a bad status or url, 404s an unknown invoice', async () => {
    expect((await request(app).patch(`/admin/invoices/${INVOICE.id}/accounting`).send({ status: 'done' })).status).toBe(400);
    expect((await request(app).patch(`/admin/invoices/${INVOICE.id}/accounting`).send({ status: 'synced', url: 'not a url' })).status).toBe(400);
    queue({ data: null, error: null });
    expect((await request(app).patch(`/admin/invoices/${INVOICE.id}/accounting`).send({ status: 'skipped' })).status).toBe(404);
  });
});
