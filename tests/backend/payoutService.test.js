import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { payoutSeller } from '../../src/services/payoutService.js';

function builder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), update: vi.fn(() => b), eq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const queue = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));
const stripeWith = (impl) => ({ transfers: { create: vi.fn(impl) } });

beforeEach(() => vi.clearAllMocks());

describe('payoutSeller', () => {
  it('returns none for a missing seller or non-positive proceeds', async () => {
    expect(await payoutSeller(stripeWith(), { sellerId: null, sellerProceeds: 10 })).toEqual({ status: 'none' });
    expect(await payoutSeller(stripeWith(), { sellerId: 's', sellerProceeds: 0 })).toEqual({ status: 'none' });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('transfers to a connected, onboarded seller and stamps the order', async () => {
    const stripe = stripeWith(async () => ({ id: 'tr_99' }));
    queue(
      builder({ data: { stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true, wallet_balance_aud: 0 } }), // profile
      builder({ error: null }), // orders update
    );
    const res = await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 230, orderId: 'o1' });
    expect(res).toEqual({ status: 'transferred', transferId: 'tr_99' });
    expect(stripe.transfers.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 23000, currency: 'aud', destination: 'acct_1' }));
    const ordersUpdate = mockSupabase.from.mock.results[1].value;
    expect(ordersUpdate.update).toHaveBeenCalledWith({ stripe_transfer_id: 'tr_99', payout_status: 'transferred' });
  });

  it('falls back to a wallet credit when the transfer fails', async () => {
    const stripe = stripeWith(async () => { throw new Error('transfer boom'); });
    queue(
      builder({ data: { stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true } }), // profile
      builder({ error: null }), // orders payout_status update
    );
    const res = await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 100, orderId: 'o1' });
    expect(res).toEqual({ status: 'wallet_credited', fallback: true });
    // Wallet credit now goes through the atomic RPC, not a read-modify-write update.
    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_wallet_balance', { p_user: 's1', p_delta: 100 });
  });

  it('credits the wallet when the seller is not Connect-onboarded', async () => {
    const stripe = stripeWith();
    queue(
      builder({ data: { stripe_connect_account_id: null, stripe_connect_onboarded: false } }),
      builder({ error: null }), // orders payout_status update
    );
    const res = await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 80, orderId: 'o1' });
    expect(res).toEqual({ status: 'wallet_credited' });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_wallet_balance', { p_user: 's1', p_delta: 80 });
  });
});
