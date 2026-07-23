import { describe, it, expect } from 'vitest';
import { shouldAutoIdentify, buildPriceLookupQuery } from '@/utils/listingFlow.js';

const base = { isEdit: false, cardName: '', isScanning: false, isIdentifying: false };

describe('shouldAutoIdentify', () => {
  it('runs for a fresh photo on a new card', () => {
    expect(shouldAutoIdentify(base)).toBe(true);
  });

  it('never runs in edit mode', () => {
    expect(shouldAutoIdentify({ ...base, isEdit: true })).toBe(false);
  });

  it('never overwrites an already-filled card name', () => {
    expect(shouldAutoIdentify({ ...base, cardName: 'Charizard' })).toBe(false);
  });

  it('treats a whitespace-only card name as empty', () => {
    expect(shouldAutoIdentify({ ...base, cardName: '   ' })).toBe(true);
  });

  it('does not stack runs while an analysis is in flight', () => {
    expect(shouldAutoIdentify({ ...base, isScanning: true })).toBe(false);
    expect(shouldAutoIdentify({ ...base, isIdentifying: true })).toBe(false);
  });

  it('handles a missing card name safely', () => {
    expect(shouldAutoIdentify({ ...base, cardName: undefined })).toBe(true);
  });
});

describe('buildPriceLookupQuery', () => {
  it('requires a card name', () => {
    expect(buildPriceLookupQuery({ cardName: '' })).toBeNull();
    expect(buildPriceLookupQuery({ cardName: '   ' })).toBeNull();
    expect(buildPriceLookupQuery(null)).toBeNull();
  });

  it('builds a full query from typed fields', () => {
    expect(
      buildPriceLookupQuery({
        cardName: ' Charizard ',
        setName: 'Base Set',
        gradingCompany: 'psa',
        grade: '10',
      })
    ).toEqual({
      name: 'Charizard',
      cardSetName: 'Base Set',
      gradingService: 'PSA',
      gradeScore: '10',
    });
  });

  it('omits grading terms for raw and unrecognised services', () => {
    expect(buildPriceLookupQuery({ cardName: 'Pikachu', gradingCompany: 'raw' }).gradingService).toBe('None');
    expect(buildPriceLookupQuery({ cardName: 'Pikachu', gradingCompany: 'other' }).gradingService).toBe('None');
  });

  it('leaves optional fields undefined when blank', () => {
    const query = buildPriceLookupQuery({ cardName: 'Pikachu', setName: '  ', grade: '' });
    expect(query.cardSetName).toBeUndefined();
    expect(query.gradeScore).toBeUndefined();
  });
});
