/**
 * Card detection + perspective crop (browser only).
 *
 * Given an image File, this finds the card's outer quadrilateral, warps it flat
 * (removing perspective/tilt) and fits it to the standard 5:7 card format.
 * Detection runs on a downscaled copy for speed; the final warp is done at full
 * resolution so the saved image stays crisp.
 *
 * Detection is built for real listing photos: a card held in a hand, in dim
 * indoor light, over a busy background. That rules out the classic "largest
 * clean contour" document-scanner approach — fingers crossing the card border
 * split its contour, and a hand merges the card into one blob with the arm.
 * Instead, candidate quads are generated three ways (contours over several
 * edge/threshold maps, convex hulls, and Hough-line intersections — lines
 * survive partial occlusion because each edge only needs a visible run, not an
 * unbroken outline), then every candidate is scored by how much of its
 * perimeter actually lies on image edges. The best-supported plausible quad
 * wins.
 *
 * Everything is best-effort: if OpenCV fails to load or no card-like quad is
 * found, it resolves to { found: false } and the caller keeps the original.
 */

import { loadOpenCV } from './opencvLoader.js';
import { orderCorners, isPlausibleCard, outputDimsFor, quadArea, quadSides, isConvexQuad, maxAngleError } from './cardCrop.js';

const DETECT_MAX_DIM = 1024; // downscale long edge to this for contour detection
const JPEG_QUALITY = 0.95;
const MIN_AREA_FRAC = 0.05;  // a card can sit fairly small in a hand-held photo

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

/** Approximate median of a single-channel Mat, sampled for speed. */
function matMedian(mat) {
  const data = mat.data;
  const step = Math.max(1, Math.floor(data.length / 5000));
  const sample = [];
  for (let i = 0; i < data.length; i += step) sample.push(data[i]);
  sample.sort((a, b) => a - b);
  return sample[Math.floor(sample.length / 2)] ?? 128;
}

/**
 * Candidate quads from the contours of one binary map. Each contour large
 * enough to be the card contributes up to three readings: a polygon
 * approximation (clean borders), the approximation of its convex hull (heals
 * notches where a finger cuts into the outline), and its rotated bounding
 * rectangle (last-resort shape). All are scored later — generating generously
 * and letting edge support decide is the whole strategy.
 */
function contourQuads(cv, binary, frameArea) {
  const quads = [];
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const minArea = MIN_AREA_FRAC * frameArea;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      try {
        if (cv.contourArea(contour) < minArea) continue;

        const peri = cv.arcLength(contour, true);
        for (const k of [0.02, 0.035, 0.05]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, k * peri, true);
          if (approx.rows === 4) {
            quads.push([
              [approx.data32S[0], approx.data32S[1]],
              [approx.data32S[2], approx.data32S[3]],
              [approx.data32S[4], approx.data32S[5]],
              [approx.data32S[6], approx.data32S[7]],
            ]);
          }
          approx.delete();
        }

        const hull = new cv.Mat();
        cv.convexHull(contour, hull);
        const hullPeri = cv.arcLength(hull, true);
        for (const k of [0.02, 0.05]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(hull, approx, k * hullPeri, true);
          if (approx.rows === 4) {
            quads.push([
              [approx.data32S[0], approx.data32S[1]],
              [approx.data32S[2], approx.data32S[3]],
              [approx.data32S[4], approx.data32S[5]],
              [approx.data32S[6], approx.data32S[7]],
            ]);
          }
          approx.delete();
        }
        hull.delete();

        const rect = cv.minAreaRect(contour);
        quads.push(cv.RotatedRect.points(rect).map(p => [p.x, p.y]));
      } finally {
        contour.delete();
      }
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
  return quads;
}

/** Intersection of two infinite lines given as segments, or null if parallel. */
function lineIntersection([x1, y1, x2, y2], [x3, y3, x4, y4]) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-6) return null;
  const a = x1 * y2 - y1 * x2;
  const b = x3 * y4 - y3 * x4;
  return [(a * (x3 - x4) - (x1 - x2) * b) / d, (a * (y3 - y4) - (y1 - y2) * b) / d];
}

/** Perpendicular distance from a point to the infinite line through a segment. */
function pointLineDistance([px, py], [x1, y1, x2, y2]) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!len) return 0;
  return Math.abs((x2 - x1) * (y1 - py) - (x1 - px) * (y2 - y1)) / len;
}

/**
 * Candidate quads built from Hough line segments: split detected lines into
 * two roughly-perpendicular families around the dominant orientation, then
 * intersect every well-separated pair from one family with every pair from the
 * other. This is what recovers a card held in a hand — each border only needs
 * one clear visible run for its line to be found, no matter how many fingers
 * cross it.
 */
function houghQuads(cv, edges, width, height) {
  const minDim = Math.min(width, height);
  const lines = new cv.Mat();
  const segments = [];
  try {
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 60, 0.18 * minDim, 0.04 * minDim);
    for (let i = 0; i < lines.rows; i++) {
      const [x1, y1, x2, y2] = lines.data32S.slice(i * 4, i * 4 + 4);
      const len = Math.hypot(x2 - x1, y2 - y1);
      const angle = ((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 180) % 180;
      segments.push({ seg: [x1, y1, x2, y2], len, angle });
    }
  } finally {
    lines.delete();
  }
  if (segments.length < 4) return [];

  // Dominant orientation: length-weighted vote on angle mod 90, in 10° bins.
  const bins = new Array(9).fill(0);
  for (const s of segments) bins[Math.floor((s.angle % 90) / 10)] += s.len;
  const domBin = bins.indexOf(Math.max(...bins));
  const dom = domBin * 10 + 5;

  const angDist = (a, b) => {
    const d = Math.abs(a - b) % 180;
    return Math.min(d, 180 - d);
  };
  const famA = [];
  const famB = [];
  for (const s of segments) {
    const dA = Math.min(angDist(s.angle, dom), angDist(s.angle, dom + 180));
    const dB = angDist(s.angle, dom + 90);
    if (dA <= 30 && dA <= dB) famA.push(s);
    else if (dB <= 30) famB.push(s);
  }
  famA.sort((a, b) => b.len - a.len);
  famB.sort((a, b) => b.len - a.len);
  const topA = famA.slice(0, 7);
  const topB = famB.slice(0, 7);

  // Well-separated pairs within a family — opposite borders of the card.
  const pairsOf = (fam) => {
    const pairs = [];
    for (let i = 0; i < fam.length; i++) {
      for (let j = i + 1; j < fam.length; j++) {
        const mid = [
          (fam[j].seg[0] + fam[j].seg[2]) / 2,
          (fam[j].seg[1] + fam[j].seg[3]) / 2,
        ];
        if (pointLineDistance(mid, fam[i].seg) >= 0.15 * minDim) pairs.push([fam[i], fam[j]]);
      }
    }
    return pairs;
  };

  const quads = [];
  const margin = 0.04 * Math.max(width, height);
  for (const [a1, a2] of pairsOf(topA)) {
    for (const [b1, b2] of pairsOf(topB)) {
      const corners = [
        lineIntersection(a1.seg, b1.seg),
        lineIntersection(a1.seg, b2.seg),
        lineIntersection(a2.seg, b2.seg),
        lineIntersection(a2.seg, b1.seg),
      ];
      if (corners.some(c => !c
        || c[0] < -margin || c[0] > width + margin
        || c[1] < -margin || c[1] > height + margin)) continue;
      quads.push(corners);
    }
  }
  return quads;
}

/**
 * Fraction of points sampled along each quad side that land on an edge pixel
 * (in the dilated support map). Returns per-side fractions plus the mean —
 * the score that separates the real card border from a hand-plus-card blob's
 * bounding box, whose sides mostly cross empty space.
 */
function edgeSupport(support, quad, width, height) {
  const ordered = orderCorners(quad);
  const data = support.data;
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = ordered[i];
    const [bx, by] = ordered[(i + 1) % 4];
    const samples = 40;
    let hits = 0;
    let counted = 0;
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const x = Math.round(ax + (bx - ax) * t);
      const y = Math.round(ay + (by - ay) * t);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      counted++;
      if (data[y * width + x]) hits++;
    }
    sides.push(counted ? hits / counted : 0);
  }
  return { sides, mean: sides.reduce((a, b) => a + b, 0) / 4 };
}

/** Support fraction for one segment, sampled like edgeSupport does. */
function segmentSupport(data, width, height, [ax, ay], [bx, by]) {
  const samples = 40;
  let hits = 0;
  let counted = 0;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    counted++;
    if (data[y * width + x]) hits++;
  }
  return counted ? hits / counted : 0;
}

/**
 * Slides each side of the quad outward along its normal for as long as edge
 * support holds up, then rebuilds the quad from the shifted lines. Detected
 * lines tend to sit a few pixels inside the physical card edge (blur widens
 * the border transition and the line lands mid-transition), which shaves the
 * card's outer border off the crop — and the border is exactly what condition
 * and centering are judged on. Bails out of a side after a few unsupported
 * steps so a neighbouring edge (another card in the stack, a table line)
 * can't drag the side away.
 */
function expandToOuterEdge(support, quad, width, height) {
  const ordered = orderCorners(quad);
  const data = support.data;
  const cx = ordered.reduce((s, p) => s + p[0], 0) / 4;
  const cy = ordered.reduce((s, p) => s + p[1], 0) / 4;
  const maxShift = Math.round(0.025 * Math.min(width, height));

  const shiftedLines = ordered.map((a, i) => {
    const b = ordered[(i + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // Unit normal pointing away from the centroid.
    let nx = (b[1] - a[1]) / len;
    let ny = (a[0] - b[0]) / len;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }

    const base = segmentSupport(data, width, height, a, b);
    const keep = Math.max(0.5, base * 0.8);
    let best = 0;
    for (let s = 1; s <= maxShift; s++) {
      const sa = [a[0] + nx * s, a[1] + ny * s];
      const sb = [b[0] + nx * s, b[1] + ny * s];
      if (segmentSupport(data, width, height, sa, sb) >= keep) best = s;
      else if (s - best > 3) break;
    }
    // Small fixed margin past the last supported position: cards bow slightly
    // when held, and losing a strip of border to the warp costs more (the
    // border carries centering/condition) than including a sliver of
    // background does.
    const shift = best + Math.max(2, 0.006 * Math.min(width, height));
    return [a[0] + nx * shift, a[1] + ny * shift, b[0] + nx * shift, b[1] + ny * shift];
  });

  const corners = shiftedLines.map((line, i) =>
    lineIntersection(shiftedLines[(i + 3) % 4], line));
  if (corners.some(c => !c)) return quad;
  return corners;
}

/**
 * Finds the card quad in the downscaled image: generate candidates from every
 * strategy, score them all against the edge map, return the winner (or null).
 */
function findCardQuad(cv, canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const frameArea = width * height;

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const eq = new cv.Mat();
  const hsv = new cv.Mat();
  const sat = new cv.Mat();
  const edgesGray = new cv.Mat();
  const edgesSat = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const support = new cv.Mat();
  const otsuGray = new cv.Mat();
  const otsuSat = new cv.Mat();
  const channels = new cv.MatVector();
  let clahe = null;
  let kernel5 = null;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // CLAHE lifts local contrast so dim indoor photos still yield edges. Some
    // builds ship without it — plain gray is an acceptable fallback.
    try {
      clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(gray, eq);
    } catch {
      gray.copyTo(eq);
    }
    cv.GaussianBlur(eq, eq, new cv.Size(5, 5), 0);

    // Saturation channel: a colourful card pops out of a muted background even
    // when their brightness is similar.
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
    cv.split(hsv, channels);
    const satChannel = channels.get(1);
    satChannel.copyTo(sat);
    satChannel.delete();
    cv.GaussianBlur(sat, sat, new cv.Size(5, 5), 0);

    // Median-adaptive Canny on both channels, OR'd together.
    const med = matMedian(eq);
    const lo = Math.max(10, 0.66 * med);
    const hi = Math.max(40, 1.33 * med);
    cv.Canny(eq, edgesGray, lo, hi);
    cv.Canny(sat, edgesSat, 40, 120);
    cv.bitwise_or(edgesGray, edgesSat, edges);

    kernel5 = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel5);
    // Support map is deliberately generous (dilated) — it grades candidate
    // perimeters, so a corner landing a pixel or two off still counts.
    cv.dilate(edges, support, kernel5);

    // Otsu binarisations give contour candidates that don't depend on an
    // unbroken edge outline at all.
    cv.threshold(eq, otsuGray, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.threshold(sat, otsuSat, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    const candidates = [
      ...contourQuads(cv, closed, frameArea),
      ...contourQuads(cv, otsuGray, frameArea),
      ...contourQuads(cv, otsuSat, frameArea),
      ...houghQuads(cv, closed, width, height),
    ];

    const scored = [];
    for (const quad of candidates) {
      if (!isPlausibleCard(quad, width, height, { minAreaFrac: MIN_AREA_FRAC })) continue;
      if (!isConvexQuad(quad)) continue;

      const { sides, mean } = edgeSupport(support, quad, width, height);
      // A real border has support on every side; one fully unsupported side
      // means a phantom line (usually the frame edge or an arm).
      if (mean < 0.45 || Math.min(...sides) < 0.18) continue;

      const { width: qw, height: qh } = quadSides(quad);
      const ratio = Math.min(qw, qh) / Math.max(qw, qh);
      const ratioScore = Math.max(0, 1 - Math.abs(ratio - 5 / 7) / 0.35);
      // Cards are rectangles: corners should sit near 90° even under the mild
      // perspective of a hand-held phone photo. This is what stops a crisp
      // *internal* line (text divider, artwork frame edge) from beating the
      // true border — a quad mixing an internal line with three real borders
      // comes out visibly skewed.
      const angleScore = Math.max(0, 1 - maxAngleError(quad) / 22);
      const areaBoost = Math.min(1, quadArea(quad) / (0.3 * frameArea)) ** 0.3;

      const score = mean * (0.6 + 0.4 * ratioScore) * (0.55 + 0.45 * angleScore) * areaBoost;
      scored.push({ quad, score, area: quadArea(quad) });
    }
    if (!scored.length) return null;

    // Among near-tied candidates, take the outermost: the card's real border
    // strictly contains every internal near-miss, and when both explain the
    // edges about equally well the outer one is the card.
    const bestScore = Math.max(...scored.map(s => s.score));
    const near = scored.filter(s => s.score >= 0.92 * bestScore);
    near.sort((a, b) => b.area - a.area);
    return expandToOuterEdge(support, near[0].quad, width, height);
  } finally {
    src.delete();
    gray.delete();
    eq.delete();
    hsv.delete();
    sat.delete();
    edgesGray.delete();
    edgesSat.delete();
    edges.delete();
    closed.delete();
    support.delete();
    otsuGray.delete();
    otsuSat.delete();
    channels.delete();
    if (clahe) clahe.delete();
    if (kernel5) kernel5.delete();
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
 * @returns {Promise<{ found: false } | { found: true, blob: Blob, url: string, width: number, height: number, corners: number[][] }>}
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

    // Scale corners back up to full-resolution coordinates, clamped into frame
    // (Hough intersections can land a whisker outside it).
    const quadFull = quadSmall.map(([x, y]) => [
      Math.min(naturalW, Math.max(0, x / scale)),
      Math.min(naturalH, Math.max(0, y / scale)),
    ]);
    if (!isPlausibleCard(quadFull, naturalW, naturalH, { minAreaFrac: MIN_AREA_FRAC })) {
      return { found: false };
    }

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
