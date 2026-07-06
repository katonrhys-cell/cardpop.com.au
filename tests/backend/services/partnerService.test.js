import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

// Per-table result queues (same pattern as welcomeOfferService.test.js): each
// supabase query shifts the next result off its table's queue, so tests script
// exact call sequences. Inserts are captured for assertions.
const h = vi.hoisted(() => ({
  queues: {},
  inserts: [],
  rpcCalls: [],
}));

vi.mock('../../../src/utils/supabaseClient.js', () => {
  const nextResult = (table) => {
    const q = h.queues[table] || [];
    return Promise.resolve(q.length ? q.shift() : { data: null, error: null });
  };
  const makeBuilder = (table) => {
    const builder = {};
    for (const m of ['select', 'eq', 'is', 'in', 'ilike', 'order', 'limit', 'update']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.insert = vi.fn((row) => {
      h.inserts.push({ table, row });
      return builder;
    });
    builder.maybeSingle = vi.fn(() => nextResult(table));
    builder.then = (onFulfilled, onRejected) => nextResult(table).then(onFulfilled, onRejected);
    return builder;
  };
  const supabase = {
    from: vi.fn((table) => makeBuilder(table)),
    rpc: vi.fn((fn, args) => {
      h.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    }),
  };
  return { supabase, default: supabase };
});
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  normalisePartnerCode,
  isWelcomeCodeFormat,
  validatePartnerCodeFormat,
  submitPartnerApplication,
  validatePartnerCode,
  shopItemsCents,
  partnerDiscountCents,
  buildPartnerDiscount,
  recordShopOrderReferral,
  recordSubscriptionReferral,
  recordPartnerClick,
} from '../../../src/services/partnerService.js';

const approvedPartner = (over = {}) => ({
  id: 'partner-1',
  user_id: 'partner-user',
  code: 'TOPDECK10',
  discount_pct: 10,
  commission_pct: 5,
  free_shipping: false,
  status: 'approved',
  ...over,
});

const validApplication = (over = {}) => ({
  partnerType: 'local_game_store',
  businessName: 'Top Deck Cards',
  website: 'https://topdeck.com.au',
  socials: 'https://instagram.com/topdeck',
  abn: '51824753556',
  phone: '0400000000',
  pitch: 'Parramatta LGS with weekly Pokémon and MTG events, 4k Instagram followers.',
  preferredCode: 'TOPDECK10',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.queues = {};
  h.inserts = [];
  h.rpcCalls = [];
});

// ─── code helpers ─────────────────────────────────────────────────────────────

describe('normalisePartnerCode', () => {
  it('trims and uppercases', () => {
    expect(normalisePartnerCode('  topdeck10 ')).toBe('TOPDECK10');
    expect(normalisePartnerCode(null)).toBe('');
  });
});

describe('isWelcomeCodeFormat', () => {
  it('recognises the POP-XXXX-XXXX welcome shape', () => {
    expect(isWelcomeCodeFormat('POP-K7QN-4WX2')).toBe(true);
    expect(isWelcomeCodeFormat('pop-k7qn-4wx2')).toBe(true);
  });

  it('rejects partner-style codes', () => {
    expect(isWelcomeCodeFormat('TOPDECK10')).toBe(false);
    expect(isWelcomeCodeFormat('POP-CULT')).toBe(false);
  });
});

describe('validatePartnerCodeFormat', () => {
  it('accepts 4–20 chars of letters, digits and hyphens', () => {
    expect(validatePartnerCodeFormat('topdeck10')).toBe('TOPDECK10');
    expect(validatePartnerCodeFormat('A-1-B')).toBe('A-1-B');
  });

  it('rejects too-short, too-long and bad characters', () => {
    expect(() => validatePartnerCodeFormat('AB')).toThrow();
    expect(() => validatePartnerCodeFormat('X'.repeat(21))).toThrow();
    expect(() => validatePartnerCodeFormat('BAD CODE!')).toThrow();
    expect(() => validatePartnerCodeFormat('-LEADINGHYPHEN')).toThrow();
  });

  it('rejects the reserved welcome-code namespace', () => {
    expect(() => validatePartnerCodeFormat('POP-K7QN-4WX2')).toThrow(/reserved/);
  });
});

// ─── application validation ───────────────────────────────────────────────────

describe('submitPartnerApplication', () => {
  it('rejects an unknown partner type', async () => {
    await expect(submitPartnerApplication('u1', validApplication({ partnerType: 'reseller' })))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a too-short pitch', async () => {
    await expect(submitPartnerApplication('u1', validApplication({ pitch: 'hi' })))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a malformed ABN', async () => {
    await expect(submitPartnerApplication('u1', validApplication({ abn: '123' })))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts an ABN with spaces', async () => {
    h.queues.partners = [{ data: { id: 'p1', status: 'pending' }, error: null }];
    await submitPartnerApplication('u1', validApplication({ abn: '51 824 753 556' }));
    expect(h.inserts[0].row.abn).toBe('51824753556');
  });

  it('rejects URLs smuggled into free-text fields', async () => {
    await expect(submitPartnerApplication('u1', validApplication({
      pitch: 'Check out https://spam.example for great deals and other things too',
    }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('inserts a pending application', async () => {
    h.queues.partners = [{ data: { id: 'p1', status: 'pending' }, error: null }];
    const result = await submitPartnerApplication('u1', validApplication());
    expect(result).toMatchObject({ id: 'p1', status: 'pending' });
    expect(h.inserts[0].row).toMatchObject({
      user_id: 'u1',
      partner_type: 'local_game_store',
      business_name: 'Top Deck Cards',
      preferred_code: 'TOPDECK10',
      status: 'pending',
    });
  });

  it('returns the existing application on duplicate submission', async () => {
    h.queues.partners = [
      { data: null, error: { code: '23505', message: 'duplicate' } },
      { data: { id: 'p1', status: 'pending' }, error: null },
    ];
    const result = await submitPartnerApplication('u1', validApplication());
    expect(result).toMatchObject({ id: 'p1', duplicate: true });
  });
});

// ─── checkout validation ──────────────────────────────────────────────────────

describe('validatePartnerCode', () => {
  it('returns the approved partner for a valid code', async () => {
    h.queues.partners = [{ data: approvedPartner(), error: null }];
    const partner = await validatePartnerCode('buyer-1', 'topdeck10');
    expect(partner.id).toBe('partner-1');
  });

  it('rejects unknown and unapproved codes alike', async () => {
    h.queues.partners = [{ data: null, error: null }];
    await expect(validatePartnerCode('buyer-1', 'NOPE1234')).rejects.toMatchObject({ statusCode: 400 });

    h.queues.partners = [{ data: approvedPartner({ status: 'pending' }), error: null }];
    await expect(validatePartnerCode('buyer-1', 'TOPDECK10')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks self-referral', async () => {
    h.queues.partners = [{ data: approvedPartner(), error: null }];
    await expect(validatePartnerCode('partner-user', 'TOPDECK10')).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─── discount maths ───────────────────────────────────────────────────────────

const LINES = [
  { type: 'shop', line_total_aud: 100 },
  { type: 'shop', line_total_aud: 25.5 },
  { type: 'listing', line_total_aud: 400 }, // marketplace item — excluded
];

describe('shopItemsCents / partnerDiscountCents', () => {
  it('sums shop lines only', () => {
    expect(shopItemsCents(LINES)).toBe(12550);
    expect(shopItemsCents([])).toBe(0);
  });

  it('applies the partner percentage to the shop subtotal', () => {
    expect(partnerDiscountCents(approvedPartner(), LINES)).toBe(1255);
    expect(partnerDiscountCents(approvedPartner({ discount_pct: 15 }), LINES)).toBe(1883);
  });
});

describe('buildPartnerDiscount', () => {
  it('creates a single-use amount-off coupon', async () => {
    const stripe = { coupons: { create: vi.fn().mockResolvedValue({ id: 'coupon-1' }) } };
    const built = await buildPartnerDiscount(stripe, approvedPartner(), 1255);
    expect(built).toEqual({ couponId: 'coupon-1', discountCents: 1255 });
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({
      amount_off: 1255,
      currency: 'aud',
      duration: 'once',
    }));
  });

  it('returns null when the discount rounds to zero', async () => {
    const stripe = { coupons: { create: vi.fn() } };
    expect(await buildPartnerDiscount(stripe, approvedPartner(), 0)).toBeNull();
    expect(stripe.coupons.create).not.toHaveBeenCalled();
  });
});

// ─── commission booking ───────────────────────────────────────────────────────

describe('recordShopOrderReferral', () => {
  it('books commission on the shop subtotal after discount', async () => {
    h.queues.partners = [{ data: approvedPartner(), error: null }];
    h.queues.partner_referrals = [{ data: null, error: null }];

    await recordShopOrderReferral({
      partnerId: 'partner-1',
      orderId: 'order-1',
      referredUserId: 'buyer-1',
      orderLines: LINES,
      discountCents: 1255,
    });

    // base = 12550 − 1255 = 11295¢; 5% commission = 565¢ (rounded)
    expect(h.inserts[0].row).toMatchObject({
      partner_id: 'partner-1',
      kind: 'shop_order',
      order_id: 'order-1',
      sale_amount_cents: 11295,
      discount_cents: 1255,
      commission_cents: 565,
      status: 'pending',
    });
  });

  it('skips partners that are no longer approved', async () => {
    h.queues.partners = [{ data: approvedPartner({ status: 'rejected' }), error: null }];
    await recordShopOrderReferral({
      partnerId: 'partner-1', orderId: 'order-1', orderLines: LINES, discountCents: 0,
    });
    expect(h.inserts).toHaveLength(0);
  });

  it('treats a duplicate order booking as a no-op (webhook retry)', async () => {
    h.queues.partners = [{ data: approvedPartner(), error: null }];
    h.queues.partner_referrals = [{ data: null, error: { code: '23505', message: 'dup' } }];
    // Must not throw — order fulfilment continues.
    await expect(recordShopOrderReferral({
      partnerId: 'partner-1', orderId: 'order-1', orderLines: LINES, discountCents: 0,
    })).resolves.toBeUndefined();
  });
});

describe('recordSubscriptionReferral', () => {
  it('books commission on the first payment', async () => {
    h.queues.partners = [{ data: approvedPartner(), error: null }];
    h.queues.partner_referrals = [{ data: null, error: null }];

    await recordSubscriptionReferral({
      partnerId: 'partner-1',
      referredUserId: 'seller-1',
      firstPaymentCents: 899,
    });

    expect(h.inserts[0].row).toMatchObject({
      partner_id: 'partner-1',
      kind: 'subscription',
      referred_user_id: 'seller-1',
      sale_amount_cents: 899,
      commission_cents: 45,
      status: 'pending',
    });
  });

  it('does nothing without a partner, user or amount', async () => {
    await recordSubscriptionReferral({ partnerId: null, referredUserId: 'u', firstPaymentCents: 899 });
    await recordSubscriptionReferral({ partnerId: 'p', referredUserId: null, firstPaymentCents: 899 });
    await recordSubscriptionReferral({ partnerId: 'p', referredUserId: 'u', firstPaymentCents: 0 });
    expect(h.inserts).toHaveLength(0);
  });
});

describe('recordPartnerClick', () => {
  it('increments via the atomic RPC for well-formed codes', async () => {
    await recordPartnerClick('topdeck10');
    expect(h.rpcCalls).toEqual([{ fn: 'increment_partner_clicks', args: { p_code: 'TOPDECK10' } }]);
  });

  it('ignores garbage codes without touching the database', async () => {
    await recordPartnerClick('<script>');
    await recordPartnerClick('');
    expect(h.rpcCalls).toHaveLength(0);
  });
});
