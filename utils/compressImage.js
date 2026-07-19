// Client-side image compression.
//
// Card photos are often uploaded straight off a phone camera at 3–8 MB and
// full resolution, then served back as small thumbnails — which is why pages
// load slowly. This resizes and re-encodes images in the browser *before* they
// are uploaded to Supabase Storage, typically shrinking them by 80–95% while
// keeping enough detail for zoom/inspection.
//
// It is deliberately defensive: anything it can't handle (non-images, SVG/GIF,
// already-small files, decode failures) falls through and returns the original
// File unchanged, so an upload can never be blocked by compression.

const DEFAULTS = {
  maxDimension: 1600, // longest edge in px — plenty for card detail/zoom
  quality: 0.82, // WebP/JPEG quality (0–1)
  mimeType: 'image/webp',
  skipUnderBytes: 80 * 1024, // don't bother with files already <80 KB
};

const isCompressible = (file) =>
  typeof File !== 'undefined' &&
  file instanceof File &&
  /^image\//i.test(file.type) &&
  !/svg|gif/i.test(file.type);

let webpSupport;
const supportsWebP = () => {
  if (webpSupport !== undefined) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
};

/**
 * Compress/resize an image File for upload.
 * @param {File} file        The original file from an <input type="file">.
 * @param {object} [options] Overrides for DEFAULTS (maxDimension, quality, mimeType, skipUnderBytes).
 * @returns {Promise<File>}  A smaller File, or the original if compression isn't worthwhile/possible.
 */
export async function compressImage(file, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  if (!isCompressible(file)) return file;
  if (file.size <= opts.skipUnderBytes) return file;

  const targetType =
    opts.mimeType === 'image/webp' && !supportsWebP() ? 'image/jpeg' : opts.mimeType;

  try {
    // `imageOrientation: 'from-image'` bakes in EXIF rotation so photos taken
    // sideways on a phone come out the right way up.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const { width, height } = bitmap;
    const scale = Math.min(1, opts.maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, targetType, opts.quality)
    );

    // If encoding failed or didn't actually save space, keep the original.
    if (!blob || blob.size >= file.size) return file;

    const ext = targetType === 'image/webp' ? 'webp' : 'jpg';
    const newName = file.name.replace(/\.[^/.]+$/, '') + '.' + ext;
    return new File([blob], newName, { type: targetType, lastModified: Date.now() });
  } catch (err) {
    console.error('Image compression failed, uploading original:', err);
    return file;
  }
}

// Card grids render at ~300 px but were serving the full 1600 px upload. A
// pre-generated grid thumbnail cuts each grid view's payload ~5-10× — which
// also shrinks CDN/edge cache pressure and the one-off R2 migration cost.
// Uploaded alongside the full image under a deterministic name (see
// thumbStoragePath in utils/imageUrl.js) so renderers can derive its URL
// without a DB column.
const THUMB_DEFAULTS = {
  maxDimension: 480, // ≥ the largest grid cell across breakpoints (~300 px @2x ≈ 600… 480 is the srcset sweet spot)
  quality: 0.7,
  mimeType: 'image/webp',
  skipUnderBytes: 20 * 1024, // tiny files are their own thumbnail
};

/**
 * Generate a small grid thumbnail for an image File. Same defensive behaviour
 * as {@link compressImage}: anything unprocessable comes back unchanged, so
 * the caller can always upload the result.
 */
export function createThumbnail(file, options = {}) {
  return compressImage(file, { ...THUMB_DEFAULTS, ...options });
}

/**
 * Compress an array of files, preserving order. Non-File entries (e.g. already
 * uploaded {url} placeholders) are passed through untouched.
 */
export async function compressImages(files, options = {}) {
  return Promise.all(
    files.map((f) => (f instanceof File ? compressImage(f, options) : f))
  );
}

export default compressImage;
