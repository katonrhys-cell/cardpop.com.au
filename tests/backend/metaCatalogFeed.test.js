import { describe, it, expect } from 'vitest';
import { metaShopFeedRow, metaCardFeedRow, withMetaUtm, META_FEED_COLUMNS } from '../../utils/metaCatalogFeed.js';
import { toTsv } from '../../utils/merchantFeed.js';

const shop = (over = {}) => ({
  id: 'p1', title: '9-Pocket Zip Binder', slug: '9-pocket-zip-binder', sku: 'CP-9-POCKET-ZIP-BINDER',
  brand: '', barcode: '', category: 'Binders', description: '<p>A binder.</p>', price_aud: 29.9,
  stock_quantity: 4, images: ['https://cdn.test/a.png'], status: 'active', ...over,
});

describe('metaShopFeedRow', () => {
  it("uses Meta's availability spelling and tags the link", () => {
    const row = metaShopFeedRow(shop());
    expect(row).toMatchObject({ id: 'CP-9-POCKET-ZIP-BINDER', availability: 'in stock', price: '29.90 AUD', brand: 'CardPop', condition: 'new' });
    expect(row.link).toBe('https://cardpop.com.au/shop/binders/9-pocket-zip-binder?utm_source=meta&utm_medium=social&utm_campaign=catalog');
    expect(metaShopFeedRow(shop({ stock_quantity: 0 })).availability).toBe('out of stock');
  });

  it('drops Google-only columns', () => {
    const row = metaShopFeedRow(shop());
    expect(row).not.toHaveProperty('identifier_exists');
    expect(row).not.toHaveProperty('availability_date');
    expect(META_FEED_COLUMNS).not.toContain('identifier_exists');
  });

  it('lists every pre-order as orderable, saying so in the description', () => {
    const dated = metaShopFeedRow(shop({ status: 'preorder', stock_quantity: 0, preorder_eta: 'December 2026' }));
    expect(dated.availability).toBe('in stock');
    expect(dated.description).toBe('Pre-order (estimated December 2026). A binder.');
    const undated = metaShopFeedRow(shop({ status: 'preorder', preorder_eta: 'Ships when stock arrives' }));
    expect(undated.description.startsWith('Pre-order (estimated Ships when stock arrives).')).toBe(true);
  });

  it('still skips unsellable rows', () => {
    expect(metaShopFeedRow(shop({ price_aud: 0 }))).toBeNull();
    expect(metaShopFeedRow(shop({ status: 'preorder', images: [], image_url: null }))).toBeNull();
  });
});

describe('metaCardFeedRow', () => {
  it('builds an Official Store card', () => {
    const row = metaCardFeedRow({
      id: 'l1', slug: 'charizard', price_aud: 500,
      vault_item: { card_name: 'Charizard', collection: 'Pokémon', set_name: 'Base Set', card_number: '4' },
    }, { imageUrls: ['https://cdn.test/c.jpg'] });
    expect(row).toMatchObject({ id: 'l1', availability: 'in stock', condition: 'used', brand: 'Pokémon' });
    expect(row.link).toContain('/marketplace/l1/charizard?utm_source=meta');
  });
});

describe('withMetaUtm', () => {
  it('keeps an existing query such as a colour', () => {
    expect(withMetaUtm('https://cardpop.com.au/shop/x/y?colour=blue')).toBe('https://cardpop.com.au/shop/x/y?colour=blue&utm_source=meta&utm_medium=social&utm_campaign=catalog');
  });
});

describe('toTsv with Meta columns', () => {
  it('writes the Meta header', () => {
    const [header, line] = toTsv([metaShopFeedRow(shop())], META_FEED_COLUMNS).trimEnd().split('\n');
    expect(header.split('\t')).toEqual(META_FEED_COLUMNS);
    expect(line.split('\t')).toHaveLength(META_FEED_COLUMNS.length);
  });
});
