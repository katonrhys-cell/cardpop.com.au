/**
 * CardSight reports detection confidence as a three-level enum
 * ("High" | "Medium" | "Low") — NOT a 0..1 number. Every percentage render and
 * numeric threshold must go through this module: multiplying the raw enum by
 * 100 produces `NaN`, and comparing it against a number (`'High' >= 0.95`) is
 * always false, which silently degrades every match to the lowest band.
 *
 * Tier → percentage bands are the ones CardSight documents on the detection
 * field: High 90-100%, Medium 75-89%, Low 50-74%. We surface the midpoint of
 * each band so the UI has a single honest number to draw.
 *
 * Shared by the Express route (src/routes/cardsight.js) and the listing form.
 */

const TIER_RANK = { high: 3, medium: 2, low: 1 };
const TIER_SCORE = { high: 0.95, medium: 0.82, low: 0.62 };

function tierOf(confidence) {
  return String(confidence ?? '').trim().toLowerCase();
}

/**
 * Ordinal rank used for sorting detections. High = 3 … Low = 1, unknown = 0.
 *
 * @param {string|number|null|undefined} confidence
 * @returns {number}
 */
export function confidenceRank(confidence) {
  return TIER_RANK[tierOf(confidence)] ?? 0;
}

/**
 * A 0..1 score safe to render or threshold against. Accepts the CardSight
 * enum, an already-numeric score (0..1 or 0..100), and returns null when the
 * value is missing or unrecognised — callers should hide the meter rather than
 * draw a misleading number.
 *
 * @param {string|number|null|undefined} confidence
 * @returns {number|null}
 */
export function confidenceScore(confidence) {
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    const normalised = confidence > 1 ? confidence / 100 : confidence;
    return Math.min(Math.max(normalised, 0), 1);
  }
  return TIER_SCORE[tierOf(confidence)] ?? null;
}

/**
 * Display label for a confidence value: 'High' | 'Medium' | 'Low' | null.
 *
 * @param {string|number|null|undefined} confidence
 * @returns {string|null}
 */
export function confidenceLabel(confidence) {
  const tier = tierOf(confidence);
  if (TIER_SCORE[tier] !== undefined) return tier[0].toUpperCase() + tier.slice(1);

  const score = confidenceScore(confidence);
  if (score === null) return null;
  if (score >= 0.9) return 'High';
  if (score >= 0.75) return 'Medium';
  return 'Low';
}

/**
 * True when a match is weak enough that auto-filled fields should be presented
 * as a suggestion to check rather than a verified catalog hit.
 *
 * @param {string|number|null|undefined} confidence
 * @returns {boolean}
 */
export function isLowConfidence(confidence) {
  const score = confidenceScore(confidence);
  return score === null || score < 0.75;
}
