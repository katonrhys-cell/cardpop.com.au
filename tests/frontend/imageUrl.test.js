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
  parseStorageObjectUrl,
  cdnifyStorageUrlsInHtml,
  _setCdnHostForTests,
  _setTransformsEnabledForTests,
} from '@/utils/imageUrl.js';

beforeEach(() => {
  _resetTransformState();
  _setCdnHostForTests(null);
  // Transforms are OFF by default (paid feature). Most cases here exercise the
  // transform path, so enable it explicitly; the "disabled" block flips it off.
  _setTransformsEnabledForTests(true);
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

describe('getCardImage with transforms disabled (default)', () => {
  beforeEach(() => {
    _setTransformsEnabledForTests(false);
  });

  it('serves the untransformed original with no srcSet for a storage path', () => {
    const r = getCardImage('user/card.jpg', { widths: [240, 400, 600] });
    expect(r.src).toBe('https://cdn/object/vault-images/user/card.jpg');
    expect(r.src).toBe(r.fallbackSrc);
    expect(r.srcSet).toBeNull();
    // Crucially, it never emits a /render/image (transform) URL.
    expect(r.src).not.toContain('render');
  });

  it('does not transform stored absolute Supabase object URLs either', () => {
    const stored =
      'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/vault-images/u/c.webp';
    const r = getCardImage(stored, { widths: [240, 400, 600] });
    expect(r.src).toBe('https://cdn/object/vault-images/u/c.webp');
    expect(r.srcSet).toBeNull();
    expect(r.src).not.toContain('render');
  });

  it('still exposes a canonical origin source', () => {
    const r = getCardImage('user/card.jpg');
    expect(r.canonicalSrc).toBe('https://cdn/object/vault-images/user/card.jpg');
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

describe('getCardImage with stored absolute Supabase URLs', () => {
  // Absolute Supabase *object* URLs (the shape stored whole in DB columns like
  // hero_showcase_cards.image_url) are parsed back into bucket + path so they
  // get resize transforms like any storage path — serving the full-resolution
  // original was a multi-MB payload per image.
  it('derives bucket/path and builds transformed URLs', () => {
    const stored =
      'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/vault-images/u/c.webp';
    const r = getCardImage(stored, { widths: [240, 400, 600] });
    expect(r.src).toBe('https://cdn/render/vault-images/u/c.webp?w=400&q=75');
    expect(r.srcSet).toMatch(/240w.*400w.*600w/);
    expect(r.fallbackSrc).toBe('https://cdn/object/vault-images/u/c.webp');
  });

  it('serves the untransformed object URL once transforms are flagged off', () => {
    markTransformsUnavailable();
    const stored =
      'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/vault-images/u/c.webp';
    const r = getCardImage(stored);
    expect(r.src).toBe('https://cdn/object/vault-images/u/c.webp');
    expect(r.srcSet).toBeNull();
  });
});

describe('parseStorageObjectUrl', () => {
  it('splits an absolute Supabase object URL into bucket and path', () => {
    expect(
      parseStorageObjectUrl(
        'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/vault-images/u/c%20d.webp?v=1'
      )
    ).toEqual({ bucket: 'vault-images', path: 'u/c d.webp' });
  });

  it('returns null for non-storage and non-Supabase URLs, paths, and non-strings', () => {
    expect(parseStorageObjectUrl('https://example.com/pic.png')).toBeNull();
    expect(
      parseStorageObjectUrl(
        'https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/render/image/public/vault-images/u/c.webp'
      )
    ).toBeNull();
    expect(parseStorageObjectUrl('user/card.jpg')).toBeNull();
    expect(parseStorageObjectUrl(null)).toBeNull();
  });
});

describe('cdnifyStorageUrlsInHtml', () => {
  const html =
    '<p>intro</p>' +
    '<img src="https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/object/public/media/media/1.png" alt="a">' +
    '<img src="https://odoglvswwymyjuwlonkf.supabase.co/storage/v1/render/image/public/media/media/2.png?width=640" alt="b">' +
    '<img src="https://elsewhere.example/pic.jpg" alt="c">';

  it('is a no-op when no CDN host is configured', () => {
    _setCdnHostForTests(null);
    expect(cdnifyStorageUrlsInHtml(html)).toBe(html);
  });

  it('rewrites every embedded Supabase storage URL onto the CDN host', () => {
    _setCdnHostForTests('img.cardpop.com.au');
    const out = cdnifyStorageUrlsInHtml(html);
    expect(out).toContain('https://img.cardpop.com.au/storage/v1/object/public/media/media/1.png');
    expect(out).toContain('https://img.cardpop.com.au/storage/v1/render/image/public/media/media/2.png?width=640');
    // Non-Supabase URLs and surrounding markup are untouched.
    expect(out).toContain('https://elsewhere.example/pic.jpg');
    expect(out).toContain('<p>intro</p>');
    expect(out).not.toContain('supabase.co');
  });

  it('passes non-string input through unchanged', () => {
    _setCdnHostForTests('img.cardpop.com.au');
    expect(cdnifyStorageUrlsInHtml(null)).toBe(null);
    expect(cdnifyStorageUrlsInHtml(undefined)).toBe(undefined);
  });
});
