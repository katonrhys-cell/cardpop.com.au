import { describe, it, expect } from 'vitest';
import {
  buildPriceLookupQuery,
  identifyCallToAction,
  analysisPhotoCount,
  ANALYSIS_IMAGE_LIMIT,
} from '@/utils/listingFlow.js';

const photo = (name) => new File(['x'], name, { type: 'image/jpeg' });

describe('analysisPhotoCount', () => {
  it('counts the front plus the filled extra slots', () => {
    expect(analysisPhotoCount(photo('front.jpg'), [photo('back.jpg'), null, null])).toBe(2);
  });

  it('ignores empty slots', () => {
    expect(analysisPhotoCount(photo('front.jpg'), [null, null])).toBe(1);
  });

  it('is zero with no front photo', () => {
    // Extras alone are never sent, so counting them would render an Identify
    // button that returns immediately without reading anything.
    expect(analysisPhotoCount(null, [photo('back.jpg')])).toBe(0);
    expect(analysisPhotoCount(null, [])).toBe(0);
  });

  it('caps at the number an identification actually sends', () => {
    const extras = Array.from({ length: 9 }, (_, i) => photo(`extra-${i}.jpg`));
    expect(analysisPhotoCount(photo('front.jpg'), extras)).toBe(ANALYSIS_IMAGE_LIMIT);
  });

  it('tolerates a missing extras array', () => {
    expect(analysisPhotoCount(photo('front.jpg'))).toBe(1);
  });
});

describe('identifyCallToAction', () => {
  it('offers nothing without a photo', () => {
    expect(identifyCallToAction({ photoCount: 0 })).toBeNull();
  });

  it('asks for the back before spending a front-only read', () => {
    // The whole reason identification is manual: this advice has to arrive
    // before the read, not in the results panel afterwards.
    const cta = identifyCallToAction({ photoCount: 1 });
    expect(cta.label).toBe('Identify Card');
    expect(cta.hint).toMatch(/back/i);
    expect(cta.stale).toBe(false);
  });

  it('says how many photos a multi-photo read will use', () => {
    expect(identifyCallToAction({ photoCount: 3 }).label).toBe('Identify Card from 3 photos');
  });

  it('flags a read as stale once more photos are added', () => {
    const cta = identifyCallToAction({ photoCount: 2, analysedImageCount: 1 });
    expect(cta.label).toBe('Identify Again with 2 photos');
    expect(cta.stale).toBe(true);
  });

  it('offers a plain re-run when the photos have not changed', () => {
    const cta = identifyCallToAction({ photoCount: 2, analysedImageCount: 2 });
    expect(cta.label).toBe('Identify Again');
    expect(cta.hint).toBe('Last read used 2 photos.');
    expect(cta.stale).toBe(false);
  });

  it('does not call a removed photo a new one', () => {
    // Fewer photos than the last read is not staleness — nothing was added.
    expect(identifyCallToAction({ photoCount: 1, analysedImageCount: 2 }).stale).toBe(false);
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
