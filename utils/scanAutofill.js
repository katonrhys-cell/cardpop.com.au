/**
 * Resolvers that turn what a scan *read* (names, colours, a printed serial)
 * into what the listing form *selects* (hierarchy ids, numbering fields).
 *
 * Kept out of AddEditCardPage so each rule is unit-testable: every one of
 * these encodes a "why didn't the scanner fill X?" bug that was found with a
 * real card, and a regression here silently degrades the scanner without
 * failing any request.
 *
 * All matching is deliberately conservative: an ambiguous match returns null
 * rather than guessing, because a wrong auto-selection on a live listing is
 * worse than an empty dropdown the seller fills themselves.
 */

import { normalizeName, normalizeSeason, setsMatch } from './cardMatch.js';

/**
 * Parses a printed serial ("097/199", "23 / 99") into the Numbering Details
 * fields. Leading zeros are dropped — the form's inputs and the saved
 * serial_position/serial_print_run columns are numeric.
 *
 * @param {string|null|undefined} serial
 * @returns {{ position: string, printRun: string } | null}
 */
export function parseSerialNumber(serial) {
  const m = String(serial ?? '').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const position = String(parseInt(m[1], 10));
  const printRun = String(parseInt(m[2], 10));
  // "0/0" or a position beyond the run is a misread, not a serial.
  if (printRun === '0' || Number(position) > Number(printRun)) return null;
  return { position, printRun };
}

/**
 * Whether a set name carries no product information of its own. CardSight's
 * sports catalog answers with its release name — literally "Base Set" — which
 * must not overwrite a real product name ("Topps Chrome") already read off the
 * card. (Pokemon's genuine "Base Set" is unaffected: there OCR reads "Base
 * Set" too, so there is a same-value overwrite or nothing to overwrite.)
 */
export function isGenericSetName(name) {
  return /^base(\s+set)?$/i.test(String(name ?? '').trim());
}

/** Season prefix of a set name ("2025-26 Topps Chrome Basketball" → "2025-26"). */
function seasonPrefixOf(name) {
  const m = String(name ?? '').trim().match(/^(\d{4})(?:\s*[-/–—]\s*(\d{2,4}))?/);
  if (!m) return null;
  return normalizeSeason(m[2] ? `${m[1]}-${m[2]}` : m[1]);
}

/**
 * Picks the catalogue set a scanned set name refers to.
 *
 * `setsMatch` treats a season prefix present on only one side as noise, so
 * "Topps Chrome" matches every season of "XXXX-YY Topps Chrome Basketball" —
 * the year read off the card is what disambiguates. No year, or a year that
 * narrows to more than one candidate, returns null rather than a guess.
 *
 * @param {Array<{id: string, name: string}>} sets - loaded options
 * @param {string} setName - as read off the card ("Topps Chrome")
 * @param {string} [year] - year or season as read ("2025-26" or "2025")
 * @returns {{id: string, name: string} | null}
 */
export function pickSetByNameAndYear(sets, setName, year) {
  if (!setName) return null;
  const matches = (sets ?? []).filter(s => setsMatch(s.name, setName));
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const season = normalizeSeason(year);
  if (!season || !/^\d{4}/.test(season)) return null;
  const seasoned = matches.filter(s => {
    const prefix = seasonPrefixOf(s.name);
    // A single year matches the season starting with it ("2025" → "2025-26"),
    // because graders and copyright lines often print only the first year.
    return prefix === season || (prefix ?? '').startsWith(`${season}-`) || season.startsWith(`${prefix}-`);
  });
  return seasoned.length === 1 ? seasoned[0] : null;
}

/**
 * Resolves a team name read off a card to a team option. Containment runs
 * both ways so "Celtics" finds "Boston Celtics" and "Boston Celtics Guard"
 * still finds "Boston Celtics" — but only when exactly one team matches.
 *
 * @param {Array<{id: string, name: string}>} teams
 * @param {string} teamName
 * @returns {{id: string, name: string} | null}
 */
export function matchTeam(teams, teamName) {
  const target = normalizeName(teamName);
  if (!target) return null;
  const options = teams ?? [];

  const exact = options.find(t => normalizeName(t.name) === target);
  if (exact) return exact;

  const partial = options.filter(t => {
    const name = normalizeName(t.name);
    return name.includes(target) || target.includes(name);
  });
  return partial.length === 1 ? partial[0] : null;
}

// The finish families a parallel name can belong to, keyed by the product
// finish chips `productFinishNames` derives. A print-run-only match is unsafe
// on its own (199 is both "Blue Prizm /199" and "Teal Refractor /199") — the
// family word from the product is what makes it safe.
const FINISH_FAMILY_WORDS = {
  Chrome: 'refractor',
  Refractor: 'refractor',
  Prizm: 'prizm',
  Mosaic: 'mosaic',
  Optic: 'optic',
};

/** Finish-family words implied by finish chips (from variant + product name). */
export function finishFamilies(chips) {
  const out = new Set();
  for (const chip of chips ?? []) {
    const word = FINISH_FAMILY_WORDS[chip];
    if (word) out.add(word);
  }
  return [...out];
}

/** Parallel option names often carry the run ("Teal Refractor /199") — strip it to compare names. */
const stripPrintRun = name => normalizeName(String(name ?? '').replace(/\/\s*\d+\s*$/, ''));

/**
 * Picks the Parallel / Variation option a scan points at, trying signals in
 * decreasing order of strength:
 *
 * 1. A parallel NAME (printed on the card or from CardSight) — exact
 *    normalized match, ignoring a trailing "/199" in the option name.
 * 2. Colour + print run — "teal" + 199 → "Teal Refractor /199".
 * 3. Colour + finish family — for unnumbered colour parallels.
 * 4. Print run + finish family — the serial alone, constrained to the
 *    product's finish so a Chrome card can never land on a Prizm parallel.
 *
 * Every rung requires a UNIQUE match; ambiguity falls through to null.
 *
 * @param {Array<{id: string, name: string, print_run?: number|null}>} options
 * @param {{name?: string, color?: string, printRun?: string|number, families?: string[]}} signals
 * @returns {object | null}
 */
export function matchParallel(options, { name, color, printRun, families } = {}) {
  const opts = options ?? [];

  const targetName = stripPrintRun(name);
  if (targetName) {
    const exact = opts.filter(p => stripPrintRun(p.name) === targetName);
    if (exact.length === 1) return exact[0];
  }

  const colorWord = normalizeName(color);
  const run = parseInt(printRun, 10) || null;
  const familyWords = (families ?? []).map(f => String(f).toLowerCase());
  const nameHas = (p, word) => normalizeName(p.name).split(' ').includes(word);
  const inFamily = p => familyWords.some(f => nameHas(p, f));

  if (colorWord && run) {
    const hits = opts.filter(p => p.print_run === run && nameHas(p, colorWord));
    if (hits.length === 1) return hits[0];
  }
  if (colorWord && familyWords.length) {
    const hits = opts.filter(p => inFamily(p) && nameHas(p, colorWord));
    if (hits.length === 1) return hits[0];
  }
  if (run && familyWords.length) {
    const hits = opts.filter(p => p.print_run === run && inFamily(p));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

// The colour words the Refractor Details panel offers, keyed by what a model
// calls the colour it sees. Only colours with a button in the panel appear —
// an unknown colour word selects nothing rather than a wrong swatch.
const REFRACTOR_COLOR_VALUES = {
  teal: 'teal',
  green: 'green',
  purple: 'purple',
  blue: 'blue',
  aqua: 'aqua',
  cyan: 'aqua',
  pink: 'pink',
  yellow: 'yellow',
  gold: 'gold',
  orange: 'orange',
  black: 'black',
  red: 'red',
};

/** Maps an observed finish colour to the Refractor Colour value, else ''. */
export function refractorColorValue(color) {
  return REFRACTOR_COLOR_VALUES[String(color ?? '').trim().toLowerCase()] ?? '';
}
