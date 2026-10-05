import { describe, it, expect } from 'vitest';
import {
  SHOP_HOUSE_BRAND, shopBrandName, shopProductIdentifiersLd,
  cardBrandName, cardMpn, cardIdentifiersLd,
} from '@/utils/productIdentifiers.js';

describe('shopBrandName', () => {
  it('uses the brand column when set', () => {
    expect(shopBrandName({ brand: 'Palms Off Gaming' })).toBe('Palms Off Gaming');
  });
  it('falls back to CardPop for house products', () => {
    expect(shopBrandName({ brand: null, sku: 'CP-PENNY-SLEEVES' })).toBe(SHOP_HOUSE_BRAND);
    expect(shopBrandName({ brand: '   ' })).toBe('CardPop');
    expect(shopBrandName(null)).toBe('CardPop');
  });
});

describe('shopProductIdentifiersLd', () => {
  it('emits brand, sku, mpn and a valid gtin', () => {
    expect(shopProductIdentifiersLd({ brand: 'Palms Off Gaming', sku: 'ZB-04-BLK', barcode: '1209202001436' })).toEqual({
      brand: { '@type': 'Brand', name: 'Palms Off Gaming' },
      sku: 'ZB-04-BLK',
      mpn: 'ZB-04-BLK',
      gtin: '1209202001436',
    });
  });
  it('never emits a malformed gtin', () => {
    const ld = shopProductIdentifiersLd({ sku: 'CP-X', barcode: 'abc123' });
    expect(ld.gtin).toBeUndefined();
    expect(shopProductIdentifiersLd({ sku: 'CP-X', barcode: '123' }).gtin).toBeUndefined();
  });
  it('always carries a brand, defaulting to CardPop', () => {
    expect(shopProductIdentifiersLd({})).toEqual({ brand: { '@type': 'Brand', name: 'CardPop' } });
  });
  it('lets catalogue pages override the brand', () => {
    expect(shopProductIdentifiersLd({ sku: 'TOP-04' }, { brand: 'Palms Off Gaming' }).brand.name).toBe('Palms Off Gaming');
  });
});

describe('cardBrandName', () => {
  it('normalises the franchise names the site stores', () => {
    expect(cardBrandName('pokemon')).toBe('Pokémon');
    expect(cardBrandName('Pokémon')).toBe('Pokémon');
    expect(cardBrandName('Basketball (NBA)')).toBe('NBA');
    expect(cardBrandName('one-piece')).toBe('One Piece Card Game');
    expect(cardBrandName('AFL')).toBe('AFL');
    expect(cardBrandName('NRL')).toBe('NRL');
    expect(cardBrandName('Magic: The Gathering')).toBe('Magic: The Gathering');
    expect(cardBrandName('yugioh')).toBe('Yu-Gi-Oh!');
  });
  it('uses the first known name and passes unknown names through', () => {
    expect(cardBrandName('', null, 'pokemon')).toBe('Pokémon');
    expect(cardBrandName('Soccer')).toBe('Soccer');
  });
  it('returns null when nothing is known', () => {
    expect(cardBrandName()).toBeNull();
    expect(cardBrandName('', undefined)).toBeNull();
  });
});

describe('cardMpn / cardIdentifiersLd', () => {
  it('builds the part number from set and card number', () => {
    expect(cardMpn({ setName: 'Base Set', cardNumber: '4/102' })).toBe('Base Set 4/102');
    expect(cardMpn({ cardNumber: '4/102' })).toBe('4/102');
    expect(cardMpn({ setName: 'Base Set' })).toBeNull();
  });
  it('emits brand, sku and mpn for a card', () => {
    expect(cardIdentifiersLd({ brand: 'pokemon', setName: 'Base Set', cardNumber: '4/102' })).toEqual({
      brand: { '@type': 'Brand', name: 'Pokémon' },
      sku: '4/102',
      mpn: 'Base Set 4/102',
    });
  });
  it('omits what it does not know rather than inventing it', () => {
    expect(cardIdentifiersLd({})).toEqual({});
    expect(cardIdentifiersLd({ brand: 'AFL' })).toEqual({ brand: { '@type': 'Brand', name: 'AFL' } });
  });
});
