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

// Optional image CDN in front of Supabase Storage (a Cloudflare Worker on
// img.cardpop.com.au — see cloudflare/image-proxy-worker.js — or any host
// that proxies /storage/v1/... paths). Supabase egress is metered — including
// its own CDN's cache hits — so serving images through an external CDN takes
// storage traffic off the Supabase quota. When VITE_IMAGE_CDN_HOST is set
// (e.g. `img.cardpop.com.au`), public storage URLs are rewritten to that
// host; when unset, everything below is a no-op and URLs stay on Supabase.
// See docs/image-cdn.md.
let cdnOrigin = normalizeCdnHost(import.meta.env?.VITE_IMAGE_CDN_HOST);

function normalizeCdnHost(host) {
  if (!host || typeof host !== 'string') return null;
  const trimmed = host.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// For tests — override the CDN origin without stubbing import.meta.env.
export function _setCdnHostForTests(host) {
  cdnOrigin = normalizeCdnHost(host);
}

// Origin of the Supabase project (e.g. https://xxxx.supabase.co), derived once
// from a throwaway public URL. Used to map a CDN storage URL back to its source
// of truth when the CDN itself is failing to serve — see canonicalStorageUrl.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(
      supabase.storage.from(DEFAULT_BUCKET).getPublicUrl('_').data.publicUrl
    ).origin;
  } catch {
    return null;
  }
})();

/**
 * Reverse of {@link toCdnUrl}: map a storage URL served from the image CDN back
 * to the canonical Supabase origin. Any URL not on the CDN host (or when no CDN
 * is configured) is returned unchanged. This is the recovery path when the CDN
 * has an outage — the object is still readable straight from Supabase Storage.
 */
export function canonicalStorageUrl(url) {
  if (typeof url !== 'string' || !cdnOrigin || !SUPABASE_ORIGIN) return url;
  if (url === cdnOrigin || url.startsWith(`${cdnOrigin}/`)) {
    return `${SUPABASE_ORIGIN}${url.slice(cdnOrigin.length)}`;
  }
  return url;
}

// Matches the origin of a Supabase storage public URL, keeping the
// `/storage/v1/...` path intact so the CDN can proxy it verbatim.
const SUPABASE_STORAGE_URL_RE =
  /^https?:\/\/[^/]+\.supabase\.(co|in)(\/storage\/v1\/(?:object|render\/image)\/public\/.+)$/;

/**
 * Rewrite a Supabase storage public URL onto the image CDN, if one is
 * configured. Any other URL (external images, signed URLs, null) is returned
 * unchanged, so this is always safe to apply.
 */
export function toCdnUrl(url) {
  if (!cdnOrigin || typeof url !== 'string') return url ?? null;
  const match = url.match(SUPABASE_STORAGE_URL_RE);
  return match ? `${cdnOrigin}${match[2]}` : url;
}

/**
 * Public URL for an image that may be stored as a bucket path or an absolute
 * URL (both shapes exist in the database). Routes through the image CDN when
 * configured. Use this instead of calling `getPublicUrl` directly at render
 * time.
 */
export function publicImageUrl(pathOrUrl, bucket = DEFAULT_BUCKET) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  if (isHttp(pathOrUrl)) return toCdnUrl(pathOrUrl);
  return toCdnUrl(supabase.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl);
}

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
 * @returns {{ src: string|null, srcSet: string|null, fallbackSrc: string|null, canonicalSrc: string|null }}
 */
export function getCardImage(pathOrUrl, opts = {}) {
  const { widths = DEFAULT_WIDTHS, bucket = DEFAULT_BUCKET, quality = 75 } = opts;

  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return { src: null, srcSet: null, fallbackSrc: null, canonicalSrc: null };
  }

  // Already an absolute URL (legacy/external image) — nothing to transform.
  // `canonicalSrc` is the un-rewritten original, so a CDN outage falls back to
  // the source URL (DB-stored URLs are canonical Supabase URLs by design).
  if (isHttp(pathOrUrl)) {
    const direct = toCdnUrl(pathOrUrl);
    return { src: direct, srcSet: null, fallbackSrc: direct, canonicalSrc: pathOrUrl };
  }

  // Canonical (non-CDN) public URL — the last-resort fallback that always hits
  // Supabase directly, so a CDN failure self-heals instead of showing a broken
  // image. `fallbackSrc` stays CDN-routed (untransformed) to keep egress off
  // the metered quota in the normal case where only transforms are the problem.
  const canonicalSrc = supabase.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl;
  const fallbackSrc = toCdnUrl(canonicalSrc);

  // Feature known-off this session → just serve the original.
  if (transformsUnavailable) {
    return { src: fallbackSrc, srcSet: null, fallbackSrc, canonicalSrc };
  }

  const at = (width) =>
    toCdnUrl(
      supabase.storage.from(bucket).getPublicUrl(pathOrUrl, {
        transform: { width, quality, resize: 'cover' },
      }).data.publicUrl
    );

  const sorted = [...widths].sort((a, b) => a - b);
  const srcSet = sorted.map((w) => `${at(w)} ${w}w`).join(', ');
  // Default src = middle width (a sensible pick for no-srcset browsers).
  const src = at(sorted[Math.floor(sorted.length / 2)] ?? sorted[0]);

  return { src, srcSet, fallbackSrc, canonicalSrc };
}

// Sensible default `sizes` for the 1→2→3→4 column card grids used across the
// marketplace/shop/vault. Slightly generous so we never under-fetch.
export const CARD_GRID_SIZES =
  '(min-width: 1280px) 300px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw';
