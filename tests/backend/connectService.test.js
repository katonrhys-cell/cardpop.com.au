import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mock the shared stripe + supabase clients before importing the service ────

const mockStripe = vi.hoisted(() => ({
  accounts: { create: vi.fn(), retrieve: vi.fn(), createLoginLink: vi.fn() },
  accountLinks: { create: vi.fn() },
}));
vi.mock('../../src/utils/stripeClient.js', () => ({ default: mockStripe }));

// A minimal supabase double: `from().update().eq()` resolves to { error },
// `from().select().eq().maybeSingle()` resolves to { data: profile } — both
// configurable per test.
const supabaseState = vi.hoisted(() => ({ updateError: null, lastUpdate: null, profile: null }));
vi.mock('../../src/utils/supabaseClient.js', () => {
  const sb = {
    from: () => ({
      update: (payload) => {
        supabaseState.lastUpdate = payload;
        return { eq: () => Promise.resolve({ error: supabaseState.updateError }) };
      },
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: supabaseState.profile, error: null }) }),
      }),
    }),
  };
  return { supabase: sb, default: sb };
});

import { ensureSellerConnectAccount, getConnectStatus } from '../../src/services/connectService.js';
import { buildSellerAccountParams, isPayoutReady, payoutAccountName } from '../../src/utils/sellerAccountShape.js';

beforeEach(() => {
  mockStripe.accounts.create.mockReset();
  mockStripe.accounts.retrieve.mockReset();
  supabaseState.updateError = null;
  supabaseState.lastUpdate = null;
  supabaseState.profile = null;
});

describe('buildSellerAccountParams', () => {
  it('builds an AU Express account requesting card_payments + transfers', () => {
    const params = buildSellerAccountParams('user-1', { email: 'a@b.com', displayName: 'Ada' });
    expect(params.type).toBe('express');
    expect(params.country).toBe('AU');
    expect(params.capabilities.transfers.requested).toBe(true);
    // Requested alongside transfers because transfers-only account creation
    // requires special platform approval from Stripe.
    expect(params.capabilities.card_payments.requested).toBe(true);
    expect(params.email).toBe('a@b.com');
    expect(params.business_profile.name).toBe('Ada');
    expect(params.metadata.cardpop_user_id).toBe('user-1');
  });

  it('omits email / business_profile when not provided (no undefined keys)', () => {
    const params = buildSellerAccountParams('user-2');
    expect('email' in params).toBe(false);
    expect('business_profile' in params).toBe(false);
  });
});

describe('isPayoutReady', () => {
  it('is true only when payouts are enabled and the transfers capability is active', () => {
    expect(isPayoutReady({ payouts_enabled: true, capabilities: { transfers: 'active' } })).toBe(true);
    expect(isPayoutReady({ payouts_enabled: true, capabilities: { transfers: 'pending' } })).toBe(false);
    expect(isPayoutReady({ payouts_enabled: false, capabilities: { transfers: 'active' } })).toBe(false);
    expect(isPayoutReady(null)).toBe(false);
    expect(isPayoutReady({})).toBe(false);
  });
});

describe('ensureSellerConnectAccount', () => {
  it('is idempotent: returns the existing id and makes no Stripe call', async () => {
    const result = await ensureSellerConnectAccount('user-1', 'acct_existing');

    expect(result).toEqual({ accountId: 'acct_existing', created: false });
    expect(mockStripe.accounts.create).not.toHaveBeenCalled();
    expect(supabaseState.lastUpdate).toBeNull();
  });

  it('creates an Express account and persists it when none exists', async () => {
    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_new' });

    const result = await ensureSellerConnectAccount('user-2', null, { email: 'a@b.com', displayName: 'Ada' });

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

describe('payoutAccountName', () => {
  it('prefers the individual first/last name, falls back to the company name', () => {
    expect(payoutAccountName({ individual: { first_name: 'Maya', last_name: 'Chen' } })).toBe('Maya Chen');
    expect(payoutAccountName({ company: { name: 'Cardtopia Pty Ltd' } })).toBe('Cardtopia Pty Ltd');
    expect(payoutAccountName({})).toBe('');
    expect(payoutAccountName(null)).toBe('');
  });
});

describe('getConnectStatus payout name cross-check', () => {
  const activeAccount = (fields) => ({
    payouts_enabled: true,
    capabilities: { transfers: 'active' },
    details_submitted: true,
    ...fields,
  });
  const makeRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() });

  it('flags a payout account whose KYC name differs from the profile name', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true,
      display_name: 'Maya Chen', legal_name: 'Maya Chen', business_name: null, payout_name_mismatch: false,
    };
    mockStripe.accounts.retrieve.mockResolvedValue(activeAccount({ individual: { first_name: 'John', last_name: 'Smith' } }));

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith('acct_1');
    expect(supabaseState.lastUpdate).toEqual({ stripe_connect_onboarded: true, payout_name_mismatch: true });
  });

  it('clears the flag once the names agree again', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true,
      display_name: 'Maya Chen', legal_name: 'Maya Chen', business_name: null, payout_name_mismatch: true,
    };
    mockStripe.accounts.retrieve.mockResolvedValue(activeAccount({ individual: { first_name: 'Maya', last_name: 'Chen' } }));

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    expect(supabaseState.lastUpdate).toEqual({ stripe_connect_onboarded: true, payout_name_mismatch: false });
  });

  it('accepts a payout account registered under the profile business name (sole trader)', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true,
      display_name: 'Maya Chen', legal_name: 'Maya Chen', business_name: 'Cardtopia Pty Ltd', payout_name_mismatch: false,
    };
    mockStripe.accounts.retrieve.mockResolvedValue(activeAccount({ company: { name: 'Cardtopia Pty Ltd' } }));

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    // No change → no profile write at all.
    expect(supabaseState.lastUpdate).toBeNull();
  });

  it('does not flag while Stripe has no name yet (onboarding incomplete)', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: false,
      display_name: 'Maya Chen', legal_name: null, business_name: null, payout_name_mismatch: false,
    };
    mockStripe.accounts.retrieve.mockResolvedValue({ payouts_enabled: false, capabilities: {} });

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    expect(supabaseState.lastUpdate).toBeNull();
  });
});
