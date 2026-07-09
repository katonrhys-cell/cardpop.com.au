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
  toCdnUrl,
  publicImageUrl,
  canonicalStorageUrl,
  _setCdnHostForTests,
} from '@/utils/imageUrl.js';

beforeEach(() => {
  _resetTransformState();
  _setCdnHostForTests(null);
});

describe('getCardImage', () => {
  it('returns all-null for missing input', () => {
    const empty = { src: null, srcSet: null, fallbackSrc: null, canonicalSrc: null };
    expect(getCardImage(null)).toEqual(empty);
    expect(getCardImage('')).toEqual(empty);
    expect(getCardImage(undefined)).toEqual(empty);
  });

  it('exposes a canonical (non-CDN) source for a storage path even when a CDN is set', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    const r = getCardImage('user/card.jpg');
    // canonicalSrc is the plain Supabase public URL, never rewritten to the CDN,
    // so a CDN outage falls back to the origin. (The mock's URL doesn't match the
    // Supabase shape, so toCdnUrl leaves fallbackSrc unchanged here too.)
    expect(r.canonicalSrc).toBe('https://cdn/object/vault-images/user/card.jpg');
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

describe('toCdnUrl', () => {
  const storageUrl =
    'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/vault-images/user/card.jpg';

  it('is a no-op when no CDN host is configured', () => {
    expect(toCdnUrl(storageUrl)).toBe(storageUrl);
  });

  it('rewrites Supabase storage URLs onto the configured CDN host', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    expect(toCdnUrl(storageUrl)).toBe(
      'https://dxxxx.cloudfront.net/storage/v1/object/public/vault-images/user/card.jpg'
    );
  });

  it('accepts a host with protocol and trailing slash', () => {
    _setCdnHostForTests('https://cdn.cardpop.com.au/');
    expect(toCdnUrl(storageUrl)).toBe(
      'https://cdn.cardpop.com.au/storage/v1/object/public/vault-images/user/card.jpg'
    );
  });

  it('rewrites render/image (transform) URLs too', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    const renderUrl =
      'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/render/image/public/vault-images/user/card.jpg?width=240';
    expect(toCdnUrl(renderUrl)).toBe(
      'https://dxxxx.cloudfront.net/storage/v1/render/image/public/vault-images/user/card.jpg?width=240'
    );
  });

  it('leaves non-Supabase URLs and non-strings alone', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    expect(toCdnUrl('https://example.com/pic.png')).toBe('https://example.com/pic.png');
    expect(toCdnUrl(null)).toBeNull();
    expect(toCdnUrl(undefined)).toBeNull();
  });
});

describe('canonicalStorageUrl', () => {
  // In this suite the mocked getPublicUrl origin is `https://cdn`, so a CDN URL
  // maps back onto that host.
  it('is a no-op when no CDN host is configured', () => {
    const url = 'https://dxxxx.cloudfront.net/storage/v1/object/public/vault-images/u/c.jpg';
    expect(canonicalStorageUrl(url)).toBe(url);
  });

  it('maps a CDN storage URL back to the Supabase origin', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    expect(
      canonicalStorageUrl(
        'https://dxxxx.cloudfront.net/storage/v1/object/public/vault-images/u/c.jpg'
      )
    ).toBe('https://cdn/storage/v1/object/public/vault-images/u/c.jpg');
  });

  it('leaves URLs not on the CDN host, and non-strings, unchanged', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    const other = 'https://example.com/pic.png';
    expect(canonicalStorageUrl(other)).toBe(other);
    expect(canonicalStorageUrl(null)).toBeNull();
    expect(canonicalStorageUrl(undefined)).toBeUndefined();
  });
});

describe('publicImageUrl', () => {
  it('returns null for missing input', () => {
    expect(publicImageUrl(null)).toBeNull();
    expect(publicImageUrl('')).toBeNull();
    expect(publicImageUrl(undefined)).toBeNull();
  });

  it('builds a public URL from a storage path (default bucket)', () => {
    expect(publicImageUrl('user/card.jpg')).toBe(
      'https://cdn/object/vault-images/user/card.jpg'
    );
  });

  it('honours a custom bucket', () => {
    expect(publicImageUrl('a/b.png', 'avatars')).toBe('https://cdn/object/avatars/a/b.png');
  });

  it('passes absolute non-Supabase URLs through untouched', () => {
    const url = 'https://example.com/legacy.jpg';
    expect(publicImageUrl(url)).toBe(url);
  });
});

describe('getCardImage with a CDN host', () => {
  // The mocked getPublicUrl returns https://cdn/... which doesn't match the
  // Supabase URL shape, so CDN rewriting of built URLs is covered by the
  // toCdnUrl tests above. Here we just check absolute Supabase URLs stored in
  // the DB get rewritten when passed straight in.
  it('rewrites stored absolute Supabase URLs', () => {
    _setCdnHostForTests('dxxxx.cloudfront.net');
    const stored =
      'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/vault-images/u/c.webp';
    const r = getCardImage(stored);
    expect(r.src).toBe(
      'https://dxxxx.cloudfront.net/storage/v1/object/public/vault-images/u/c.webp'
    );
    expect(r.fallbackSrc).toBe(r.src);
  });
});
