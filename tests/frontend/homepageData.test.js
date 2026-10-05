import { describe, it, expect, vi, beforeEach } from 'vitest';

// main.jsx starts the homepage reads before React mounts; HomePage reads the
// same cache keys. These check the prefetch covers every key, de-dupes with
// the page's own reads, and can never throw at boot.

const calls = vi.hoisted(() => []);
vi.mock('@/lib/queryCache.js', () => ({
  cachedQuery: vi.fn(async (key) => {
    calls.push(key);
    if (key === 'homepage_stats') throw new Error('boom');
    return { data: [], error: null };
  }),
}));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));

import { prefetchHomepageData, HOMEPAGE_KEYS, getFeaturedCards } from '@/lib/homepageData.js';

beforeEach(() => { calls.length = 0; });

describe('prefetchHomepageData', () => {
  it('starts every homepage query and swallows failures', async () => {
    expect(() => prefetchHomepageData()).not.toThrow();
    await Promise.resolve();
    expect(new Set(calls)).toEqual(new Set(Object.values(HOMEPAGE_KEYS)));
  });

  it('page reads use the same cache keys as the prefetch', async () => {
    await getFeaturedCards();
    expect(calls).toEqual([HOMEPAGE_KEYS.cards]);
  });
});
