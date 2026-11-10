/**
 * Turns the located parts of a grade estimate (cardLocation, centeringMeasured,
 * findings — see GradeEstimatorPrompt) into shapes the results page can draw
 * over the member's own photo.
 *
 * Model JSON is not trusted: every coordinate is coerced to a number, clamped to
 * the photo (0–100 %), and anything unusable is dropped rather than drawn in the
 * wrong place. An older reply with none of these fields still renders — the page
 * just shows the photo without markers.
 */

export const GRADE_FACTORS = ['centering', 'corners', 'edges', 'surface'];
export const GRADE_SIDES = ['front', 'back'];
const SEVERITIES = ['minor', 'moderate', 'major'];
const MAX_FINDINGS = 12;
const MIN_BOX = 3; // % — a smaller box is too fiddly to see or tap on a phone

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * A box in percent of the photo, clamped inside it. Returns null when the
 * coordinates are missing or the box has no area. Values that look like 0–1
 * fractions (every one ≤ 1) are scaled up — models slip into that form.
 */
export function cleanBox(raw, { minSize = 0 } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  let x = num(raw.x);
  let y = num(raw.y);
  let w = num(raw.w ?? raw.width);
  let h = num(raw.h ?? raw.height);
  if (x === null || y === null) return null;
  if (w === null) w = 0;
  if (h === null) h = 0;
  if ([x, y, w, h].every((v) => v >= 0 && v <= 1) && (w > 0 || h > 0 || x > 0 || y > 0)) {
    x *= 100; y *= 100; w *= 100; h *= 100;
  }
  if (x > 100 || y > 100 || x + w < 0 || y + h < 0) return null;
  w = Math.max(w, minSize);
  h = Math.max(h, minSize);
  x = clamp(x, 0, 100 - Math.min(w, 100));
  y = clamp(y, 0, 100 - Math.min(h, 100));
  w = Math.min(w, 100 - x);
  h = Math.min(h, 100 - y);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/** "55/45" → [55, 45]; null when it isn't a ratio that adds up to ~100. */
export function parseRatio(value) {
  const m = String(value ?? '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!(a >= 0 && b >= 0) || Math.abs(a + b - 100) > 2) return null;
  return [a, b];
}

function cleanCentering(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const leftRight = parseRatio(raw.leftRight);
  const topBottom = parseRatio(raw.topBottom);
  if (!leftRight && !topBottom) return null;
  return {
    leftRight: leftRight ? `${leftRight[0]}/${leftRight[1]}` : null,
    topBottom: topBottom ? `${topBottom[0]}/${topBottom[1]}` : null,
  };
}

function cleanFinding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const factor = String(raw.factor ?? '').toLowerCase();
  if (!GRADE_FACTORS.includes(factor)) return null;
  const side = String(raw.side ?? 'front').toLowerCase();
  if (!GRADE_SIDES.includes(side)) return null;
  const box = cleanBox(raw, { minSize: MIN_BOX });
  if (!box) return null;
  const severity = SEVERITIES.includes(String(raw.severity).toLowerCase())
    ? String(raw.severity).toLowerCase()
    : 'minor';
  const description = String(raw.description ?? '').trim().slice(0, 160);
  return { factor, side, severity, description, ...box };
}

/**
 * @param {object} result  the parsed grade estimate
 * @param {{ hasBack?: boolean }} [opts]  whether a back photo was supplied
 * @returns {{
 *   cardLocation: { front: object|null, back: object|null },
 *   centering: { front: object|null, back: object|null },
 *   findings: Array<{ n: number, factor: string, side: string, severity: string, description: string, x: number, y: number, w: number, h: number }>,
 * }}
 */
export function normaliseGradeGeometry(result, { hasBack = true } = {}) {
  const loc = result?.cardLocation ?? {};
  const cen = result?.centeringMeasured ?? {};
  const sides = hasBack ? GRADE_SIDES : ['front'];

  const cardLocation = { front: null, back: null };
  const centering = { front: null, back: null };
  for (const side of sides) {
    cardLocation[side] = cleanBox(loc[side]);
    centering[side] = cleanCentering(cen[side]);
  }

  const findings = (Array.isArray(result?.findings) ? result.findings : [])
    .map(cleanFinding)
    .filter((f) => f && sides.includes(f.side))
    .slice(0, MAX_FINDINGS)
    // Number them in reading order — front first, then top-to-bottom, left-to-right —
    // so the markers on the photo count up the way the eye travels.
    .sort((a, b) => (a.side === b.side ? (a.y - b.y) || (a.x - b.x) : a.side === 'front' ? -1 : 1))
    .map((f, i) => ({ ...f, n: i + 1 }));

  return { cardLocation, centering, findings };
}

/**
 * The four corner regions of a card box (percent of the photo), for highlighting
 * "corners" when the model gave no located findings. `aspect` is the photo's
 * width ÷ height, so each region comes out square on screen.
 */
export function cornerRegions(box, aspect = 1, share = 0.2) {
  if (!box) return [];
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const cw = Math.min(box.w / 2, box.w * share);
  const ch = Math.min(box.h / 2, cw * a);
  return [
    { key: 'tl', x: box.x, y: box.y, w: cw, h: ch },
    { key: 'tr', x: box.x + box.w - cw, y: box.y, w: cw, h: ch },
    { key: 'bl', x: box.x, y: box.y + box.h - ch, w: cw, h: ch },
    { key: 'br', x: box.x + box.w - cw, y: box.y + box.h - ch, w: cw, h: ch },
  ];
}
