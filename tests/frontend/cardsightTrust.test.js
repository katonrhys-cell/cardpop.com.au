import { describe, it, expect } from 'vitest';
import {
  namesConflict,
  cardSightDisagreements,
  assessCardSightMatch,
} from '@/utils/cardsightTrust.js';

// A clean exact hit, as the identify route returns it.
const exactHit = (card, overrides = {}) => ({
  identified: true,
  exactMatch: true,
  ambiguous: false,
  confidence: 'High',
  confidenceScore: 0.95,
  card,
  ...overrides,
});

describe('namesConflict', () => {
  it('flags two different players as a conflict', () => {
    expect(namesConflict('Jalen Brunson', 'Stephen Curry')).toBe(true);
  });

  it('treats containment as agreement — a variant suffix is the same card identity', () => {
    expect(namesConflict('Pikachu', 'Pikachu VMAX')).toBe(false);
    expect(namesConflict('Pikachu VMAX', 'Pikachu')).toBe(false);
  });

  it('ignores case, accents and punctuation', () => {
    expect(namesConflict("Farfetch'd", 'Farfetchd')).toBe(false);
    expect(namesConflict('POKÉMON', 'pokemon')).toBe(false);
  });

  it('never conflicts when either side is missing — unknown is not a disagreement', () => {
    expect(namesConflict('', 'Stephen Curry')).toBe(false);
    expect(namesConflict('Jalen Brunson', null)).toBe(false);
    expect(namesConflict(undefined, undefined)).toBe(false);
  });
});

describe('cardSightDisagreements', () => {
  it('reports name and number disagreements independently', () => {
    expect(cardSightDisagreements(
      { name: 'Jalen Brunson', cardNumber: 'HS-11' },
      { name: 'Stephen Curry', cardNumber: 'HS-2' },
    )).toEqual(['name', 'number']);

    expect(cardSightDisagreements(
      { name: 'Stephen Curry', cardNumber: 'HS-11' },
      { name: 'Stephen Curry', cardNumber: 'HS-2' },
    )).toEqual(['number']);
  });

  it('reads the raw SDK `number` field as well as the mapped `cardNumber`', () => {
    expect(cardSightDisagreements(
      { name: 'Jalen Brunson', cardNumber: 'HS-11' },
      { name: 'Jalen Brunson', number: 'HS-2' },
    )).toEqual(['number']);
  });

  it('a number OCR could not read is unknown, not a conflict', () => {
    expect(cardSightDisagreements(
      { name: 'Jalen Brunson', cardNumber: '' },
      { name: 'Jalen Brunson', cardNumber: 'HS-11' },
    )).toEqual([]);
  });

  it('is empty without an OCR read to disagree with', () => {
    expect(cardSightDisagreements(null, { name: 'Stephen Curry' })).toEqual([]);
    expect(cardSightDisagreements({ name: 'Jalen Brunson' }, null)).toEqual([]);
  });
});

describe('assessCardSightMatch', () => {
  const ocr = { name: 'Jalen Brunson', cardNumber: 'HS-11' };

  it('trusts a clean exact hit that agrees with the OCR read', () => {
    const res = assessCardSightMatch(exactHit({ name: 'Jalen Brunson', cardNumber: 'HS-11' }), ocr);
    expect(res).toEqual({ trustworthy: true, disagreements: [] });
  });

  // The regression this module exists for: a template-styled insert set where
  // CardSight, seeing only the front, returned the wrong player in the right
  // set as an exact High-confidence hit — and overwrote the correctly-read name.
  it('demotes an exact hit that names a different card than was read off the photo', () => {
    const res = assessCardSightMatch(exactHit({ name: 'Stephen Curry', cardNumber: 'HS-2' }), ocr);
    expect(res.trustworthy).toBe(false);
    expect(res.disagreements).toEqual(['name', 'number']);
  });

  it('demotes on a positively disagreeing number even when the name agrees', () => {
    const res = assessCardSightMatch(exactHit({ name: 'Jalen Brunson', cardNumber: 'HS-2' }), ocr);
    expect(res.trustworthy).toBe(false);
    expect(res.disagreements).toEqual(['number']);
  });

  it('still trusts an exact hit when OCR read nothing to check it against', () => {
    const res = assessCardSightMatch(exactHit({ name: 'Stephen Curry', cardNumber: 'HS-2' }), null);
    expect(res).toEqual({ trustworthy: true, disagreements: [] });
  });

  it('keeps the existing gates: set-level, ambiguous and low-confidence hits stay untrusted', () => {
    const card = { name: 'Jalen Brunson', cardNumber: 'HS-11' };
    expect(assessCardSightMatch(exactHit(card, { exactMatch: false }), ocr).trustworthy).toBe(false);
    expect(assessCardSightMatch(exactHit(card, { ambiguous: true }), ocr).trustworthy).toBe(false);
    expect(assessCardSightMatch(
      exactHit(card, { confidence: 'Low', confidenceScore: 0.62 }), ocr,
    ).trustworthy).toBe(false);
    expect(assessCardSightMatch(null, ocr).trustworthy).toBe(false);
  });

  it('works on the scoring-harness shape (enum confidence, raw `number` field)', () => {
    const harness = {
      card: { name: 'Stephen Curry', number: 'HS-2' },
      confidence: 'High',
      exactMatch: true,
      ambiguous: false,
    };
    const res = assessCardSightMatch(harness, ocr);
    expect(res.trustworthy).toBe(false);
    expect(res.disagreements).toEqual(['name', 'number']);
  });
});
