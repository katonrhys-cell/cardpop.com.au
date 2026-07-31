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
import {
  buildSellerAccountParams,
  buildLegacyExpressAccountParams,
  createSellerConnectAccount,
  isPayoutReady,
  payoutAccountName,
  sellerLossLiability,
} from '../../src/utils/sellerAccountShape.js';

beforeEach(() => {
  mockStripe.accounts.create.mockReset();
  mockStripe.accounts.retrieve.mockReset();
  supabaseState.updateError = null;
  supabaseState.lastUpdate = null;
  supabaseState.profile = null;
  delete process.env.STRIPE_CONNECT_LEGACY_EXPRESS;
});

describe('buildSellerAccountParams', () => {
  it('builds an AU account with Managed Risk, Stripe-managed pricing and the Express Dashboard', () => {
    const params = buildSellerAccountParams('user-1', { email: 'a@b.com', displayName: 'Ada' });
    // `type` and `controller` are mutually exclusive in the Accounts API.
    expect('type' in params).toBe(false);
    expect(params.controller).toEqual({
      fees: { payer: 'account' },
      losses: { payments: 'stripe' },
      requirement_collection: 'stripe',
      stripe_dashboard: { type: 'express' },
    });
    expect(params.country).toBe('AU');
    expect(params.capabilities.transfers.requested).toBe(true);
    // Requested alongside transfers because transfers-only account creation
    // requires special platform approval from Stripe.
    expect(params.capabilities.card_payments.requested).toBe(true);
    expect(params.email).toBe('a@b.com');
    expect(params.business_profile.name).toBe('Ada');
    expect(params.metadata.cardpop_user_id).toBe('user-1');
    expect(params.metadata.cardpop_account_config).toBe('managed_risk');
  });

  it('omits email / business_profile when not provided (no undefined keys)', () => {
    const params = buildSellerAccountParams('user-2');
    expect('email' in params).toBe(false);
    expect('business_profile' in params).toBe(false);
  });
});

describe('buildLegacyExpressAccountParams', () => {
  it('keeps the pre-Managed-Risk shape for the fallback path', () => {
    const params = buildLegacyExpressAccountParams('user-1', { email: 'a@b.com' });
    expect(params.type).toBe('express');
    expect('controller' in params).toBe(false);
    expect(params.country).toBe('AU');
    expect(params.capabilities.transfers.requested).toBe(true);
    expect(params.metadata.cardpop_account_config).toBe('express');
  });
});

describe('createSellerConnectAccount', () => {
  const invalidRequest = (message) => Object.assign(new Error(message), { type: 'invalid_request_error' });

  it('creates the Managed Risk shape when Stripe accepts it', async () => {
    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_mr' });

    const result = await createSellerConnectAccount(mockStripe, 'user-1');

    expect(result).toEqual({ account: { id: 'acct_mr' }, config: 'managed_risk' });
    expect(mockStripe.accounts.create).toHaveBeenCalledTimes(1);
    expect(mockStripe.accounts.create.mock.calls[0][0].controller.losses.payments).toBe('stripe');
    // A stable idempotency key stops an SDK retry after a timeout from creating
    // a second account for the same seller.
    expect(mockStripe.accounts.create.mock.calls[0][1]).toEqual({ idempotencyKey: 'cardpop_seller_user-1_managed_risk' });
  });

  it('falls back to legacy Express when Stripe rejects the configuration', async () => {
    mockStripe.accounts.create
      .mockRejectedValueOnce(invalidRequest('Managed Risk is not enabled for your merchant'))
      .mockResolvedValueOnce({ id: 'acct_express' });

    const result = await createSellerConnectAccount(mockStripe, 'user-2');

    expect(result.config).toBe('express');
    expect(result.account.id).toBe('acct_express');
    expect(result.fallbackReason).toMatch(/not enabled/);
    expect(mockStripe.accounts.create.mock.calls[1][0].type).toBe('express');
  });

  it('re-throws the original error when the fallback fails too (bad request data)', async () => {
    mockStripe.accounts.create
      .mockRejectedValueOnce(invalidRequest('Invalid email address'))
      .mockRejectedValueOnce(invalidRequest('Invalid email address (retry)'));

    await expect(createSellerConnectAccount(mockStripe, 'user-3', { email: 'nope' })).rejects.toThrow('Invalid email address');
  });

  it('does not retry on a connection error — a second attempt could orphan an account', async () => {
    const connErr = Object.assign(new Error('network down'), { type: 'StripeConnectionError' });
    mockStripe.accounts.create.mockRejectedValueOnce(connErr);

    await expect(createSellerConnectAccount(mockStripe, 'user-4')).rejects.toThrow('network down');
    expect(mockStripe.accounts.create).toHaveBeenCalledTimes(1);
  });

  it('STRIPE_CONNECT_LEGACY_EXPRESS=true pins new accounts back to Express', async () => {
    process.env.STRIPE_CONNECT_LEGACY_EXPRESS = 'true';
    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_pinned' });

    const result = await createSellerConnectAccount(mockStripe, 'user-5');

    expect(result.config).toBe('express');
    expect(mockStripe.accounts.create).toHaveBeenCalledTimes(1);
    expect(mockStripe.accounts.create.mock.calls[0][0].type).toBe('express');
  });
});

describe('sellerLossLiability', () => {
  it('reports Stripe only when the account actually carries Managed Risk', () => {
    expect(sellerLossLiability({ controller: { losses: { payments: 'stripe' } } })).toBe('stripe');
    expect(sellerLossLiability({ controller: { losses: { payments: 'application' } } })).toBe('platform');
    // Legacy Express accounts, and any response without the hash, are assumed
    // platform-liable rather than reporting protection that may not exist.
    expect(sellerLossLiability({ controller: { type: 'application' } })).toBe('platform');
    expect(sellerLossLiability({})).toBe('platform');
    expect(sellerLossLiability(null)).toBe('platform');
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

  it('creates a Managed Risk account and persists it when none exists', async () => {
    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_new' });

    const result = await ensureSellerConnectAccount('user-2', null, { email: 'a@b.com', displayName: 'Ada' });

    expect(result).toEqual({ accountId: 'acct_new', created: true });
    const args = mockStripe.accounts.create.mock.calls[0][0];
    expect(args.controller.losses.payments).toBe('stripe');
    expect(args.country).toBe('AU');
    expect(args.capabilities.transfers.requested).toBe(true);
    expect(args.metadata.cardpop_user_id).toBe('user-2');
    // The new id is written back to the profile, not yet onboarded.
    expect(supabaseState.lastUpdate).toEqual({
      stripe_connect_account_id: 'acct_new',
      stripe_connect_onboarded: false,
    });
  });

  it('still onboards the seller when Stripe rejects Managed Risk (degrades, never blocks)', async () => {
    mockStripe.accounts.create
      .mockRejectedValueOnce(Object.assign(new Error('not enabled'), { type: 'invalid_request_error' }))
      .mockResolvedValueOnce({ id: 'acct_fallback' });

    const result = await ensureSellerConnectAccount('user-fb', null);

    expect(result).toEqual({ accountId: 'acct_fallback', created: true });
    expect(supabaseState.lastUpdate).toEqual({
      stripe_connect_account_id: 'acct_fallback',
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
