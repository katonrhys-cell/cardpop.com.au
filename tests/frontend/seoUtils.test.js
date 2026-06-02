import { describe, it, expect } from 'vitest';
import {
  generateMetaTitle,
  generateMetaDescription,
  generateStructuredData,
  generateSitemap,
} from '@/utils/seoUtils.js';

// ─── generateMetaTitle ────────────────────────────────────────────────────────

describe('generateMetaTitle', () => {
  it('returns the default title when called with no arguments', () => {
    expect(generateMetaTitle()).toBe('Shop Trading Cards & Collectibles | CardPop');
  });

  it('uses itemName when provided, ignoring all other args', () => {
    expect(
      generateMetaTitle(
        { name: 'Pokemon' },
        { name: 'Vintage' },
        { name: 'Holographic' },
        'Charizard Base Set',
      ),
    ).toBe('Charizard Base Set | Buy & Sell CardPop');
  });

  it('builds a title from category alone', () => {
    expect(generateMetaTitle({ name: 'Pokemon' })).toBe('Pokemon | CardPop');
  });

  it('builds a title from category and subcategory', () => {
    expect(generateMetaTitle({ name: 'Pokemon' }, { name: 'Vintage' })).toBe(
      'Vintage - Pokemon | CardPop',
    );
  });

  it('builds a title from all three taxonomy levels in productType - subcategory - category order', () => {
    expect(
      generateMetaTitle({ name: 'Pokemon' }, { name: 'Vintage' }, { name: 'Holographic' }),
    ).toBe('Holographic - Vintage - Pokemon | CardPop');
  });

  it('falls back to default when only null/undefined args are passed', () => {
    expect(generateMetaTitle(null, null, null, null)).toBe(
      'Shop Trading Cards & Collectibles | CardPop',
    );
  });

  it('uses subcategory and productType without a category', () => {
    expect(generateMetaTitle(null, { name: 'Vintage' }, { name: 'Holo' })).toBe(
      'Holo - Vintage | CardPop',
    );
  });

  it('uses productType alone without subcategory or category', () => {
    expect(generateMetaTitle(null, null, { name: 'Holographic' })).toBe('Holographic | CardPop');
  });
});

// ─── generateMetaDescription ──────────────────────────────────────────────────

describe('generateMetaDescription', () => {
  it('uses "Trading Cards & Collectibles" when category is null', () => {
    const desc = generateMetaDescription(null);
    expect(desc).toContain('Trading Cards & Collectibles');
  });

  it('uses the category name when provided', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' });
    expect(desc).toContain('Pokemon');
  });

  it('uses "a wide selection of" when itemCount is 0', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 0);
    expect(desc).toContain('a wide selection of');
    expect(desc).not.toMatch(/\d+\+/);
  });

  it('uses "a wide selection of" when itemCount is omitted', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' });
    expect(desc).toContain('a wide selection of');
  });

  it('shows the item count with a + suffix when itemCount > 0', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 150);
    expect(desc).toContain('150+');
  });

  it('includes the price range when both min and max are set', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 50, { min: 5, max: 500 });
    expect(desc).toContain('$5');
    expect(desc).toContain('$500');
  });

  it('omits the price range when min is null', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 50, { min: null, max: 500 });
    expect(desc).not.toContain('Prices ranging');
  });

  it('omits the price range when max is null', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 50, { min: 5, max: null });
    expect(desc).not.toContain('Prices ranging');
  });

  it('omits the price range when priceRange is null', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 50, null);
    expect(desc).not.toContain('Prices ranging');
  });

  it('always ends with the marketplace trust statement', () => {
    const desc = generateMetaDescription({ name: 'Pokemon' }, 10, { min: 1, max: 100 });
    expect(desc).toContain('Buy, sell, and trade securely in our verified marketplace.');
  });
});

// ─── generateStructuredData ───────────────────────────────────────────────────

describe('generateStructuredData', () => {
  it('returns null when product is null', () => {
    expect(generateStructuredData(null)).toBeNull();
  });

  it('uses product.title as the schema name', () => {
    const data = generateStructuredData({ title: 'Charizard', price: 250, condition: 'Near Mint' });
    expect(data.name).toBe('Charizard');
  });

  it('falls back to cardName when title is absent', () => {
    const data = generateStructuredData({ cardName: 'Pikachu', price: 50, condition: 'Good' });
    expect(data.name).toBe('Pikachu');
  });

  it('maps product images to their url property', () => {
    const data = generateStructuredData({
      title: 'Card',
      price: 10,
      condition: 'Near Mint',
      images: [{ url: 'https://cdn.example.com/a.jpg' }, { url: 'https://cdn.example.com/b.jpg' }],
    });
    expect(data.image).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('returns an empty image array when images is absent', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Near Mint' });
    expect(data.image).toEqual([]);
  });

  it('uses product.price for the offer price', () => {
    const data = generateStructuredData({ title: 'Card', price: 99.99, condition: 'Near Mint' });
    expect(data.offers.price).toBe(99.99);
  });

  it('falls back to askingPrice when price is absent', () => {
    const data = generateStructuredData({ title: 'Card', askingPrice: 75, condition: 'Good' });
    expect(data.offers.price).toBe(75);
  });

  it('falls back to estimatedValue when both price and askingPrice are absent', () => {
    const data = generateStructuredData({ title: 'Card', estimatedValue: 40, condition: 'Fair' });
    expect(data.offers.price).toBe(40);
  });

  it('formats condition by removing spaces and appending Condition', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Near Mint' });
    expect(data.offers.itemCondition).toBe('https://schema.org/NearMintCondition');
  });

  it('defaults to UsedCondition when condition is absent', () => {
    const data = generateStructuredData({ title: 'Card', price: 10 });
    expect(data.offers.itemCondition).toBe('https://schema.org/UsedCondition');
  });

  it('defaults currency to USD', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Good' });
    expect(data.offers.priceCurrency).toBe('USD');
  });

  it('uses product currency when provided', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Good', currency: 'AUD' });
    expect(data.offers.priceCurrency).toBe('AUD');
  });

  it('uses product.sku for the schema sku field', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Good', sku: 'CHAR-001' });
    expect(data.sku).toBe('CHAR-001');
  });

  it('falls back to product.id for sku when sku is absent', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Good', id: 'prod-42' });
    expect(data.sku).toBe('prod-42');
  });

  it('sets the correct @context and @type', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Good' });
    expect(data['@context']).toBe('https://schema.org/');
    expect(data['@type']).toBe('Product');
  });

  it('sets seller name to "CardPop Marketplace"', () => {
    const data = generateStructuredData({ title: 'Card', price: 10, condition: 'Good' });
    expect(data.offers.seller.name).toBe('CardPop Marketplace');
  });
});

// ─── generateSitemap ──────────────────────────────────────────────────────────

describe('generateSitemap', () => {
  it('returns a string starting with an XML declaration', () => {
    const xml = generateSitemap([], []);
    expect(xml).toMatch(/^<\?xml version="1\.0"/);
  });

  it('includes the homepage URL', () => {
    const xml = generateSitemap([], []);
    expect(xml).toContain('<loc>https://cardpop.example.com/</loc>');
  });

  it('includes static routes for /vault and /shop', () => {
    const xml = generateSitemap([], []);
    expect(xml).toContain('/vault');
    expect(xml).toContain('/shop');
  });

  it('includes listing URLs with their IDs', () => {
    const listings = [
      { id: 'listing-1', updated: new Date().toISOString() },
      { id: 'listing-2', updated: new Date().toISOString() },
    ];
    const xml = generateSitemap(listings, []);
    expect(xml).toContain('/vault/listing/listing-1');
    expect(xml).toContain('/vault/listing/listing-2');
  });

  it('includes product URLs with their IDs', () => {
    const products = [{ id: 'prod-99', updated: new Date().toISOString() }];
    const xml = generateSitemap([], products);
    expect(xml).toContain('/shop/product/prod-99');
  });

  it('handles undefined listings gracefully', () => {
    expect(() => generateSitemap(undefined, [])).not.toThrow();
  });

  it('handles undefined products gracefully', () => {
    expect(() => generateSitemap([], undefined)).not.toThrow();
  });

  it('closes the urlset element', () => {
    const xml = generateSitemap([], []);
    expect(xml).toContain('</urlset>');
  });
});
