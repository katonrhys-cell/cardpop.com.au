/**
 * Prepares the image sent to the identification models.
 *
 * The photo a seller takes has the card sitting in a frame, usually tilted and
 * surrounded by desk. Vision APIs downscale what you send them (Anthropic caps
 * the long edge around 1568px), so the *card's* share of that budget is what
 * actually determines whether the collector number and copyright line are
 * legible. Rectifying the card out of the photo first spends the whole budget
 * on the card: a 3000×4000 photo where the card fills 60% of the frame arrives
 * as roughly 900×1250 pixels of card, where the same card cropped and warped to
 * the standard 1200×1680 arrives intact. That is the small print the catalogue
 * lookup depends on.
 *
 * Every failure path keeps the original file. Detection that finds nothing,
 * OpenCV failing to load, a warp that comes out too small, or the whole thing
 * taking too long all resolve to "use what the seller gave us" — this step can
 * only improve the input or leave it alone, never block a scan.
 */

import { detectAndCropCard } from './detectCard.js';
import { compressImage } from './compressImage.js';

// Detection lazy-loads OpenCV (a large wasm chunk) on first use. Cap the wait so
// a slow connection or a failed load delays the scan by this much at worst.
const DETECT_TIMEOUT_MS = 8000;

// Longest edge worth sending. Both identification models downscale their input
// (Anthropic caps the long edge near 1568px), so pixels beyond this cost payload
// and buy nothing — a 4 MB phone photo and a 400 KB resize of it are the same
// picture by the time the model sees them.
const MAX_UPLOAD_EDGE = 1600;
const UPLOAD_QUALITY = 0.85;

// Vercel rejects a serverless request body over 4.5 MB with a 413 before Express
// ever runs, so the whole multipart body has to fit under that. This budget
// leaves headroom for multipart overhead and the other form fields.
const TOTAL_PAYLOAD_BUDGET = 3.5 * 1024 * 1024;

// A warp smaller than this on its long edge is not worth trading the original
// for — something has gone wrong with the detected quad.
const MIN_USEFUL_EDGE = 600;

// Build-time opt-out. On by default; set VITE_OCR_AUTOCROP=false to send the
// original photo straight to the models.
const AUTOCROP_ENABLED = import.meta.env?.VITE_OCR_AUTOCROP !== 'false';

/**
 * @param {File|null|undefined} file - the seller's photo
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ file: File, cropped: boolean }>} the image to analyse.
 *   `cropped` is true only when a rectified card is being returned.
 */
export async function prepareAnalysisImage(file, { timeoutMs = DETECT_TIMEOUT_MS } = {}) {
  if (!file || !AUTOCROP_ENABLED) return { file, cropped: false };

  let timer;
  try {
    const result = await Promise.race([
      detectAndCropCard(file),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);

    if (!result?.found || !result.blob) return { file, cropped: false };
    if (Math.max(result.width ?? 0, result.height ?? 0) < MIN_USEFUL_EDGE) {
      return { file, cropped: false };
    }

    const base = (file.name || 'card').replace(/\.[^.]+$/, '');
    return {
      file: new File([result.blob], `${base}-analysis.jpg`, { type: 'image/jpeg' }),
      cropped: true,
    };
  } catch {
    return { file, cropped: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Resizes one image down to something worth sending, or returns it unchanged. */
async function boundForUpload(file) {
  if (!file) return file;
  try {
    // JPEG rather than the compressor's default WebP: this goes to two
    // third-party APIs, and JPEG is the format both unambiguously accept.
    return await compressImage(file, {
      maxDimension: MAX_UPLOAD_EDGE,
      quality: UPLOAD_QUALITY,
      mimeType: 'image/jpeg',
    });
  } catch {
    return file;
  }
}

/**
 * Prepares every image for an identification request: rectifies the front,
 * resizes them all to something worth sending, and drops trailing angles if the
 * body would still be too large.
 *
 * The payload cap is the point. Vercel refuses a request body over 4.5 MB with a
 * 413 (`FUNCTION_PAYLOAD_TOO_LARGE`) before any of our code runs, and the form
 * previously posted raw camera files — up to 5 MB each, up to three of them — so
 * identification failed outright on ordinary phone photos. Resizing first is
 * free accuracy-wise, since the models downscale to roughly this size anyway.
 *
 * @param {Array<File|null|undefined>} files - front first, then extra angles
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ files: File[], cropped: boolean, dropped: number }>}
 */
export async function prepareAnalysisImages(files, options = {}) {
  const present = (Array.isArray(files) ? files : [files]).filter(Boolean);
  if (!present.length) return { files: [], cropped: false, dropped: 0 };

  const [front, ...extras] = present;
  const { file: rectified, cropped } = await prepareAnalysisImage(front, options);

  const bounded = await Promise.all([rectified, ...extras].map(boundForUpload));

  // Trim from the back until the body fits: the front is the read that matters,
  // the extra angles only add set codes and copyright lines.
  const kept = [...bounded];
  let total = kept.reduce((sum, f) => sum + (f.size ?? 0), 0);
  let dropped = 0;
  while (kept.length > 1 && total > TOTAL_PAYLOAD_BUDGET) {
    total -= kept.pop().size ?? 0;
    dropped += 1;
  }

  return { files: kept, cropped, dropped };
}
