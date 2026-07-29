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
  'Flesh and Blood', 'Dragon Ball Super', 'Star Wars Unlimited',
  'Weiss Schwarz', 'Cardfight!! Vanguard',
];

export const SPORTS_COLLECTIONS = [
  'NBA', 'NFL', 'MLB', 'Cricket', 'NRL', 'NHL', 'Formula 1',
  'Wrestling', 'Golf', 'Soccer', 'AFL', 'AFLW', 'Rugby Union',
  'Boxing', 'MMA', 'Tennis', 'UFC',
];

export const COLLECTIONS_LIST = [...TCG_COLLECTIONS, ...SPORTS_COLLECTIONS].sort();
