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
 * Whether the quad, traversed in the order given, is convex — every cross
 * product of consecutive edges has the same sign. Points must be sequentially
 * wound (as contours, hulls and intersection chains produce them); do NOT
 * pre-apply orderCorners, which can collapse a concave quad into a degenerate
 * shape that reads as convex. Filters out bow-ties and dented quads.
 */
export function isConvexQuad(quad) {
  if (!Array.isArray(quad) || quad.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const [cx, cy] = quad[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/**
 * Output dimensions for the warped crop, preserving the detected orientation.
 *
 * A quad within ~6% of the 5:7 card ratio snaps to the standard card output —
 * measured sides carry perspective bias, and for a raw card the true answer is
 * known. Anything else (a graded slab is ~0.61, a PSA case with its tab even
 * squarer) keeps its own measured aspect, scaled to the standard long edge:
 * force-warping a slab to 5:7 visibly squashes it and the label.
 */
export function outputDimsFor(quad) {
  const { width, height } = quadSides(quad);
  const long = Math.max(width, height) || 1;
  const short = Math.min(width, height) || 1;
  const ratio = short / long;

  const shortOut = Math.abs(ratio - CARD_RATIO) <= 0.06 * CARD_RATIO
    ? OUTPUT.width
    : Math.round(OUTPUT.height * ratio);

  return width > height
    ? { width: OUTPUT.height, height: shortOut }
    : { width: shortOut, height: OUTPUT.height };
}

/**
 * Whether `inner` sits entirely inside the convex quad `outer`, with a
 * tolerance (fraction of the outer quad's mean side length) so a corner
 * grazing the boundary still counts. Used to recognise a card nested inside
 * its grading slab.
 */
export function quadContains(outer, inner, tolerance = 0.03) {
  if (!Array.isArray(outer) || outer.length !== 4) return false;
  if (!Array.isArray(inner) || inner.length !== 4) return false;
  const o = orderCorners(outer);
  const { width, height } = quadSides(o);
  const tol = tolerance * ((width + height) / 2);

  // Winding of the ordered quad decides which side of each edge is "inside".
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = o[i];
    const [x2, y2] = o[(i + 1) % 4];
    area += x1 * y2 - x2 * y1;
  }
  const sign = Math.sign(area) || 1;

  return inner.every(([px, py]) => {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = o[i];
      const [x2, y2] = o[(i + 1) % 4];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      // Signed distance of the point from this edge, positive toward inside.
      const d = (sign * ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1))) / len;
      if (d < -tol) return false;
    }
    return true;
  });
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
 * Interior angle (degrees) at each corner of the (ordered) quad, returned in
 * [tl, tr, br, bl] order. A perfect rectangle has four 90° corners — the manual
 * crop editor uses these to tell the user whether their selection is square.
 */
export function cornerAngles(quad) {
  const ordered = orderCorners(quad);
  return ordered.map((cur, i) => {
    const prev = ordered[(i + 3) % 4];
    const next = ordered[(i + 1) % 4];
    const v1 = [prev[0] - cur[0], prev[1] - cur[1]];
    const v2 = [next[0] - cur[0], next[1] - cur[1]];
    const m1 = Math.hypot(v1[0], v1[1]);
    const m2 = Math.hypot(v2[0], v2[1]);
    if (!m1 || !m2) return 0;
    const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (m1 * m2)));
    return (Math.acos(cos) * 180) / Math.PI;
  });
}

/** Largest deviation (degrees) of any corner from a perfect 90° right angle. */
export function maxAngleError(quad) {
  return Math.max(...cornerAngles(quad).map(a => Math.abs(a - 90)));
}

/**
 * Whether the quad is close enough to a true rectangle (all corners within
 * `toleranceDeg` of 90°) to crop cleanly without perspective distortion.
 */
export function isRectangularQuad(quad, toleranceDeg = 4) {
  return maxAngleError(quad) <= toleranceDeg;
}

/**
 * Snaps an arbitrary quad to an upright rectangle of the same centre and
 * average side lengths, ordered [tl, tr, br, bl]. Lets the user fix a skewed
 * selection in one tap so the crop comes out as a perfect rectangle.
 */
export function rectifyQuad(quad) {
  const ordered = orderCorners(quad);
  const cx = ordered.reduce((s, p) => s + p[0], 0) / 4;
  const cy = ordered.reduce((s, p) => s + p[1], 0) / 4;
  const { width, height } = quadSides(ordered);
  const hw = width / 2;
  const hh = height / 2;
  return [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ];
}
