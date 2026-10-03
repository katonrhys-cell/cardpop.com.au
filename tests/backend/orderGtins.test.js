import { vi, describe, it, expect } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { gtinsForSession } from '../../src/utils/orderGtins.js';

// supabase stand-in: orders → { order_items }, shop_products → rows.
function makeSupabase({ lines, products = [], throws = false }) {
  return {
    from: vi.fn((table) => {
      if (throws) throw new Error('boom');
      if (table === 'orders') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: lines === undefined ? null : { order_items: lines } }) }) }) };
      }
      return { select: () => ({ in: async () => ({ data: products }) }) };
    }),
  };
}

describe('gtinsForSession', () => {
  it('prefers a variant barcode and falls back to the product barcode', async () => {
    const supabase = makeSupabase({
      lines: [
        { type: 'shop', id: 'p1', variant_barcode: '1209202001436' },
        { type: 'shop', id: 'p2' },
        { type: 'listing', id: 'l1' },
      ],
      products: [{ id: 'p2', barcode: '396483852909' }],
    });
    expect(await gtinsForSession(supabase, 'cs_1')).toEqual(['1209202001436', '396483852909']);
  });

  it('skips missing or malformed barcodes and de-duplicates', async () => {
    const supabase = makeSupabase({
      lines: [{ type: 'shop', id: 'p1' }, { type: 'shop', id: 'p2' }, { type: 'shop', id: 'p3' }],
      products: [{ id: 'p1', barcode: '396483852909' }, { id: 'p2', barcode: '396483852909' }, { id: 'p3', barcode: 'abc' }],
    });
    expect(await gtinsForSession(supabase, 'cs_1')).toEqual(['396483852909']);
  });

  it('is empty for an order with no shop lines or no order row', async () => {
    expect(await gtinsForSession(makeSupabase({ lines: [{ type: 'listing', id: 'l1' }] }), 'cs_1')).toEqual([]);
    expect(await gtinsForSession(makeSupabase({ lines: undefined }), 'cs_1')).toEqual([]);
  });

  it('never throws', async () => {
    expect(await gtinsForSession(makeSupabase({ throws: true }), 'cs_1')).toEqual([]);
  });
});
