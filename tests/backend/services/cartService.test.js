import { vi, describe, it, expect, beforeEach } from 'vitest';

// cartService reads platform settings, prices listings via commissionService and
// looks up shop/listing rows in Supabase. Mock all three so we can exercise the
// money math (GST, duplicate merging, self-purchase block, shipping threshold)
// deterministically.
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
const mockGetPlatformSetting = vi.hoisted(() => vi.fn());
const mockCalculateBreakdown = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../../src/services/stripeWebhookService.js', () => ({ getPlatformSetting: mockGetPlatformSetting }));
vi.mock('../../../src/services/commissionService.js', () => ({ calculateBreakdown: mockCalculateBreakdown }));

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
});

describe('priceCart — shop items', () => {
  it('prices a single active shop product with GST', async () => {
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Booster Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');

    expect(result.itemsCents).toBe(10000);
    expect(result.gstCents).toBe(1000); // 10% of $100
    expect(result.commissionCents).toBe(0);
    expect(result.grandCents).toBe(11000);
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
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
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
    expect(result.lineItems.some((l) => l.price_data.product_data.name === 'GST')).toBe(false);
  });
});

describe('priceCart — shipping', () => {
  it('charges the flat shipping rate on shop items below the free threshold', async () => {
    setPlatformSettings({ default_shipping_rate_aud: 9.95, free_shipping_threshold_aud: 200 });
    mockSupabase.from.mockReturnValueOnce(rowBuilder({
      data: { id: 'p1', title: 'Box', price_aud: 100, stock_quantity: 5, status: 'active' },
      error: null,
    }));

    const result = await priceCart([{ type: 'shop', id: 'p1', quantity: 1 }], 'buyer-1');
    expect(result.shippingCents).toBe(995);
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
    mockCalculateBreakdown.mockResolvedValueOnce({ itemPrice: 100, commissionAud: 5, gstAud: 0.5 });

    const result = await priceCart([{ type: 'listing', id: 'l1', quantity: 1 }], 'buyer-1');
    expect(result.itemsCents).toBe(10000);
    expect(result.commissionCents).toBe(500);
    expect(result.gstCents).toBe(50);
    expect(result.grandCents).toBe(10550);
    const line = result.orderLines.find((l) => l.type === 'listing');
    expect(line.seller_id).toBe('seller-9');
    expect(line.title).toBe('Blastoise');
  });

  it('rejects an unknown cart item type (400)', async () => {
    await expect(priceCart([{ type: 'mystery', id: 'x' }], 'buyer-1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
