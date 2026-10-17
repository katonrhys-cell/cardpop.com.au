import { describe, it, expect } from 'vitest';
import { mapCollectionType } from '@/utils/ocrResult.js';
import { TCG_COLLECTIONS } from '@/data/collections.js';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';

// The franchise is "Dragon Ball" (Score, Panini and Bandai all made Dragon Ball
// card games), not the one Bandai game it used to be named after. Everything a
// model or a seller might call it has to land on that one name so the listing
// form resolves the franchise and CardSight is skipped for it.
describe('Dragon Ball collection name', () => {
  it('is the TCG collection name', () => {
    expect(TCG_COLLECTIONS).toContain('Dragon Ball');
    expect(TCG_COLLECTIONS).not.toContain('Dragon Ball Super');
  });

  it.each([
    'Dragon Ball', 'Dragon Ball Super', 'Dragon Ball Z', 'Dragon Ball Super Card Game',
    'Dragon Ball Z TCG', 'DBS', 'DBZ', 'dragon ball super fusion world',
  ])('maps %s onto it', (raw) => {
    expect(mapCollectionType(raw)).toBe('Dragon Ball');
  });

  it('keeps the collection page aliases in step with the franchise name', () => {
    const cfg = Object.values(COLLECTION_CONFIGS).find(c => c.name === 'Dragon Ball');
    expect(cfg.categoryAliases).toEqual(expect.arrayContaining(['Dragon Ball', 'Dragon Ball Super']));
  });
});
