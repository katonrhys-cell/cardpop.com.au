import { describe, it, expect } from 'vitest';
import { validateListingForm, validateListingField } from '@/utils/listingValidation.js';

const currentYear = new Date().getFullYear();

const validForm = {
  cardName: 'Charizard',
  estimatedValue: '100',
  year: '',
  listingType: 'private',
  askingPrice: '',
  offerMin: '',
  offerMax: '',
  tradeValue: '',
};

const validCtx = {
  isEdit: false,
  lockedBaseValue: null,
  selCategoryId: 'cat1',
  franchiseId: 'fr1',
  hasImage: true,
  requireImage: true,
};

describe('validateListingForm', () => {
  it('returns no errors for a valid new card', () => {
    expect(validateListingForm(validForm, validCtx)).toEqual({});
  });

  it('surfaces field, image and hierarchy problems in one pass', () => {
    const errors = validateListingForm(
      { ...validForm, cardName: '', estimatedValue: '' },
      { ...validCtx, hasImage: false, franchiseId: '' }
    );
    expect(Object.keys(errors).sort()).toEqual(['cardImage', 'cardName', 'estimatedValue', 'hierarchy']);
  });
});

describe('field rules', () => {
  it('requires a card name', () => {
    expect(validateListingField('cardName', { cardName: '  ' })).toMatch(/required/);
    expect(validateListingField('cardName', { cardName: 'Pikachu' })).toBeNull();
  });

  it('requires a valid estimated value', () => {
    expect(validateListingField('estimatedValue', { estimatedValue: '' }, validCtx)).toMatch(/valid/);
    expect(validateListingField('estimatedValue', { estimatedValue: '-5' }, validCtx)).toMatch(/valid/);
    expect(validateListingField('estimatedValue', { estimatedValue: '10' }, validCtx)).toBeNull();
  });

  it('enforces the locked base value floor on edit only', () => {
    const ctx = { ...validCtx, isEdit: true, lockedBaseValue: 50 };
    expect(validateListingField('estimatedValue', { estimatedValue: '40' }, ctx)).toMatch(/locked base value of \$50\.00/);
    expect(validateListingField('estimatedValue', { estimatedValue: '60' }, ctx)).toBeNull();
    expect(validateListingField('estimatedValue', { estimatedValue: '40' }, { ...validCtx, lockedBaseValue: 50 })).toBeNull();
  });

  it('validates year formats', () => {
    expect(validateListingField('year', { year: '' })).toBeNull();
    expect(validateListingField('year', { year: String(currentYear) })).toBeNull();
    expect(validateListingField('year', { year: `${currentYear}/${currentYear + 1}` })).toBeNull();
    expect(validateListingField('year', { year: 'abcd' })).toMatch(/single year/);
    expect(validateListingField('year', { year: '1850' })).toMatch(/between 1900/);
    expect(validateListingField('year', { year: String(currentYear + 2) })).toMatch(/between 1900/);
    expect(validateListingField('year', { year: `${currentYear}/${currentYear + 2}` })).toMatch(/consecutive/);
  });

  it('requires an asking price only for sale listing types', () => {
    expect(validateListingField('askingPrice', { listingType: 'For Sale', askingPrice: '' })).toMatch(/asking price/);
    expect(validateListingField('askingPrice', { listingType: 'For Sale & Trade', askingPrice: '0' })).toMatch(/asking price/);
    expect(validateListingField('askingPrice', { listingType: 'For Sale', askingPrice: '25' })).toBeNull();
    expect(validateListingField('askingPrice', { listingType: 'private', askingPrice: '' })).toBeNull();
    expect(validateListingField('askingPrice', { listingType: 'For Trade', askingPrice: '' })).toBeNull();
  });

  it('requires a sensible offer range for Expression of Interest', () => {
    const eoi = { listingType: 'Expression of Interest' };
    expect(validateListingField('offerMin', { ...eoi, offerMin: '' })).toMatch(/minimum/);
    expect(validateListingField('offerMax', { ...eoi, offerMin: '10', offerMax: '' })).toMatch(/maximum/);
    expect(validateListingField('offerMax', { ...eoi, offerMin: '10', offerMax: '5' })).toMatch(/at least the minimum/);
    expect(validateListingField('offerMin', { ...eoi, offerMin: '10' })).toBeNull();
    expect(validateListingField('offerMax', { ...eoi, offerMin: '10', offerMax: '20' })).toBeNull();
    expect(validateListingField('offerMin', { listingType: 'private', offerMin: '' })).toBeNull();
  });

  it('enforces the trade value floor on edit only', () => {
    const ctx = { ...validCtx, isEdit: true, lockedBaseValue: 50 };
    expect(validateListingField('tradeValue', { tradeValue: '40' }, ctx)).toMatch(/locked base value/);
    expect(validateListingField('tradeValue', { tradeValue: '60' }, ctx)).toBeNull();
    expect(validateListingField('tradeValue', { tradeValue: '' }, ctx)).toBeNull();
    expect(validateListingField('tradeValue', { tradeValue: '40' }, validCtx)).toBeNull();
  });

  it('requires both hierarchy levels', () => {
    expect(validateListingField('hierarchy', {}, { ...validCtx, selCategoryId: '' })).toMatch(/Category and a Franchise/);
    expect(validateListingField('hierarchy', {}, { ...validCtx, franchiseId: '' })).toMatch(/Category and a Franchise/);
    expect(validateListingField('hierarchy', {}, validCtx)).toBeNull();
  });

  it('requires a photo only when the context demands one', () => {
    expect(validateListingField('cardImage', {}, { requireImage: true, hasImage: false })).toMatch(/photo/);
    expect(validateListingField('cardImage', {}, { requireImage: true, hasImage: true })).toBeNull();
    expect(validateListingField('cardImage', {}, { requireImage: false, hasImage: false })).toBeNull();
  });

  it('returns null for unknown fields and missing form data', () => {
    expect(validateListingField('nope', validForm, validCtx)).toBeNull();
    expect(validateListingField('cardName', null)).toMatch(/required/);
  });
});
