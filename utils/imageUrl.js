import { supabase } from '@/lib/supabaseClient.js';

// Responsive image URLs for Supabase-hosted listing/product photos.
//
// User uploads are full-resolution, but card grids display them at ~300 px. We
// use Supabase Storage image transformations to request right-sized images
// (the render endpoint also auto-negotiates WebP/AVIF via the Accept header),
// and emit a srcset so the browser picks the smallest sufficient file per
// viewport/DPR.
//
// Image transformations are a paid Supabase feature. Rather than assume it's
// enabled, this degrades gracefully: every result carries a `fallbackSrc` (the
// untransformed public URL) and `CardImage` swaps to it if a transformed URL
// fails to load. The first such failure flips a session flag so we stop
// requesting transforms entirely — bounding the cost to ~1 wasted request if
// the feature is off.

const DEFAULT_BUCKET = 'vault-images';
const DEFAULT_WIDTHS = [240, 400, 600];

// Session-scoped: set true the first time a transformed URL 404/errors.
let transformsUnavailable = false;

export function markTransformsUnavailable() {
  transformsUnavailable = true;
}

export function areTransformsUnavailable() {
  return transformsUnavailable;
}

// For tests — reset the session flag between cases.
export function _resetTransformState() {
  transformsUnavailable = false;
}

const isHttp = (s) => typeof s === 'string' && /^https?:\/\//.test(s);

/**
 * Build a responsive image descriptor for a card/grid image.
 *
 * @param {string|null} pathOrUrl  Supabase storage path, or an absolute URL.
 * @param {object} [opts]
 * @param {number[]} [opts.widths]  Candidate widths for the srcset.
 * @param {string}   [opts.bucket]  Storage bucket (default `vault-images`).
 * @param {number}   [opts.quality] Transform quality (default 75).
 * @returns {{ src: string|null, srcSet: string|null, fallbackSrc: string|null }}
 */
export function getCardImage(pathOrUrl, opts = {}) {
  const { widths = DEFAULT_WIDTHS, bucket = DEFAULT_BUCKET, quality = 75 } = opts;

  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return { src: null, srcSet: null, fallbackSrc: null };
  }

  // Already an absolute URL (legacy/external image) — nothing to transform.
  if (isHttp(pathOrUrl)) {
    return { src: pathOrUrl, srcSet: null, fallbackSrc: pathOrUrl };
  }

  const fallbackSrc = supabase.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl;

  // Feature known-off this session → just serve the original.
  if (transformsUnavailable) {
    return { src: fallbackSrc, srcSet: null, fallbackSrc };
  }

  const at = (width) =>
    supabase.storage.from(bucket).getPublicUrl(pathOrUrl, {
      transform: { width, quality, resize: 'cover' },
    }).data.publicUrl;

  const sorted = [...widths].sort((a, b) => a - b);
  const srcSet = sorted.map((w) => `${at(w)} ${w}w`).join(', ');
  // Default src = middle width (a sensible pick for no-srcset browsers).
  const src = at(sorted[Math.floor(sorted.length / 2)] ?? sorted[0]);

  return { src, srcSet, fallbackSrc };
}

// Sensible default `sizes` for the 1→2→3→4 column card grids used across the
// marketplace/shop/vault. Slightly generous so we never under-fetch.
export const CARD_GRID_SIZES =
  '(min-width: 1280px) 300px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw';
