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

import { detectAndCropCard } from '@/utils/detectCard.js';

// Detection lazy-loads OpenCV (a large wasm chunk) on first use. Cap the wait so
// a slow connection or a failed load delays the scan by this much at worst.
const DETECT_TIMEOUT_MS = 8000;

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
