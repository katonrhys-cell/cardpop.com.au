/**
 * Maps CardPop collection names to CardSight API segments.
 * Used to filter which sport/TCG segment to search when identifying cards.
 */

export const COLLECTION_SEGMENT_MAP = {
  // TCG Collections — try all sports segments as fallback (CardSight is sports-heavy)
  'Pokémon': ['pokemon'],
  'Pokemon': ['pokemon'],
  'Magic: The Gathering': [],
  'Magic': [],
  'MTG': [],
  'Yu-Gi-Oh': [],
  'Yu-Gi-Oh!': [],
  'Yugioh': [],

  // Sports Collections
  'NBA': ['basketball'],
  'NFL': ['football'],
  'MLB': ['baseball'],
  'NHL': ['hockey'],
  'Soccer': ['soccer'],
  'Cricket': ['cricket'],
  'Golf': ['golf'],
  'Tennis': ['tennis'],
  'UFC': ['ufc'],
  'MMA': ['ufc'],
  'Boxing': [], // Not supported by CardSight
  'Formula 1': [], // Not supported by CardSight
  'Wrestling': [], // Not supported by CardSight
  'NRL': [], // Rugby League — not directly supported
  'AFL': [], // Australian Football — not supported
  'AFLW': [], // Australian Football Women — not supported
  'Rugby Union': [], // Not supported by CardSight
  'Cricket': ['cricket'],
};

/**
 * Get segments to search for a given collection.
 * If collection maps to specific segments, use only those.
 * If collection is empty or not found, fall back to all segments.
 */
export function getSegmentsForCollection(collectionName) {
  if (!collectionName) {
    // No collection specified — try all major segments
    return ['basketball', 'baseball', 'football', 'soccer', 'pokemon', 'hockey', 'ufc', 'golf', 'tennis', 'cricket'];
  }

  const mapped = COLLECTION_SEGMENT_MAP[collectionName];

  if (Array.isArray(mapped)) {
    // Explicit mapping found
    if (mapped.length > 0) return mapped;
    // Empty array means "not supported by CardSight" — still try all as fallback
    return ['basketball', 'baseball', 'football', 'soccer', 'pokemon', 'hockey', 'ufc', 'golf', 'tennis', 'cricket'];
  }

  // Collection not in map — try all segments
  return ['basketball', 'baseball', 'football', 'soccer', 'pokemon', 'hockey', 'ufc', 'golf', 'tennis', 'cricket'];
}
