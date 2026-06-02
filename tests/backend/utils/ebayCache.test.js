import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { get, set, clear } from '../../../src/utils/ebayCache.js';

// Default TTL from the module (EBAY_CACHE_TTL env not set → 3600 s)
const TTL_MS = 3600 * 1000;

beforeEach(() => {
  clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── cache miss ───────────────────────────────────────────────────────────────

describe('get (cache miss)', () => {
  it('returns null for a key that has never been set', () => {
    expect(get('missing-key')).toBeNull();
  });

  it('returns null after clear() removes all entries', () => {
    set('my-key', { data: 'value' });
    clear();
    expect(get('my-key')).toBeNull();
  });
});

// ─── cache hit ────────────────────────────────────────────────────────────────

describe('get (cache hit)', () => {
  it('returns the stored value immediately after set', () => {
    set('card-price', { avgPrice: 250 });
    expect(get('card-price')).toEqual({ avgPrice: 250 });
  });

  it('returns the value when time has not yet reached expiry', () => {
    set('card-price', 'still-fresh');
    vi.advanceTimersByTime(TTL_MS - 1);
    expect(get('card-price')).toBe('still-fresh');
  });

  it('stores and retrieves any serialisable value type', () => {
    set('num', 42);
    set('arr', [1, 2, 3]);
    set('obj', { nested: { deep: true } });
    expect(get('num')).toBe(42);
    expect(get('arr')).toEqual([1, 2, 3]);
    expect(get('obj')).toEqual({ nested: { deep: true } });
  });

  it('handles multiple independent keys', () => {
    set('key-a', 'alpha');
    set('key-b', 'beta');
    expect(get('key-a')).toBe('alpha');
    expect(get('key-b')).toBe('beta');
  });

  it('overwrites an existing key with the latest value', () => {
    set('key', 'first');
    set('key', 'second');
    expect(get('key')).toBe('second');
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('get (TTL expiry)', () => {
  it('returns null exactly at expiry (Date.now() > expiresAt)', () => {
    set('expired-key', 'old-data');
    vi.advanceTimersByTime(TTL_MS + 1);
    expect(get('expired-key')).toBeNull();
  });

  it('removes the expired entry from the cache after expiry', () => {
    set('to-delete', 'data');
    vi.advanceTimersByTime(TTL_MS + 1);
    get('to-delete'); // triggers deletion
    // A second get should still return null (not a stale entry)
    expect(get('to-delete')).toBeNull();
  });

  it('does not expire a key that was refreshed after the first set', () => {
    set('refreshed', 'v1');
    vi.advanceTimersByTime(TTL_MS - 100); // just before expiry
    set('refreshed', 'v2');               // reset the TTL clock
    vi.advanceTimersByTime(TTL_MS - 100); // advance again — v2 still fresh
    expect(get('refreshed')).toBe('v2');
  });

  it('expires one key without affecting another', () => {
    set('short', 'gone-soon');
    vi.advanceTimersByTime(500);
    set('long', 'stays');
    vi.advanceTimersByTime(TTL_MS); // short expires; long still has 500 ms left
    expect(get('short')).toBeNull();
    expect(get('long')).toBe('stays');
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('removes all keys at once', () => {
    set('a', 1);
    set('b', 2);
    set('c', 3);
    clear();
    expect(get('a')).toBeNull();
    expect(get('b')).toBeNull();
    expect(get('c')).toBeNull();
  });

  it('is safe to call on an already-empty cache', () => {
    expect(() => clear()).not.toThrow();
  });
});
