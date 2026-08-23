import { describe, it, expect } from 'vitest';
import {
  TIER_ORDER,
  DISPLAY_STYLES,
  DEFAULT_TIER,
  DEFAULT_STYLE,
  tierRank,
  normalizeTier,
  normalizeStyle,
  getStyleByKey,
  canUseStyle,
  getAccessibleStyles,
  resolveDisplayStyle,
} from '@/lib/displayStyles.js';

describe('displayStyles registry integrity', () => {
  it('exposes exactly the eleven canonical styles in ladder order', () => {
    expect(DISPLAY_STYLES.map(s => s.key)).toEqual([
      'classic', 'stand', 'floating', 'neon', 'glass', 'slab',
      'spotlight', 'rotating', 'spinning', 'prism', 'holographic',
    ]);
  });

  it('only references tiers that exist in TIER_ORDER', () => {
    for (const style of DISPLAY_STYLES) {
      expect(TIER_ORDER).toContain(style.minTier);
    }
  });

  it('defaults are the always-free baseline', () => {
    expect(DEFAULT_TIER).toBe('free');
    expect(DEFAULT_STYLE).toBe('classic');
    expect(getStyleByKey(DEFAULT_STYLE).minTier).toBe('free');
  });
});

describe('tierRank', () => {
  it('ranks tiers cumulatively by position', () => {
    expect(tierRank('free')).toBe(0);
    expect(tierRank('pro')).toBe(1);
    expect(tierRank('ultimate')).toBe(4);
  });

  it('treats unknown/missing tiers as the lowest rank', () => {
    expect(tierRank('mystery')).toBe(0);
    expect(tierRank(undefined)).toBe(0);
    expect(tierRank(null)).toBe(0);
  });
});

describe('normalizeTier / normalizeStyle', () => {
  it('passes through known values', () => {
    expect(normalizeTier('elite')).toBe('elite');
    expect(normalizeStyle('slab')).toBe('slab');
  });

  it('coerces unknown values to the safe default', () => {
    expect(normalizeTier('platinum')).toBe('free');
    expect(normalizeTier(null)).toBe('free');
    expect(normalizeStyle('sparkles')).toBe('classic');
    expect(normalizeStyle(undefined)).toBe('classic');
  });
});

describe('canUseStyle', () => {
  it('always allows the free baseline style for everyone', () => {
    expect(canUseStyle('classic', 'free')).toBe(true);
    expect(canUseStyle('classic', undefined)).toBe(true);
  });

  it('gates a higher style behind its minimum tier', () => {
    expect(canUseStyle('rotating', 'premium')).toBe(false); // rotating needs elite
    expect(canUseStyle('rotating', 'elite')).toBe(true);
    expect(canUseStyle('rotating', 'ultimate')).toBe(true);  // higher tier still allowed
  });

  it('locks the top style to ultimate only', () => {
    expect(canUseStyle('holographic', 'elite')).toBe(false);
    expect(canUseStyle('holographic', 'ultimate')).toBe(true);
  });

  it('treats an unknown style as classic (allowed)', () => {
    expect(canUseStyle('bogus', 'free')).toBe(true);
  });
});

describe('getAccessibleStyles', () => {
  it('free users get only Classic', () => {
    expect(getAccessibleStyles('free').map(s => s.key)).toEqual(['classic']);
  });

  it('pro users add Stand, Floating and Neon', () => {
    expect(getAccessibleStyles('pro').map(s => s.key)).toEqual([
      'classic', 'stand', 'floating', 'neon',
    ]);
  });

  it('premium users add Glass, Slab and Spotlight', () => {
    expect(getAccessibleStyles('premium').map(s => s.key)).toEqual([
      'classic', 'stand', 'floating', 'neon', 'glass', 'slab', 'spotlight',
    ]);
  });

  it('elite users add Rotating, Spinning and Prism', () => {
    expect(getAccessibleStyles('elite').map(s => s.key)).toEqual([
      'classic', 'stand', 'floating', 'neon', 'glass', 'slab', 'spotlight', 'rotating', 'spinning', 'prism',
    ]);
  });

  it('ultimate users unlock everything', () => {
    expect(getAccessibleStyles('ultimate').map(s => s.key)).toEqual(
      DISPLAY_STYLES.map(s => s.key),
    );
  });

  it('an unknown tier is treated as free', () => {
    expect(getAccessibleStyles('whatever').map(s => s.key)).toEqual(['classic']);
  });
});

describe('resolveDisplayStyle', () => {
  it('renders the stored style as-is when no owner tier is supplied', () => {
    expect(resolveDisplayStyle('holographic')).toBe('holographic');
  });

  it('renders the stored style when the owner is still entitled', () => {
    expect(resolveDisplayStyle('slab', 'premium')).toBe('slab');
    expect(resolveDisplayStyle('slab', 'ultimate')).toBe('slab');
  });

  it('falls back to classic when a downgraded owner is no longer entitled', () => {
    expect(resolveDisplayStyle('holographic', 'pro')).toBe('classic');
    expect(resolveDisplayStyle('rotating', 'free')).toBe('classic');
  });

  it('coerces an unknown stored style to classic', () => {
    expect(resolveDisplayStyle('garbage', 'ultimate')).toBe('classic');
  });
});
