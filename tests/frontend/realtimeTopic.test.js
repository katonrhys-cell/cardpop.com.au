import { describe, it, expect } from 'vitest';
import { uniqueTopic } from '@/lib/realtimeTopic.js';

// supabase.channel(topic) returns the EXISTING channel for a topic that is
// still registered (including one that is mid-leave), so a remount with the
// same topic binds to a dying channel. Every per-mount topic must be unique.
describe('uniqueTopic', () => {
  it('never returns the same topic twice for the same base', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i += 1) seen.add(uniqueTopic('product-detail-abc'));
    expect(seen.size).toBe(50);
  });

  it('keeps the base readable at the front', () => {
    expect(uniqueTopic('watchlist-page-u1')).toMatch(/^watchlist-page-u1-\d+$/);
  });
});
