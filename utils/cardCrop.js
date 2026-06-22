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
