/**
 * Maps CardPop collection names to CardSight API segments.
 *
 * CardSight's catalog covers ten segments and nothing else. Three outcomes
 * matter and must stay distinguishable:
 *
 *   - a supported collection  → search exactly that segment
 *   - a collection CardSight cannot possibly hold (Magic, One Piece, AFL, NRL…)
 *     → search nothing, because every segment would answer with its best guess
 *       *within that segment* and the result is always the wrong card
 *   - no collection at all     → fan out across every segment and rank the
 *       merged detections
 *
 * The second case used to fall back to "search everything", which is how a
 * Magic or One Piece scan came back as a confident-looking baseball card.
 */

export const ALL_SEGMENTS = [
  'basketball', 'baseball', 'football', 'soccer', 'pokemon',
  'hockey', 'ufc', 'golf', 'tennis', 'cricket',
];

/**
 * Collection → segments. An empty array means "CardSight has no catalog for
 * this" and is deliberately different from a missing key ("we don't recognise
 * this name, so try everything").
 *
 * Keys are matched loosely (case, accents and punctuation are ignored), so
 * "Pokémon", "pokemon" and "POKEMON" all resolve. Aliases exist for the
 * display names the listing form writes back into `collection` after an
 * identification (e.g. "NBA Basketball").
 */
export const COLLECTION_SEGMENT_MAP = {
  // ─── TCG ───────────────────────────────────────────────────────────────────
  // Pokemon is the only TCG in CardSight's catalog.
  'Pokemon': ['pokemon'],
  'Pokémon': ['pokemon'],
  'Pokemon TCG': ['pokemon'],

  'Magic: The Gathering': [],
  'Magic': [],
  'MTG': [],
  'Yu-Gi-Oh': [],
  'Yu-Gi-Oh!': [],
  'Yugioh': [],
  'Digimon': [],
  'Riftbound': [],
  'TMNT': [],
  'Final Fantasy': [],
  'Disney Lorcana': [],
  'One Piece': [],
  'Flesh and Blood': [],
  'Dragon Ball Super': [],
  'Star Wars Unlimited': [],
  'Weiss Schwarz': [],
  'Cardfight!! Vanguard': [],

  // ─── Sports ────────────────────────────────────────────────────────────────
  'NBA': ['basketball'],
  'NBA Basketball': ['basketball'],
  'Basketball': ['basketball'],
  'NFL': ['football'],
  'NFL Football': ['football'],
  'MLB': ['baseball'],
  'MLB Baseball': ['baseball'],
  'Baseball': ['baseball'],
  'NHL': ['hockey'],
  'NHL Hockey': ['hockey'],
  'Hockey': ['hockey'],
  'Soccer': ['soccer'],
  'Cricket': ['cricket'],
  'Golf': ['golf'],
  'Tennis': ['tennis'],
  'UFC': ['ufc'],
  'MMA': ['ufc'],

  // Australian and other codes CardSight does not carry.
  'Boxing': [],
  'Formula 1': [],
  'Wrestling': [],
  'NRL': [],
  'AFL': [],
  'AFLW': [],
  'Rugby Union': [],
};

/** Strips case, accents and punctuation so "Pokémon" and "pokemon" collide. */
function normaliseKey(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NORMALISED_MAP = new Map(
  Object.entries(COLLECTION_SEGMENT_MAP).map(([name, segments]) => [normaliseKey(name), segments])
);

/**
 * Segments to search for a collection.
 *
 * @param {string|null|undefined} collectionName
 * @returns {string[]} the segments to query — `[]` when CardSight cannot hold
 *   this collection at all, every segment when the collection is unknown.
 */
export function getSegmentsForCollection(collectionName) {
  const mapped = NORMALISED_MAP.get(normaliseKey(collectionName));
  // Unknown (or blank) name: no basis to narrow, so search everything.
  return mapped ?? ALL_SEGMENTS;
}

/**
 * Whether CardSight can identify this collection at all. False for a known but
 * uncovered collection (Magic, AFL, …); true for supported and for unknown
 * names, where the fan-out is still worth a try.
 *
 * @param {string|null|undefined} collectionName
 * @returns {boolean}
 */
export function isSupportedByCardSight(collectionName) {
  return getSegmentsForCollection(collectionName).length > 0;
}
