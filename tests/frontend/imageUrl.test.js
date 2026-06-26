import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Supabase client so getPublicUrl is deterministic and we can tell a
// transformed request (has `transform`) from a plain one.
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path, opts) => ({
          data: {
            publicUrl: opts?.transform
              ? `https://cdn/render/${bucket}/${path}?w=${opts.transform.width}&q=${opts.transform.quality}`
              : `https://cdn/object/${bucket}/${path}`,
          },
        }),
      }),
    },
  },
}));

import {
  getCardImage,
  CARD_GRID_SIZES,
  markTransformsUnavailable,
  areTransformsUnavailable,
  _resetTransformState,
} from '@/utils/imageUrl.js';

beforeEach(() => {
  _resetTransformState();
});

describe('getCardImage', () => {
  it('returns all-null for missing input', () => {
    expect(getCardImage(null)).toEqual({ src: null, srcSet: null, fallbackSrc: null });
    expect(getCardImage('')).toEqual({ src: null, srcSet: null, fallbackSrc: null });
    expect(getCardImage(undefined)).toEqual({ src: null, srcSet: null, fallbackSrc: null });
  });

  it('passes absolute URLs through untouched (no transform)', () => {
    const url = 'https://example.com/legacy.jpg';
    const r = getCardImage(url);
    expect(r.src).toBe(url);
    expect(r.fallbackSrc).toBe(url);
    expect(r.srcSet).toBeNull();
  });

  it('builds a responsive srcSet + untransformed fallback for a storage path', () => {
    const r = getCardImage('user/card.jpg', { widths: [240, 400, 600] });
    // srcSet has one entry per width, ascending, with the transform endpoint.
    expect(r.srcSet).toContain('w=240');
    expect(r.srcSet).toContain('w=400');
    expect(r.srcSet).toContain('w=600');
    expect(r.srcSet).toMatch(/240w.*400w.*600w/);
    // default src is the middle width
    expect(r.src).toContain('w=400');
    // fallback is the plain (untransformed) public URL
    expect(r.fallbackSrc).toBe('https://cdn/object/vault-images/user/card.jpg');
    expect(r.fallbackSrc).not.toContain('render');
  });

  it('honours a custom bucket and quality', () => {
    const r = getCardImage('a/b.png', { bucket: 'avatars', widths: [100], quality: 55 });
    expect(r.src).toBe('https://cdn/render/avatars/a/b.png?w=100&q=55');
  });

  it('stops emitting transforms once transforms are marked unavailable', () => {
    expect(areTransformsUnavailable()).toBe(false);
    markTransformsUnavailable();
    expect(areTransformsUnavailable()).toBe(true);

    const r = getCardImage('user/card.jpg');
    expect(r.srcSet).toBeNull();
    expect(r.src).toBe('https://cdn/object/vault-images/user/card.jpg');
    expect(r.src).toBe(r.fallbackSrc);
  });

  it('exposes a sensible default sizes string', () => {
    expect(CARD_GRID_SIZES).toMatch(/vw/);
  });
});
