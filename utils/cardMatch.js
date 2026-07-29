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

/**
 * Whether two set names refer to the same set.
 *
 * Plain substring containment is not good enough here: set names nest, so
 * "Base Set" contains-matches "Base Set 2" and "Sword & Shield" matches
 * "Sword & Shield Promo" — different sets that would then corroborate each
 * other. Containment counts only when the extra words carry no distinguishing
 * information; a trailing "2" or "Promo" does.
 */
export function setsMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  const shortWords = shorter.split(' ').filter(Boolean);
  const longWords = longer.split(' ').filter(Boolean);
  if (!shortWords.every(w => longWords.includes(w))) return false;

  const shortSet = new Set(shortWords);
  return longWords.filter(w => !shortSet.has(w)).every(w => SET_NOISE_WORDS.has(w));
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
