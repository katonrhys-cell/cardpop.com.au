import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import { calculateBreakdown, calculateGst } from '../../../src/services/commissionService.js';

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

// GST is INSIDE every price now (Australian consumer prices are GST-inclusive),
// so calculateBreakdown adds none to the buyer's bill — calculateGst splits the
// included amount between the seller's supply and CardPop's.
describe('calculateBreakdown — GST is not added on top', () => {
  it('adds nothing to the buyer total beyond the commission', async () => {
    queue(
      settingRow(false), // commissions_enabled -> disabled, so commissionAud stays 0
    );
    const result = await calculateBreakdown({ price_aud: 100 }, 'fixed');
    expect(result.commissionAud).toBe(0);
    expect(result.total).toBe(100); // the listed price, GST already inside it
    expect(result.gstAud).toBeUndefined();
  });

  it('totals item + commission only', async () => {
    queue(
      settingRow(true),  // commissions_enabled
      settingRow(true),  // commission_on_fixed
      builder({ data: { id: 'cfg-1', fee_pct: 5 }, error: null }), // fee_config lookup
    );
    const result = await calculateBreakdown({ price_aud: 100 }, 'fixed');
    expect(result.commissionAud).toBe(5);
    expect(result.total).toBe(105);
  });
});

describe('calculateGst — who owes what', () => {
  it('splits the included GST between the seller’s supply and CardPop’s', async () => {
    queue(
      settingRow(true), // gst_enabled
      settingRow(10),   // gst_rate_pct
    );
    // $107.17 of seller supply (a $101.17 card + $6.00 postage) and $8.58 of
    // CardPop fees. GST is 1/11 of each, not 10% on top of either.
    const gst = await calculateGst({ sellerAmountAud: 107.17, platformAmountAud: 8.58 });
    expect(gst.sellerGstAud).toBe(9.74);
    expect(gst.platformGstAud).toBe(0.78);
    expect(gst.gstIncludedAud).toBe(10.52);
  });

  it('charges every transaction with no registration test — a $1 sale still carries GST', async () => {
    queue(settingRow(true), settingRow(10));
    const gst = await calculateGst({ sellerAmountAud: 1, platformAmountAud: 0 });
    expect(gst.sellerGstAud).toBe(0.09);
  });

  it('returns zeroes when GST is switched off platform-wide', async () => {
    queue(settingRow(false)); // gst_enabled
    const gst = await calculateGst({ sellerAmountAud: 100, platformAmountAud: 10 });
    expect(gst).toEqual({ sellerGstAud: 0, platformGstAud: 0, gstIncludedAud: 0, gstRatePct: 0 });
  });
});
