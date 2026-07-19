import { vi, describe, it, expect, beforeEach } from 'vitest';

// Unit tests for the informational payer-name cross-check stored on orders by
// the checkout webhook: the (unverified) name typed at Stripe Checkout vs the
// buyer's account name. null = unknown/not comparable, never a hard signal.

const state = vi.hoisted(() => ({ buyer: null, throwOnRead: false }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const sb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => state.throwOnRead
            ? Promise.reject(new Error('db down'))
            : Promise.resolve({ data: state.buyer, error: null }),
        }),
      }),
    }),
  };
  return { supabase: sb, default: sb };
});
vi.mock('../../src/utils/stripeClient.js', () => ({ default: {} }));

import { computePayerNameMismatch } from '../../src/services/stripeWebhookService.js';

beforeEach(() => {
  state.buyer = null;
  state.throwOnRead = false;
});

describe('computePayerNameMismatch', () => {
  it('is null for guests and missing payer names', async () => {
    expect(await computePayerNameMismatch(null, 'Maya Chen')).toBeNull();
    expect(await computePayerNameMismatch('user-1', '')).toBeNull();
    expect(await computePayerNameMismatch('user-1', '   ')).toBeNull();
    expect(await computePayerNameMismatch('user-1', undefined)).toBeNull();
  });

  it('is null when the buyer has no account name to compare against', async () => {
    state.buyer = { display_name: null, legal_name: null };
    expect(await computePayerNameMismatch('user-1', 'Maya Chen')).toBeNull();
  });

  it('is false when the payer matches the account name (tolerant matching)', async () => {
    state.buyer = { display_name: 'Maya Chen', legal_name: null };
    expect(await computePayerNameMismatch('user-1', 'MAYA CHEN')).toBe(false);
    expect(await computePayerNameMismatch('user-1', 'Maya Li Chen')).toBe(false);
  });

  it('prefers the ID-verified legal name over the display name', async () => {
    state.buyer = { display_name: 'CardShark99', legal_name: 'Maya Chen' };
    expect(await computePayerNameMismatch('user-1', 'Maya Chen')).toBe(false);
  });

  it('is true when the payer name differs from the account name', async () => {
    state.buyer = { display_name: 'Maya Chen', legal_name: null };
    expect(await computePayerNameMismatch('user-1', 'John Smith')).toBe(true);
  });

  it('fails open to null on a lookup error', async () => {
    state.throwOnRead = true;
    expect(await computePayerNameMismatch('user-1', 'Maya Chen')).toBeNull();
  });
});
