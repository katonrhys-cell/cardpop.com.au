/**
 * Card detection + perspective crop (browser only).
 *
 * Given an image File, this finds the card's outer quadrilateral, warps it flat
 * (removing perspective/tilt) and fits it to the standard 5:7 card format.
 * Detection runs on a downscaled copy for speed; the final warp is done at full
 * resolution so the saved image stays crisp.
 *
 * Everything is best-effort: if OpenCV fails to load or no card-like quad is
 * found, it resolves to { found: false } and the caller keeps the original.
 */

import { loadOpenCV } from './opencvLoader.js';
import { orderCorners, isPlausibleCard, outputDimsFor } from './cardCrop.js';

const DETECT_MAX_DIM = 1024; // downscale long edge to this for contour detection
const JPEG_QUALITY = 0.95;

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
    img.src = url;
  });
}

function drawToCanvas(image, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, w, h);
  return canvas;
}

/**
 * Reduces a contour to a 4-point quad. First tries approxPolyDP at increasing
 * epsilons to land on a clean quadrilateral; if the contour is too noisy to
 * approximate to four points (common with busy/low-contrast backgrounds), falls
 * back to its rotated min-area rectangle — which still corrects rotation and
 * gives a usable crop. Returns [[x, y] × 4].
 */
function quadFromContour(cv, contour) {
  const peri = cv.arcLength(contour, true);
  for (const k of [0.02, 0.03, 0.04, 0.05]) {
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, k * peri, true);
    if (approx.rows === 4) {
      const pts = [
        [approx.data32S[0], approx.data32S[1]],
        [approx.data32S[2], approx.data32S[3]],
        [approx.data32S[4], approx.data32S[5]],
        [approx.data32S[6], approx.data32S[7]],
      ];
      approx.delete();
      return pts;
    }
    approx.delete();
  }
  // Fallback: rotated bounding rectangle of the contour.
  const rect = cv.minAreaRect(contour);
  return cv.RotatedRect.points(rect).map(p => [p.x, p.y]);
}

/**
 * Finds the card quad in the downscaled image. Considers every contour large
 * enough to be the card (biggest first) and returns the first one that reduces
 * to a plausible card-shaped quad. This is far more tolerant of textured or
 * low-contrast backgrounds than requiring a single clean 4-point contour, since
 * a card border broken up by background edges can still be recovered via its
 * rotated bounding rectangle. Returns [[x, y] × 4] or null.
 */
function findCardQuad(cv, canvas) {
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let kernel = null;
  const large = [];

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 40, 120);
    // Morphological close (larger kernel than a plain dilate) bridges gaps so a
    // card edge interrupted by a textured background still forms one contour.
    kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);

    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const minArea = 0.12 * canvas.width * canvas.height;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      if (cv.contourArea(contour) >= minArea) large.push(contour);
      else contour.delete();
    }
    // Biggest first — the card is normally the largest foreground object.
    large.sort((a, b) => cv.contourArea(b) - cv.contourArea(a));

    for (const contour of large) {
      const quad = quadFromContour(cv, contour);
      if (quad && isPlausibleCard(quad, canvas.width, canvas.height)) return quad;
    }
    return null;
  } finally {
    for (const contour of large) contour.delete();
    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    if (kernel) kernel.delete();
  }
}

/** Warps the full-resolution source so `quad` becomes a flat 5:7 rectangle. */
function warpCard(cv, fullCanvas, quad) {
  const ordered = orderCorners(quad);
  const { width, height } = outputDimsFor(quad);

  const src = cv.imread(fullCanvas);
  const dst = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flat());
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);

  try {
    cv.warpPerspective(src, dst, M, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    const out = document.createElement('canvas');
    cv.imshow(out, dst);
    return out;
  } finally {
    src.delete();
    dst.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
  }
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

/**
 * Detects and crops the card in `file`.
 * @returns {Promise<{ found: false } | { found: true, blob: Blob, url: string, width: number, height: number }>}
 */
export async function detectAndCropCard(file) {
  let cv;
  try {
    cv = await loadOpenCV();
  } catch {
    return { found: false };
  }

  let bitmap;
  try {
    bitmap = await decodeImage(file);
    const naturalW = bitmap.naturalWidth ?? bitmap.width;
    const naturalH = bitmap.naturalHeight ?? bitmap.height;

    const scale = Math.min(1, DETECT_MAX_DIM / Math.max(naturalW, naturalH));
    const dW = Math.max(1, Math.round(naturalW * scale));
    const dH = Math.max(1, Math.round(naturalH * scale));

    const detectCanvas = drawToCanvas(bitmap, dW, dH);
    const quadSmall = findCardQuad(cv, detectCanvas);
    if (!quadSmall) return { found: false };

    // Scale corners back up to full-resolution coordinates.
    const quadFull = quadSmall.map(([x, y]) => [x / scale, y / scale]);
    if (!isPlausibleCard(quadFull, naturalW, naturalH)) return { found: false };

    const fullCanvas = drawToCanvas(bitmap, naturalW, naturalH);
    const outCanvas = warpCard(cv, fullCanvas, quadFull);
    const blob = await canvasToBlob(outCanvas);
    if (!blob) return { found: false };

    return {
      found: true,
      blob,
      url: outCanvas.toDataURL('image/jpeg', JPEG_QUALITY),
      width: outCanvas.width,
      height: outCanvas.height,
      // Detected corners in full-resolution image coordinates, so the manual
      // adjuster can be seeded with the auto-detected quad.
      corners: quadFull,
    };
  } catch {
    return { found: false };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}

/**
 * Warps `file` using an explicit set of 4 corners (full-resolution image
 * coordinates), e.g. from the manual corner adjuster. Returns the cropped
 * image, or { ok: false } if OpenCV is unavailable or the warp fails.
 * @returns {Promise<{ ok: false } | { ok: true, blob: Blob, url: string, width: number, height: number }>}
 */
export async function warpCardWithCorners(file, corners) {
  let cv;
  try {
    cv = await loadOpenCV();
  } catch {
    return { ok: false };
  }

  let bitmap;
  try {
    bitmap = await decodeImage(file);
    const naturalW = bitmap.naturalWidth ?? bitmap.width;
    const naturalH = bitmap.naturalHeight ?? bitmap.height;

    const fullCanvas = drawToCanvas(bitmap, naturalW, naturalH);
    const outCanvas = warpCard(cv, fullCanvas, corners);
    const blob = await canvasToBlob(outCanvas);
    if (!blob) return { ok: false };

    return {
      ok: true,
      blob,
      url: outCanvas.toDataURL('image/jpeg', JPEG_QUALITY),
      width: outCanvas.width,
      height: outCanvas.height,
    };
  } catch {
    return { ok: false };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}
