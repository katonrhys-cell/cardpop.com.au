import { vi, describe, it, expect, beforeEach } from 'vitest';
import { orderRef, shortOrderId, normaliseOrderNumber } from '../../utils/orderRef.js';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// The default (service-role) client is never reached: every test passes its own.
vi.mock('../../src/utils/supabaseClient.js', () => ({ supabase: {}, default: {} }));

const {
  fetchOrderNumbers, orderRefFor, attachOrderNumbers, orderIdForNumber, ORDER_NUMBER_LOOKUP_TIMEOUT_MS,
} = await import('../../src/utils/orderNumbers.js');

// A client whose `from('orders').select().in()` resolves to `result` (or hangs / throws).
const clientReturning = (result) => {
  const inFn = vi.fn(() => (typeof result === 'function' ? result() : Promise.resolve(result)));
  const select = vi.fn(() => ({ in: inFn }));
  return { client: { from: vi.fn(() => ({ select })) }, select, inFn };
};

describe('orderRef (utils/orderRef.js)', () => {
  it('prefers the sequential order number', () => {
    expect(orderRef({ id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f', order_number: 'CP-000123' })).toBe('CP-000123');
    expect(orderRef({ order_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', order_number: ' CP-000007 ' })).toBe('CP-000007');
  });

  it('falls back to the first 8 characters of the id, upper-cased', () => {
    expect(orderRef({ id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f' })).toBe('0F0F0F0F');
    expect(orderRef({ id: 'a1b2c3d4-e5f6-4789-8abc-def012345678', order_number: null })).toBe('A1B2C3D4');
    expect(orderRef({ order_id: 'a1b2c3d4-e5f6-4789-8abc-def012345678', order_number: '' })).toBe('A1B2C3D4');
  });

  it('never throws on missing input', () => {
    expect(orderRef(null)).toBe('');
    expect(orderRef({})).toBe('');
    expect(shortOrderId(undefined)).toBe('');
  });

  it('matches what every screen showed before order numbers existed', () => {
    const id = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
    expect(shortOrderId(id)).toBe(id.slice(0, 8).toUpperCase());
  });
});

describe('fetchOrderNumbers (src/utils/orderNumbers.js)', () => {
  beforeEach(() => vi.useRealTimers());

  it('reads order_number for the given ids in one query', async () => {
    const { client, select, inFn } = clientReturning({
      data: [{ id: 'o1', order_number: 'CP-000001' }, { id: 'o2', order_number: 'CP-000002' }], error: null,
    });
    const map = await fetchOrderNumbers(['o1', 'o2', 'o1', null], client);
    expect(select).toHaveBeenCalledWith('id, order_number');
    expect(inFn).toHaveBeenCalledWith('id', ['o1', 'o2']); // de-duplicated, blanks dropped
    expect(map.get('o1')).toBe('CP-000001');
    expect(map.get('o2')).toBe('CP-000002');
  });

  it('skips the query entirely when there is nothing to look up', async () => {
    const { client } = clientReturning({ data: [], error: null });
    expect((await fetchOrderNumbers([], client)).size).toBe(0);
    expect((await fetchOrderNumbers([undefined], client)).size).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns an empty map — never throws — when the column does not exist yet', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'column orders.order_number does not exist' } });
    const map = await fetchOrderNumbers(['o1'], client);
    expect(map.size).toBe(0);
  });

  it('returns an empty map when the client itself throws', async () => {
    const client = { from: () => { throw new Error('connection reset'); } };
    expect((await fetchOrderNumbers(['o1'], client)).size).toBe(0);
  });

  it('gives up after the timeout instead of holding up an email', async () => {
    vi.useFakeTimers();
    const { client } = clientReturning(() => new Promise(() => {})); // never resolves
    const pending = fetchOrderNumbers(['o1'], client);
    await vi.advanceTimersByTimeAsync(ORDER_NUMBER_LOOKUP_TIMEOUT_MS + 1);
    expect((await pending).size).toBe(0);
  });

  it('ignores rows with no number (an order the migration has not numbered)', async () => {
    const { client } = clientReturning({ data: [{ id: 'o1', order_number: null }], error: null });
    expect((await fetchOrderNumbers(['o1'], client)).size).toBe(0);
  });
});

describe('orderRefFor', () => {
  it('returns the order number when there is one', async () => {
    const { client } = clientReturning({ data: [{ id: 'o1', order_number: 'CP-000042' }], error: null });
    expect(await orderRefFor('o1', client)).toBe('CP-000042');
  });

  it('falls back to the short id when the lookup finds nothing or fails', async () => {
    const id = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
    expect(await orderRefFor(id, clientReturning({ data: [], error: null }).client)).toBe('A1B2C3D4');
    expect(await orderRefFor(id, clientReturning({ data: null, error: { message: 'boom' } }).client)).toBe('A1B2C3D4');
  });

  it('returns an empty string for no id', async () => {
    expect(await orderRefFor(null, clientReturning({ data: [], error: null }).client)).toBe('');
  });
});

describe('normaliseOrderNumber', () => {
  it('turns what an admin types into the canonical order number', () => {
    expect(normaliseOrderNumber('CP-000123')).toBe('CP-000123');
    expect(normaliseOrderNumber('cp-123')).toBe('CP-000123');
    expect(normaliseOrderNumber(' cp 7 ')).toBe('CP-000007');
    expect(normaliseOrderNumber('CP1234567')).toBe('CP-1234567');
  });

  it('refuses anything that is not explicitly an order number', () => {
    // bare digits are too ambiguous in a search box (invoice numbers, amounts)
    for (const v of ['123', 'INV-000123', 'CP-', 'CP-abc', 'CP-12 34', '', null, undefined]) {
      expect(normaliseOrderNumber(v)).toBeNull();
    }
  });
});

describe('attachOrderNumbers', () => {
  it('adds order_number to the rows whose order has one, leaving the rest alone', async () => {
    const { client } = clientReturning({ data: [{ id: 'o1', order_number: 'CP-000001' }], error: null });
    const rows = [{ id: 'r1', order_id: 'o1' }, { id: 'r2', order_id: 'o2' }, { id: 'r3', order_id: null }];
    const out = await attachOrderNumbers(rows, { client });
    expect(out[0]).toEqual({ id: 'r1', order_id: 'o1', order_number: 'CP-000001' });
    expect(out[1]).toEqual({ id: 'r2', order_id: 'o2' });
    expect(out[2]).toEqual({ id: 'r3', order_id: null });
    expect(rows[0]).not.toHaveProperty('order_number'); // input not mutated
  });

  it('returns the rows unchanged when the lookup fails', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'boom' } });
    const rows = [{ id: 'r1', order_id: 'o1' }];
    expect(await attachOrderNumbers(rows, { client })).toEqual(rows);
  });

  it('reads the id from a custom key', async () => {
    const { client } = clientReturning({ data: [{ id: 'o9', order_number: 'CP-000009' }], error: null });
    const out = await attachOrderNumbers([{ ref: 'o9' }], { idKey: 'ref', client });
    expect(out[0].order_number).toBe('CP-000009');
  });

  it('copes with no rows', async () => {
    const { client } = clientReturning({ data: [], error: null });
    expect(await attachOrderNumbers([], { client })).toEqual([]);
    expect(await attachOrderNumbers(undefined, { client })).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('looks long lists up in chunks so the request URL stays short', async () => {
    const { client, inFn } = clientReturning({ data: [], error: null });
    const rows = Array.from({ length: 250 }, (_, i) => ({ order_id: `o${i}` }));
    await attachOrderNumbers(rows, { client });
    expect(inFn).toHaveBeenCalledTimes(3);
    expect(inFn.mock.calls.map((c) => c[1].length)).toEqual([100, 100, 50]);
  });
});

describe('orderIdForNumber', () => {
  const clientFinding = (result) => {
    const maybeSingle = vi.fn(() => Promise.resolve(result));
    const eq = vi.fn(() => ({ maybeSingle }));
    return { client: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })) }, eq };
  };

  it('finds the order behind a number', async () => {
    const { client, eq } = clientFinding({ data: { id: 'order-1' }, error: null });
    expect(await orderIdForNumber('CP-000123', client)).toBe('order-1');
    expect(eq).toHaveBeenCalledWith('order_number', 'CP-000123');
  });

  it('returns null for an unknown number, an error, or no number', async () => {
    expect(await orderIdForNumber('CP-000999', clientFinding({ data: null, error: null }).client)).toBeNull();
    expect(await orderIdForNumber('CP-000123', clientFinding({ data: null, error: { message: 'x' } }).client)).toBeNull();
    expect(await orderIdForNumber(null, clientFinding({ data: null, error: null }).client)).toBeNull();
  });
});
