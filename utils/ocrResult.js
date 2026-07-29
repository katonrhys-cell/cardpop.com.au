/**
 * Normalises the raw OCR JSON into the shape the listing form and the catalogue
 * grounding step consume.
 *
 * Kept out of the React hook so it can run in Node — the scoring harness maps
 * model output exactly the way production does rather than approximating it.
 */

import { COLLECTIONS_LIST } from '../data/collections.js';

export function mapOCRResult(data) {
  const condition = mapCondition(data.condition);
  const gradingService = mapGradingService(data.gradingService);
  const rarity = mapRarity(data.rarity);
  const collectionType = mapCollectionType(data.collectionType);

  return {
    name: data.name || '',
    description: data.description || '',
    cardSetName: data.cardSetName || '',
    cardNumber: data.cardNumber || '',
    releaseYear: data.releaseYear ? String(data.releaseYear) : '',
    collectionType,
    condition,
    gradingService,
    gradeScore: data.gradeScore != null ? String(data.gradeScore) : '',
    certificationNumber: data.certificationNumber || '',
    rarity,
    cardType: data.cardType || '',
    brand: data.brand || '',
    series: data.series || data.cardSetName || '',
    confidence: data.confidence || null,
    candidateSets: Array.isArray(data.candidateSets) ? data.candidateSets : [],
  };
}

// Maps the OCR collectionType to the /catalog/search collection param. The
// catalogue route only covers Pokemon, Magic and Yu-Gi-Oh; for anything else
// we send no collection and let the backend try all three.
export function catalogueCollectionParam(collectionType) {
  const c = (collectionType || '').toLowerCase();
  if (c.includes('pokemon') || c.includes('pokémon')) return 'pokemon';
  if (c.includes('magic')) return 'magic';
  if (c.includes('yu-gi-oh') || c.includes('yugioh')) return 'yu-gi-oh';
  return '';
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
  const lower = raw.toLowerCase();
  const match = COLLECTIONS_LIST.find(c => c.toLowerCase() === lower || lower.includes(c.toLowerCase()));
  return match || '';
}
