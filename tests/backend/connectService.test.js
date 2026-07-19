import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mock the shared stripe + supabase clients before importing the service ────

const mockStripe = vi.hoisted(() => ({
  v2: { core: { accounts: { create: vi.fn(), retrieve: vi.fn() }, accountLinks: { create: vi.fn() } } },
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
  mockStripe.v2.core.accounts.create.mockReset();
  mockStripe.v2.core.accounts.retrieve.mockReset();
  supabaseState.updateError = null;
  supabaseState.lastUpdate = null;
  supabaseState.profile = null;
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

describe('payoutAccountName', () => {
  it('prefers the individual given/surname, falls back to the registered business name', () => {
    expect(payoutAccountName({ identity: { individual: { given_name: 'Maya', surname: 'Chen' } } })).toBe('Maya Chen');
    expect(payoutAccountName({ identity: { business_details: { registered_name: 'Cardtopia Pty Ltd' } } })).toBe('Cardtopia Pty Ltd');
    expect(payoutAccountName({ identity: {} })).toBe('');
    expect(payoutAccountName(null)).toBe('');
  });
});

describe('getConnectStatus payout name cross-check', () => {
  const activeAccount = (identity) => ({
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } },
    identity,
  });
  const makeRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() });

  it('flags a payout account whose KYC name differs from the profile name', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true,
      display_name: 'Maya Chen', legal_name: 'Maya Chen', business_name: null, payout_name_mismatch: false,
    };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(activeAccount({ individual: { given_name: 'John', surname: 'Smith' } }));

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    expect(mockStripe.v2.core.accounts.retrieve.mock.calls[0][1].include).toContain('identity');
    expect(supabaseState.lastUpdate).toEqual({ stripe_connect_onboarded: true, payout_name_mismatch: true });
  });

  it('clears the flag once the names agree again', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true,
      display_name: 'Maya Chen', legal_name: 'Maya Chen', business_name: null, payout_name_mismatch: true,
    };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(activeAccount({ individual: { given_name: 'Maya', surname: 'Chen' } }));

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    expect(supabaseState.lastUpdate).toEqual({ stripe_connect_onboarded: true, payout_name_mismatch: false });
  });

  it('accepts a payout account registered under the profile business name (sole trader)', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true,
      display_name: 'Maya Chen', legal_name: 'Maya Chen', business_name: 'Cardtopia Pty Ltd', payout_name_mismatch: false,
    };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(activeAccount({ business_details: { registered_name: 'Cardtopia Pty Ltd' } }));

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    // No change → no profile write at all.
    expect(supabaseState.lastUpdate).toBeNull();
  });

  it('does not flag while Stripe has no name yet (onboarding incomplete)', async () => {
    supabaseState.profile = {
      stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: false,
      display_name: 'Maya Chen', legal_name: null, business_name: null, payout_name_mismatch: false,
    };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue({ configuration: {}, identity: {} });

    await getConnectStatus({ user: { id: 'user-1' } }, makeRes());

    expect(supabaseState.lastUpdate).toBeNull();
  });
});
