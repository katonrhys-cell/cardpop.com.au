/**
 * The collection (hobby) names CardPop sells under.
 *
 * These live here rather than in Header.jsx so they can be imported outside the
 * React tree — the OCR result mapper and the scoring harness both need them and
 * neither can pull in a component. Header re-exports them for compatibility.
 */

export const TCG_COLLECTIONS = [
  'Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh', 'Digimon',
  'Riftbound', 'TMNT', 'Final Fantasy', 'Disney Lorcana', 'One Piece',
  'Flesh and Blood', 'Dragon Ball', 'Star Wars Unlimited',
  'Weiss Schwarz', 'Cardfight!! Vanguard',
];

export const SPORTS_COLLECTIONS = [
  'NBA', 'NFL', 'MLB', 'Cricket', 'NRL', 'NHL', 'Formula 1',
  'Wrestling', 'Golf', 'Soccer', 'AFL', 'AFLW', 'Rugby Union',
  'Boxing', 'MMA', 'Tennis', 'UFC',
];

export const COLLECTIONS_LIST = [...TCG_COLLECTIONS, ...SPORTS_COLLECTIONS].sort();

/**
 * Wording a model returns that means one of the collections above.
 *
 * Models describe a card by its sport ("Basketball") far more readily than by
 * its league ("NBA"), and an unmapped category is expensive: it leaves
 * `collectionType` empty, which sends CardSight into the ten-segment fan-out and
 * strips the variant taxonomy of its game.
 */
export const COLLECTION_ALIASES = {
  basketball: 'NBA',
  'nba basketball': 'NBA',
  football: 'NFL',
  'american football': 'NFL',
  'nfl football': 'NFL',
  baseball: 'MLB',
  'mlb baseball': 'MLB',
  hockey: 'NHL',
  'ice hockey': 'NHL',
  'nhl hockey': 'NHL',
  'association football': 'Soccer',
  mma: 'MMA',
  'mixed martial arts': 'MMA',
  'rugby league': 'NRL',
  'australian rules': 'AFL',
  'australian football': 'AFL',
  'pokemon tcg': 'Pokemon',
  'pokémon': 'Pokemon',
  mtg: 'Magic: The Gathering',
  magic: 'Magic: The Gathering',
  yugioh: 'Yu-Gi-Oh',
  'yu-gi-oh!': 'Yu-Gi-Oh',
  'dragon ball super': 'Dragon Ball',
  'dragon ball z': 'Dragon Ball',
  'dragon ball super card game': 'Dragon Ball',
  dbs: 'Dragon Ball',
  dbz: 'Dragon Ball',
};
