import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── doubles ──────────────────────────────────────────────────────────────────
// Records what the service would write and what it would email, so each test
// can assert on the hand-off rather than on internal calls.

const state = vi.hoisted(() => ({
  products: [],
  productError: null,
  suppliers: [],
  supplierError: null,
  insertError: null,
  inserted: [],
  updates: [],
  sent: [],
  sendResult: true,
  sendThrows: false,
}));

vi.mock('../../src/utils/supabaseClient.js', () => {
  const selectIn = (rows, error) => {
    const q = {
      select: () => q,
      in: () => Promise.resolve({ data: rows(), error: error() }),
      eq: () => q,
      then: (resolve) => resolve({ data: rows(), error: error() }),
    };
    return q;
  };

  const sb = {
    from: (table) => {
      if (table === 'shop_products') return selectIn(() => state.products, () => state.productError);
      if (table === 'suppliers') return selectIn(() => state.suppliers, () => state.supplierError);
      if (table === 'supplier_dispatches') {
        return {
          insert: (row) => {
            if (state.insertError) return Promise.resolve({ error: state.insertError });
            state.inserted.push(row);
            return Promise.resolve({ error: null });
          },
          update: (patch) => {
            const chain = {
              eq: () => chain,
              then: (resolve) => { state.updates.push(patch); return resolve({ error: null }); },
            };
            return chain;
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { supabase: sb, default: sb };
});

vi.mock('../../src/utils/emailService.js', () => ({
  sendSupplierOrder: vi.fn(async (args) => {
    if (state.sendThrows) throw new Error('resend exploded');
    state.sent.push(args);
    return state.sendResult;
  }),
}));

vi.mock('../../src/utils/adminNotificationRecipient.js', () => ({
  getAdminNotificationEmail: async () => 'ops@cardpop.com.au',
}));

import { dispatchSupplierOrders, orderReference } from '../../src/services/supplierFulfilmentService.js';

const ORDER = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  shipping_name: 'Jo Smith',
  shipping_address: '12 Example St',
  shipping_suburb: 'Bondi',
  shipping_state: 'NSW',
  shipping_postcode: '2026',
  created_at: '2026-09-19T00:00:00Z',
};

const PALMS = {
  id: 'sup-1',
  name: 'Palms Off Gaming',
  fulfilment_email: 'orders@example-supplier.test',
  cc_emails: [],
  blind_shipping: true,
  blind_shipping_note: 'BLIND SHIP: CardPop as sender.',
  active: true,
};

beforeEach(() => {
  state.products = [
    { id: 'prod-1', title: 'Japanese Binder', sku: 'BODS-JPN', supplier_id: 'sup-1' },
    { id: 'prod-2', title: 'Card Sleeves', sku: 'PROS-CLR', supplier_id: 'sup-1' },
  ];
  state.productError = null;
  state.suppliers = [PALMS];
  state.supplierError = null;
  state.insertError = null;
  state.inserted = [];
  state.updates = [];
  state.sent = [];
  state.sendResult = true;
  state.sendThrows = false;
});

const shopLines = () => ([
  { type: 'shop', id: 'prod-1', title: 'Japanese Binder', quantity: 2 },
  { type: 'shop', id: 'prod-2', title: 'Card Sleeves', quantity: 1 },
]);

describe('dispatchSupplierOrders', () => {
  it('emails the supplier one dispatch with SKUs, quantities and the address', async () => {
    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(result).toEqual({ dispatched: 1, skipped: 0, failed: 0 });
    expect(state.sent).toHaveLength(1);

    const mail = state.sent[0];
    expect(mail.to).toEqual(['orders@example-supplier.test']);
    expect(mail.orderRef).toBe('A1B2C3D4');
    expect(mail.lines).toEqual([
      { sku: 'BODS-JPN', title: 'Japanese Binder', quantity: 2, product_id: 'prod-1' },
      { sku: 'PROS-CLR', title: 'Card Sleeves', quantity: 1, product_id: 'prod-2' },
    ]);
    expect(mail.shipTo).toMatchObject({ name: 'Jo Smith', suburb: 'Bondi', postcode: '2026' });
    expect(mail.blindShipping).toBe(true);
    expect(mail.blindShippingNote).toBe('BLIND SHIP: CardPop as sender.');
    // The supplier is asked to reply with tracking, and From is noreply@.
    expect(mail.replyTo).toBe('ops@cardpop.com.au');
  });

  it('records the dispatch as sent, with what was disclosed', async () => {
    await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      order_id: ORDER.id,
      supplier_id: 'sup-1',
      status: 'pending',
      recipient_email: 'orders@example-supplier.test',
    });
    expect(state.inserted[0].payload.ship_to.postcode).toBe('2026');
    expect(state.updates[0]).toMatchObject({ status: 'sent', attempts: 1 });
    expect(state.updates[0].sent_at).toBeTruthy();
  });

  // The property the whole table exists for: Stripe retries webhook deliveries,
  // and a second send means the supplier posts a second parcel.
  it('sends nothing when the dispatch was already claimed (duplicate delivery)', async () => {
    state.insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.sent).toHaveLength(0);
    expect(result.dispatched).toBe(0);
  });

  it('refuses to send if the claim could not be recorded at all', async () => {
    // Without a claim row there is no guard against a retry, so not sending is
    // the safe failure.
    state.insertError = { code: '08006', message: 'connection failure' };

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.sent).toHaveLength(0);
    expect(result.failed).toBe(1);
  });

  // Every shipping_* column on orders is nullable, so this is reachable — and a
  // pick list with nowhere to post to is worse than no pick list at all.
  it('refuses to dispatch when the order has no usable shipping address', async () => {
    const result = await dispatchSupplierOrders({
      order: { ...ORDER, shipping_address: null },
      lines: shopLines(),
    });

    expect(state.sent).toHaveLength(0);
    expect(result.failed).toBe(1);
    expect(state.inserted[0]).toMatchObject({ status: 'failed' });
    expect(state.inserted[0].last_error).toMatch(/no usable shipping address/i);
  });

  it('refuses to dispatch when the order has no postcode', async () => {
    const result = await dispatchSupplierOrders({
      order: { ...ORDER, shipping_postcode: null },
      lines: shopLines(),
    });

    expect(state.sent).toHaveLength(0);
    expect(result.failed).toBe(1);
  });

  it('skips an inactive supplier and records why, without emailing', async () => {
    state.suppliers = [{ ...PALMS, active: false }];

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.sent).toHaveLength(0);
    expect(result).toEqual({ dispatched: 0, skipped: 1, failed: 0 });
    expect(state.inserted[0]).toMatchObject({ status: 'skipped' });
    expect(state.inserted[0].last_error).toMatch(/is inactive/);
  });

  it('skips a supplier with no fulfilment address rather than guessing one', async () => {
    state.suppliers = [{ ...PALMS, fulfilment_email: null }];

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.sent).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('marks the dispatch failed when Resend rejects the message', async () => {
    state.sendResult = false;

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(result.failed).toBe(1);
    expect(state.updates[0]).toMatchObject({ status: 'failed' });
    expect(state.updates[0].sent_at).toBeNull();
  });

  it('does not throw when the send itself throws', async () => {
    state.sendThrows = true;

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(result.failed).toBe(1);
    expect(state.updates[0]).toMatchObject({ status: 'failed' });
  });

  it('ignores products with no supplier — CardPop packs its own stock', async () => {
    state.products = [{ id: 'prod-1', title: 'In-house', sku: 'X', supplier_id: null }];
    state.suppliers = [];

    const result = await dispatchSupplierOrders({ order: ORDER, lines: [shopLines()[0]] });

    expect(state.sent).toHaveLength(0);
    expect(state.inserted).toHaveLength(0);
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 });
  });

  it('splits an order across two suppliers into one dispatch each', async () => {
    state.products = [
      { id: 'prod-1', title: 'Binder', sku: 'B-1', supplier_id: 'sup-1' },
      { id: 'prod-2', title: 'Toploaders', sku: 'T-1', supplier_id: 'sup-2' },
    ];
    state.suppliers = [PALMS, { ...PALMS, id: 'sup-2', name: 'Other Supplier', fulfilment_email: 'other@example.test' }];

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(result.dispatched).toBe(2);
    expect(state.sent.map(m => m.supplierName).sort()).toEqual(['Other Supplier', 'Palms Off Gaming']);
    // Each supplier sees only its own line — never the rest of the order.
    for (const mail of state.sent) expect(mail.lines).toHaveLength(1);
  });

  it('ignores marketplace listing lines entirely', async () => {
    const result = await dispatchSupplierOrders({
      order: ORDER,
      lines: [{ type: 'listing', id: 'listing-1', seller_id: 'seller-1' }],
    });

    expect(state.sent).toHaveLength(0);
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 });
  });

  // CLAUDE.md: Vercel deploys on push while `supabase db push` runs on merge, so
  // the backend can briefly run ahead of its own schema.
  it('no-ops quietly when the supplier column has not migrated yet', async () => {
    state.productError = { code: '42703', message: 'column shop_products.supplier_id does not exist' };

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.sent).toHaveLength(0);
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 });
  });

  it('no-ops quietly when the suppliers table has not migrated yet', async () => {
    // PostgREST reports an unknown table as a schema-cache miss, whose message
    // looks nothing like a missing-column error.
    state.supplierError = { code: 'PGRST205', message: "Could not find the table 'public.suppliers' in the schema cache" };

    const result = await dispatchSupplierOrders({ order: ORDER, lines: shopLines() });

    expect(state.sent).toHaveLength(0);
    expect(result).toEqual({ dispatched: 0, skipped: 0, failed: 0 });
  });

  it('never throws on an unexpected read failure', async () => {
    state.productError = { code: 'XXYYZ', message: 'catastrophe' };

    await expect(dispatchSupplierOrders({ order: ORDER, lines: shopLines() })).resolves.toEqual(
      { dispatched: 0, skipped: 0, failed: 0 },
    );
  });

  it('returns early with no order or no lines', async () => {
    await expect(dispatchSupplierOrders({ order: null, lines: shopLines() })).resolves.toMatchObject({ dispatched: 0 });
    await expect(dispatchSupplierOrders({ order: ORDER, lines: [] })).resolves.toMatchObject({ dispatched: 0 });
  });
});

describe('orderReference', () => {
  it('prefers order_number when the column exists', () => {
    expect(orderReference({ id: 'a1b2c3d4-xxxx', order_number: 'CP-1042' })).toBe('CP-1042');
  });

  it('falls back to the admin UI short form', () => {
    expect(orderReference({ id: 'a1b2c3d4-xxxx' })).toBe('A1B2C3D4');
  });

  it('degrades safely with no id', () => {
    expect(orderReference({})).toBe('UNKNOWN');
  });
});
