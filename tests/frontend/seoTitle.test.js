import { describe, it, expect } from 'vitest';
import { brandedTitle, SEO_TITLE_MAX, SHORT_BRAND_SUFFIXES } from '@/utils/seoTitle.js';
import { PALMS_OFF_PRODUCTS } from '@/data/palmsOffCatalogue.js';
import { BINDER_PRODUCTS } from '@/data/shopBinderProducts.js';
import { SHOP_COLLECTION_SEO } from '@/data/shopCollectionSeo.js';

describe('brandedTitle', () => {
  it('adds the full brand when it fits', () => {
    expect(brandedTitle('Palms Off Gaming Top Loaders 35pt')).toBe('Palms Off Gaming Top Loaders 35pt | CardPop Australia');
  });

  it('falls back to the short brand, then to the bare name', () => {
    expect(brandedTitle('Palms Off Gaming Booster Pack Top Loaders')).toBe('Palms Off Gaming Booster Pack Top Loaders | CardPop');
    const long = 'Palms Off Gaming Premium Over Sleeves — Japanese Mini, Clear';
    expect(brandedTitle(long)).toBe(long);
  });

  it('never shortens the name itself', () => {
    const tooLong = 'x'.repeat(SEO_TITLE_MAX + 5);
    expect(brandedTitle(tooLong)).toBe(tooLong);
  });

  it('honours a custom suffix list', () => {
    expect(brandedTitle('Charizard', { suffixes: SHORT_BRAND_SUFFIXES })).toBe('Charizard | CardPop');
  });

  it('has a fallback for an empty name', () => {
    expect(brandedTitle('')).toBe('CardPop | CardPop Australia');
  });
});

// The site audit flagged these pages for titles past ~60 characters, which
// Google cuts off — usually right where the colour/size/finish is.
describe('static shop titles fit a search result', () => {
  it.each(PALMS_OFF_PRODUCTS.map((p) => [p.sku, p]))('Palms Off product %s', (_sku, p) => {
    expect(brandedTitle(p.seoName || p.title).length).toBeLessThanOrEqual(SEO_TITLE_MAX);
  });

  it.each(BINDER_PRODUCTS.map((p) => [p.slug, p]))('binder %s', (_slug, p) => {
    expect(p.metaTitle.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
  });

  it.each(Object.values(SHOP_COLLECTION_SEO).map((c) => [c.slug, c]))('supply collection %s', (_slug, c) => {
    expect(c.title.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
  });
});
