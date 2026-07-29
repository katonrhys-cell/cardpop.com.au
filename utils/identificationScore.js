/**
 * Scoring for card-identification results against known ground truth.
 *
 * The central idea is that **wrong is much worse than missing**. A field left
 * blank costs a seller ten seconds of typing. A field confidently filled with
 * the wrong set or the wrong collector number gets saved into a live listing
 * and misrepresents what is being sold. Aggregate "accuracy" hides that
 * difference, so every summary here keeps the two apart and reports a separate
 * `wrongRate` — the number to drive down first.
 *
 * Pure: no I/O, no fixtures, no network. The runner
 * (`scripts/score-card-identification.mjs`) supplies the actual results.
 */

import { namesMatch, setsMatch, normalizeName, normalizeSeason } from './cardMatch.js';
import { cardNumbersMatch } from './cardNumber.js';

/**
 * Fields scored, and how each is compared.
 *
 * `parallel` and `insert` are here because on a modern sports card they are
 * usually the biggest drivers of value — a Red Laser Holo and the base card of
 * the same player carry the same name, set, number and year, and are worth
 * wildly different amounts. A pipeline that gets everything else right and
 * misses them has still mispriced the listing.
 *
 * `setName` is the product a card came out of ("Topps Chrome"); `insert` is the
 * subset within it ("Ball of Duty"). Keeping them apart matters — folding the
 * insert into the set name loses the product, and vice versa.
 */
export const SCORED_FIELDS = ['name', 'setName', 'cardNumber', 'year', 'collection', 'insert', 'parallel'];

export const VERDICT = {
  CORRECT: 'correct',
  WRONG: 'wrong',
  MISSING: 'missing',
  UNSCORED: 'unscored',
};

const isBlank = v => v === null || v === undefined || String(v).trim() === '';

const COMPARATORS = {
  // Set names get the same noise-word and season-prefix tolerance the pipeline
  // uses ("Base" is "Base Set", "Topps Chrome" is "2025-26 Topps Chrome").
  setName: setsMatch,
  name: namesMatch,
  cardNumber: cardNumbersMatch,
  // Season formatting varies by source ("2025-2026", "2025/26"); the written
  // form is canonicalised, but "2025" stays distinct from "2025-26" — a listing
  // showing only the first year is missing the season.
  year: (a, b) => normalizeSeason(a) === normalizeSeason(b),
  collection: (a, b) => normalizeName(a) === normalizeName(b),
  // Deliberately strict to start with. Parallel names are close-packed within a
  // product ("Red Laser" and "Red Laser Holo" can be different parallels), so
  // any tolerance here should be added on the evidence of a real run rather
  // than guessed at now.
  parallel: (a, b) => normalizeName(a) === normalizeName(b),
  // The insert/subset a card belongs to ("Ball of Duty"), kept separate from
  // the product it came out of ("Topps Chrome").
  insert: (a, b) => normalizeName(a) === normalizeName(b),
};

/**
 * Scores one field.
 *
 * @param {string} field - one of SCORED_FIELDS
 * @param {*} expected - ground truth; blank means this fixture doesn't assert it
 * @param {*} actual - what the pipeline produced
 * @returns {'correct'|'wrong'|'missing'|'unscored'}
 */
export function scoreField(field, expected, actual) {
  if (isBlank(expected)) return VERDICT.UNSCORED;
  if (isBlank(actual)) return VERDICT.MISSING;
  const compare = COMPARATORS[field] ?? ((a, b) => normalizeName(a) === normalizeName(b));
  return compare(expected, actual) ? VERDICT.CORRECT : VERDICT.WRONG;
}

/**
 * Scores one card against its expected fields.
 *
 * @param {object} expected - ground truth, keyed by SCORED_FIELDS
 * @param {object} actual - pipeline output, same keys
 * @returns {{ fields: Record<string, {verdict: string, expected: *, actual: *}>, wrong: string[], missing: string[], correct: string[] }}
 */
export function scoreCase(expected = {}, actual = {}) {
  const fields = {};
  const wrong = [];
  const missing = [];
  const correct = [];

  for (const field of SCORED_FIELDS) {
    const verdict = scoreField(field, expected[field], actual[field]);
    fields[field] = { verdict, expected: expected[field] ?? null, actual: actual[field] ?? null };
    if (verdict === VERDICT.WRONG) wrong.push(field);
    else if (verdict === VERDICT.MISSING) missing.push(field);
    else if (verdict === VERDICT.CORRECT) correct.push(field);
  }

  return { fields, wrong, missing, correct };
}

/**
 * Aggregates scored cases.
 *
 * `wrongRate` is the headline: the share of asserted fields that came back
 * confidently incorrect. `correctRate` alone can improve while `wrongRate` gets
 * worse — filling more fields wrongly raises coverage and lowers trust — so the
 * two are always reported together, per field and overall.
 *
 * @param {Array<{id: string, score: ReturnType<typeof scoreCase>}>} results
 */
export function summarise(results) {
  const perField = Object.fromEntries(
    SCORED_FIELDS.map(f => [f, { correct: 0, wrong: 0, missing: 0, scored: 0 }])
  );

  for (const { score } of results) {
    for (const field of SCORED_FIELDS) {
      const { verdict } = score.fields[field];
      if (verdict === VERDICT.UNSCORED) continue;
      perField[field].scored += 1;
      perField[field][verdict] += 1;
    }
  }

  const totals = { correct: 0, wrong: 0, missing: 0, scored: 0 };
  for (const field of SCORED_FIELDS) {
    totals.correct += perField[field].correct;
    totals.wrong += perField[field].wrong;
    totals.missing += perField[field].missing;
    totals.scored += perField[field].scored;
  }

  const rate = (n, d) => (d > 0 ? n / d : null);

  return {
    cases: results.length,
    // A card is "clean" only if nothing came back wrong. Missing fields are
    // tolerable; a wrong one taints the whole listing.
    cleanCases: results.filter(r => r.score.wrong.length === 0).length,
    perField: Object.fromEntries(
      SCORED_FIELDS.map(f => [f, {
        ...perField[f],
        correctRate: rate(perField[f].correct, perField[f].scored),
        wrongRate: rate(perField[f].wrong, perField[f].scored),
      }])
    ),
    totals: {
      ...totals,
      correctRate: rate(totals.correct, totals.scored),
      wrongRate: rate(totals.wrong, totals.scored),
    },
  };
}

/** Renders a summary as a fixed-width table for the terminal. */
export function formatSummary(summary) {
  const pct = v => (v === null ? '   — ' : `${(v * 100).toFixed(0).padStart(3)}% `);
  const lines = [
    `Cases: ${summary.cases}   Clean (nothing wrong): ${summary.cleanCases}/${summary.cases}`,
    '',
    'field         scored  correct    wrong  missing',
    '───────────────────────────────────────────────',
  ];

  for (const [field, s] of Object.entries(summary.perField)) {
    lines.push(
      `${field.padEnd(13)}${String(s.scored).padStart(6)}  ` +
      `${pct(s.correctRate)}  ${pct(s.wrongRate)}  ${String(s.missing).padStart(7)}`
    );
  }

  const t = summary.totals;
  lines.push('───────────────────────────────────────────────');
  lines.push(
    `${'TOTAL'.padEnd(13)}${String(t.scored).padStart(6)}  ` +
    `${pct(t.correctRate)}  ${pct(t.wrongRate)}  ${String(t.missing).padStart(7)}`
  );
  lines.push('');
  lines.push('A wrong field reaches a live listing; a missing one costs typing.');
  lines.push('Drive `wrong` to zero before chasing `correct`.');

  return lines.join('\n');
}
