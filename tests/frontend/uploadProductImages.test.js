import { describe, it, expect, beforeEach, vi } from 'vitest';

const uploads = [];
let uploadImpl = () => ({ error: null });

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    storage: {
      from: (bucket) => ({
        upload: (path, body, opts) => {
          uploads.push({ bucket, path, body, opts });
          return Promise.resolve(uploadImpl(path));
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://store/${bucket}/${path}` } }),
      }),
    },
  },
}));

// The real compressor needs canvas/createImageBitmap; the pipeline only cares
// what type of File it gets back. `passthrough` reproduces its fail-safe
// branch, where an undecodable (or already-small) file comes back unchanged.
const compression = vi.hoisted(() => ({ passthrough: false }));

vi.mock('@/utils/compressImage.js', () => {
  const encode = (label) => async (f) =>
    compression.passthrough
      ? f
      : new File([label], f.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
  return { compressImage: encode('full'), createThumbnail: encode('thumb') };
});

import {
  SHOP_IMAGE_BUCKET,
  mapWithConcurrency,
  shopImageBasePath,
  uploadShopImage,
  uploadShopImages,
} from '@/utils/uploadProductImages.js';
import { OPTIMIZED_SUFFIX, THUMB_SUFFIX, thumbStoragePath } from '@/utils/imageUrl.js';

const file = (name = 'card.jpg') => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  uploads.length = 0;
  uploadImpl = () => ({ error: null });
  compression.passthrough = false;
});

describe('shopImageBasePath', () => {
  it('is a timestamped, extensionless path under the shop prefix', () => {
    expect(shopImageBasePath(1791003113285)).toMatch(/^shop-products\/1791003113285-[a-z0-9]+$/);
  });

  it('derives the optimizer-compatible thumb name', () => {
    // utils/imageUrl.js treats `.opt.webp` as proof a companion thumb exists,
    // so the pair has to match what scripts/optimize-shop-images.mjs writes.
    const base = shopImageBasePath(1791003113285);
    expect(thumbStoragePath(`${base}${OPTIMIZED_SUFFIX}`)).toBe(`${base}.opt${THUMB_SUFFIX}`);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order', async () => {
    const out = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((r) => setTimeout(r, n));
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe('uploadShopImage', () => {
  it('uploads the thumbnail first, then the marked full image', async () => {
    const result = await uploadShopImage(file());

    expect(uploads).toHaveLength(2);
    // Thumb first: the `.opt.webp` marker promises a thumb exists, so it must
    // already be stored before any URL carrying that marker is returned.
    expect(uploads[0].path).toMatch(/\.opt\.thumb\.webp$/);
    expect(uploads[1].path).toMatch(/\.opt\.webp$/);
    expect(uploads[1].path).toBe(uploads[0].path.replace('.opt.thumb.webp', '.opt.webp'));
    expect(uploads[0].bucket).toBe(SHOP_IMAGE_BUCKET);
    expect(uploads[1].opts.cacheControl).toBe('31536000');
    expect(result.url).toBe(`https://store/media/${uploads[1].path}`);
    expect(result.thumbnail).toBe(true);
  });

  it('drops the marker when the thumbnail fails, so grids cannot 404', async () => {
    uploadImpl = (path) => (path.endsWith(THUMB_SUFFIX) ? { error: { message: 'nope' } } : { error: null });
    const result = await uploadShopImage(file());

    expect(result.thumbnail).toBe(false);
    expect(result.path).not.toContain(OPTIMIZED_SUFFIX);
    expect(result.url).toBeTruthy();
  });

  it('retries a failing upload before giving up', async () => {
    let attempts = 0;
    uploadImpl = (path) => {
      if (path.endsWith(THUMB_SUFFIX)) return { error: null };
      attempts += 1;
      return attempts < 2 ? { error: { message: 'flaky' } } : { error: null };
    };
    await expect(uploadShopImage(file())).resolves.toMatchObject({ thumbnail: true });
    expect(attempts).toBe(2);
  });

  it('refuses a HEIC photo rather than storing one browsers cannot display', async () => {
    compression.passthrough = true;
    const heic = new File(['x'], 'card.heic', { type: 'image/heic' });

    await expect(uploadShopImage(heic)).rejects.toThrow(/HEIC/i);
    expect(uploads).toHaveLength(0);
  });

  it('stores an unmarked JPEG when compression passed the original through', async () => {
    // Already-small files come back untouched. A JPEG is perfectly displayable,
    // so it uploads — just without the WebP-only marker.
    compression.passthrough = true;
    const result = await uploadShopImage(file('small.jpg'));

    expect(result.path).toMatch(/\.jpg$/);
    expect(result.thumbnail).toBe(false);
    expect(uploads).toHaveLength(1);
  });

  it('rejects an oversized file before decoding it', async () => {
    const big = file();
    Object.defineProperty(big, 'size', { value: 25 * 1024 * 1024 });
    await expect(uploadShopImage(big)).rejects.toThrow(/larger than 20MB/);
    expect(uploads).toHaveLength(0);
  });
});

describe('uploadShopImages', () => {
  it('keeps order and passes existing images through untouched', async () => {
    const urls = await uploadShopImages([
      { isExisting: true, url: 'https://old/keep.webp' },
      file('new.jpg'),
    ]);

    expect(urls[0]).toBe('https://old/keep.webp');
    expect(urls[1]).toMatch(/^https:\/\/store\/media\/shop-products\/.*\.opt\.webp$/);
    expect(uploads).toHaveLength(2); // the new file plus its thumbnail
  });

  it('reports progress against the count of new files only', async () => {
    const seen = [];
    await uploadShopImages([{ isExisting: true, url: 'u' }, file('a.jpg'), file('b.jpg')], {
      onProgress: (done, total) => seen.push([done, total]),
    });
    expect(seen).toEqual([[1, 2], [2, 2]]);
  });
});
