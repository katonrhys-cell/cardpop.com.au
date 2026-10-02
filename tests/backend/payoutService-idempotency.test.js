import { vi, describe, it, expect, beforeEach } from 'vitest';

// payoutSeller takes an optional idempotencyKey (used by the admin dispute
// release so a repeated release returns the original transfer instead of
// sending the money twice). Without one, the transfer call is unchanged.

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { payoutSeller } from '../../src/services/payoutService.js';

function builder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), update: vi.fn(() => b), eq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}
const connected = () => builder({ data: { stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true } });

beforeEach(() => vi.clearAllMocks());

describe('payoutSeller idempotency key', () => {
  it('passes the key to Stripe as a request option', async () => {
    const stripe = { transfers: { create: vi.fn(async () => ({ id: 'tr_1' })) } };
    mockSupabase.from.mockReturnValueOnce(connected());
    await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 10, idempotencyKey: 'dispute-release-d1' });
    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000, destination: 'acct_1' }),
      { idempotencyKey: 'dispute-release-d1' },
    );
  });

  it('calls Stripe exactly as before when no key is given', async () => {
    const stripe = { transfers: { create: vi.fn(async () => ({ id: 'tr_1' })) } };
    mockSupabase.from.mockReturnValueOnce(connected());
    await payoutSeller(stripe, { sellerId: 's1', sellerProceeds: 10 });
    expect(stripe.transfers.create.mock.calls[0]).toHaveLength(1);
  });
});
