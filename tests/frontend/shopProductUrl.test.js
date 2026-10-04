import { describe, it, expect } from 'vitest';
import {
  shopProductPath, shopProductBasePath, shopLineSlug, shopColourParam, shopCategorySlug, legacyShopProductPath,
  shopSlugRedirectTarget,
} from '@/utils/shopProductUrl.js';
import { SHOP_CATEGORIES } from '@/utils/shopCategories.js';
import { BINDER_PRODUCTS } from '@/data/shopBinderProducts.js';
import { PALMS_OFF_PRODUCTS } from '@/data/palmsOffCatalogue.js';

const blue = {
  id: 'b1', title: 'Palms Off Gaming Stealth 12-Pocket Zip Binder — Blue',
  slug: 'palms-off-gaming-stealth-12-pocket-zip-binder-blue', family_sku: 'STL-12', colour: 'Blue', category: 'Binders',
};

describe('shopProductPath', () => {
  it('puts a colour sibling on its line page with the colour preselected', () => {
    expect(shopLineSlug(blue)).toBe('palms-off-gaming-stealth-12-pocket-zip-binder');
    expect(shopColourParam(blue)).toBe('blue');
    expect(shopProductBasePath(blue)).toBe('/shop/binders/palms-off-gaming-stealth-12-pocket-zip-binder');
    expect(shopProductPath(blue)).toBe('/shop/binders/palms-off-gaming-stealth-12-pocket-zip-binder?colour=blue');
  });

  it('handles multi-word colours', () => {
    const row = { ...blue, colour: 'Glow In The Dark', slug: 'palms-off-gaming-playmat-glow-in-the-dark', category: 'Playmats' };
    expect(shopProductPath(row)).toBe('/shop/playmats/palms-off-gaming-playmat?colour=glow-in-the-dark');
  });

  it('gives a single product its own slug and no colour', () => {
    const row = { id: 'p1', slug: 'penny-sleeves-100-pack', category: 'Penny Sleeves', colour: null };
    expect(shopProductPath(row)).toBe('/shop/penny-sleeves/penny-sleeves-100-pack');
  });

  it('keeps a lone colour that is not part of a family in the slug', () => {
    const row = { id: 'p2', slug: 'storage-box-black', category: 'Storage Boxes', colour: 'Black', family_sku: null };
    expect(shopProductPath(row)).toBe('/shop/storage-boxes/storage-box-black');
  });

  it('falls back to the legacy id URL when a product cannot be placed', () => {
    expect(shopProductPath({ id: 'x', title: 'Mystery Box', slug: null, category: 'Misc' })).toBe('/product/shop/x/mystery-box');
    expect(shopProductPath({ id: 'x', title: 'Mystery Box', slug: 'mystery', category: null })).toBe('/product/shop/x/mystery-box');
    expect(legacyShopProductPath({ id: 'x' })).toBe('/product/shop/x/product');
  });

  it('never claims the reserved /shop/category/* route', () => {
    expect(shopCategorySlug({ category: 'Category' })).toBeNull();
    expect(shopProductPath({ id: 'x', title: 'T', slug: 't', category: 'Category' })).toBe('/product/shop/x/t');
  });
});

describe('URL scheme matches the shop taxonomy', () => {
  it('every shop category name slugifies to its URL slug', () => {
    for (const c of SHOP_CATEGORIES) expect(shopCategorySlug({ category: c.name })).toBe(c.slug);
  });

  it('every catalogue page is where the product rows point', () => {
    const nameBySlug = Object.fromEntries(SHOP_CATEGORIES.map((c) => [c.slug, c.name]));
    for (const p of PALMS_OFF_PRODUCTS) {
      expect(shopProductBasePath({ slug: p.slug, category: nameBySlug[p.categorySlug] }))
        .toBe(`/shop/${p.categorySlug}/${p.slug}`);
    }
    for (const p of BINDER_PRODUCTS) {
      expect(shopProductBasePath({ slug: `${p.slug}-black`, colour: 'Black', family_sku: p.sku, category: 'Binders' }))
        .toBe(`/shop/binders/${p.slug}`);
    }
  });
});

describe('shopSlugRedirectTarget', () => {
  const house = { old_slug: 'binder-9-pocket-zip', product: { id: 'h1', slug: '9-pocket-zip-binder', category: 'Binders', colour: null, family_sku: null } };
  const mat = (colour) => ({
    old_slug: `palms-off-gaming-playmat-${colour.toLowerCase()}`,
    product: { id: colour, slug: `palms-off-gaming-core-playmat-${colour.toLowerCase()}`, category: 'Playmats', colour, family_sku: 'PM-ST' },
  });

  it('sends an old house slug to the product\'s current URL', () => {
    expect(shopSlugRedirectTarget([house], 'binder-9-pocket-zip')).toBe('/shop/binders/9-pocket-zip-binder');
  });

  it('matches an old line slug through its colour siblings and keeps the chosen colour', () => {
    const rows = [mat('Black'), mat('Pink')];
    expect(shopSlugRedirectTarget(rows, 'palms-off-gaming-playmat', 'pink'))
      .toBe('/shop/playmats/palms-off-gaming-core-playmat?colour=pink');
    expect(shopSlugRedirectTarget(rows, 'palms-off-gaming-playmat'))
      .toBe('/shop/playmats/palms-off-gaming-core-playmat');
    // A colour the line never had falls back to the bare line page.
    expect(shopSlugRedirectTarget(rows, 'palms-off-gaming-playmat', 'green'))
      .toBe('/shop/playmats/palms-off-gaming-core-playmat');
  });

  it('ignores redirects whose old slug merely shares a prefix', () => {
    expect(shopSlugRedirectTarget([house], 'binder-9-pocket')).toBeNull();
    expect(shopSlugRedirectTarget([mat('Pink')], 'palms-off-gaming-playmat-pin')).toBeNull();
  });

  it('returns null with nothing to go on', () => {
    expect(shopSlugRedirectTarget([], 'anything')).toBeNull();
    expect(shopSlugRedirectTarget(null, '')).toBeNull();
    expect(shopSlugRedirectTarget([{ old_slug: 'x', product: null }], 'x')).toBeNull();
  });
});
