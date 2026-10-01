import { describe, it, expect } from 'vitest';
import { PALMS_OFF_PRODUCTS, palmsOffSpecs } from '@/data/palmsOffCatalogue.js';
import { BINDER_PRODUCTS, binderSpecs } from '@/data/shopBinderProducts.js';

// Product pages were flagged by AdSense as "low value content". These guard
// the long-form copy against regressing to thin or duplicated text.
const words = (text) => String(text).trim().split(/\s+/).length;
const BANNED = /\b(elevate|unleash|game-changer|seamless|look no further|dive into)\b/i;

describe('Palms Off Gaming product copy', () => {
  it.each(PALMS_OFF_PRODUCTS.map((p) => [p.sku, p]))('%s has substantial, original copy', (_sku, product) => {
    expect(product.metaDescription.length).toBeLessThanOrEqual(160);
    expect(product.details?.length).toBeGreaterThanOrEqual(2);
    expect(words([product.intro, ...product.details].join(' '))).toBeGreaterThanOrEqual(200);
    expect([product.intro, ...product.details].join(' ')).not.toMatch(BANNED);
    const labels = palmsOffSpecs(product).map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('never repeats a paragraph across products', () => {
    const paragraphs = PALMS_OFF_PRODUCTS.flatMap((p) => [p.intro, ...p.details]);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
  });
});

describe('Palms Off Gaming binder copy', () => {
  it.each(BINDER_PRODUCTS.map((p) => [p.sku, p]))('%s has an About section', (_sku, product) => {
    expect(words(product.details?.join(' ') ?? '')).toBeGreaterThanOrEqual(150);
    const labels = binderSpecs(product).map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
