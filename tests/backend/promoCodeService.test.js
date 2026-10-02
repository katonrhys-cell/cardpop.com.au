import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  normalisePromoCode,
  generatePromoCode,
  validatePromoCode,
  promoDiscountCents,
  reservePromoCode,
  parsePromoInput,
  promoStatus,
  markPromoRedeemed,
  releasePromoRedemption,
  createPromoCode,
  deletePromoCode,
} from '../../src/services/promoCodeService.js';

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

let builders;
const queue = (...results) => {
  builders = [];
  const pending = [...results];
  mockSupabase.from.mockImplementation((table) => {
    const b = makeBuilder(pending.shift() ?? { data: null, error: null });
    builders.push({ table, b });
    return b;
  });
};

const PROMO = {
  id: 'promo-1', code: 'SPRING25', discount_pct: 25, applies_to: 'shop',
  usage_type: 'ongoing', max_redemptions: null, once_per_customer: true,
  min_order_aud: null, max_discount_aud: null, starts_at: null, expires_at: null,
  issued_to_email: null, restrict_to_email: false, active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  queue();
});

describe('code helpers', () => {
  it('normalises codes to trimmed upper case', () => {
    expect(normalisePromoCode('  spring25 ')).toBe('SPRING25');
  });

  it('generates readable codes with no ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePromoCode()).toMatch(/^CP-[A-HJKMNP-Z2-9]{8}$/);
    }
  });
});

describe('validatePromoCode', () => {
  it('accepts a live code the buyer hasn’t used', async () => {
    queue({ count: 0, error: null });
    await expect(validatePromoCode(PROMO, { userId: 'u1', email: 'a@b.com' })).resolves.toBe(PROMO);
    // once_per_customer → scoped to this buyer.
    expect(builders[0].b.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('refuses a buyer who already used a once-per-customer code', async () => {
    queue({ count: 1, error: null });
    await expect(validatePromoCode(PROMO, { userId: 'u1' })).rejects.toMatchObject({
      statusCode: 409, message: 'You’ve already used this promo code.',
    });
  });

  it('refuses a single-use code that has been used', async () => {
    queue({ count: 1, error: null });
    await expect(validatePromoCode({ ...PROMO, usage_type: 'single_use', once_per_customer: false }, { userId: 'u2' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'That promo code has already been used.' });
  });

  it('refuses inactive, scheduled and expired codes', async () => {
    await expect(validatePromoCode({ ...PROMO, active: false }, {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(validatePromoCode({ ...PROMO, starts_at: new Date(Date.now() + 86400000).toISOString() }, {}))
      .rejects.toThrow('isn’t active yet');
    await expect(validatePromoCode({ ...PROMO, expires_at: new Date(Date.now() - 1000).toISOString() }, {}))
      .rejects.toMatchObject({ statusCode: 410 });
  });

  it('only lets the named recipient use an email-locked code (case-insensitive)', async () => {
    const locked = { ...PROMO, once_per_customer: false, restrict_to_email: true, issued_to_email: 'friend@example.com' };
    await expect(validatePromoCode(locked, { userId: 'u1', email: 'someone@else.com' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(validatePromoCode(locked, { userId: 'u1', email: 'Friend@Example.com' })).resolves.toBe(locked);
  });
});

describe('promoDiscountCents', () => {
  const priced = {
    itemsCents: 30000,
    grandCents: 32000,
    orderLines: [
      { type: 'shop', line_total_aud: 100 },
      { type: 'listing', line_total_aud: 200 },
    ],
  };

  it('discounts only shop items for a shop code', () => {
    expect(promoDiscountCents(PROMO, priced)).toBe(2500);
  });

  it('discounts the whole item subtotal for an all-items code', () => {
    expect(promoDiscountCents({ ...PROMO, applies_to: 'all' }, priced)).toBe(7500);
  });

  it('caps at the maximum discount', () => {
    expect(promoDiscountCents({ ...PROMO, max_discount_aud: 10 }, priced)).toBe(1000);
  });

  it('never discounts below Stripe’s 50¢ minimum charge', () => {
    const p = { itemsCents: 1000, grandCents: 1000, orderLines: [{ type: 'shop', line_total_aud: 10 }] };
    expect(promoDiscountCents({ ...PROMO, discount_pct: 100 }, p)).toBe(950);
  });

  it('refuses a shop code on a cart with no shop items', () => {
    expect(() => promoDiscountCents(PROMO, { ...priced, orderLines: [{ type: 'listing', line_total_aud: 300 }] }))
      .toThrow('CardPop Shop items only');
  });

  it('enforces the minimum spend on the eligible items', () => {
    expect(() => promoDiscountCents({ ...PROMO, min_order_aud: 150 }, priced)).toThrow('minimum spend of $150.00');
  });
});

describe('reservePromoCode', () => {
  it('returns the redemption id from the row-locked RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'red-1', error: null });
    await expect(reservePromoCode(PROMO, { userId: 'u1', email: 'a@b.com', discountCents: 500 })).resolves.toBe('red-1');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('reserve_promo_code', {
      p_promo_code_id: 'promo-1', p_user_id: 'u1', p_email: 'a@b.com', p_discount_cents: 500,
    });
  });

  it('maps the DB’s refusal to a user-facing message', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'promo_exhausted' } });
    await expect(reservePromoCode(PROMO, { userId: 'u1' })).rejects.toMatchObject({
      statusCode: 409, message: 'That promo code has already been used.',
    });
  });
});

describe('redemption lifecycle', () => {
  it('marks a redemption redeemed with its order, idempotently', async () => {
    await markPromoRedeemed('red-1', 'order-1');
    const { table, b } = builders[0];
    expect(table).toBe('promo_code_redemptions');
    expect(b.calls[0][0]).toBe('update');
    expect(b.calls[0][1]).toMatchObject({ status: 'redeemed', order_id: 'order-1' });
    expect(b.calls).toContainEqual(['neq', 'status', 'redeemed']);
  });

  it('only releases a still-reserved redemption', async () => {
    await releasePromoRedemption('red-1');
    expect(builders[0].b.calls).toContainEqual(['update', { status: 'released' }]);
    expect(builders[0].b.calls).toContainEqual(['eq', 'status', 'reserved']);
  });
});

describe('parsePromoInput', () => {
  const valid = { code: 'vip-mate', discountPct: 15, usageType: 'single_use', issuedToName: 'Sam', issuedToEmail: 'Sam@Example.com' };

  it('normalises a valid body', () => {
    expect(parsePromoInput(valid)).toMatchObject({
      code: 'VIP-MATE', discount_pct: 15, usage_type: 'single_use', applies_to: 'shop',
      issued_to_name: 'Sam', issued_to_email: 'sam@example.com', once_per_customer: true, active: true,
    });
  });

  it('rejects bad codes, percentages and windows', () => {
    expect(() => parsePromoInput({ ...valid, code: 'ab' })).toThrow('4–30 characters');
    expect(() => parsePromoInput({ ...valid, code: 'POP-ABCD-EFGH' })).toThrow('reserved for welcome offers');
    expect(() => parsePromoInput({ ...valid, discountPct: 0 })).toThrow('between');
    expect(() => parsePromoInput({ ...valid, discountPct: 101 })).toThrow('between');
    expect(() => parsePromoInput({ ...valid, startsAt: '2026-11-02', expiresAt: '2026-11-01' })).toThrow('after the start');
  });

  it('only returns present fields for a partial update', () => {
    expect(parsePromoInput({ active: false }, { partial: true })).toEqual({ active: false });
  });
});

describe('promoStatus', () => {
  it('reports used-up single-use codes and expired codes', () => {
    expect(promoStatus({ ...PROMO, usage_type: 'single_use' }, 1)).toBe('used_up');
    expect(promoStatus({ ...PROMO, expires_at: '2000-01-01T00:00:00Z' }, 0)).toBe('expired');
    expect(promoStatus({ ...PROMO, active: false }, 0)).toBe('inactive');
    expect(promoStatus(PROMO, 50)).toBe('active');
  });
});

describe('admin writes', () => {
  it('refuses a code that is already a partner code', async () => {
    queue({ data: null, error: null }, { data: { id: 'partner-1' }, error: null });
    await expect(createPromoCode({ code: 'STORE10', discountPct: 10 }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('requires an email to lock a code to its recipient', async () => {
    await expect(createPromoCode({ code: 'LOCKED1', discountPct: 10, restrictToEmail: true }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('won’t delete a code with usage history', async () => {
    queue({ count: 2, error: null });
    await expect(deletePromoCode('promo-1', 'admin-1')).rejects.toMatchObject({ statusCode: 409 });
  });
});
