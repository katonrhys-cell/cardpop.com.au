/**
 * Card auto-crop geometry helpers.
 *
 * These functions are pure (they operate on plain [x, y] point arrays) so the
 * corner-ordering, sizing and plausibility logic can be unit-tested without a
 * canvas or OpenCV. The heavy detection/warp lives in detectCard.js.
 *
 * A standard trading card is 2.5" × 3.5" — a 5:7 ratio. The fitted output uses
 * the Photography Standard's main-image dimensions (1200 × 1680, portrait).
 */

export const CARD_RATIO = 5 / 7; // width / height, portrait
export const OUTPUT = { width: 1200, height: 1680 };

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Orders four points as [top-left, top-right, bottom-right, bottom-left].
 * Uses the classic sum/diff trick: top-left has the smallest x+y, bottom-right
 * the largest; top-right has the largest x−y, bottom-left the smallest.
 */
export function orderCorners(points) {
  if (!Array.isArray(points) || points.length !== 4) {
    throw new Error('orderCorners expects exactly 4 points');
  }
  const sum = p => p[0] + p[1];
  const diff = p => p[0] - p[1];
  const tl = points.reduce((a, b) => (sum(b) < sum(a) ? b : a));
  const br = points.reduce((a, b) => (sum(b) > sum(a) ? b : a));
  const tr = points.reduce((a, b) => (diff(b) > diff(a) ? b : a));
  const bl = points.reduce((a, b) => (diff(b) < diff(a) ? b : a));
  return [tl, tr, br, bl];
}

/** Shoelace area of a polygon given as [x, y] points. */
export function quadArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/**
 * Mean side lengths of the (ordered) quad, returned as { width, height }.
 * Averages opposite sides so perspective skew doesn't bias the estimate.
 */
export function quadSides(quad) {
  const [tl, tr, br, bl] = orderCorners(quad);
  const width = (dist(tl, tr) + dist(bl, br)) / 2;
  const height = (dist(tl, bl) + dist(tr, br)) / 2;
  return { width, height };
}

/**
 * Decides whether a detected quad is plausibly a card: it must cover a
 * meaningful fraction of the frame and have a side ratio in the range a
 * 5:7 card can produce under perspective.
 */
export function isPlausibleCard(quad, imgW, imgH, { minAreaFrac = 0.12 } = {}) {
  if (!Array.isArray(quad) || quad.length !== 4) return false;
  if (!(imgW > 0) || !(imgH > 0)) return false;

  if (quadArea(quad) < minAreaFrac * imgW * imgH) return false;

  const { width, height } = quadSides(quad);
  if (!(width > 0) || !(height > 0)) return false;

  // 5:7 ≈ 0.714. Allow 0.5–0.98 so a tilted card (foreshortened) still passes
  // while clearly non-card rectangles (very square or very long) are rejected.
  const ratio = Math.min(width, height) / Math.max(width, height);
  return ratio >= 0.5 && ratio <= 0.98;
}

/**
 * Output dimensions for the warped card, preserving the detected orientation
 * (portrait vs landscape) at the standard 5:7 size.
 */
export function outputDimsFor(quad) {
  const { width, height } = quadSides(quad);
  return width > height
    ? { width: OUTPUT.height, height: OUTPUT.width }
    : { width: OUTPUT.width, height: OUTPUT.height };
}

/**
 * A sensible starting quad for the manual adjuster when there's no detected
 * card to seed from: a rectangle inset `inset` (fraction) from each edge,
 * ordered [tl, tr, br, bl] in image coordinates.
 */
export function defaultCorners(width, height, inset = 0.08) {
  const x0 = width * inset;
  const x1 = width * (1 - inset);
  const y0 = height * inset;
  const y1 = height * (1 - inset);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/**
 * Interior angle (degrees) at each corner of the quad, returned in
 * [tl, tr, br, bl] order. A perfect rectangle has four 90° corners, so these
 * power the live "is this a clean rectangle?" feedback in the manual adjuster.
 */
export function cornerAngles(quad) {
  const ordered = orderCorners(quad);
  return ordered.map((cur, i) => {
    const prev = ordered[(i + 3) % 4];
    const next = ordered[(i + 1) % 4];
    const a = [prev[0] - cur[0], prev[1] - cur[1]];
    const b = [next[0] - cur[0], next[1] - cur[1]];
    const magA = Math.hypot(a[0], a[1]);
    const magB = Math.hypot(b[0], b[1]);
    if (magA === 0 || magB === 0) return 0;
    const cos = clamp((a[0] * b[0] + a[1] * b[1]) / (magA * magB), -1, 1);
    return (Math.acos(cos) * 180) / Math.PI;
  });
}

/**
 * Largest deviation (degrees) of any corner from a right angle. 0 ⇒ a perfect
 * rectangle; bigger numbers ⇒ a more skewed/tilted quad.
 */
export function maxAngleError(quad) {
  return Math.max(...cornerAngles(quad).map(a => Math.abs(a - 90)));
}

/**
 * Short-side / long-side ratio of the quad, plus whether it matches the
 * standard 5:7 card ratio within `tol`.
 */
export function aspectStatus(quad, tol = 0.05) {
  const { width, height } = quadSides(quad);
  if (!(width > 0) || !(height > 0)) return { ratio: 0, matchesCard: false };
  const ratio = Math.min(width, height) / Math.max(width, height);
  return { ratio, matchesCard: Math.abs(ratio - CARD_RATIO) <= tol };
}

/**
 * One-stop status for the crop guide overlay: how square the corners are, how
 * close the shape is to a 5:7 card, and whether both are good enough that the
 * user can be confident they're cropping a clean card rectangle.
 */
export function cropGuideStatus(quad, { angleTolDeg = 5, ratioTol = 0.05 } = {}) {
  const angleError = maxAngleError(quad);
  const { ratio, matchesCard } = aspectStatus(quad, ratioTol);
  const isRectangle = angleError <= angleTolDeg;
  return { angleError, isRectangle, ratio, matchesCard, isPerfect: isRectangle && matchesCard };
}

/**
 * Snaps a (possibly skewed) quad to an upright rectangle at the 5:7 card ratio,
 * centred on the quad's centroid and clamped to fit a `frameW`×`frameH` image.
 * Powers the adjuster's one-tap "Snap to rectangle" action so a user can always
 * land on a perfect card rectangle. Returns [tl, tr, br, bl].
 */
export function rectifyToCard(quad, frameW = 0, frameH = 0) {
  const ordered = orderCorners(quad);
  const cx = ordered.reduce((s, p) => s + p[0], 0) / 4;
  const cy = ordered.reduce((s, p) => s + p[1], 0) / 4;
  const { width, height } = quadSides(quad);
  const portrait = height >= width;

  // Force the card ratio, preserving the longer side of the current selection.
  let w = portrait ? height * CARD_RATIO : width;
  let h = portrait ? height : width * CARD_RATIO;

  // Shrink (keeping the ratio) so the centred rectangle stays inside the frame.
  if (frameW > 0 && frameH > 0) {
    const maxW = Math.min(cx, frameW - cx) * 2;
    const maxH = Math.min(cy, frameH - cy) * 2;
    if (w > maxW && maxW > 0) { const k = maxW / w; w *= k; h *= k; }
    if (h > maxH && maxH > 0) { const k = maxH / h; w *= k; h *= k; }
  }

  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}
