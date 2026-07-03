import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

// Per-table result queues: each supabase query (however it terminates) shifts
// the next result off its table's queue, so tests script exact call sequences.
const h = vi.hoisted(() => ({
  queues: {},
  getUserResult: { data: { user: null }, error: null },
}));
const mockSendWelcomeOffer = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/supabaseClient.js', () => {
  const nextResult = (table) => {
    const q = h.queues[table] || [];
    return Promise.resolve(q.length ? q.shift() : { data: null, error: null });
  };
  const makeBuilder = (table) => {
    const builder = {};
    for (const m of ['select', 'eq', 'is', 'insert', 'update']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(() => nextResult(table));
    // Queries awaited without a terminal method (bare update chains) resolve too.
    builder.then = (onFulfilled, onRejected) => nextResult(table).then(onFulfilled, onRejected);
    return builder;
  };
  const supabase = {
    from: vi.fn((table) => makeBuilder(table)),
    auth: { admin: { getUserById: vi.fn(() => Promise.resolve(h.getUserResult)) } },
  };
  return { supabase, default: supabase };
});
vi.mock('../../../src/utils/emailService.js', () => ({
  sendWelcomeOffer: mockSendWelcomeOffer,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  generateCode,
  normaliseCode,
  issueWelcomeOffer,
  validateTrialCode,
  markTrialRedeemed,
  validateWelcomeDiscount,
  welcomeDiscountCents,
  buildWelcomeDiscount,
} from '../../../src/services/welcomeOfferService.js';

const HOUR = 3600 * 1000;
const future = () => new Date(Date.now() + 30 * 24 * HOUR).toISOString();
const past = () => new Date(Date.now() - HOUR).toISOString();

const baseOffer = (over = {}) => ({
  id: 'offer-1',
  code: 'POP-ABCD-2345',
  trial_days: 30,
  discount_pct: 10,
  expires_at: future(),
  trial_redeemed_at: null,
  discount_redeemed_at: null,
  email_sent_at: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.queues = {};
  h.getUserResult = { data: { user: null }, error: null };
  mockSendWelcomeOffer.mockResolvedValue(true);
});

// ─── code generation ──────────────────────────────────────────────────────────

describe('generateCode', () => {
  it('produces POP-XXXX-XXXX codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toMatch(/^POP-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    }
  });

  it('never contains ambiguous characters (0, O, 1, I, L)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode().slice(4)).not.toMatch(/[0O1IL]/);
    }
  });
});

describe('normaliseCode', () => {
  it('trims and uppercases', () => {
    expect(normaliseCode('  pop-abcd-2345 ')).toBe('POP-ABCD-2345');
    expect(normaliseCode(null)).toBe('');
  });
});

// ─── issueWelcomeOffer ────────────────────────────────────────────────────────

describe('issueWelcomeOffer', () => {
  const newUser = (over = {}) => ({
    id: 'user-1',
    email: 'new@user.com',
    created_at: new Date().toISOString(),
    user_metadata: { full_name: 'Alex Chen' },
    ...over,
  });

  it('rejects unknown users', async () => {
    h.getUserResult = { data: { user: null }, error: { message: 'nope' } };
    await expect(issueWelcomeOffer('user-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses accounts older than the issue window', async () => {
    h.getUserResult = {
      data: { user: newUser({ created_at: new Date(Date.now() - 72 * HOUR).toISOString() }) },
      error: null,
    };
    await expect(issueWelcomeOffer('user-1')).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSendWelcomeOffer).not.toHaveBeenCalled();
  });

  it('creates the offer, emails the code, and stamps email_sent_at', async () => {
    h.getUserResult = { data: { user: newUser() }, error: null };
    h.queues.welcome_offers = [
      { data: null, error: null },              // no existing offer
      { data: baseOffer(), error: null },       // insert returns the new row
      { data: null, error: null },              // email_sent_at stamp
    ];

    const result = await issueWelcomeOffer('user-1');
    expect(result).toEqual({ issued: true, emailed: true });
    expect(mockSendWelcomeOffer).toHaveBeenCalledWith(expect.objectContaining({
      to: 'new@user.com',
      name: 'Alex',
      code: 'POP-ABCD-2345',
      trialDays: 30,
      discountPct: 10,
    }));
  });

  it('is idempotent: an already-emailed offer sends nothing again', async () => {
    h.getUserResult = { data: { user: newUser() }, error: null };
    h.queues.welcome_offers = [
      { data: baseOffer({ email_sent_at: past() }), error: null },
    ];

    const result = await issueWelcomeOffer('user-1');
    expect(result).toEqual({ issued: false, emailed: false });
    expect(mockSendWelcomeOffer).not.toHaveBeenCalled();
  });

  it('does not stamp email_sent_at when the send fails', async () => {
    h.getUserResult = { data: { user: newUser() }, error: null };
    mockSendWelcomeOffer.mockResolvedValue(false);
    h.queues.welcome_offers = [
      { data: baseOffer(), error: null }, // existing offer, never emailed
    ];

    const result = await issueWelcomeOffer('user-1');
    expect(result).toEqual({ issued: false, emailed: false });
  });
});

// ─── validateTrialCode ────────────────────────────────────────────────────────

describe('validateTrialCode', () => {
  it('confirms a valid, unredeemed code without touching the profile', async () => {
    h.queues.welcome_offers = [{ data: baseOffer(), error: null }];
    h.queues.profiles = [
      { data: { subscription_status: 'none', trial_ends_at: null }, error: null },
    ];

    const result = await validateTrialCode('user-1', ' pop-abcd-2345 ');
    expect(result).toEqual({ trialDays: 30 });
    // Nothing left queued means no writes were attempted anywhere.
    expect(h.queues.welcome_offers).toHaveLength(0);
    expect(h.queues.profiles).toHaveLength(0);
  });

  it('rejects a code that does not match the user’s offer', async () => {
    h.queues.welcome_offers = [{ data: baseOffer(), error: null }];
    await expect(validateTrialCode('user-1', 'POP-WRNG-9999')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an expired code', async () => {
    h.queues.welcome_offers = [{ data: baseOffer({ expires_at: past() }), error: null }];
    await expect(validateTrialCode('user-1', 'POP-ABCD-2345')).rejects.toMatchObject({ statusCode: 410 });
  });

  it('rejects a code whose trial was already claimed', async () => {
    h.queues.welcome_offers = [{ data: baseOffer({ trial_redeemed_at: past() }), error: null }];
    await expect(validateTrialCode('user-1', 'POP-ABCD-2345')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects when the user can already sell', async () => {
    h.queues.welcome_offers = [{ data: baseOffer(), error: null }];
    h.queues.profiles = [
      { data: { subscription_status: 'trialing', trial_ends_at: null }, error: null },
    ];
    await expect(validateTrialCode('user-1', 'POP-ABCD-2345')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('markTrialRedeemed', () => {
  it('is a no-op without a user id', async () => {
    await markTrialRedeemed(null);
    expect(h.queues.welcome_offers ?? []).toHaveLength(0);
  });

  it('swallows database errors (best-effort)', async () => {
    h.queues.welcome_offers = [{ data: null, error: { message: 'boom' } }];
    await expect(markTrialRedeemed('user-1')).resolves.toBeUndefined();
  });
});

// ─── discount half ────────────────────────────────────────────────────────────

describe('validateWelcomeDiscount', () => {
  it('returns the offer for a valid unused discount', async () => {
    h.queues.welcome_offers = [{ data: baseOffer(), error: null }];
    const offer = await validateWelcomeDiscount('user-1', 'pop-abcd-2345');
    expect(offer.id).toBe('offer-1');
  });

  it('rejects an already-used discount', async () => {
    h.queues.welcome_offers = [{ data: baseOffer({ discount_redeemed_at: past() }), error: null }];
    await expect(validateWelcomeDiscount('user-1', 'POP-ABCD-2345')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a code belonging to nobody / another account', async () => {
    h.queues.welcome_offers = [{ data: null, error: null }];
    await expect(validateWelcomeDiscount('user-1', 'POP-ABCD-2345')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('welcomeDiscountCents / buildWelcomeDiscount', () => {
  it('computes 10% of the item subtotal in cents, rounded', () => {
    expect(welcomeDiscountCents(baseOffer(), 12345)).toBe(1235);
    expect(welcomeDiscountCents(baseOffer(), 10000)).toBe(1000);
    expect(welcomeDiscountCents(baseOffer(), 0)).toBe(0);
  });

  it('creates a once-off AUD amount-off coupon', async () => {
    const stripeClient = { coupons: { create: vi.fn(async () => ({ id: 'coup_1' })) } };
    const built = await buildWelcomeDiscount(stripeClient, baseOffer(), 10000);
    expect(built).toEqual({ couponId: 'coup_1', discountCents: 1000 });
    expect(stripeClient.coupons.create).toHaveBeenCalledWith(expect.objectContaining({
      amount_off: 1000,
      currency: 'aud',
      duration: 'once',
    }));
  });

  it('returns null (no coupon) when the discount rounds to zero', async () => {
    const stripeClient = { coupons: { create: vi.fn() } };
    expect(await buildWelcomeDiscount(stripeClient, baseOffer(), 0)).toBeNull();
    expect(stripeClient.coupons.create).not.toHaveBeenCalled();
  });
});
