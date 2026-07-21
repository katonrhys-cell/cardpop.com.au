import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRpc = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({ supabase: { rpc: mockRpc }, default: {} }));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import PgRateLimitStore from '../../src/utils/pgRateLimitStore.js';

describe('PgRateLimitStore', () => {
  beforeEach(() => mockRpc.mockReset());

  it('namespaces keys and forwards the window to rate_limit_hit', async () => {
    mockRpc.mockResolvedValue({ data: [{ total_hits: 2, reset_at: new Date(Date.now() + 1000).toISOString() }], error: null });
    const store = new PgRateLimitStore('login');
    store.init({ windowMs: 900000 });

    const res = await store.increment('1.2.3.4');

    expect(mockRpc).toHaveBeenCalledWith('rate_limit_hit', { p_key: 'login:1.2.3.4', p_window_ms: 900000 });
    expect(res.totalHits).toBe(2);
    expect(res.resetTime).toBeInstanceOf(Date);
  });

  it('fails OPEN (reports a single hit, never blocks) when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    const store = new PgRateLimitStore('backupcode');
    store.init({ windowMs: 60000 });

    const res = await store.increment('user-1');
    expect(res.totalHits).toBe(1);
  });

  it('fails OPEN when the RPC returns no usable count (malformed/unavailable)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const store = new PgRateLimitStore('ai');
    const res = await store.increment('user-2');
    expect(res.totalHits).toBe(1);
  });

  it('resetKey clears the namespaced key', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const store = new PgRateLimitStore('login');
    await store.resetKey('1.2.3.4');
    expect(mockRpc).toHaveBeenCalledWith('rate_limit_reset', { p_key: 'login:1.2.3.4' });
  });

  it('two stores with different names keep independent counters', async () => {
    mockRpc.mockResolvedValue({ data: [{ total_hits: 1, reset_at: new Date().toISOString() }], error: null });
    await new PgRateLimitStore('login').increment('same-ip');
    await new PgRateLimitStore('pwned').increment('same-ip');
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'rate_limit_hit', expect.objectContaining({ p_key: 'login:same-ip' }));
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'rate_limit_hit', expect.objectContaining({ p_key: 'pwned:same-ip' }));
  });
});
