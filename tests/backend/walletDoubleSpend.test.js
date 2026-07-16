import { vi, describe, it, expect } from 'vitest';

vi.mock('../../src/utils/supabaseClient.js', () => ({ supabase: { from: vi.fn() }, default: {} }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { assertNoOpenWalletCheckout } from '../../src/services/walletService.js';

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
