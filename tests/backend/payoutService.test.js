import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { payoutSeller, reverseSellerPayout } from '../../src/services/payoutService.js';

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
      builder({ data: { stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true, wallet_balance_aud: 50 } }), // profile
      builder({ error: null }), // wallet update
      builder({ error: null }), // orders update
    );
    const res = await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 100, orderId: 'o1' });
    expect(res).toEqual({ status: 'wallet_credited', fallback: true });
    const walletUpdate = mockSupabase.from.mock.results[1].value;
    expect(walletUpdate.update).toHaveBeenCalledWith({ wallet_balance_aud: 150 });
  });

  it('credits the wallet when the seller is not Connect-onboarded', async () => {
    const stripe = stripeWith();
    queue(
      builder({ data: { stripe_connect_account_id: null, stripe_connect_onboarded: false, wallet_balance_aud: 20 } }),
      builder({ error: null }), // wallet update
      builder({ error: null }), // orders update
    );
    const res = await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 80, orderId: 'o1' });
    expect(res).toEqual({ status: 'wallet_credited' });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    const walletUpdate = mockSupabase.from.mock.results[1].value;
    expect(walletUpdate.update).toHaveBeenCalledWith({ wallet_balance_aud: 100 });
  });
});

const stripeReversal = (impl = async () => ({ id: 'trr_1' })) => ({ transfers: { createReversal: vi.fn(impl) } });

describe('reverseSellerPayout', () => {
  it('reverses a Connect transfer for a transferred payout', async () => {
    const stripe = stripeReversal();
    const res = await reverseSellerPayout(stripe, { id: 'o1', payout_status: 'transferred', stripe_transfer_id: 'tr_1' });
    expect(res).toEqual({ action: 'transfer_reversed' });
    expect(stripe.transfers.createReversal).toHaveBeenCalledWith('tr_1');
  });

  it('claws back a wallet credit, never below zero', async () => {
    const stripe = stripeReversal();
    queue(
      builder({ data: { wallet_balance_aud: 50 } }), // seller wallet read
      builder({ error: null }),                       // wallet update
    );
    const res = await reverseSellerPayout(stripe, { id: 'o2', seller_id: 's2', payout_status: 'wallet_credited', seller_proceeds_aud: 80 });
    expect(res).toEqual({ action: 'wallet_clawback' });
    const walletUpdate = mockSupabase.from.mock.results[1].value;
    expect(walletUpdate.update).toHaveBeenCalledWith({ wallet_balance_aud: 0 }); // max(0, 50 - 80)
  });

  it('does nothing when there was no payout to reverse', async () => {
    const stripe = stripeReversal();
    expect(await reverseSellerPayout(stripe, { id: 'o3', payout_status: 'pending' })).toEqual({ action: 'none' });
    expect(await reverseSellerPayout(stripe, null)).toEqual({ action: 'none' });
    expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
  });

  it('returns failed (does not throw) when the reversal errors', async () => {
    const stripe = stripeReversal(async () => { throw new Error('already reversed'); });
    const res = await reverseSellerPayout(stripe, { id: 'o4', payout_status: 'transferred', stripe_transfer_id: 'tr_4' });
    expect(res).toEqual({ action: 'failed' });
  });
});
