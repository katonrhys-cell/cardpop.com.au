// Path/URL rules for scripts/optimize-shop-images.mjs, kept pure so they're
// testable without Supabase or sharp.
//
// A source photo `<folder>/<name>.png` in a public bucket gets two companions:
//   optimized/<folder>/<name>.opt.webp        — full image, ≤ FULL_MAX px
//   optimized/<folder>/<name>.opt.thumb.webp  — grid thumbnail, ≤ THUMB_MAX px
// The `.opt.webp` marker is what utils/imageUrl.js keys on to emit a thumbSrc,
// and the thumb name is exactly thumbStoragePath() of the full image.

export const OPTIMIZED_PREFIX = 'optimized/';
export const FULL_MAX = 1600;
export const THUMB_MAX = 480;

const SUPABASE_OBJECT_URL_RE =
  /^(https?:\/\/[^/]+\.supabase\.(?:co|in))\/storage\/v1\/object\/public\/([^/]+)\/([^?#]+)$/;

const CONVERTIBLE_EXT_RE = /\.(png|jpe?g)$/i;

/** Split a public Supabase object URL into { origin, bucket, path } (decoded), else null. */
export function parseObjectUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(SUPABASE_OBJECT_URL_RE);
  if (!m) return null;
  try {
    return { origin: m[1], bucket: decodeURIComponent(m[2]), path: decodeURIComponent(m[3]) };
  } catch {
    return null;
  }
}

/** Public URL for bucket + path, encoding each segment (bucket and folders may contain spaces). */
export function objectUrl(origin, bucket, path) {
  const encoded = `${bucket}/${path}`.split('/').map(encodeURIComponent).join('/');
  return `${origin}/storage/v1/object/public/${encoded}`;
}

/** True for a PNG/JPEG original that hasn't already been optimized. */
export function isConvertible(path) {
  return typeof path === 'string' && CONVERTIBLE_EXT_RE.test(path) && !path.startsWith(OPTIMIZED_PREFIX);
}

export function optimizedPath(path) {
  return `${OPTIMIZED_PREFIX}${path.replace(CONVERTIBLE_EXT_RE, '')}.opt.webp`;
}

export function optimizedThumbPath(path) {
  return optimizedPath(path).replace(/\.webp$/, '.thumb.webp');
}

/**
 * Rewrite a product row's image fields onto optimized URLs.
 *
 * @param {{ image_url?: string|null, images?: unknown }} row
 * @param {Map<string,string>} done  original URL → optimized URL, for sources converted successfully
 * @returns {{ image_url: string|null, images: string[] } | null}  null when nothing changes
 */
export function rewriteRowImages(row, done) {
  const swap = (u) => (typeof u === 'string' && done.has(u) ? done.get(u) : u);
  const images = Array.isArray(row.images) ? row.images : [];
  const nextImages = images.map(swap);
  const nextUrl = swap(row.image_url ?? null);
  const changed = nextUrl !== (row.image_url ?? null) || nextImages.some((u, i) => u !== images[i]);
  return changed ? { image_url: nextUrl, images: nextImages } : null;
}
