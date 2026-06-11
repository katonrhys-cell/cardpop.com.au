/**
 * CardPop Photography Standard v1.0 — photo quality scoring.
 *
 * The metric and scoring functions are pure (they operate on grayscale luma
 * arrays) so they can be unit-tested without a canvas. analyzePhotoQuality()
 * is the browser entry point: it decodes an image File, downsamples it onto
 * a canvas and runs the full set of checks.
 */

export const PHOTO_STANDARD = {
  minHeight: 1200,        // minimum listing image height (px)
  recommendedHeight: 2000,
  premiumHeight: 3000,
  mainImage: { width: 1200, height: 1680 }, // portrait main listing image
  targetFillRatio: 0.85,  // card should fill ~85% of the frame
};

// Relative weight of each check in the overall score (sums to 100)
export const QUALITY_WEIGHTS = {
  resolution: 25,
  sharpness: 25,
  lighting: 20,
  glare: 15,
  crop: 15,
};

// Analysis is run on a downsampled copy for speed; metrics are tuned for this size
const ANALYSIS_MAX_DIM = 512;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ─── Metrics (pure, operate on luma data) ────────────────────────────────────

/** Converts RGBA pixel data (Uint8ClampedArray from getImageData) to a luma array. */
export function computeLuma(rgba) {
  const luma = new Float32Array(rgba.length / 4);
  for (let i = 0; i < luma.length; i++) {
    const o = i * 4;
    luma[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return luma;
}

export function meanLuma(luma) {
  if (!luma.length) return 0;
  let sum = 0;
  for (let i = 0; i < luma.length; i++) sum += luma[i];
  return sum / luma.length;
}

/** Fraction of pixels at or above the blown-highlight threshold (specular glare). */
export function blownHighlightRatio(luma, threshold = 250) {
  if (!luma.length) return 0;
  let blown = 0;
  for (let i = 0; i < luma.length; i++) {
    if (luma[i] >= threshold) blown++;
  }
  return blown / luma.length;
}

/**
 * Variance of the 4-neighbour Laplacian — the standard cheap blur metric.
 * Sharp images have strong local intensity changes and therefore high variance.
 */
export function laplacianVariance(luma, width, height) {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - width] - luma[i + width];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Estimates how much of the frame the card occupies. The background level is
 * sampled from the border ring; pixels that differ from it by more than
 * `diffThreshold` are treated as subject, and the subject's bounding-box area
 * relative to the frame is returned (0–1).
 */
export function subjectFillRatio(luma, width, height, diffThreshold = 40) {
  if (width < 4 || height < 4) return 0;

  let borderSum = 0;
  let borderCount = 0;
  for (let x = 0; x < width; x++) {
    borderSum += luma[x] + luma[(height - 1) * width + x];
    borderCount += 2;
  }
  for (let y = 1; y < height - 1; y++) {
    borderSum += luma[y * width] + luma[y * width + width - 1];
    borderCount += 2;
  }
  const background = borderSum / borderCount;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(luma[y * width + x] - background) > diffThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return 0;
  return ((maxX - minX + 1) * (maxY - minY + 1)) / (width * height);
}

// ─── Scoring (pure, each returns 0–100) ──────────────────────────────────────

export function scoreResolution(width, height) {
  // The standard is expressed in image height (portrait orientation)
  const h = Math.max(0, height);
  const { minHeight, recommendedHeight, premiumHeight } = PHOTO_STANDARD;
  if (h >= premiumHeight) return 100;
  if (h >= recommendedHeight) {
    return Math.round(85 + (15 * (h - recommendedHeight)) / (premiumHeight - recommendedHeight));
  }
  if (h >= minHeight) {
    return Math.round(60 + (25 * (h - minHeight)) / (recommendedHeight - minHeight));
  }
  return Math.round((60 * h) / minHeight);
}

export function scoreSharpness(variance) {
  // ~250+ Laplacian variance on a 512px downsample reads as crisp
  return Math.round(clamp((variance / 250) * 100, 0, 100));
}

export function scoreLighting(mean) {
  // Well-exposed card photos on a white background sit in the 120–190 band
  if (mean >= 120 && mean <= 190) return 100;
  if (mean < 120) return Math.round(clamp((100 * (mean - 30)) / (120 - 30), 0, 100));
  return Math.round(clamp((100 * (245 - mean)) / (245 - 190), 0, 100));
}

export function scoreGlare(blownRatio) {
  // Up to 1% blown pixels is normal (gloss/foil); beyond 15% is unusable
  if (blownRatio <= 0.01) return 100;
  return Math.round(clamp(100 * (1 - (blownRatio - 0.01) / 0.14), 0, 100));
}

export function scoreCropFill(fillRatio) {
  // Target is ~85% fill; a ±10% band scores full marks, then falls off
  const deviation = Math.abs(fillRatio - PHOTO_STANDARD.targetFillRatio);
  if (deviation <= 0.1) return 100;
  return Math.round(clamp(100 - (deviation - 0.1) * 400, 0, 100));
}

export function computeOverallScore(scores) {
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(QUALITY_WEIGHTS)) {
    if (typeof scores[key] === 'number') {
      total += scores[key] * weight;
      weightSum += weight;
    }
  }
  return weightSum ? Math.round(total / weightSum) : 0;
}

// ─── Check metadata + hints shown to sellers ─────────────────────────────────

const CHECK_DEFS = [
  {
    key: 'resolution',
    label: 'Resolution',
    hint: `Aim for at least ${PHOTO_STANDARD.minHeight}px tall (${PHOTO_STANDARD.recommendedHeight}px+ recommended) so buyers can zoom on corners and edges.`,
  },
  {
    key: 'sharpness',
    label: 'Sharpness',
    hint: 'The image looks soft. Use a tripod or rest your phone on something stable, tap to focus, and avoid digital zoom.',
  },
  {
    key: 'lighting',
    label: 'Lighting',
    hint: 'The exposure is off. Shoot near a window in natural light or use two LED panels angled at 45° — avoid direct overhead flash.',
  },
  {
    key: 'glare',
    label: 'Glare',
    hint: 'Bright reflections are hiding the surface. Tilt the card slightly or diffuse your light source to remove hotspots.',
  },
  {
    key: 'crop',
    label: 'Crop & framing',
    hint: 'The card should fill about 85% of the frame on a plain background. Move closer and centre the card.',
  },
];

export function buildQualityResult({ width, height, metrics }) {
  const scores = {
    resolution: scoreResolution(width, height),
    sharpness: scoreSharpness(metrics.laplacianVariance),
    lighting: scoreLighting(metrics.meanLuma),
    glare: scoreGlare(metrics.blownRatio),
    crop: scoreCropFill(metrics.fillRatio),
  };
  return {
    overall: computeOverallScore(scores),
    width,
    height,
    checks: CHECK_DEFS.map(({ key, label, hint }) => ({
      key,
      label,
      score: scores[key],
      hint,
    })),
  };
}

// ─── Browser entry point ─────────────────────────────────────────────────────

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
    img.src = url;
  });
}

/**
 * Analyzes an image File against the CardPop Photography Standard.
 * Returns { overall, width, height, checks: [{ key, label, score, hint }] }.
 */
export async function analyzePhotoQuality(file) {
  const image = await decodeImage(file);
  const naturalWidth = image.naturalWidth ?? image.width;
  const naturalHeight = image.naturalHeight ?? image.height;

  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(naturalWidth, naturalHeight));
  const w = Math.max(1, Math.round(naturalWidth * scale));
  const h = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  if (typeof image.close === 'function') image.close();

  const luma = computeLuma(data);
  return buildQualityResult({
    width: naturalWidth,
    height: naturalHeight,
    metrics: {
      meanLuma: meanLuma(luma),
      blownRatio: blownHighlightRatio(luma),
      laplacianVariance: laplacianVariance(luma, w, h),
      fillRatio: subjectFillRatio(luma, w, h),
    },
  });
}
