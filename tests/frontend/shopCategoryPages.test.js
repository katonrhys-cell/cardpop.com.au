import { describe, it, expect } from 'vitest';
import {
  SHOP_CATEGORY_GROUPS, mergeShopCategoryGroups, flattenShopCategoryGroups,
} from '@/utils/shopCategories.js';
import { SHOP_COLLECTION_SEO } from '@/data/shopCollectionSeo.js';
import { shopCategoryLeaves, productInShopCategory } from '@/utils/shopCategoryPages.js';

const pairs = (items) => items.map((i) => [i.name, i.slug]);

describe('shopCategoryLeaves', () => {
  it('SHOP_COLLECTION_SEO subs mirror the Shop menu leaves', () => {
    // The sitemap and prerender read the JSX-free copy; if this fails, mirror
    // the utils/shopCategories.js change into data/shopCollectionSeo.js.
    for (const group of SHOP_CATEGORY_GROUPS) {
      expect(pairs(SHOP_COLLECTION_SEO[group.slug]?.subs || [])).toEqual(pairs(group.items));
    }
  });

  it('matches the Shop menu once admin edits are merged', () => {
    const rows = [
      { id: 'a', section_slug: 'storage', name: 'Card Tins', description: 'Metal tins', hidden: false },
      { id: 'b', section_slug: 'protection', name: 'penny sleeves', hidden: true },
      { id: 'c', section_slug: 'display', name: 'Acrylic Stands', hidden: false }, // already built-in
    ];
    const menu = flattenShopCategoryGroups(mergeShopCategoryGroups(SHOP_CATEGORY_GROUPS, rows));
    const leaves = shopCategoryLeaves(rows);
    expect(leaves.map((l) => [l.name, l.slug, l.groupSlug]))
      .toEqual(menu.map((m) => [m.name, m.slug, m.groupSlug]));
    expect(leaves.find((l) => l.slug === 'card-tins')).toMatchObject({ desc: 'Metal tins', groupName: 'Card Storage' });
    expect(leaves.some((l) => l.slug === 'penny-sleeves')).toBe(false);
  });
});

describe('productInShopCategory', () => {
  it('matches case-insensitively on a substring, like the page query', () => {
    expect(productInShopCategory({ category: 'Penny Sleeves' }, 'Penny Sleeves')).toBe(true);
    expect(productInShopCategory({ category: 'premium sleeves, penny sleeves' }, 'Penny Sleeves')).toBe(true);
    expect(productInShopCategory({ category: 'Top Loaders' }, 'Penny Sleeves')).toBe(false);
    expect(productInShopCategory({ category: null }, 'Penny Sleeves')).toBe(false);
  });
});
