import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { transformProductToListing, validateListing } from '../../../src/utils/productTransformer.js';

const BASE_PRODUCT = {
  id: 'prod-1',
  name: 'Charizard Base Set',
  description: 'Holographic Rare',
  price: 250,
  images: ['https://example.com/img.jpg'],
  category: 'Pokemon',
  stock: 1,
  sku: 'CHAR-001',
};

// ─── transformProductToListing ────────────────────────────────────────────────

describe('transformProductToListing', () => {
  it('transforms a valid product into a listing', () => {
    const listing = transformProductToListing(BASE_PRODUCT);
    expect(listing.title).toBe('Charizard Base Set');
    expect(listing.description).toBe('Holographic Rare');
    expect(listing.price).toBe(250);
    expect(listing.images).toEqual(['https://example.com/img.jpg']);
    expect(listing.category).toBe('Pokemon');
    expect(listing.quantity).toBe(1);
    expect(listing.sku).toBe('CHAR-001');
    expect(listing.sourceProductId).toBe('prod-1');
    expect(listing.sourceIntegration).toBe('online-store');
  });

  it('trims whitespace from name into title', () => {
    const listing = transformProductToListing({ ...BASE_PRODUCT, name: '  Charizard  ' });
    expect(listing.title).toBe('Charizard');
  });

  it('parses a string price to a float', () => {
    const listing = transformProductToListing({ ...BASE_PRODUCT, price: '99.99' });
    expect(listing.price).toBe(99.99);
  });

  it('prefers stock over quantity when both are present', () => {
    const listing = transformProductToListing({ ...BASE_PRODUCT, stock: 5, quantity: 99 });
    expect(listing.quantity).toBe(5);
  });

  it('falls back to quantity when stock is absent', () => {
    const { stock: _, ...noStock } = BASE_PRODUCT;
    const listing = transformProductToListing({ ...noStock, quantity: 3 });
    expect(listing.quantity).toBe(3);
  });

  it('defaults quantity to 0 when neither stock nor quantity is present', () => {
    const { stock: _, ...noStock } = BASE_PRODUCT;
    const listing = transformProductToListing(noStock);
    expect(listing.quantity).toBe(0);
  });

  it('falls back to product id for sku when sku is absent', () => {
    const { sku: _, ...noSku } = BASE_PRODUCT;
    const listing = transformProductToListing(noSku);
    expect(listing.sku).toBe('prod-1');
  });

  it('defaults category to "Uncategorized" when absent', () => {
    const { category: _, ...noCat } = BASE_PRODUCT;
    const listing = transformProductToListing(noCat);
    expect(listing.category).toBe('Uncategorized');
  });

  it('defaults description to empty string when absent', () => {
    const { description: _, ...noDesc } = BASE_PRODUCT;
    const listing = transformProductToListing(noDesc);
    expect(listing.description).toBe('');
  });

  it('defaults images to empty array when images is not an array', () => {
    const listing = transformProductToListing({ ...BASE_PRODUCT, images: null });
    expect(listing.images).toEqual([]);
  });

  it('includes a createdAt ISO timestamp', () => {
    const listing = transformProductToListing(BASE_PRODUCT);
    expect(listing.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ── throws ───────────────────────────────────────────────────────────────────

  it('throws when product is null', () => {
    expect(() => transformProductToListing(null)).toThrow('Product object is required');
  });

  it('throws when product is undefined', () => {
    expect(() => transformProductToListing(undefined)).toThrow('Product object is required');
  });

  it('throws when name is missing', () => {
    const { name: _, ...noName } = BASE_PRODUCT;
    expect(() => transformProductToListing(noName)).toThrow('Product name is required');
  });

  it('throws when name is whitespace only', () => {
    expect(() => transformProductToListing({ ...BASE_PRODUCT, name: '   ' })).toThrow('Product name is required');
  });

  it('throws when price is undefined', () => {
    const { price: _, ...noPrice } = BASE_PRODUCT;
    expect(() => transformProductToListing(noPrice)).toThrow('Product price is required');
  });

  it('throws when price is null', () => {
    expect(() => transformProductToListing({ ...BASE_PRODUCT, price: null })).toThrow('Product price is required');
  });

  it('throws when price is negative', () => {
    expect(() => transformProductToListing({ ...BASE_PRODUCT, price: -5 })).toThrow('Listing price cannot be negative');
  });

  it('throws when quantity resolves to negative', () => {
    expect(() => transformProductToListing({ ...BASE_PRODUCT, stock: -1 })).toThrow('Listing quantity cannot be negative');
  });
});

// ─── validateListing ──────────────────────────────────────────────────────────

const VALID_LISTING = {
  title: 'Charizard Base Set',
  price: 250,
  quantity: 1,
  category: 'Pokemon',
};

describe('validateListing', () => {
  it('returns isValid:true with no errors for a valid listing', () => {
    const result = validateListing(VALID_LISTING);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when title is missing', () => {
    const result = validateListing({ ...VALID_LISTING, title: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title is required');
  });

  it('errors when title is whitespace only', () => {
    const result = validateListing({ ...VALID_LISTING, title: '   ' });
    expect(result.errors).toContain('Title is required');
  });

  it('errors when price is missing', () => {
    const { price: _, ...noPrice } = VALID_LISTING;
    const result = validateListing(noPrice);
    expect(result.errors).toContain('Price is required');
  });

  it('errors when price is a string (wrong type)', () => {
    const result = validateListing({ ...VALID_LISTING, price: '250' });
    expect(result.errors).toContain('Price must be a non-negative number');
  });

  it('errors when price is negative', () => {
    const result = validateListing({ ...VALID_LISTING, price: -1 });
    expect(result.errors).toContain('Price must be a non-negative number');
  });

  it('accepts price of 0', () => {
    const result = validateListing({ ...VALID_LISTING, price: 0 });
    expect(result.isValid).toBe(true);
  });

  it('errors when quantity is missing', () => {
    const { quantity: _, ...noQty } = VALID_LISTING;
    const result = validateListing(noQty);
    expect(result.errors).toContain('Quantity is required');
  });

  it('errors when quantity is negative', () => {
    const result = validateListing({ ...VALID_LISTING, quantity: -1 });
    expect(result.errors).toContain('Quantity must be a non-negative number');
  });

  it('accepts quantity of 0', () => {
    const result = validateListing({ ...VALID_LISTING, quantity: 0 });
    expect(result.isValid).toBe(true);
  });

  it('errors when category is missing', () => {
    const { category: _, ...noCat } = VALID_LISTING;
    const result = validateListing(noCat);
    expect(result.errors).toContain('Category is required');
  });

  it('errors when category is whitespace only', () => {
    const result = validateListing({ ...VALID_LISTING, category: '   ' });
    expect(result.errors).toContain('Category is required');
  });

  it('accumulates multiple errors at once', () => {
    const result = validateListing({ title: '', price: -1, quantity: -1, category: '' });
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.isValid).toBe(false);
  });
});
