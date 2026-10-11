// Shared upload pipeline for official shop product photos.
//
// Every shop image goes through here — the single-product admin form and the
// bulk importer both call `uploadShopImages`, so the storage layout, the
// compression presets and the companion grid thumbnail can never drift apart
// between the two paths.
//
// Three things it does that the old inline upload in ShopProductForm did not:
//
//   1. **Writes a companion grid thumbnail.** Card grids render at ~300 px but
//      were being served the full upload. This writes the same pair that
//      scripts/optimize-shop-images.mjs produces for supplier imagery —
//      `<base>.opt.webp` plus `<base>.opt.thumb.webp` — so `getCardImage`
//      serves the thumb in grids with no change to utils/imageUrl.js.
//   2. **Uploads in parallel.** The old loop was strictly sequential: a
//      50-product import with 3 photos each meant 150 round trips end to end.
//      A small worker pool cuts that to roughly a quarter of the wall time
//      without hammering the browser's connection pool.
//   3. **Retries.** A single flaky upload used to abort the whole save (and,
//      in a bulk run, would strand every product behind it).
//
// Storage layout — bucket `media`, path `shop-products/<epoch-ms>-<rand>`.
// The `.opt.webp` suffix is the marker `hasThumbnail()` in utils/imageUrl.js
// keys on, and it is only used when the thumbnail actually landed AND the full
// image really is WebP (see uploadShopImage). That keeps the same "both or
// neither" discipline as the optimizer script: a product URL never carries the
// marker unless its companion thumb exists, so a grid can't 404 chasing one.

import { supabase } from '@/lib/supabaseClient.js';
import { compressImage, createThumbnail } from '@/utils/compressImage.js';
import { thumbStoragePath, OPTIMIZED_SUFFIX } from '@/utils/imageUrl.js';

export const SHOP_IMAGE_BUCKET = 'media';
export const SHOP_IMAGE_PREFIX = 'shop-products';

/** Reject anything over this before we waste time decoding it. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

// Full-size preset. Deliberately larger than the 1600 px default used for
// user card scans: these are hi-definition product photos and the detail page
// offers zoom, so detail matters. It costs nothing on grid pages — those load
// the 480 px thumbnail instead.
export const FULL_IMAGE_PRESET = {
  maxDimension: 2400,
  quality: 0.85,
  mimeType: 'image/webp',
};

// Cache-Control for a year. Safe because every path is timestamped and content
// is never overwritten at an existing path (see docs/image-cdn.md).
const CACHE_CONTROL = '31536000';

const UPLOAD_ATTEMPTS = 3;
const DEFAULT_CONCURRENCY = 4;

// Formats every browser can render. A compressed file always lands on WebP or
// JPEG; a file that still has some other type is one compression could not
// decode, and storing it would put an image on the storefront that a shopper's
// browser may refuse to show.
const WEB_SAFE_IMAGE_RE = /^image\/(webp|jpeg|jpg|png|avif|gif)$/i;

const describeFormat = (file) => {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) return 'a HEIC photo';
  return file.type ? `a ${file.type} file` : 'an unrecognised image format';
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

const extensionFor = (mime) => (/webp/i.test(mime) ? 'webp' : /png/i.test(mime) ? 'png' : 'jpg');

/**
 * Base storage path (no extension) for a shop product image. The epoch-ms keeps
 * every upload at a fresh, immutable path so the one-year cache header is safe.
 */
export function shopImageBasePath(now = Date.now(), prefix = SHOP_IMAGE_PREFIX) {
  return `${prefix}/${now}-${randomSuffix()}`;
}

/** Public URL for a path in the shop image bucket. */
export function shopImagePublicUrl(path) {
  return supabase.storage.from(SHOP_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Run `fn` over `items` with at most `limit` in flight. Results keep input
 * order. A rejected `fn` rejects the whole call, so callers that want
 * per-item error isolation should resolve their own error objects.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function uploadWithRetry(path, body, { attempts = UPLOAD_ATTEMPTS } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { error } = await supabase.storage
      .from(SHOP_IMAGE_BUCKET)
      .upload(path, body, { upsert: true, cacheControl: CACHE_CONTROL, contentType: body.type || undefined });
    if (!error) return;
    lastError = error;
    if (attempt < attempts) await sleep(300 * attempt);
  }
  throw new Error(lastError?.message || 'Upload failed');
}

/**
 * Compress, thumbnail and upload one image File.
 *
 * `prefix` picks the folder inside the `media` bucket. Shop photos use the
 * default; the homepage hero showcase (Admin → Hero Showcase) uploads under
 * `hero-showcase` through the same pipeline so its cards — displayed at 68 px
 * and 160 px — get the 480 px companion thumbnail instead of being served the
 * full upload (PageSpeed's biggest "Improve image delivery" line on desktop).
 * @returns {Promise<{url: string, path: string, thumbnail: boolean}>}
 */
export async function uploadShopImage(file, { prefix = SHOP_IMAGE_PREFIX } = {}) {
  if (!(typeof File !== 'undefined' && file instanceof File)) {
    throw new Error('Not an image file');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} is larger than 20MB`);
  }

  const [full, thumb] = await Promise.all([
    compressImage(file, FULL_IMAGE_PRESET),
    createThumbnail(file),
  ]);

  // `compressImage` is deliberately fail-safe: anything it can't decode comes
  // back as the ORIGINAL File so an upload is never blocked. That's the right
  // default for formats every browser can render — but not for HEIC/HEIF.
  // Only Safari can decode it, so in Chrome/Firefox compression silently falls
  // through and we'd store a .heic that most shoppers' browsers cannot display:
  // a broken image on the storefront, discovered long after the import.
  // Refuse it with an actionable message instead.
  if (!WEB_SAFE_IMAGE_RE.test(full.type || '')) {
    throw new Error(
      `${file.name} is ${describeFormat(file)}, which most browsers can't display. Export it as JPEG (or use a Mac/Safari) and re-import.`
    );
  }

  const base = shopImageBasePath(Date.now(), prefix);
  const isWebp = /webp/i.test(full.type || '');

  // The `.opt.webp` marker promises a companion thumbnail exists, so earn it
  // before claiming it: upload the thumb FIRST and only use the marker path if
  // it landed. A thumbnail is an optimisation, never a requirement — if it
  // fails we fall back to an unmarked path and grids serve the full image,
  // which is slower but never a broken tile.
  let thumbnail = false;
  if (isWebp && /webp/i.test(thumb.type || '')) {
    try {
      await uploadWithRetry(thumbStoragePath(`${base}${OPTIMIZED_SUFFIX}`), thumb, { attempts: 1 });
      thumbnail = true;
    } catch (err) {
      console.warn('Shop thumbnail upload failed (serving full image instead):', err);
    }
  }

  const path = thumbnail ? `${base}${OPTIMIZED_SUFFIX}` : `${base}.${extensionFor(full.type)}`;
  await uploadWithRetry(path, full);

  return { url: shopImagePublicUrl(path), path, thumbnail };
}

/**
 * Upload a mixed list of new Files and already-uploaded images, preserving
 * order so the first entry stays the product's primary photo.
 *
 * @param {Array<File|{isExisting: true, url: string}|string>} entries
 * @param {object}   [options]
 * @param {number}   [options.concurrency] Max uploads in flight (default 4).
 * @param {Function} [options.onProgress]  Called with (done, total) after each file.
 * @returns {Promise<string[]>} Public URLs in input order.
 */
export async function uploadShopImages(entries, options = {}) {
  const { concurrency = DEFAULT_CONCURRENCY, onProgress } = options;
  const list = Array.isArray(entries) ? entries : [];

  const newFileCount = list.filter((e) => typeof File !== 'undefined' && e instanceof File).length;
  let done = 0;
  const tick = () => {
    done += 1;
    if (onProgress) onProgress(done, newFileCount);
  };

  const results = await mapWithConcurrency(list, concurrency, async (entry) => {
    if (typeof entry === 'string') return entry;
    if (entry && entry.isExisting) return entry.url;
    const { url } = await uploadShopImage(entry);
    tick();
    return url;
  });

  return results.filter(Boolean);
}

export default uploadShopImages;
