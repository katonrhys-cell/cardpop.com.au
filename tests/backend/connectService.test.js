import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mock the shared stripe + supabase clients before importing the service ────

const mockStripe = vi.hoisted(() => ({
  accounts: { create: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

// A minimal supabase double: `from().update().eq()` resolves to { error }, and
// the resolved error is configurable per test.
const supabaseState = vi.hoisted(() => ({ updateError: null, lastUpdate: null }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const sb = {
    from: () => ({
      update: (payload) => {
        supabaseState.lastUpdate = payload;
        return { eq: () => Promise.resolve({ error: supabaseState.updateError }) };
      },
    }),
  };
  return { supabase: sb, default: sb };
});

import { ensureSellerConnectAccount } from '../../src/services/connectService.js';

beforeEach(() => {
  mockStripe.accounts.create.mockReset();
  supabaseState.updateError = null;
  supabaseState.lastUpdate = null;
});

describe('ensureSellerConnectAccount', () => {
  it('is idempotent: returns the existing id and makes no Stripe call', async () => {
    const result = await ensureSellerConnectAccount('user-1', 'acct_existing');

    expect(result).toEqual({ accountId: 'acct_existing', created: false });
    expect(mockStripe.accounts.create).not.toHaveBeenCalled();
    expect(supabaseState.lastUpdate).toBeNull();
  });

  it('creates an AU Express account and persists it when none exists', async () => {
    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_new' });

    const result = await ensureSellerConnectAccount('user-2', null);

    expect(result).toEqual({ accountId: 'acct_new', created: true });
    const args = mockStripe.accounts.create.mock.calls[0][0];
    expect(args.type).toBe('express');
    expect(args.country).toBe('AU');
    expect(args.capabilities.transfers.requested).toBe(true);
    expect(args.metadata.cardpop_user_id).toBe('user-2');
    // The new id is written back to the profile, not yet onboarded.
    expect(supabaseState.lastUpdate).toEqual({
      stripe_connect_account_id: 'acct_new',
      stripe_connect_onboarded: false,
    });
  });

  it('throws if the account is created but cannot be persisted (avoids silent orphan)', async () => {
    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_orphan' });
    supabaseState.updateError = { message: 'db down' };

    await expect(ensureSellerConnectAccount('user-3', null)).rejects.toThrow(/db down/);
  });
});
