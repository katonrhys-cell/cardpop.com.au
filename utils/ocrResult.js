/**
 * Normalises the raw OCR JSON into the shape the listing form and the catalogue
 * grounding step consume.
 *
 * Kept out of the React hook so it can run in Node — the scoring harness maps
 * model output exactly the way production does rather than approximating it.
 */

import { COLLECTIONS_LIST, COLLECTION_ALIASES } from '../data/collections.js';

export function mapOCRResult(data) {
  const condition = mapCondition(data.condition);
  const gradingService = mapGradingService(data.gradingService);
  const rarity = mapRarity(data.rarity);
  const collectionType = mapCollectionType(data.collectionType);

  return {
    name: data.name || '',
    description: data.description || '',
    cardSetName: data.cardSetName || '',
    // The insert/subset within the product ("Ball of Duty"), kept apart from
    // the product itself ("Topps Chrome") — they are different attributes and
    // folding either into the other loses information a listing needs.
    insertName: data.insertName || '',
    cardNumber: data.cardNumber || '',
    releaseYear: data.releaseYear ? String(data.releaseYear) : '',
    collectionType,
    condition,
    gradingService,
    gradeScore: data.gradeScore != null ? String(data.gradeScore) : '',
    certificationNumber: data.certificationNumber || '',
    rarity,
    cardType: data.cardType || '',
    // Rookie designation as printed. Ticks the "Rookie Card (RC)" chip, which
    // is the single source of truth for everything rookie-related.
    rookie: data.rookie || '',
    // Treatments visible on the card, resolved to real variant chips later —
    // free text here, because the taxonomy is per-game and the model shouldn't
    // be asked to know it.
    attributes: Array.isArray(data.attributes) ? data.attributes : [],
    // The printed print-run serial ("23/99"), distinct from the collector number.
    serialNumber: data.serialNumber || '',
    // Sports: the player's team as printed / shown by the logo.
    team: data.team || '',
    // A parallel NAME only when printed on the card; the colour of a coloured
    // chromium finish is a separate visual observation the form combines with
    // the product (Chrome + Teal → teal refractor) — see mergeIdentifiedVariants.
    parallel: data.parallel || '',
    parallelColor: data.parallelColor || '',
    brand: data.brand || '',
    series: data.series || data.cardSetName || '',
    confidence: data.confidence || null,
    candidateSets: Array.isArray(data.candidateSets) ? data.candidateSets : [],
  };
}

// Maps the OCR collectionType to the /catalog/search collection param. The
// public adapters cover Pokemon, Magic and Yu-Gi-Oh, keyed by these short
// names. Any other collection is passed through as-is: the public trio treats
// an unrecognised name exactly like a blank one (fan out to all three), while
// the internal CardPop catalogue — the only source that covers sports cards
// and the other uncatalogued hobbies — uses it to filter its candidates.
export function catalogueCollectionParam(collectionType) {
  const c = (collectionType || '').toLowerCase();
  if (c.includes('pokemon') || c.includes('pokémon')) return 'pokemon';
  if (c.includes('magic')) return 'magic';
  if (c.includes('yu-gi-oh') || c.includes('yugioh')) return 'yu-gi-oh';
  return (collectionType || '').trim();
}

export function mapCondition(raw) {
  const c = (raw || '').toLowerCase();
  if (c.includes('near mint') || c === 'nm') return 'Near Mint';
  if (c.includes('mint')) return 'Mint';
  if (c.includes('excellent') || c.includes('lightly played')) return 'Excellent';
  if (c.includes('good') || c.includes('moderately played')) return 'Good';
  if (c.includes('fair') || c.includes('heavily played') || c.includes('poor')) return 'Fair';
  return 'Good';
}

export function mapGradingService(raw) {
  const gs = (raw || '').toUpperCase();
  if (gs.includes('PSA')) return 'PSA';
  if (gs.includes('BGS') || gs.includes('BECKETT')) return 'BGS';
  if (gs.includes('CGC')) return 'CGC';
  if (gs.includes('SGC')) return 'SGC';
  if (gs.includes('ACE')) return 'ACE';
  return 'None';
}

export function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r.includes('secret') || r.includes('ultra rare')) return 'Secret Rare';
  if (r.includes('holo') || r.includes('holographic')) return 'Holographic';
  if (r.includes('rare')) return 'Rare';
  if (r.includes('uncommon')) return 'Uncommon';
  if (r.includes('common')) return 'Common';
  return null;
}

export function mapCollectionType(raw) {
  if (!raw) return '';
  const lower = String(raw).trim().toLowerCase();

  const exact = COLLECTIONS_LIST.find(c => c.toLowerCase() === lower);
  if (exact) return exact;

  // A model saying "Basketball" means NBA. Without this the category comes back
  // empty, and an empty category is what sends CardSight into its ten-segment
  // fan-out — the worst input the identify call can get.
  const alias = COLLECTION_ALIASES[lower];
  if (alias) return alias;

  const contained = COLLECTIONS_LIST.find(c => lower.includes(c.toLowerCase()));
  if (contained) return contained;

  const aliasHit = Object.keys(COLLECTION_ALIASES).find(k => lower.includes(k));
  return aliasHit ? COLLECTION_ALIASES[aliasHit] : '';
}
