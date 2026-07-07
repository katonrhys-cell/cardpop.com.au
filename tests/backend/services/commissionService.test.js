import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import { calculateBreakdown } from '../../../src/services/commissionService.js';

function builder(result) {
  const b = {
    select: vi.fn(() => b), eq: vi.fn(() => b), contains: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return b;
}
const settingRow = (value) => builder({ data: { value }, error: null });
const noRow = () => builder({ data: null, error: null });
const queue = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

beforeEach(() => vi.clearAllMocks());

// GST base: confirmed business decision is to tax the full sale price
// (item price + commission), not just CardPop's commission cut — see
// supabase/migrations/20260707120240_gst_on_full_sale_price.sql.
describe('calculateBreakdown — GST base', () => {
  it('taxes the full sale price when gst_on_commission_only is false', async () => {
    queue(
      settingRow(false), // commissions_enabled -> disabled, so commissionAud stays 0
      settingRow(true),  // gst_enabled
      settingRow(10),    // gst_rate_pct
      settingRow(false), // gst_on_commission_only
    );
    const result = await calculateBreakdown({ price_aud: 100 }, 'fixed');
    expect(result.commissionAud).toBe(0);
    expect(result.gstAud).toBe(10); // 10% of the $100 item price
  });

  it('defaults to taxing the full sale price when no override row exists', async () => {
    queue(
      settingRow(false), // commissions_enabled
      settingRow(true),  // gst_enabled
      settingRow(10),    // gst_rate_pct
      noRow(),            // gst_on_commission_only — falls back to the false default
    );
    const result = await calculateBreakdown({ price_aud: 200 }, 'fixed');
    expect(result.gstAud).toBe(20); // 10% of the $200 item price, not $0
  });

  it('taxes only the commission when gst_on_commission_only is explicitly true', async () => {
    queue(
      settingRow(true),  // commissions_enabled
      settingRow(true),  // gst_enabled
      settingRow(10),    // gst_rate_pct
      settingRow(true),  // gst_on_commission_only
      settingRow(true),  // commission_on_offers (fixed listing type)
      builder({ data: { id: 'cfg-1', fee_pct: 5 }, error: null }), // fee_config lookup
    );
    const result = await calculateBreakdown({ price_aud: 100 }, 'fixed');
    expect(result.commissionAud).toBe(5); // 5% of $100
    expect(result.gstAud).toBe(0.5); // 10% of the $5 commission, not the $100 item
  });
});
