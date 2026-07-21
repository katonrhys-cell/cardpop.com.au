import { vi, describe, it, expect } from 'vitest';

const mockRpc = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({ supabase: { from: vi.fn(), rpc: mockRpc }, default: {} }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { assertNoOpenWalletCheckout, reserveWalletCheckout, releaseWalletCheckout } from '../../src/services/walletService.js';

const makeStripe = (sessions) => ({
  checkout: { sessions: { list: vi.fn().mockResolvedValue({ data: sessions }) } },
});

describe('assertNoOpenWalletCheckout', () => {
  it('resolves when the customer has no open checkout sessions', async () => {
    const stripe = makeStripe([]);
    await expect(assertNoOpenWalletCheckout(stripe, 'cus_1')).resolves.toBeUndefined();
    expect(stripe.checkout.sessions.list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'open', limit: 100 });
  });

  it('throws a 409 when an open wallet-funded session already exists', async () => {
    const stripe = makeStripe([{ id: 'cs_1', metadata: { walletCents: '500' } }]);
    await expect(assertNoOpenWalletCheckout(stripe, 'cus_1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('ignores open sessions that are not wallet-funded', async () => {
    const stripe = makeStripe([
      { id: 'cs_2', metadata: {} },
      { id: 'cs_3', metadata: { walletCents: '0' } },
    ]);
    await expect(assertNoOpenWalletCheckout(stripe, 'cus_1')).resolves.toBeUndefined();
  });

  it('skips the check (no Stripe call) when there is no customer id', async () => {
    const stripe = makeStripe([]);
    await assertNoOpenWalletCheckout(stripe, null);
    expect(stripe.checkout.sessions.list).not.toHaveBeenCalled();
  });
});

describe('reserveWalletCheckout (atomic single-flight slot)', () => {
  it('resolves when the slot is acquired', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(reserveWalletCheckout('user-1')).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('reserve_wallet_checkout', { p_user_id: 'user-1' });
  });

  it('throws a 409 when another checkout already holds the slot', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(reserveWalletCheckout('user-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws (not a silent pass) when the reservation RPC errors', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(reserveWalletCheckout('user-1')).rejects.toBeInstanceOf(Error);
  });

  it('is a no-op without a user id (guest checkout has no wallet)', async () => {
    mockRpc.mockClear();
    await expect(reserveWalletCheckout(null)).resolves.toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('releaseWalletCheckout', () => {
  it('calls release_wallet_checkout for the user', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await releaseWalletCheckout('user-1');
    expect(mockRpc).toHaveBeenCalledWith('release_wallet_checkout', { p_user_id: 'user-1' });
  });

  it('never throws on RPC error (best-effort)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(releaseWalletCheckout('user-1')).resolves.toBeUndefined();
  });

  it('is a no-op without a user id', async () => {
    mockRpc.mockClear();
    await releaseWalletCheckout(null);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
