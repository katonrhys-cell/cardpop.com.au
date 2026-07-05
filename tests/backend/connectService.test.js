import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mock the shared stripe + supabase clients before importing the service ────

const mockStripe = vi.hoisted(() => ({
  v2: { core: { accounts: { create: vi.fn(), retrieve: vi.fn() }, accountLinks: { create: vi.fn() } } },
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
import { buildSellerAccountParams, isPayoutReady } from '../../src/utils/sellerAccountShape.js';

beforeEach(() => {
  mockStripe.v2.core.accounts.create.mockReset();
  supabaseState.updateError = null;
  supabaseState.lastUpdate = null;
});

describe('buildSellerAccountParams', () => {
  it('builds an AU recipient account requesting stripe_transfers', () => {
    const params = buildSellerAccountParams('user-1', { email: 'a@b.com', displayName: 'Ada' });
    expect(params.identity.country).toBe('au');
    expect(params.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested).toBe(true);
    expect(params.defaults.responsibilities.losses_collector).toBe('application');
    expect(params.defaults.responsibilities.fees_collector).toBe('application');
    expect(params.dashboard).toBe('express');
    expect(params.contact_email).toBe('a@b.com');
    expect(params.display_name).toBe('Ada');
    expect(params.metadata.cardpop_user_id).toBe('user-1');
  });

  it('omits contact_email / display_name when not provided (no undefined keys)', () => {
    const params = buildSellerAccountParams('user-2');
    expect('contact_email' in params).toBe(false);
    expect('display_name' in params).toBe(false);
  });
});

describe('isPayoutReady', () => {
  it('is true only when the recipient stripe_transfers capability is active', () => {
    const active = { configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } } };
    const pending = { configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'pending' } } } } } };
    expect(isPayoutReady(active)).toBe(true);
    expect(isPayoutReady(pending)).toBe(false);
    expect(isPayoutReady(null)).toBe(false);
    expect(isPayoutReady({})).toBe(false);
  });
});

describe('ensureSellerConnectAccount', () => {
  it('is idempotent: returns the existing id and makes no Stripe call', async () => {
    const result = await ensureSellerConnectAccount('user-1', 'acct_existing');

    expect(result).toEqual({ accountId: 'acct_existing', created: false });
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
    expect(supabaseState.lastUpdate).toBeNull();
  });

  it('creates a v2 recipient account and persists it when none exists', async () => {
    mockStripe.v2.core.accounts.create.mockResolvedValue({ id: 'acct_new' });

    const result = await ensureSellerConnectAccount('user-2', null, { email: 'a@b.com', displayName: 'Ada' });

    expect(result).toEqual({ accountId: 'acct_new', created: true });
    const args = mockStripe.v2.core.accounts.create.mock.calls[0][0];
    expect(args.identity.country).toBe('au');
    expect(args.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested).toBe(true);
    expect(args.metadata.cardpop_user_id).toBe('user-2');
    // The new id is written back to the profile, not yet onboarded.
    expect(supabaseState.lastUpdate).toEqual({
      stripe_connect_account_id: 'acct_new',
      stripe_connect_onboarded: false,
    });
  });

  it('throws if the account is created but cannot be persisted (avoids silent orphan)', async () => {
    mockStripe.v2.core.accounts.create.mockResolvedValue({ id: 'acct_orphan' });
    supabaseState.updateError = { message: 'db down' };

    await expect(ensureSellerConnectAccount('user-3', null)).rejects.toThrow(/db down/);
  });
});
