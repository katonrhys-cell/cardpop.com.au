/**
 * Decides whether a CardSight identification is trustworthy enough to
 * overwrite the fields OCR read off the card.
 *
 * CardSight only ever sees the front photo, and it matches on the image alone.
 * For template-styled insert sets — where every card in the set shares the same
 * artwork layout and only the player differs — it can return the wrong card in
 * the right set as a clean "exact / High" hit. OCR, meanwhile, has read the
 * name and collector number printed on the card (often from the back photo
 * CardSight never receives). When the two disagree, the direct read of the
 * card wins and the catalog hit is demoted to a suggestion.
 *
 * This mirrors the catalogue-grounding rule one stage earlier
 * (`utils/catalogueGrounding.js`): a candidate whose collector number
 * positively disagrees with the printed one is a different card, and a wrong
 * field is much worse than a missing one.
 *
 * Shared by the listing form (`pages/AddEditCardPage.jsx`) and the scoring
 * harness (`scripts/score-card-identification.mjs`) so the overlay decision
 * stays measurable — keep changes to the bar here, not in the callers.
 */

import { normalizeName, namesMatch } from './cardMatch.js';
import { cardNumbersConflict } from './cardNumber.js';
import { isLowConfidence } from './cardsightConfidence.js';

/**
 * Whether two card names positively disagree. Deliberately looser than
 * `!namesMatch`: containment ("Pikachu" / "Pikachu VMAX") is agreement, and a
 * missing name on either side is unknown, not a conflict — the same posture
 * `nameSignal` takes in the grounding step.
 *
 * @returns {boolean}
 */
export function namesConflict(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (namesMatch(a, b)) return false;
  return !na.includes(nb) && !nb.includes(na);
}

/**
 * Which identity fields a CardSight card record positively disagrees on with
 * what OCR read off the card. Only positive disagreement counts — a field OCR
 * couldn't read can't conflict with anything.
 *
 * @param {object|null|undefined} ocr - mapped OCR result ({ name, cardNumber })
 * @param {object|null|undefined} card - CardSight card record. The route maps
 *   the SDK's `number` to `cardNumber`; the scoring harness keeps the raw
 *   field, so both spellings are read.
 * @returns {('name'|'number')[]}
 */
export function cardSightDisagreements(ocr, card) {
  if (!ocr || !card) return [];
  const disagreements = [];
  if (namesConflict(ocr.name, card.name)) disagreements.push('name');
  if (cardNumbersConflict(ocr.cardNumber, card.cardNumber ?? card.number)) {
    disagreements.push('number');
  }
  return disagreements;
}

/**
 * The overlay decision: CardSight may overwrite the OCR-derived fields only on
 * a clean exact hit — not ambiguous, not low confidence — that does not
 * disagree with what was actually read off the card.
 *
 * @param {object|null|undefined} csResult - identify response ({ exactMatch,
 *   ambiguous, confidence, confidenceScore, card })
 * @param {object|null|undefined} ocr - mapped OCR result, when one exists
 * @returns {{ trustworthy: boolean, disagreements: ('name'|'number')[] }}
 */
export function assessCardSightMatch(csResult, ocr) {
  const cleanExact = Boolean(
    csResult?.exactMatch
    && !csResult.ambiguous
    && !isLowConfidence(csResult.confidenceScore ?? csResult.confidence)
  );
  if (!cleanExact) return { trustworthy: false, disagreements: [] };

  const disagreements = cardSightDisagreements(ocr, csResult.card);
  return { trustworthy: disagreements.length === 0, disagreements };
}
