import { describe, it, expect } from 'vitest';
import { getSegmentsForCollection, COLLECTION_SEGMENT_MAP } from '../../../src/utils/collectionSegmentMap.js';

const ALL_SEGMENTS = ['basketball', 'baseball', 'football', 'soccer', 'pokemon', 'hockey', 'ufc', 'golf', 'tennis', 'cricket'];

describe('getSegmentsForCollection', () => {
  it('returns the specific segment for a mapped sport', () => {
    expect(getSegmentsForCollection('NBA')).toEqual(['basketball']);
    expect(getSegmentsForCollection('NFL')).toEqual(['football']);
    expect(getSegmentsForCollection('Pokémon')).toEqual(['pokemon']);
  });

  it('maps aliases to the same segment', () => {
    expect(getSegmentsForCollection('MMA')).toEqual(['ufc']);
    expect(getSegmentsForCollection('UFC')).toEqual(['ufc']);
  });

  it('falls back to all segments for an unsupported (empty-mapped) collection', () => {
    expect(getSegmentsForCollection('Magic: The Gathering')).toEqual(ALL_SEGMENTS);
    expect(getSegmentsForCollection('Boxing')).toEqual(ALL_SEGMENTS);
  });

  it('falls back to all segments for a collection that is not in the map', () => {
    expect(getSegmentsForCollection('Totally Unknown League')).toEqual(ALL_SEGMENTS);
  });

  it('falls back to all segments when no collection is given', () => {
    expect(getSegmentsForCollection(undefined)).toEqual(ALL_SEGMENTS);
    expect(getSegmentsForCollection('')).toEqual(ALL_SEGMENTS);
    expect(getSegmentsForCollection(null)).toEqual(ALL_SEGMENTS);
  });

  it('every mapped value is an array (config integrity)', () => {
    for (const value of Object.values(COLLECTION_SEGMENT_MAP)) {
      expect(Array.isArray(value)).toBe(true);
    }
  });
});
