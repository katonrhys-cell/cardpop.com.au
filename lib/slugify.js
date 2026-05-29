/**
 * Convert any string to a clean URL slug.
 * e.g. "LeBron James RC Auto" → "lebron-james-rc-auto"
 *      "Pokémon"              → "pokemon"
 *      "2003-04 Upper Deck"   → "2003-04-upper-deck"
 */
export const slugify = (str = '') =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[^a-z0-9\s-]/g, ' ')    // drop non-alphanumeric (keeps hyphens & spaces)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
