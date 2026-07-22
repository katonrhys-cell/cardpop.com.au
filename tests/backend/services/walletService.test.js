import { vi, describe, it, expect, beforeEach } from 'vitest';

// The buyer wallet balance lives on the Stripe Customer, never in our DB, so
// every test passes in a per-case fake `stripe`. Only Supabase (profile link,
// notifications, reservation RPCs) is module-mocked.
const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));

import {
  ensureWalletCustomer,
  getWalletBalanceCents,
  assertNoOpenWalletCheckout,
  reserveWalletCheckout,
  releaseWalletCheckout,
  creditWallet,
  debitWallet,
  debitWalletForOrder,
  handleWalletTopup,
} from '../../../src/services/walletService.js';

// Chainable Supabase stub: `single` feeds .maybeSingle(); `value` feeds a direct
// await on the chain (update().eq()... / insert().then()).
function builder({ single = { data: null, error: null }, value = { data: null, error: null } } = {}) {
  const b = {};
  for (const m of ['select', 'update', 'insert', 'eq', 'is', 'order', 'limit']) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(single));
  b.then = (onF, onR) => Promise.resolve(value).then(onF, onR);
  return b;
}
const queueFrom = (...builders) => builders.forEach((b) => mockSupabase.from.mockReturnValueOnce(b));

// A Stripe error the self-heal path recognises as "object no longer exists".
const missingErr = () => Object.assign(new Error('No such customer'), { code: 'resource_missing' });

beforeEach(() => vi.clearAllMocks());

describe('ensureWalletCustomer', () => {
  it('returns a stored customer id that still exists without creating a new one', async () => {
    queueFrom(builder({ single: { data: { stripe_customer_id: 'cus_ok' }, error: null } }));
    const stripe = { customers: { retrieve: vi.fn().mockResolvedValue({ id: 'cus_ok', deleted: false }), create: vi.fn() } };

    await expect(ensureWalletCustomer(stripe, 'u1', { email: 'a@b.com' })).resolves.toBe('cus_ok');
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it('creates and persists a customer when the profile has none', async () => {
    queueFrom(
      builder({ single: { data: { stripe_customer_id: null }, error: null } }), // initial read
      builder({ value: { error: null } }),                                       // guarded update
      builder({ single: { data: { stripe_customer_id: 'cus_new' }, error: null } }), // converge re-read
    );
    const stripe = { customers: { retrieve: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'cus_new' }) } };

    await expect(ensureWalletCustomer(stripe, 'u1', { email: 'a@b.com' })).resolves.toBe('cus_new');
    expect(stripe.customers.create).toHaveBeenCalledOnce();
  });

  it('self-heals a stale stored id (deleted on Stripe) by recreating', async () => {
    queueFrom(
      builder({ single: { data: { stripe_customer_id: 'cus_stale' }, error: null } }),
      builder({ value: { error: null } }),
      builder({ single: { data: { stripe_customer_id: 'cus_fresh' }, error: null } }),
    );
    const stripe = {
      customers: {
        retrieve: vi.fn().mockRejectedValue(missingErr()),
        create: vi.fn().mockResolvedValue({ id: 'cus_fresh' }),
      },
    };

    await expect(ensureWalletCustomer(stripe, 'u1', { email: 'a@b.com' })).resolves.toBe('cus_fresh');
    expect(stripe.customers.create).toHaveBeenCalledOnce();
  });
});

describe('getWalletBalanceCents', () => {
  it('returns 0 when the profile has no Stripe customer', async () => {
    queueFrom(builder({ single: { data: { stripe_customer_id: null }, error: null } }));
    await expect(getWalletBalanceCents({ customers: { retrieve: vi.fn() } }, 'u1')).resolves.toBe(0);
  });

  it('converts a negative Stripe balance (credit owed) into positive cents', async () => {
    queueFrom(builder({ single: { data: { stripe_customer_id: 'cus_1' }, error: null } }));
    const stripe = { customers: { retrieve: vi.fn().mockResolvedValue({ balance: -2500 }) } };
    await expect(getWalletBalanceCents(stripe, 'u1')).resolves.toBe(2500);
  });

  it('returns 0 when the customer owes money (positive balance)', async () => {
    queueFrom(builder({ single: { data: { stripe_customer_id: 'cus_1' }, error: null } }));
    const stripe = { customers: { retrieve: vi.fn().mockResolvedValue({ balance: 500 }) } };
    await expect(getWalletBalanceCents(stripe, 'u1')).resolves.toBe(0);
  });

  it('returns 0 for a deleted customer', async () => {
    queueFrom(builder({ single: { data: { stripe_customer_id: 'cus_1' }, error: null } }));
    const stripe = { customers: { retrieve: vi.fn().mockResolvedValue({ deleted: true, balance: -999 }) } };
    await expect(getWalletBalanceCents(stripe, 'u1')).resolves.toBe(0);
  });

  it('treats a stale (resource_missing) customer id as no credit', async () => {
    queueFrom(builder({ single: { data: { stripe_customer_id: 'cus_gone' }, error: null } }));
    const stripe = { customers: { retrieve: vi.fn().mockRejectedValue(missingErr()) } };
    await expect(getWalletBalanceCents(stripe, 'u1')).resolves.toBe(0);
  });
});

describe('assertNoOpenWalletCheckout', () => {
  it('no-ops when there is no customer id', async () => {
    const stripe = { checkout: { sessions: { list: vi.fn() } } };
    await expect(assertNoOpenWalletCheckout(stripe, null)).resolves.toBeUndefined();
    expect(stripe.checkout.sessions.list).not.toHaveBeenCalled();
  });

  it('throws 409 when an open wallet-funded session already exists', async () => {
    const stripe = { checkout: { sessions: { list: vi.fn().mockResolvedValue({ data: [{ metadata: { walletCents: '500' } }] }) } } };
    await expect(assertNoOpenWalletCheckout(stripe, 'cus_1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows a new checkout when open sessions carry no wallet credit', async () => {
    const stripe = { checkout: { sessions: { list: vi.fn().mockResolvedValue({ data: [{ metadata: {} }, { metadata: { walletCents: '0' } }] }) } } };
    await expect(assertNoOpenWalletCheckout(stripe, 'cus_1')).resolves.toBeUndefined();
  });
});

describe('reserveWalletCheckout / releaseWalletCheckout', () => {
  it('resolves when the reservation CAS wins the slot', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(reserveWalletCheckout('u1')).resolves.toBeUndefined();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('reserve_wallet_checkout', { p_user_id: 'u1' });
  });

  it('throws 409 when another checkout already holds the slot', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(reserveWalletCheckout('u1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws a generic error when the reservation RPC errors', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(reserveWalletCheckout('u1')).rejects.toThrow(/could not start wallet checkout/i);
  });

  it('release is best-effort and never throws on RPC error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ error: { message: 'boom' } });
    await expect(releaseWalletCheckout('u1')).resolves.toBeUndefined();
  });

  it('release no-ops without a user id', async () => {
    await releaseWalletCheckout(undefined);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe('creditWallet / debitWallet', () => {
  it('credit posts a NEGATIVE balance transaction with the idempotency key', async () => {
    const stripe = { customers: { createBalanceTransaction: vi.fn().mockResolvedValue({}) } };
    await creditWallet(stripe, 'cus_1', 1000, 'top-up', 'idem-1');
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_1', { amount: -1000, currency: 'aud', description: 'top-up' }, { idempotencyKey: 'idem-1' },
    );
  });

  it('debit posts a POSITIVE balance transaction', async () => {
    const stripe = { customers: { createBalanceTransaction: vi.fn().mockResolvedValue({}) } };
    await debitWallet(stripe, 'cus_1', 750, 'spend', 'idem-2');
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_1', { amount: 750, currency: 'aud', description: 'spend' }, { idempotencyKey: 'idem-2' },
    );
  });

  it('is a no-op for a zero or negative amount', async () => {
    const stripe = { customers: { createBalanceTransaction: vi.fn() } };
    await creditWallet(stripe, 'cus_1', 0, 'x');
    await debitWallet(stripe, 'cus_1', -5, 'x');
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
});

describe('debitWalletForOrder', () => {
  it('debits without alerting when the balance covers the amount', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn().mockResolvedValue({ balance: -5000 }), // $50 credit
        createBalanceTransaction: vi.fn().mockResolvedValue({}),
      },
    };
    await debitWalletForOrder(stripe, 'cus_1', 3000, 'order', 'idem');
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledOnce();
    expect(mockSupabase.from).not.toHaveBeenCalled(); // no admin alert
  });

  it('alerts admins when the debit over-redeems the available balance', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn().mockResolvedValue({ balance: -1000 }), // only $10 available
        createBalanceTransaction: vi.fn().mockResolvedValue({}),
      },
    };
    const notif = builder({ value: { data: null, error: null } });
    queueFrom(
      builder({ value: { data: [{ id: 'admin-1' }], error: null } }), // admins lookup
      notif,                                                            // notifications insert
    );

    await debitWalletForOrder(stripe, 'cus_1', 3000, 'order', 'idem'); // debit $30 > $10
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledOnce(); // still posts in full
    expect(notif.insert).toHaveBeenCalledOnce();
  });
});

describe('handleWalletTopup', () => {
  it('credits the wallet and notifies the user for a valid top-up session', async () => {
    const stripe = { customers: { createBalanceTransaction: vi.fn().mockResolvedValue({}) } };
    const notif = builder({ value: { data: null, error: null } });
    queueFrom(notif);

    await handleWalletTopup(
      { id: 'cs_1', metadata: { userId: 'u1' }, customer: 'cus_1', amount_total: 2000 },
      stripe,
    );

    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_1', { amount: -2000, currency: 'aud', description: 'CardPop wallet top-up' }, { idempotencyKey: 'wallet-topup-cs_1' },
    );
    expect(notif.insert).toHaveBeenCalledOnce();
  });

  it('ignores an invalid top-up session (missing userId/customer/amount)', async () => {
    const stripe = { customers: { createBalanceTransaction: vi.fn() } };
    await handleWalletTopup({ id: 'cs_2', metadata: {}, customer: null, amount_total: 0 }, stripe);
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
});
