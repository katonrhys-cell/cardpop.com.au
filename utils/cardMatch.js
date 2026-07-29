/**
 * Name and set-name comparison, shared by the catalogue grounding step and the
 * scoring harness. One definition, so a change to what counts as "the same set"
 * moves the pipeline and the measurement together.
 */

/** Lowercases and reduces to alphanumeric words separated by single spaces. */
export function normalizeName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Words that describe a set without distinguishing it from another, so a name
// differing only by these is the same set read two ways ("Base" / "Base Set").
const SET_NOISE_WORDS = new Set(['the', 'set', 'series', 'edition', 'expansion', 'collection', 'tcg']);

const FULL_YEAR = /^(19|20)\d{2}$/;
const SHORT_YEAR = /^\d{2}$/;

/**
 * Splits a leading season off a set name's words.
 * "2025 26 topps chrome" → { years: ['2025', '26'], rest: ['topps', 'chrome'] }
 */
function splitSeasonPrefix(words) {
  const years = [];
  let i = 0;
  while (i < words.length) {
    const isFull = FULL_YEAR.test(words[i]);
    // A bare two-digit token only reads as a year when it follows a full one,
    // so the "2" in "Base Set 2" is never mistaken for a season.
    const isShortFollowingYear = years.length > 0 && SHORT_YEAR.test(words[i]);
    if (!isFull && !isShortFollowingYear) break;
    years.push(words[i]);
    i += 1;
  }
  return { years, rest: words.slice(i) };
}

/** Word-level comparison ignoring words that don't distinguish one set from another. */
function coreWordsMatch(wordsA, wordsB) {
  if (!wordsA.length || !wordsB.length) return false;
  if (wordsA.join(' ') === wordsB.join(' ')) return true;

  const [shortWords, longWords] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (!shortWords.every(w => longWords.includes(w))) return false;

  const shortSet = new Set(shortWords);
  return longWords.filter(w => !shortSet.has(w)).every(w => SET_NOISE_WORDS.has(w));
}

/**
 * Whether two set names refer to the same set.
 *
 * Plain substring containment is not good enough here: set names nest, so
 * "Base Set" contains-matches "Base Set 2" and "Sword & Shield" matches
 * "Sword & Shield Promo" — different sets that would then corroborate each
 * other. Containment counts only when the extra words carry no distinguishing
 * information; a trailing "2" or "Promo" does.
 *
 * Sports sets add a second wrinkle. They are conventionally written with a
 * season prefix — "2025-26 Topps Chrome" — while the same set read off the card
 * is usually just "Topps Chrome". Those are the same set, and the year is
 * carried by its own field, so a prefix present on only one side is ignored.
 * When *both* carry one it still distinguishes: "1999 Topps Chrome" is not
 * "2025-26 Topps Chrome".
 */
export function setsMatch(a, b) {
  const wordsA = normalizeName(a).split(' ').filter(Boolean);
  const wordsB = normalizeName(b).split(' ').filter(Boolean);
  if (!wordsA.length || !wordsB.length) return false;

  const seasonA = splitSeasonPrefix(wordsA);
  const seasonB = splitSeasonPrefix(wordsB);
  if (seasonA.years.length && seasonB.years.length && seasonA.years[0] !== seasonB.years[0]) {
    return false;
  }

  return coreWordsMatch(seasonA.rest, seasonB.rest);
}

/** Normalised name with all spacing removed, so punctuation can't split a word. */
const compactName = s => normalizeName(s).replace(/ /g, '');

/**
 * Whether two card names refer to the same card. Stricter than the grounding
 * step's `nameSignal`, which also accepts partial containment — here we are
 * checking a result against known ground truth, so containment must not pass
 * ("Charizard" is not "Charizard VMAX").
 *
 * The compact comparison exists for punctuation: `normalizeName` turns
 * separators into spaces, so "Farfetch'd" becomes "farfetch d" while a model
 * writing "Farfetchd" gives "farfetchd". Those are the same card, and
 * apostrophes and hyphens are common enough in Pokemon names — Farfetch'd,
 * Ho-Oh, Mr. Mime, Porygon-Z — that treating them as mismatches would fill the
 * report with false failures.
 */
export function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || compactName(a) === compactName(b);
}
