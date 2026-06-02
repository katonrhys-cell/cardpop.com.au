import { describe, it, expect } from 'vitest';
import { validateCardData } from '@/utils/cardDataValidator.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

// Minimal valid user card listing (has cardNumber property to trigger extra checks)
const USER_CARD = {
  cardName: 'Charizard',
  collectionType: 'Pokemon',
  estimatedValue: 250,
  condition: 'Near Mint',
  cardNumber: '4/102',
  category: 'Vintage',
  brand: 'Wizards of the Coast',
  series: 'Base Set',
};

// Minimal valid official catalog entry
const CATALOG_CARD = {
  name: 'Charizard',
  collectionType: 'Pokemon',
  price: 300,
  condition: 'Near Mint',
};

// ─── common required fields ────────────────────────────────────────────────────

describe('validateCardData — common fields', () => {
  it('returns isValid:true for a complete user card listing', () => {
    const { isValid, errors } = validateCardData(USER_CARD);
    expect(isValid).toBe(true);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns isValid:true for a complete official catalog entry', () => {
    const { isValid } = validateCardData(CATALOG_CARD, true);
    expect(isValid).toBe(true);
  });

  it('errors when both cardName and name are absent', () => {
    const { cardName: _, name: __, ...noName } = USER_CARD;
    const { errors } = validateCardData(noName);
    expect(errors.cardName).toBeTruthy();
  });

  it('accepts name as an alternative to cardName', () => {
    const { cardName: _, ...withName } = USER_CARD;
    const { isValid } = validateCardData({ ...withName, name: 'Charizard' });
    expect(isValid).toBe(true);
  });

  it('errors when cardName is whitespace only', () => {
    const { errors } = validateCardData({ ...USER_CARD, cardName: '   ', name: '   ' });
    expect(errors.cardName).toBeTruthy();
  });

  it('errors when collectionType is absent', () => {
    const { collectionType: _, ...noType } = USER_CARD;
    const { errors } = validateCardData(noType);
    expect(errors.collectionType).toBeTruthy();
  });

  it('errors when condition is absent', () => {
    const { condition: _, ...noCond } = USER_CARD;
    const { errors } = validateCardData(noCond);
    expect(errors.condition).toBeTruthy();
  });
});

// ─── value validation ─────────────────────────────────────────────────────────

describe('validateCardData — value field', () => {
  it('uses estimatedValue for user listings (isOfficialCatalog=false)', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: undefined });
    expect(errors.value).toBeTruthy();
  });

  it('uses price for official catalog entries (isOfficialCatalog=true)', () => {
    const { errors } = validateCardData({ ...CATALOG_CARD, price: undefined }, true);
    expect(errors.value).toBeTruthy();
  });

  it('errors when value is an empty string', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: '' });
    expect(errors.value).toBeTruthy();
  });

  it('errors when value is null', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: null });
    expect(errors.value).toBeTruthy();
  });

  it('errors when value is NaN (non-numeric string)', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: 'abc' });
    expect(errors.value).toBeTruthy();
  });

  it('errors when value is negative', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: -1 });
    expect(errors.value).toBeTruthy();
  });

  it('accepts value of 0', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: 0 });
    expect(errors.value).toBeUndefined();
  });

  it('accepts a numeric string value', () => {
    const { errors } = validateCardData({ ...USER_CARD, estimatedValue: '250' });
    expect(errors.value).toBeUndefined();
  });
});

// ─── user card listing extra fields (triggered by cardNumber presence) ─────────

describe('validateCardData — user card listing extra fields', () => {
  it('errors when cardNumber is empty', () => {
    const { errors } = validateCardData({ ...USER_CARD, cardNumber: '' });
    expect(errors.cardNumber).toBeTruthy();
  });

  it('errors when cardNumber is whitespace only', () => {
    const { errors } = validateCardData({ ...USER_CARD, cardNumber: '   ' });
    expect(errors.cardNumber).toBeTruthy();
  });

  it('errors when category is absent', () => {
    const { errors } = validateCardData({ ...USER_CARD, category: '' });
    expect(errors.category).toBeTruthy();
  });

  it('errors when brand is absent', () => {
    const { errors } = validateCardData({ ...USER_CARD, brand: '' });
    expect(errors.brand).toBeTruthy();
  });

  it('errors when series is absent', () => {
    const { errors } = validateCardData({ ...USER_CARD, series: '' });
    expect(errors.series).toBeTruthy();
  });

  it('does NOT check cardNumber/category/brand/series when cardNumber key is absent', () => {
    // A user card without the cardNumber key should not trigger those extra checks
    const { cardNumber: _, ...noCardNumber } = USER_CARD;
    const { errors } = validateCardData(noCardNumber);
    expect(errors.cardNumber).toBeUndefined();
    expect(errors.category).toBeUndefined();
    expect(errors.brand).toBeUndefined();
    expect(errors.series).toBeUndefined();
  });

  it('does NOT check extra fields in official catalog mode even with cardNumber present', () => {
    const catalogWithExtras = { ...CATALOG_CARD, cardNumber: '4/102', category: '', brand: '', series: '' };
    const { errors } = validateCardData(catalogWithExtras, true);
    expect(errors.cardNumber).toBeUndefined();
    expect(errors.category).toBeUndefined();
  });
});

// ─── error accumulation ───────────────────────────────────────────────────────

describe('validateCardData — error accumulation', () => {
  it('reports all missing fields at once', () => {
    const { isValid, errors } = validateCardData({
      cardName: '',
      cardNumber: '',   // triggers extra checks
      category: '',
      brand: '',
      series: '',
    });
    expect(isValid).toBe(false);
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(5);
  });
});
