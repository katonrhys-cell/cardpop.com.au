import { describe, it, expect } from 'vitest';
import {
  getSegmentsForCollection,
  isSupportedByCardSight,
  COLLECTION_SEGMENT_MAP,
  ALL_SEGMENTS,
} from '../../../src/utils/collectionSegmentMap.js';

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

  it('matches the display names the listing form writes back after an identify', () => {
    // mapCardSightToFormFields stores "NBA Basketball" / "NFL Football" into
    // `collection`; a re-scan must still narrow to one segment rather than
    // silently falling through to the all-segment fan-out.
    expect(getSegmentsForCollection('NBA Basketball')).toEqual(['basketball']);
    expect(getSegmentsForCollection('NFL Football')).toEqual(['football']);
    expect(getSegmentsForCollection('MLB Baseball')).toEqual(['baseball']);
  });

  it('ignores case, accents and punctuation', () => {
    expect(getSegmentsForCollection('pokemon')).toEqual(['pokemon']);
    expect(getSegmentsForCollection('POKÉMON')).toEqual(['pokemon']);
    expect(getSegmentsForCollection('  Pokémon  ')).toEqual(['pokemon']);
    expect(getSegmentsForCollection('yu-gi-oh!')).toEqual([]);
  });

  it('returns no segments for a collection CardSight has no catalog for', () => {
    // Searching anyway can only return a card from the wrong hobby: every
    // segment answers with its best guess within that segment.
    for (const collection of [
      'Magic: The Gathering', 'Yu-Gi-Oh', 'One Piece', 'Disney Lorcana',
      'Boxing', 'AFL', 'NRL', 'Formula 1', 'Rugby Union',
    ]) {
      expect(getSegmentsForCollection(collection)).toEqual([]);
      expect(isSupportedByCardSight(collection)).toBe(false);
    }
  });

  it('falls back to all segments for a collection that is not in the map', () => {
    expect(getSegmentsForCollection('Totally Unknown League')).toEqual(ALL_SEGMENTS);
  });

  it('falls back to all segments when no collection is given', () => {
    expect(getSegmentsForCollection(undefined)).toEqual(ALL_SEGMENTS);
    expect(getSegmentsForCollection('')).toEqual(ALL_SEGMENTS);
    expect(getSegmentsForCollection(null)).toEqual(ALL_SEGMENTS);
  });

  it('every mapped value is an array of known segments (config integrity)', () => {
    for (const value of Object.values(COLLECTION_SEGMENT_MAP)) {
      expect(Array.isArray(value)).toBe(true);
      for (const segment of value) expect(ALL_SEGMENTS).toContain(segment);
    }
  });
});

describe('isSupportedByCardSight', () => {
  it('is true for covered collections', () => {
    expect(isSupportedByCardSight('Pokemon')).toBe(true);
    expect(isSupportedByCardSight('NHL')).toBe(true);
  });

  it('is true for unknown names, where the fan-out is still worth trying', () => {
    expect(isSupportedByCardSight('Totally Unknown League')).toBe(true);
    expect(isSupportedByCardSight('')).toBe(true);
  });
});
