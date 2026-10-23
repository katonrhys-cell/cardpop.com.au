import { describe, it, expect } from 'vitest';
import { shopFeedRow, cardFeedRow, toTsv, preorderAvailabilityDate, FEED_COLUMNS } from '../../utils/merchantFeed.js';

const shop = (over = {}) => ({
  id: 'p1', title: '9-Pocket Zip Binder', slug: '9-pocket-zip-binder', sku: 'CP-9-POCKET-ZIP-BINDER',
  brand: '', barcode: '', category: 'Binders', description: '<p>A binder.</p>', price_aud: 29.9,
  stock_quantity: 4, images: ['https://cdn.test/a.png', 'https://cdn.test/b.png'], status: 'active', ...over,
});

describe('shopFeedRow', () => {
  it('builds an in-stock house product', () => {
    const row = shopFeedRow(shop());
    expect(row).toMatchObject({
      id: 'CP-9-POCKET-ZIP-BINDER', price: '29.90 AUD', availability: 'in_stock', condition: 'new',
      brand: 'CardPop', mpn: 'CP-9-POCKET-ZIP-BINDER', identifier_exists: 'yes',
      link: 'https://cardpop.com.au/shop/binders/9-pocket-zip-binder', description: 'A binder.',
      additional_image_link: 'https://cdn.test/b.png',
    });
  });

  it('marks zero stock out_of_stock and only emits a well-formed GTIN', () => {
    expect(shopFeedRow(shop({ stock_quantity: 0 })).availability).toBe('out_of_stock');
    expect(shopFeedRow(shop({ barcode: '123' })).gtin).toBe('');
    expect(shopFeedRow(shop({ barcode: '9421903491020' })).gtin).toBe('9421903491020');
  });

  it('lists a pre-order with its date regardless of stock', () => {
    const row = shopFeedRow(shop({ status: 'preorder', stock_quantity: 0, preorder_eta: 'December 2026' }));
    expect(row.availability).toBe('preorder');
    expect(row.availability_date).toBe('2026-12-01T00:00+1100');
  });

  it('leaves out a pre-order whose estimate names no month, and unsellable rows', () => {
    expect(shopFeedRow(shop({ status: 'preorder', preorder_eta: 'Ships when stock arrives' }))).toBeNull();
    expect(shopFeedRow(shop({ price_aud: 0 }))).toBeNull();
    expect(shopFeedRow(shop({ images: [], image_url: null }))).toBeNull();
    expect(shopFeedRow(shop({ sku: '' }))).toBeNull();
  });

  it('groups colour siblings', () => {
    const row = shopFeedRow(shop({ family_sku: 'PO-BINDER', colour: 'Blue', slug: 'x-blue' }));
    expect(row).toMatchObject({ item_group_id: 'PO-BINDER', color: 'Blue' });
  });
});

describe('preorderAvailabilityDate', () => {
  const now = new Date('2026-10-23T00:00:00Z');
  it('parses month and year, and rolls a bare past month to next year', () => {
    expect(preorderAvailabilityDate('Ships Dec 2026', now)).toBe('2026-12-01T00:00+1100');
    expect(preorderAvailabilityDate('early March', now)).toBe('2027-03-01T00:00+1100');
    expect(preorderAvailabilityDate('market day', now)).toBeNull();
  });
});

describe('cardFeedRow', () => {
  const listing = {
    id: 'l1', slug: 'charizard', price_aud: 500, grading_company: 'PSA',
    vault_item: { card_name: 'Charizard', collection: 'Pokémon', set_name: 'Base Set', card_number: '4', year: 1999, condition: 'Near Mint', grade: '9' },
  };
  it('builds a used, graded card with brand + mpn', () => {
    expect(cardFeedRow(listing, { imageUrls: ['https://cdn.test/c.jpg'] })).toMatchObject({
      id: 'l1', title: 'Charizard - PSA 9', condition: 'used', brand: 'Pokémon', mpn: 'Base Set 4',
      identifier_exists: 'yes', link: 'https://cardpop.com.au/marketplace/l1/charizard', price: '500.00 AUD',
    });
  });
  it('needs a price and an image', () => {
    expect(cardFeedRow(listing, { imageUrls: [] })).toBeNull();
    expect(cardFeedRow({ ...listing, price_aud: null }, { imageUrls: ['x'] })).toBeNull();
  });
});

describe('toTsv', () => {
  it('writes the header, drops nulls and duplicate ids, and strips tabs/newlines', () => {
    const row = shopFeedRow(shop({ title: 'Tab\there\nline' }));
    const lines = toTsv([row, null, row]).trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].split('\t')).toEqual(FEED_COLUMNS);
    expect(lines[1].split('\t')).toHaveLength(FEED_COLUMNS.length);
  });
});
