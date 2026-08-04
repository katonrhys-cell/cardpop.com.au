import { describe, it, expect } from 'vitest';
import { groundAgainstCatalogue } from '@/utils/catalogueGrounding.js';
import { catalogueCollectionParam } from '@/utils/ocrResult.js';

// A sports read the public APIs can't corroborate — only the internal
// CardPop catalogue carries entries like this.
const sportsRead = {
  name: 'LeBron James',
  cardSetName: '2003-04 Topps',
  insertName: '',
  cardNumber: '221',
  releaseYear: '',
  rarity: null,
  series: '',
  candidateSets: [],
};

const internalCandidate = {
  id: 'nba basketball|2003-04 topps|221',
  name: 'LeBron James',
  setName: '2003-04 Topps',
  cardNumber: '221',
  year: 2003,
  rarity: null,
  imageUrl: null,
  source: 'cardpop',
  insertName: 'Topps Chrome Refractor Insert',
  parallel: null,
  collection: 'NBA Basketball',
};

describe('groundAgainstCatalogue with internal candidates', () => {
  it('accepts an internal match on name + number and overlays set and year', async () => {
    const resolved = await groundAgainstCatalogue(sportsRead, async () => ({ results: [internalCandidate] }));
    expect(resolved.catalogueMatch).toMatchObject({ source: 'cardpop', verified: ['name', 'number', 'set'] });
    expect(resolved.releaseYear).toBe('2003');
  });

  it('fills insertName from the match but never overwrites a read one', async () => {
    const filled = await groundAgainstCatalogue(sportsRead, async () => ({ results: [internalCandidate] }));
    expect(filled.insertName).toBe('Topps Chrome Refractor Insert');

    const alreadyRead = { ...sportsRead, insertName: 'Printed Insert' };
    const kept = await groundAgainstCatalogue(alreadyRead, async () => ({ results: [internalCandidate] }));
    expect(kept.insertName).toBe('Printed Insert');
  });

  it('carries the internal identity fields on catalogueMatch', async () => {
    const resolved = await groundAgainstCatalogue(sportsRead, async () => ({ results: [internalCandidate] }));
    expect(resolved.catalogueMatch.insertName).toBe('Topps Chrome Refractor Insert');
    expect(resolved.catalogueMatch.parallel).toBeNull();
  });

  it('corroborates and preserves season-format years from internal candidates', async () => {
    // Sports "years" are seasons. The internal adapter passes them through as
    // text, so an exact season must count as year agreement and must survive
    // the overlay un-truncated.
    const read = { ...sportsRead, cardNumber: '', releaseYear: '2003-04' };
    const seasonCandidate = { ...internalCandidate, cardNumber: null, year: '2003-04' };
    const resolved = await groundAgainstCatalogue(read, async () => ({ results: [seasonCandidate] }));
    expect(resolved.catalogueMatch?.verified).toContain('year');
    expect(resolved.releaseYear).toBe('2003-04');
  });

  it('still rejects a candidate whose number conflicts', async () => {
    const wrongPrinting = { ...internalCandidate, cardNumber: '23' };
    const resolved = await groundAgainstCatalogue(sportsRead, async () => ({ results: [wrongPrinting] }));
    expect(resolved.catalogueMatch).toBeUndefined();
    expect(resolved.insertName).toBe('');
  });
});

describe('catalogueCollectionParam', () => {
  it('maps the three public-API hobbies to their short names', () => {
    expect(catalogueCollectionParam('Pokémon')).toBe('pokemon');
    expect(catalogueCollectionParam('Magic: The Gathering')).toBe('magic');
    expect(catalogueCollectionParam('Yu-Gi-Oh!')).toBe('yu-gi-oh');
  });

  it('passes any other collection through for the internal catalogue to filter on', () => {
    expect(catalogueCollectionParam('NBA Basketball')).toBe('NBA Basketball');
    expect(catalogueCollectionParam('One Piece')).toBe('One Piece');
  });

  it('returns empty for a blank collection', () => {
    expect(catalogueCollectionParam('')).toBe('');
    expect(catalogueCollectionParam(null)).toBe('');
  });
});
