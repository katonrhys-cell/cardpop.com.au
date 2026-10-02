import { vi, describe, it, expect, beforeEach } from 'vitest';

// cartService reads platform settings, prices listings via commissionService and
// looks up shop/listing rows in Supabase. Mock all three so we can exercise the
// money math (GST, duplicate merging, self-purchase block, shipping threshold)
// deterministically.
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockGetPlatformSetting = vi.hoisted(() => vi.fn());
const mockCalculateBreakdown = vi.hoisted(() => vi.fn());
// Defaults to 0 so the existing money-math assertions stay about commission and
// GST; the processing-fee tests at the bottom set a real rate.
const mockCalculateProcessingFee = vi.hoisted(() => vi.fn(() => Promise.resolve(0)));

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/services/stripeWebhookService.js', () => ({ getPlatformSetting: mockGetPlatformSetting }));
// Only the two settings-driven functions are stubbed. gstInsideCents is pure
// arithmetic and stays real, so these tests exercise the actual GST split
// rather than a mock of it.
vi.mock('../../../src/services/commissionService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  calculateBreakdown: mockCalculateBreakdown,
  calculateProcessingFee: mockCalculateProcessingFee,
}));

import { priceCart } from '../../../src/services/cartService.js';

// Default platform settings: GST on at 10%, no shipping fee. Individual tests
// override specific keys as needed.
function setPlatformSettings(overrides = {}) {
  const defaults = {
    gst_enabled: true,
    gst_rate_pct: 10,
    default_shipping_rate_aud: 0,
    free_shipping_threshold_aud: 0,
  };
  const merged = { ...defaults, ...overrides };
  mockGetPlatformSetting.mockImplementation((key, fallback) =>
    Promise.resolve(key in merged ? merged[key] : fallback));
}

// A one-shot query builder that resolves maybeSingle() with the given row.
function rowBuilder(result) {
  const b = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
  setPlatformSettings();
  mockCalculateProcessingFee.mockResolvedValue(0);
});

describe('priceCart — shop items', () => {
  it('snapshots the wholesale cost onto each shop line when a cost row exists', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));
    // Second lookup: shop_product_costs for the shop ids in the cart.
    const costBuilder = { select: vi.fn(() => costBuilder), in: vi.fn(() => Promise.resolve({ data: [{ product_id: 'p1', wholesale_ex_gst_aud: '60.00', wholesale_inc_gst_aud: '66.00' }], error: null })) };
    mockSupabase.from.mockReturnValueOnce(costBuilder);

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 2 }], 'buyer-1');
    expect(costBuilder.in).toHaveBeenCalledWith('product_id', ['p1']);
    expect(result.orderLines[0]).toMatchObject({ type: 'shop', id: 'p1', quantity: 2, unit_cost_ex_gst_aud: 60, unit_cost_inc_gst_aud: 66 });
  });

  it('still prices the cart when the cost lookup is unavailable', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));
    // No builder queued for shop_product_costs → from() returns undefined → caught.
    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');
    expect(result.orderLines[0]).not.toHaveProperty('unit_cost_ex_gst_aud');
    expect(result.itemsCents).toBe(10000);
  });

  it('prices a single active shop product with GST included in the price', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');

    // The $100 ticket price is GST-inclusive: the buyer pays exactly $100, and
    // the $9.09 GST is the tax component already inside it (100 ÷ 11), not added.
    expect(result.itemsCents).toBe(10000);
    expect(result.gstCents).toBe(0);            // nothing added on top
    expect(result.includedGstCents).toBe(909);  // round(10000 × 10/110)
    expect(result.commissionCents).toBe(0);
    expect(result.grandCents).toBe(10000);
  });

  it('merges duplicate shop lines into one line with summed quantity', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Single', price_aud: 10, stock_quantity: 10, status: 'active' },
      error: null,
    }));

    const result = await priceCart(
      [{ type: 'shop', id: 'p1', quantity: 2 }, { type: 'shop', id: 'p1', quantity: 3 }],
      'buyer-1',
    );

    // Only one shop_products lookup happens because the lines merged first.
    expect(mockSupabase.from.mock.calls.filter(([table]) => table === 'shop_products')).toHaveLength(1);
    expect(result.itemsCents).toBe(5000); // 5 x $10
    const shopLine = result.orderLines.find((l) => l.type === 'shop');
    expect(shopLine.quantity).toBe(5);
  });

  it('rejects a shop product with insufficient stock (409)', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Rare', price_aud: 50, stock_quantity: 1, status: 'active' },
      error: null,
    }));

    await expect(priceCart([{ type: 'shop', id: 'p1', quantity: 3 }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects an unavailable / inactive shop product (404)', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Gone', price_aud: 50, stock_quantity: 5, status: 'draft' },
      error: null,
    }));

    await expect(priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('omits the GST line when GST is disabled', async () => {
    setPlatformSettings({ gst_enabled: false });
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');
    expect(result.gstCents).toBe(0);
    expect(result.includedGstCents).toBe(0);
    expect(result.lineItems.some((l) => l.price_data.product_data.name === 'GST')).toBe(false);
  });
});

describe('priceCart — shipping', () => {
  it('falls back to $15 flat under $100, free from $100, when the settings rows are missing', async () => {
    mockGetPlatformSetting.mockImplementation((key, fallback) =>
      Promise.resolve({ gst_enabled: true, gst_rate_pct: 10 }[key] ?? fallback));
    const shopRow = (price) => rowBuilder({
      data: { id: 'p1', title: 'Box', price_aud: price, stock_quantity: 5, status: 'active' },
      error: null,
    });

    mockSupabase.from.mockReturnValueOnce(shopRow(99.99));
    const under = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');
    expect(under.shippingCents).toBe(1500);

    mockSupabase.from.mockReturnValueOnce(shopRow(100));
    const atThreshold = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');
    expect(atThreshold.shippingCents).toBe(0);
  });

  it('charges the flat shipping rate on shop items below the free threshold', async () => {
    setPlatformSettings({ default_shipping_rate_aud: 9.95, free_shipping_threshold_aud: 200 });
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');
    expect(result.shippingCents).toBe(995);
    // Shipping is added to the (GST-inclusive) item total; GST is never re-added.
    expect(result.grandCents).toBe(10995);
    // Reported GST covers the tax inside both the item ($9.09) and shipping ($0.90).
    expect(result.includedGstCents).toBe(999);
  });

  it('waives shipping once the shop subtotal reaches the free-shipping threshold', async () => {
    setPlatformSettings({ default_shipping_rate_aud: 9.95, free_shipping_threshold_aud: 200 });
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 2 }], 'buyer-1'); // $200
    expect(result.shippingCents).toBe(0);
  });
});

describe('priceCart — seller postage', () => {
  const listingRow = (id, sellerId, price, shipping) => ({
    data: {
      id, price_aud: price, shipping_cost_aud: shipping, seller_id: sellerId,
      listing_type: 'fixed', status: 'active',
      vault_item: { card_name: `Card ${id}` }, seller: { seller_tier: 'standard' },
    },
    error: null,
  });

  it('charges the seller-set postage on a marketplace listing and records it on the line', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(listingRow('l1', 'seller-9', 40, 8.95)));
    mockCalculateBreakdown.mockResolvedValueOnce({ itemPrice: 40, commissionAud: 1.2 });

    const result = await priceCart([{ type: 'listing', id: 'l1', quantity: 1 }], 'buyer-1');

    expect(result.shippingCents).toBe(895);
    expect(result.grandCents).toBe(4000 + 120 + 895);
    // Postage is the seller's own consumer-quoted price: no commission comes
    // off it, but it IS part of their supply, so the GST inside it (81¢) is
    // deducted from their payout along with the card's (364¢).
    expect(result.sellerGstCents).toBe(445);
    expect(result.platformGstCents).toBe(22); // 1/11 of 2 × $1.20 commission
    expect(result.includedGstCents).toBe(467);
    const line = result.orderLines.find((l) => l.type === 'listing');
    expect(line.shipping_aud).toBe(8.95);
    expect(line.seller_gst_aud).toBe(4.45);
    // The internal combining field never leaks into the persisted order lines.
    expect(line.listing_shipping_cost_aud).toBeUndefined();
    expect(result.lineItems.some((l) => l.price_data.product_data.name === 'Shipping' && l.price_data.unit_amount === 895)).toBe(true);
  });

  it('combines postage per seller: one parcel, the single highest price — not the sum', async () => {
    mockSupabase.from
      .mockReturnValueOnce(rowBuilder(listingRow('l1', 'seller-9', 40, 8.95)))
      .mockReturnValueOnce(rowBuilder(listingRow('l2', 'seller-9', 20, 5)));
    mockCalculateBreakdown
      .mockResolvedValueOnce({ itemPrice: 40, commissionAud: 0, gstAud: 0 })
      .mockResolvedValueOnce({ itemPrice: 20, commissionAud: 0, gstAud: 0 });

    const result = await priceCart(
      [{ type: 'listing', id: 'l1', quantity: 1 }, { type: 'listing', id: 'l2', quantity: 1 }],
      'buyer-1',
    );

    expect(result.shippingCents).toBe(895);
    // The charge sits on the parcel-defining line (the one with the highest
    // postage) so the payout and any refund reversal can follow it.
    expect(result.orderLines.find((l) => l.id === 'l1').shipping_aud).toBe(8.95);
    expect(result.orderLines.find((l) => l.id === 'l2').shipping_aud).toBeUndefined();
  });

  it('sums postage across different sellers — separate parcels', async () => {
    mockSupabase.from
      .mockReturnValueOnce(rowBuilder(listingRow('l1', 'seller-9', 40, 8.95)))
      .mockReturnValueOnce(rowBuilder(listingRow('l2', 'seller-7', 20, 5)));
    mockCalculateBreakdown
      .mockResolvedValueOnce({ itemPrice: 40, commissionAud: 0, gstAud: 0 })
      .mockResolvedValueOnce({ itemPrice: 20, commissionAud: 0, gstAud: 0 });

    const result = await priceCart(
      [{ type: 'listing', id: 'l1', quantity: 1 }, { type: 'listing', id: 'l2', quantity: 1 }],
      'buyer-1',
    );

    expect(result.shippingCents).toBe(895 + 500);
    expect(result.orderLines.find((l) => l.id === 'l1').shipping_aud).toBe(8.95);
    expect(result.orderLines.find((l) => l.id === 'l2').shipping_aud).toBe(5);
  });

  it('treats a listing without postage (or a pre-migration row) as free shipping', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(listingRow('l1', 'seller-9', 40, undefined)));
    mockCalculateBreakdown.mockResolvedValueOnce({ itemPrice: 40, commissionAud: 0, gstAud: 0 });

    const result = await priceCart([{ type: 'listing', id: 'l1', quantity: 1 }], 'buyer-1');

    expect(result.shippingCents).toBe(0);
    expect(result.orderLines.find((l) => l.type === 'listing').shipping_aud).toBeUndefined();
    expect(result.lineItems.some((l) => l.price_data.product_data.name === 'Shipping')).toBe(false);
  });
});

describe('priceCart — listings', () => {
  it('blocks a buyer from purchasing their own listing (403)', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: {
        id: 'l1', price_aud: 50, seller_id: 'buyer-1', listing_type: 'fixed', status: 'active',
        vault_item: { card_name: 'Charizard' }, seller: { seller_tier: 'standard' },
      },
      error: null,
    }));

    await expect(priceCart([{ type: 'listing', id: 'l1', quantity: 1 }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('prices a listing using the commission breakdown', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: {
        id: 'l1', price_aud: 100, seller_id: 'seller-9', listing_type: 'fixed', status: 'active',
        vault_item: { card_name: 'Blastoise' }, seller: { seller_tier: 'standard' },
      },
      error: null,
    }));
    mockCalculateBreakdown.mockResolvedValueOnce({ itemPrice: 100, commissionAud: 5 });

    const result = await priceCart([{ type: 'listing', id: 'l1', quantity: 1 }], 'buyer-1');
    expect(result.itemsCents).toBe(10000);
    expect(result.commissionCents).toBe(500);
    // Nothing is added on top: the buyer pays the listed price plus the fee.
    expect(result.gstCents).toBe(0);
    expect(result.grandCents).toBe(10500);
    // GST is inside those prices — 1/11 of the card (909¢), plus 1/11 of
    // CardPop's own commission, which is earned twice (charged to the buyer
    // AND deducted from the seller): 1000¢ × 10/110 = 91¢.
    expect(result.sellerGstCents).toBe(909);
    expect(result.platformGstCents).toBe(91);
    expect(result.includedGstCents).toBe(1000);
    const line = result.orderLines.find((l) => l.type === 'listing');
    expect(line.seller_id).toBe('seller-9');
    expect(line.title).toBe('Blastoise');
    // Recorded per line so the webhook can deduct it from this seller's payout.
    expect(line.seller_gst_aud).toBe(9.09);
  });

  it('rejects an unknown cart item type (400)', async () => {
    await expect(priceCart([{ type: 'mystery', id: 'x' }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─── colour variants ──────────────────────────────────────────────────────────

describe('priceCart — colour variants', () => {
  const VARIANTS = [
    { id: 'v-blk', sku: 'ZB-09-BLK', colour: 'Black', barcode: '1209202001375', stock_quantity: 3, price_aud: null, status: 'active' },
    { id: 'v-red', sku: 'ZB-09-RED', colour: 'Red', barcode: '1209202001405', stock_quantity: 0, price_aud: 47.95, status: 'active' },
    { id: 'v-old', sku: 'ZB-09-OLD', colour: 'Olive', barcode: null, stock_quantity: 9, price_aud: null, status: 'archived' },
  ];
  const binder = (variants = VARIANTS) => ({
    data: { id: 'p-zb09', title: '9-Pocket Zip Binder', price_aud: 44.95, stock_quantity: 3, status: 'active', variants },
    error: null,
  });

  it('requires a colour when the product has variants', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder()));
    await expect(priceCart([{ type: 'shop', id: 'p-zb09', quantity: 1 }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/choose a colour/i) });
  });

  it('rejects an unknown or archived variant id', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder()));
    await expect(priceCart([{ type: 'shop', id: 'p-zb09', quantity: 1, variantId: 'v-old' }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('checks stock on the chosen variant, not the parent', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder()));
    await expect(priceCart([{ type: 'shop', id: 'p-zb09', quantity: 1, variantId: 'v-red' }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/Red/) });
  });

  it('prices the chosen variant, carrying its identity onto the order line', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder()));
    const result = await priceCart([{ type: 'shop', id: 'p-zb09', quantity: 2, variantId: 'v-blk' }], 'buyer-1');
    expect(result.itemsCents).toBe(8990);
    expect(result.orderLines[0]).toMatchObject({
      type: 'shop', id: 'p-zb09', quantity: 2, title: '9-Pocket Zip Binder — Black',
      variant_id: 'v-blk', variant_sku: 'ZB-09-BLK', variant_colour: 'Black', variant_barcode: '1209202001375',
    });
    expect(result.lineItems[0].price_data.product_data.name).toBe('9-Pocket Zip Binder — Black');
  });

  it('uses a variant price override when set', async () => {
    const inStockRed = VARIANTS.map((v) => (v.id === 'v-red' ? { ...v, stock_quantity: 4 } : v));
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder(inStockRed)));
    const result = await priceCart([{ type: 'shop', id: 'p-zb09', quantity: 1, variantId: 'v-red' }], 'buyer-1');
    expect(result.itemsCents).toBe(4795);
    expect(result.orderLines[0].unit_price_aud).toBe(47.95);
  });

  it('auto-selects the only variant when none is named', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder([VARIANTS[0]])));
    const result = await priceCart([{ type: 'shop', id: 'p-zb09', quantity: 1 }], 'buyer-1');
    expect(result.orderLines[0].variant_id).toBe('v-blk');
  });

  it('keeps two colours of one product as separate lines', async () => {
    const both = VARIANTS.map((v) => ({ ...v, stock_quantity: 5 }));
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder(both)));
    mockSupabase.from.mockReturnValueOnce(rowBuilder(binder(both)));
    const result = await priceCart([
      { type: 'shop', id: 'p-zb09', quantity: 1, variantId: 'v-blk' },
      { type: 'shop', id: 'p-zb09', quantity: 1, variantId: 'v-red' },
    ], 'buyer-1');
    expect(result.orderLines.map((l) => l.variant_id)).toEqual(['v-blk', 'v-red']);
  });

  it('a product without variants still prices from the parent as before', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active', variants: [] },
      error: null,
    }));
    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1, variantId: 'ignored' }], 'buyer-1');
    expect(result.orderLines[0]).not.toHaveProperty('variant_id');
    expect(result.itemsCents).toBe(10000);
  });
});

describe('priceCart — pre-orders', () => {
  const preorderRow = (over = {}) => ({
    id: 'p9', title: 'Booster Box', price_aud: 120, stock_quantity: 10,
    status: 'preorder', preorder_eta: 'Ships in 4–6 weeks', ...over,
  });

  it('sells a pre-order like an active product and snapshots the estimate on the line', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({ data: preorderRow(), error: null }));

    const result = await priceCart([{ type: 'shop', id: 'p9', quantity: 2 }], 'buyer-1');

    expect(result.itemsCents).toBe(24000);
    expect(result.hasPreorder).toBe(true);
    expect(result.orderLines[0]).toMatchObject({
      type: 'shop', id: 'p9', title: 'Booster Box', quantity: 2,
      preorder: true, preorder_eta: 'Ships in 4–6 weeks',
    });
    // The buyer sees it on the Stripe page too.
    expect(result.lineItems[0].price_data.product_data.name).toBe('Booster Box (Pre-order — Ships in 4–6 weeks)');
  });

  it('leaves active products unmarked', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({ data: preorderRow({ status: 'active' }), error: null }));

    const result = await priceCart([{ type: 'shop', id: 'p9', quantity: 1 }], 'buyer-1');

    expect(result.hasPreorder).toBe(false);
    expect(result.orderLines[0]).not.toHaveProperty('preorder');
    expect(result.orderLines[0]).not.toHaveProperty('preorder_eta');
    expect(result.lineItems[0].price_data.product_data.name).toBe('Booster Box');
  });

  it('caps pre-orders at the allocation (stock_quantity)', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({ data: preorderRow({ stock_quantity: 1 }), error: null }));

    await expect(priceCart([{ type: 'shop', id: 'p9', quantity: 2 }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('still refuses coming-soon products', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({ data: preorderRow({ status: 'coming_soon' }), error: null }));

    await expect(priceCart([{ type: 'shop', id: 'p9', quantity: 1 }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('falls back to a generic estimate if a pre-order somehow has none', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({ data: preorderRow({ preorder_eta: '   ' }), error: null }));

    const result = await priceCart([{ type: 'shop', id: 'p9', quantity: 1 }], 'buyer-1');
    expect(result.orderLines[0].preorder_eta).toBe('Ships when stock arrives');
  });

  it('retries without preorder_eta when the column is not migrated yet', async () => {
    const missing = rowBuilder({ data: null, error: { message: 'column shop_products.preorder_eta does not exist' } });
    const legacy = rowBuilder({ data: preorderRow({ status: 'active', preorder_eta: undefined }), error: null });
    mockSupabase.from.mockReturnValueOnce(missing).mockReturnValueOnce(legacy);

    const result = await priceCart([{ type: 'shop', id: 'p9', quantity: 1 }], 'buyer-1');

    expect(missing.select.mock.calls[0][0]).toContain('preorder_eta');
    expect(legacy.select.mock.calls[0][0]).not.toContain('preorder_eta');
    expect(result.itemsCents).toBe(12000);
    expect(result.hasPreorder).toBe(false);
  });
});
