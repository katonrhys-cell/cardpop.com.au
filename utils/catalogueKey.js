/**
 * The identity of a card, as a deterministic string.
 *
 * This is what turns a stream of individual scans into a catalogue: two scans of
 * the same card must produce the same key, and two scans of different cards must
 * not. Everything downstream — deduplication, observation counts, "how many
 * times have we seen this" — hangs off it.
 *
 * What makes a card distinct here is what makes it a distinct thing to sell. A
 * base card and its Red Laser parallel share name, set, number and year and are
 * worth very different amounts, so the parallel is part of the identity. So is
 * the insert: "Topps Chrome / Ball of Duty #BD11" is not "Topps Chrome #BD11".
 */

import { normalizeName } from './cardMatch.js';
import { parseCardNumber } from './cardNumber.js';

/** Normalised, or '' — used for every text component so the key is stable. */
const part = value => normalizeName(value).replace(/ /g, '-');

/**
 * The printed number reduced to a stable form, keeping the set total: "4/102"
 * and "4/165" are card 4 of *different* sets and must not collide.
 */
function numberPart(printed) {
  const { value, total } = parseCardNumber(printed);
  if (!value) return '';
  return total ? `${value}-of-${total}` : value;
}

/**
 * Builds the catalogue key for an identified card, or returns null when the
 * identification isn't specific enough to be worth cataloguing.
 *
 * The null case matters more than the happy path. A scan that produced only a
 * player name cannot be told apart from a hundred other printings of that
 * player, and writing it to the catalogue would create an entry that later
 * scans wrongly merge into — permanently poisoning the record. A scan we can't
 * identify is still logged; it just doesn't earn a catalogue entry.
 *
 * @param {object} card
 * @param {string} [card.collection] - e.g. "NBA", "Pokemon"
 * @param {string} [card.setName] - the product, e.g. "Topps Chrome"
 * @param {string} [card.cardNumber] - as printed
 * @param {string} [card.insertName] - treatment within the product
 * @param {string} [card.parallel]
 * @param {string} [card.name]
 * @returns {string|null}
 */
export function buildCatalogueKey({
  collection, setName, cardNumber, insertName, parallel, name,
} = {}) {
  const collectionPart = part(collection);
  const setPart = part(setName);
  const number = numberPart(cardNumber);
  const namePart = part(name);

  // A card needs its hobby, its product, and something that separates it from
  // the rest of that product. The number is the good discriminator; a name is a
  // weak fallback that only holds for products where names are unique.
  if (!collectionPart || !setPart) return null;
  if (!number && !namePart) return null;

  return [
    collectionPart,
    setPart,
    part(insertName) || '-',
    number || `name:${namePart}`,
    part(parallel) || '-',
  ].join('|');
}

/**
 * Whether a key is specific enough that later scans of the same card will
 * reliably produce it too. Number-based keys are; name-based ones are a
 * best-effort fallback and are flagged so the catalogue can treat them as
 * provisional.
 *
 * @param {string|null} key
 * @returns {boolean}
 */
export function isStrongCatalogueKey(key) {
  return Boolean(key) && !key.includes('|name:');
}
