/**
 * Grounds a free-text OCR read against the public card catalogue.
 *
 * This is the step that decides whether a catalogue candidate is trustworthy
 * enough to overwrite what was read off the card, and it is the single biggest
 * lever on the accuracy of the filled-in fields. It lives here rather than
 * inside `useCardOCR` so it can run outside a browser — the scoring harness
 * (`scripts/score-card-identification.mjs`) exercises exactly this code, not a
 * re-implementation of it.
 *
 * I/O is injected: callers pass a `searchCatalogue(params)` function, so the
 * hook can use the browser API client and the harness can use plain fetch.
 */

import { leadingCardNumber, cardNumbersMatch, cardNumbersConflict } from './cardNumber.js';
import { normalizeName, setsMatch } from './cardMatch.js';
import { mapRarity } from './ocrResult.js';

/** 'exact' | 'partial' | 'none' — how well a candidate's name matches the read. */
export function nameSignal(ocr, candidate) {
  const target = normalizeName(ocr.name);
  const name = normalizeName(candidate.name);
  if (!target || !name) return 'none';
  if (name === target) return 'exact';
  if (name.includes(target) || target.includes(name)) return 'partial';
  return 'none';
}

/**
 * How well a candidate's set agrees with the read: 'set' when it matches the
 * one OCR settled on, 'likely set' when it matches one the model shortlisted
 * instead, null otherwise.
 *
 * The prompt asks the model to shortlist up to three sets rather than name one
 * with false confidence. A card whose set the model wouldn't commit to is
 * exactly the case where corroboration is scarcest, and the catalogue
 * independently landing on one of its guesses is real agreement — but it ranks
 * below an outright set match and is labelled separately so the UI never
 * overstates it.
 */
export function setSignal(ocr, candidate) {
  if (setsMatch(ocr.cardSetName, candidate.setName)) return 'set';
  const shortlist = Array.isArray(ocr.candidateSets) ? ocr.candidateSets : [];
  if (shortlist.some(s => setsMatch(s, candidate.setName))) return 'likely set';
  return null;
}

/**
 * Compares one catalogue candidate against what OCR read off the card, and
 * reports which fields independently agree.
 *
 * `numberConflicts` is tracked separately from "doesn't match": a candidate
 * with no number on record is merely unknown, but one whose number positively
 * disagrees is a different printing and must never be merged in.
 */
export function evaluateCandidate(ocr, candidate) {
  const name = nameSignal(ocr, candidate);
  const numberMatches = cardNumbersMatch(ocr.cardNumber, candidate.cardNumber);
  const numberConflicts = cardNumbersConflict(ocr.cardNumber, candidate.cardNumber);
  const setMatch = setSignal(ocr, candidate);
  const yearMatches = Boolean(
    ocr.releaseYear && candidate.year && String(candidate.year) === String(ocr.releaseYear)
  );

  const verified = [];
  if (name !== 'none') verified.push('name');
  if (numberMatches) verified.push('number');
  if (setMatch) verified.push(setMatch);
  if (yearMatches) verified.push('year');

  return { name, numberMatches, numberConflicts, setMatch, yearMatches, verified };
}

/**
 * Whether a candidate is trustworthy enough to overwrite what OCR read.
 *
 * The bar is deliberately high. A name match alone used to be enough, which
 * meant that for any card with more than one printing — Pikachu, Charizard,
 * Black Lotus — an arbitrary candidate from the name search replaced the set,
 * number and year that had been read correctly off the card. Grounding made the
 * answer worse than no grounding at all.
 *
 * So: the printed collector number settles it when both sides have one, and
 * without it we need two independent agreements before overwriting anything.
 */
export function isAcceptableMatch(evaluation) {
  if (evaluation.numberConflicts) return false;  // different printing
  if (evaluation.name === 'none') return false;  // never match on non-name evidence alone
  if (evaluation.numberMatches) return true;     // name + printed number agree
  return Boolean(evaluation.setMatch) || evaluation.yearMatches;
}

/** Ranks acceptable candidates: corroborated fields first, then name quality. */
export function matchStrength(evaluation) {
  return (evaluation.numberMatches ? 4 : 0)
    + (evaluation.setMatch === 'set' ? 2 : evaluation.setMatch === 'likely set' ? 1 : 0)
    + (evaluation.yearMatches ? 1 : 0)
    + (evaluation.name === 'exact' ? 2 : evaluation.name === 'partial' ? 1 : 0);
}

/**
 * The catalogue query for an OCR read. Exported so the harness and the hook
 * can't drift on what gets sent.
 *
 * The collector number goes to the API so it can filter upstream rather than us
 * picking through an arbitrary page of same-name printings. Without one, ask for
 * more rows — that's the harder case, not the easier.
 */
export function buildCatalogueQuery(result, collection) {
  const cardNumber = leadingCardNumber(result.cardNumber);
  const params = { q: result.name.trim(), take: cardNumber ? '8' : '12' };
  if (cardNumber) params.number = cardNumber;
  if (collection) params.collection = collection;
  return params;
}

/**
 * Resolves an OCR read against the catalogue and, when a candidate corroborates
 * it, overlays the fields the catalogue is authoritative for.
 *
 * Never throws — a catalogue outage returns the raw OCR read unchanged, so it
 * can never break a scan.
 *
 * @param {object} result - mapped OCR result
 * @param {(params: object) => Promise<{results?: object[]}>} searchCatalogue
 * @param {string} [collection] - catalogue collection param ('pokemon' | 'magic' | 'yu-gi-oh')
 * @returns {Promise<object>} the result, possibly with catalogueMatch/candidates
 */
export async function groundAgainstCatalogue(result, searchCatalogue, collection = '') {
  const name = result.name?.trim();
  if (!name) return result;

  try {
    const data = await searchCatalogue(buildCatalogueQuery(result, collection));
    const candidates = data?.results ?? [];
    if (!candidates.length) return result;

    const ranked = candidates
      .map(candidate => ({ candidate, evaluation: evaluateCandidate(result, candidate) }))
      .sort((a, b) => matchStrength(b.evaluation) - matchStrength(a.evaluation));

    const top3 = ranked.slice(0, 3).map(r => r.candidate);
    const best = ranked.find(r => isAcceptableMatch(r.evaluation));

    // Nothing corroborated well enough — surface the candidates for the seller
    // to look at, but leave every field exactly as it was read off the card.
    if (!best) return { ...result, catalogueCandidates: top3 };

    const m = best.candidate;
    return {
      ...result,
      // The catalogue is authoritative for the set, year and rarity — those are
      // often absent or ambiguous on the card itself.
      cardSetName: m.setName || result.cardSetName,
      releaseYear: m.year ? String(m.year) : result.releaseYear,
      rarity: result.rarity || mapRarity(m.rarity),
      series: m.setName || result.series,
      // The collector number is printed on the card and was read directly, so
      // it stands. The catalogue only supplies one when OCR couldn't read it.
      cardNumber: result.cardNumber || m.cardNumber || '',
      // Sports-card identity only the internal CardPop catalogue carries (the
      // public adapters have no concept of an insert). Fills a gap, never
      // overwrites a read.
      insertName: result.insertName || m.insertName || '',
      catalogueMatch: {
        id: m.id,
        name: m.name,
        setName: m.setName ?? null,
        cardNumber: m.cardNumber ?? null,
        year: m.year ?? null,
        rarity: m.rarity ?? null,
        imageUrl: m.imageUrl ?? null,
        source: m.source ?? null,
        insertName: m.insertName ?? null,
        parallel: m.parallel ?? null,
        // Exactly which fields agreed, so the UI can say what was checked
        // rather than claiming a blanket verification.
        verified: best.evaluation.verified,
      },
      catalogueCandidates: top3,
    };
  } catch {
    // Catalogue lookup is best-effort — fall back to the raw OCR result.
    return result;
  }
}
