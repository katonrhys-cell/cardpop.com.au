import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleDisputeCreated, handleDisputeClosed } from '../../src/services/disputeService.js';

// Builder whose terminal `.maybeSingle()` resolves to `result`, and which is
// also awaitable (for `.update().eq()` / `.insert()` chains).
function builder(result = { data: null, error: null }) {
  const b = {
    select: vi.fn(() => b), insert: vi.fn(() => b), update: vi.fn(() => b), eq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return b;
}
const queue = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

const fakeStripe = () => ({ transfers: { createReversal: vi.fn().mockResolvedValue({ id: 'trr_1' }) } });

beforeEach(() => vi.clearAllMocks());

const dispute = (over = {}) => ({
  id: 'dp_1', payment_intent: 'pi_1', amount: 25000, reason: 'fraudulent', status: 'needs_response', ...over,
});

describe('handleDisputeCreated', () => {
  it('reverses an already-transferred payout, freezes the order, records + notifies', async () => {
    const stripe = fakeStripe();
    queue(
      builder({ data: null }), // payment_disputes idempotency lookup → not seen
      builder({ data: { id: 'o1', seller_id: 's1', buyer_id: 'b1', stripe_transfer_id: 'tr_1', payout_status: 'transferred', seller_proceeds_aud: 230 } }), // order lookup
      builder({ error: null }), // orders update payout_status=frozen
      builder({ error: null }), // payment_disputes insert
      builder({ data: [{ id: 'admin-1' }] }), // admins
      builder({ error: null }), // notifications insert
    );

    await handleDisputeCreated(stripe, dispute());

    expect(stripe.transfers.createReversal).toHaveBeenCalledWith('tr_1');
    // order frozen
    const ordersUpdate = mockSupabase.from.mock.results[2].value;
    expect(ordersUpdate.update).toHaveBeenCalledWith({ payout_status: 'frozen' });
    // dispute recorded with the reversal action
    const disputeInsert = mockSupabase.from.mock.results[3].value;
    expect(disputeInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      stripe_dispute_id: 'dp_1', order_id: 'o1', amount_aud: 250, payout_action: 'transfer_reversed',
    }));
  });

  it('claws back a wallet credit when the seller was paid to their wallet', async () => {
    const stripe = fakeStripe();
    queue(
      builder({ data: null }), // idempotency lookup
      builder({ data: { id: 'o2', seller_id: 's2', buyer_id: 'b2', stripe_transfer_id: null, payout_status: 'wallet_credited', seller_proceeds_aud: 100 } }), // order
      builder({ error: null }), // orders freeze
      builder({ error: null }), // dispute insert
      builder({ data: [] }),    // admins
    );

    await handleDisputeCreated(stripe, dispute({ payment_intent: 'pi_2' }));

    expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
    // Clawback now goes through the atomic RPC (negative delta), not a read-modify-write.
    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_wallet_balance', { p_user: 's2', p_delta: -100 });
  });

  it('records the dispute even when no order matches', async () => {
    const stripe = fakeStripe();
    queue(
      builder({ data: null }), // idempotency lookup
      builder({ data: null }), // order lookup → none
      builder({ error: null }), // payment_disputes insert
      builder({ data: [] }),    // admins
    );

    await handleDisputeCreated(stripe, dispute({ payment_intent: 'pi_missing' }));

    const disputeInsert = mockSupabase.from.mock.results[2].value;
    expect(disputeInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      stripe_dispute_id: 'dp_1', payout_action: 'none',
    }));
    expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
  });

  it('never throws even if the DB blows up (webhook must still ack)', async () => {
    mockSupabase.from.mockImplementation(() => { throw new Error('db down'); });
    await expect(handleDisputeCreated(fakeStripe(), dispute())).resolves.toBeUndefined();
  });
});

describe('handleDisputeCreated — redelivery', () => {
  it('does nothing when the dispute was already recorded (Stripe redelivered the event)', async () => {
    const stripe = fakeStripe();
    queue(builder({ data: { id: 'pd_existing' } })); // idempotency lookup → already seen
    await handleDisputeCreated(stripe, dispute());
    expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    // Only the lookup ran — no freeze, no second insert, no notifications.
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('handleDisputeClosed', () => {
  it('updates the dispute status and notifies admins', async () => {
    const updateBuilder = builder({ error: null });
    queue(updateBuilder, builder({ data: [{ id: 'admin-1' }] }), builder({ error: null }));

    await handleDisputeClosed(fakeStripe(), dispute({ status: 'lost' }));

    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'lost' }));
    expect(updateBuilder.eq).toHaveBeenCalledWith('stripe_dispute_id', 'dp_1');
  });
});
