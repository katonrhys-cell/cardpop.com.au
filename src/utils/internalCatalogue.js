/**
 * CardPop's own card catalogue as a recognition source.
 *
 * `card_catalogue` accumulates one row per distinct card out of every scan a
 * seller runs (see routes/card-scans.js). Until now it was write-only — this
 * module is the read path that closes the loop, so recognition improves as the
 * marketplace is used. It matters most for the hobbies no public catalogue
 * covers at all (sports cards, One Piece, AFL, NRL, …): for those, an entry a
 * seller has confirmed is the only external corroboration a scan can get.
 *
 * Only rows with `confirmations >= 1` are eligible. An unconfirmed entry is
 * just an earlier model read — echoing it back as "catalogue corroboration"
 * would let the pipeline confirm itself, and one bad read could snowball into
 * a permanently "verified" wrong answer. A confirmation means a human saved
 * the identification untouched; that is real evidence.
 */

import supabase from './supabaseClient.js';
import { cardNumbersMatch } from '../../utils/cardNumber.js';
import { normalizeName } from '../../utils/cardMatch.js';

/**
 * Escapes LIKE/ILIKE wildcards in user text so it matches literally.
 * `*` is stripped rather than escaped: PostgREST rewrites it to `%` before
 * the SQL layer sees it, so there is no way to match a literal asterisk.
 */
function escapeLike(text) {
  return String(text).replace(/\*/g, '').replace(/[\\%_]/g, ch => `\\${ch}`);
}

/**
 * Loose collection comparison: 'pokemon' must match 'Pokémon', 'magic' must
 * match 'Magic: The Gathering'. Uses the same accent/punctuation-insensitive
 * normalisation as name matching, in both containment directions.
 */
function collectionMatches(filter, rowCollection) {
  const a = normalizeName(filter);
  const b = normalizeName(rowCollection);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Searches the internal catalogue, returning candidates in the same shape as
 * the public API adapters in routes/catalog.js.
 *
 * The SQL narrows by name and confirmation; the number and collection filters
 * run here in JS so they use the pipeline's own equivalence rules
 * (`cardNumbersMatch` understands "4" vs "004/102"; a LIKE prefix does not).
 *
 * @param {string} q - card name text
 * @param {number} take
 * @param {{ number?: string, collection?: string }} [opts]
 */
export async function searchInternalCatalogue(q, take, { number, collection } = {}) {
  const name = String(q ?? '').trim();
  if (!name) return [];

  // The bound is generous on purpose: the collection and number filters run
  // below in JS (they need accent- and format-tolerant comparisons SQL ILIKE
  // can't do), so a tight SQL cap would let a heavily-confirmed common name
  // crowd the actually-requested printing out of the window before those
  // filters ever see it. Rows are narrow; 200 of them is nothing.
  const { data, error } = await supabase
    .from('card_catalogue')
    .select('catalogue_key, collection, set_name, insert_name, card_number, parallel, card_name, year, confirmations, observations')
    .gte('confirmations', 1)
    .ilike('card_name', `%${escapeLike(name)}%`)
    .order('confirmations', { ascending: false })
    .order('observations', { ascending: false })
    .limit(200);

  if (error || !Array.isArray(data)) return [];

  return data
    .filter(row => !collection || collectionMatches(collection, row.collection))
    .filter(row => !number || cardNumbersMatch(number, row.card_number))
    .slice(0, take)
    .map(row => ({
      id: row.catalogue_key,
      name: row.card_name,
      setName: row.set_name ?? null,
      // Kept as the stored text: sports "years" are seasons ("2003-04"), and
      // parseInt would truncate one to "2003" — which both breaks the
      // grounding year comparison (String("2003") !== "2003-04") and, worse,
      // would *overwrite* a correctly-read season since the catalogue is
      // authoritative for year. The public adapters return integers; the
      // grounding layer stringifies both, so the shapes coexist.
      year: row.year ?? null,
      cardNumber: row.card_number ?? null,
      rarity: null,
      imageUrl: null,
      source: 'cardpop',
      // Sports-card identity the public adapters have no concept of — the
      // grounding overlay fills these when OCR could not read them.
      insertName: row.insert_name ?? null,
      parallel: row.parallel ?? null,
      collection: row.collection ?? null,
    }));
}
