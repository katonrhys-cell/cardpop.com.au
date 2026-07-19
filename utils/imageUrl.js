import { supabase } from '@/lib/supabaseClient.js';

// Responsive image URLs for Supabase-hosted listing/product photos.
//
// User uploads are full-resolution, but card grids display them at ~300 px. We
// use Supabase Storage image transformations to request right-sized images
// (the render endpoint also auto-negotiates WebP/AVIF via the Accept header),
// and emit a srcset so the browser picks the smallest sufficient file per
// viewport/DPR.
//
// Image transformations are a paid Supabase feature. It is OFF by default here:
// when it isn't enabled on the project the render endpoint 403s, and because a
// card grid fires one transform request per image on first paint, every page
// load produced a burst of 403s before falling back to the original. So we only
// emit transform URLs when VITE_SUPABASE_IMAGE_TRANSFORMS is explicitly enabled;
// otherwise `getCardImage` serves the untransformed public URL directly and
// never touches /render/image.
//
// Even when enabled, this still degrades gracefully: every result carries a
// `fallbackSrc` (the untransformed public URL) and `CardImage` swaps to it if a
// transformed URL fails to load. The first such failure flips a session flag so
// we stop requesting transforms entirely — bounding the cost to ~1 wasted
// request if the feature turns out to be unavailable.

const DEFAULT_BUCKET = 'vault-images';
const DEFAULT_WIDTHS = [240, 400, 600];

// Master switch for Supabase Storage image transformations (a paid feature).
// Default OFF: unless VITE_SUPABASE_IMAGE_TRANSFORMS is truthy at build time we
// never request the /render/image endpoint, so no 403s and no wasted first-load
// requests. Flip this to `true` only once transformations are enabled on the
// Supabase plan (Dashboard → Storage → Settings).
function truthyEnv(v) {
  return v === true || v === 'true' || v === '1';
}
let transformsEnabled = truthyEnv(import.meta.env?.VITE_SUPABASE_IMAGE_TRANSFORMS);

// For tests — toggle the env-gated switch without stubbing import.meta.env.
export function _setTransformsEnabledForTests(enabled) {
  transformsEnabled = !!enabled;
}

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

// Matches every Supabase storage public URL inside a blob of HTML, so stored
// article/content HTML can be rewritten onto the CDN in one pass.
const SUPABASE_STORAGE_URL_IN_HTML_RE =
  /https?:\/\/[^/"'\s]+\.supabase\.(?:co|in)(\/storage\/v1\/(?:object|render\/image)\/public\/)/g;

/**
 * Rewrite every Supabase storage public URL embedded in an HTML string onto
 * the image CDN. Admin-authored article bodies store canonical Supabase URLs
 * in their <img> tags; per-call-site helpers can't reach those, so the whole
 * HTML blob is rewritten just before render. No-op when no CDN is configured.
 */
export function cdnifyStorageUrlsInHtml(html) {
  if (!cdnOrigin || typeof html !== 'string') return html;
  return html.replace(SUPABASE_STORAGE_URL_IN_HTML_RE, `${cdnOrigin}$1`);
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

// Session-scoped: set true the first time a transformed URL 404/errors. Also
// starts true when VITE_IMAGE_TRANSFORMS='off', so the app never requests
// Supabase image transforms (a paid Pro feature) at all — it serves the
// already-upload-compressed originals directly. Flip the env var (or remove it)
// once transformations are enabled on the plan to resume right-sized delivery.
let transformsUnavailable = import.meta.env.VITE_IMAGE_TRANSFORMS === 'off';

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

// Matches an absolute Supabase storage *object* URL and captures bucket + path.
// Used to recover the storage path from URLs stored whole in the database
// (e.g. hero_showcase_cards.image_url), so they can get resize transforms too.
const SUPABASE_OBJECT_URL_RE =
  /^https?:\/\/[^/]+\.supabase\.(?:co|in)\/storage\/v1\/object\/public\/([^/]+)\/([^?]+)/;

/**
 * Split an absolute Supabase storage object URL into { bucket, path }, or
 * return null for anything else (external images, render/image URLs, paths).
 */
export function parseStorageObjectUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(SUPABASE_OBJECT_URL_RE);
  if (!m) return null;
  try {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null; // malformed percent-encoding — treat as opaque URL
  }
}

// ── Pre-generated grid thumbnails ──────────────────────────────────────────
//
// Uploads from THUMBNAILS_SINCE onward store a small companion thumbnail next
// to the full image (utils/compressImage.js createThumbnail), under a
// deterministic name so no DB column is needed: `<path minus ext>.thumb.webp`.
// Upload filenames embed their Date.now() timestamp, which lets renderers know
// whether a thumbnail exists WITHOUT probing: older uploads simply never get a
// thumbSrc, so legacy images cost zero extra requests.
export const THUMB_SUFFIX = '.thumb.webp';

// Uploads at/after this epoch-ms carry a companion thumbnail. Set just ahead
// of the feature's deploy; an upload with a thumb but a timestamp below the
// line merely serves the full image (harmless), whereas the reverse would 404.
export const THUMBNAILS_SINCE = 1784500000000; // 2026-07-19T23:06:40Z

/** Storage path of the companion thumbnail for a full-image storage path. */
export function thumbStoragePath(path) {
  return path.replace(/\.[^./]+$/, '') + THUMB_SUFFIX;
}

// Extract the upload timestamp embedded in a storage filename (the last
// 13-digit run in the basename — covers `<ts>.jpg`, `<ts>-extra-x.jpg`,
// `template-<id>-<ts>.webp`). Returns null when there isn't one.
function uploadTimestamp(path) {
  const base = String(path).split('/').pop() || '';
  const runs = base.match(/\d{13}/g);
  return runs ? Number(runs[runs.length - 1]) : null;
}

function hasThumbnail(path) {
  if (typeof path !== 'string' || path.endsWith(THUMB_SUFFIX)) return false;
  const ts = uploadTimestamp(path);
  return ts !== null && ts >= THUMBNAILS_SINCE;
}

/**
 * Build a responsive image descriptor for a card/grid image.
 *
 * @param {string|null} pathOrUrl  Supabase storage path, or an absolute URL.
 * @param {object} [opts]
 * @param {number[]} [opts.widths]  Candidate widths for the srcset.
 * @param {string}   [opts.bucket]  Storage bucket (default `vault-images`).
 * @param {number}   [opts.quality] Transform quality (default 75).
 * @returns {{ src: string|null, srcSet: string|null, fallbackSrc: string|null, canonicalSrc: string|null, thumbSrc: string|null }}
 */
export function getCardImage(pathOrUrl, opts = {}) {
  const { widths = DEFAULT_WIDTHS, bucket = DEFAULT_BUCKET, quality = 75 } = opts;

  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return { src: null, srcSet: null, fallbackSrc: null, canonicalSrc: null, thumbSrc: null };
  }

  // Absolute URL: if it's a Supabase storage object URL (the shape stored in
  // DB columns like image_url), recover its bucket/path so it can be resized
  // like any storage path — DB-stored originals are full-resolution scans, and
  // serving them untransformed was a multi-MB payload per image. Any other
  // absolute URL (external/legacy image) has nothing to transform.
  let effectivePath = pathOrUrl;
  let effectiveBucket = bucket;
  if (isHttp(pathOrUrl)) {
    const parsed = parseStorageObjectUrl(pathOrUrl);
    if (!parsed) {
      const direct = toCdnUrl(pathOrUrl);
      return { src: direct, srcSet: null, fallbackSrc: direct, canonicalSrc: pathOrUrl, thumbSrc: null };
    }
    effectivePath = parsed.path;
    effectiveBucket = parsed.bucket;
  }

  // Companion grid thumbnail (uploads since THUMBNAILS_SINCE) — CDN-routed.
  // Grid components try this first; CardImage falls back to the full image.
  const thumbSrc = hasThumbnail(effectivePath)
    ? toCdnUrl(
        supabase.storage.from(effectiveBucket).getPublicUrl(thumbStoragePath(effectivePath)).data
          .publicUrl
      )
    : null;

  // Canonical (non-CDN) public URL — the last-resort fallback that always hits
  // Supabase directly, so a CDN failure self-heals instead of showing a broken
  // image. `fallbackSrc` stays CDN-routed (untransformed) to keep egress off
  // the metered quota in the normal case where only transforms are the problem.
  const canonicalSrc = supabase.storage.from(effectiveBucket).getPublicUrl(effectivePath).data.publicUrl;
  const fallbackSrc = toCdnUrl(canonicalSrc);

  // Transforms disabled by config (default) or known-unavailable this session →
  // serve the untransformed original directly and never hit /render/image.
  if (!transformsEnabled || transformsUnavailable) {
    return { src: fallbackSrc, srcSet: null, fallbackSrc, canonicalSrc, thumbSrc };
  }

  const at = (width) =>
    toCdnUrl(
      supabase.storage.from(effectiveBucket).getPublicUrl(effectivePath, {
        transform: { width, quality, resize: 'cover' },
      }).data.publicUrl
    );

  const sorted = [...widths].sort((a, b) => a - b);
  const srcSet = sorted.map((w) => `${at(w)} ${w}w`).join(', ');
  // Default src = middle width (a sensible pick for no-srcset browsers).
  const src = at(sorted[Math.floor(sorted.length / 2)] ?? sorted[0]);

  return { src, srcSet, fallbackSrc, canonicalSrc, thumbSrc };
}

// Sensible default `sizes` for the 1→2→3→4 column card grids used across the
// marketplace/shop/vault. Slightly generous so we never under-fetch.
export const CARD_GRID_SIZES =
  '(min-width: 1280px) 300px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw';
