/**
 * Ranking for detections merged from CardSight's per-segment fan-out.
 *
 * Extracted from the identify route so the scoring harness
 * (`scripts/score-card-identification.mjs`) exercises the real ordering rather
 * than a re-implementation of it.
 */

import { isExactMatch, isSetLevelMatch } from 'cardsightai';
import { confidenceRank } from '../../utils/cardsightConfidence.js';

/**
 * Match specificity: an exact card hit (the detection carries a card id) is
 * always a better answer than a set-level guess, which in turn beats a
 * detection that resolved to neither.
 */
export function matchSpecificity(detection) {
  if (isExactMatch(detection)) return 2;
  if (isSetLevelMatch(detection)) return 1;
  return 0;
}

/**
 * Orders detections merged from the per-segment fan-out.
 *
 * Each segment is queried independently and answers with its best guess
 * *within that segment*, so a Pokemon card scanned without a collection still
 * yields a plausible-looking basketball detection. Ordering therefore has to be
 * explicit. The SDK's `getHighestConfidenceDetection` sorts on the confidence
 * enum alone, and because that enum only has three levels most cross-segment
 * scans tie — leaving the winner to be decided by the order the segments happen
 * to sit in the fan-out array (basketball first, pokemon fifth). That is what
 * made scans return confident-looking cards from the wrong sport.
 *
 * @param {Array<{detection: object, segment: string}>} candidates
 * @returns {Array<{detection: object, segment: string}>} new array, best first
 */
export function rankCandidates(candidates) {
  return [...candidates].sort((a, b) =>
    (matchSpecificity(b.detection) - matchSpecificity(a.detection)) ||
    (confidenceRank(b.detection.confidence) - confidenceRank(a.detection.confidence))
  );
}

/**
 * True when a runner-up from a *different* segment is just as good as the
 * winner — i.e. the fan-out produced a genuine cross-sport collision and the
 * pick is effectively arbitrary. The UI uses this to ask for confirmation
 * instead of presenting the guess as a verified catalog match.
 */
export function hasAmbiguousWinner(ranked) {
  const [best, ...rest] = ranked;
  if (!best) return false;
  return rest.some(c =>
    c.segment !== best.segment &&
    matchSpecificity(c.detection) === matchSpecificity(best.detection) &&
    confidenceRank(c.detection.confidence) === confidenceRank(best.detection.confidence)
  );
}
