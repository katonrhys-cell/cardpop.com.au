import { vi, describe, it, expect, beforeEach } from 'vitest';

// Captures the last update() payload and returns a scriptable result. Supports
// the .or() filter used by the reservation compare-and-swap.
const state = vi.hoisted(() => ({ result: { data: null, error: null }, lastUpdate: null }));

vi.mock('../../../src/utils/supabaseClient.js', () => {
  const makeBuilder = () => {
    const b = {};
    for (const m of ['select', 'eq', 'is', 'or', 'insert', 'update']) {
      b[m] = vi.fn((...args) => {
        if (m === 'update') state.lastUpdate = args[0];
        return b;
      });
    }
    b.maybeSingle = vi.fn(() => Promise.resolve(state.result));
    b.then = (onF, onR) => Promise.resolve(state.result).then(onF, onR);
    return b;
  };
  const supabase = { from: vi.fn(() => makeBuilder()) };
  return { supabase, default: supabase };
});
vi.mock('../../../src/utils/emailService.js', () => ({ sendWelcomeOffer: vi.fn() }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { reserveWelcomeDiscount, releaseWelcomeDiscount } from '../../../src/services/welcomeOfferService.js';

beforeEach(() => {
  vi.clearAllMocks();
  state.result = { data: null, error: null };
  state.lastUpdate = null;
});

describe('reserveWelcomeDiscount', () => {
  it('resolves and stamps discount_reserved_at when the offer is claimed', async () => {
    state.result = { data: { id: 'off_1' }, error: null };
    await expect(reserveWelcomeDiscount('off_1')).resolves.toBeUndefined();
    expect(state.lastUpdate).toHaveProperty('discount_reserved_at');
    expect(state.lastUpdate.discount_reserved_at).toBeTruthy();
  });

  it('throws 409 when no row is updated (already reserved or redeemed)', async () => {
    state.result = { data: null, error: null };
    await expect(reserveWelcomeDiscount('off_1')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('releaseWelcomeDiscount', () => {
  it('clears the reservation', async () => {
    await releaseWelcomeDiscount('off_1');
    expect(state.lastUpdate).toEqual({ discount_reserved_at: null });
  });

  it('no-ops (no query) without an offer id', async () => {
    await releaseWelcomeDiscount(null);
    expect(state.lastUpdate).toBeNull();
  });
});
