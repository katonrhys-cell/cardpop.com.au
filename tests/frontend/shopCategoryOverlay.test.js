import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));

import { SHOP_CATEGORY_GROUPS, SHOP_CATEGORIES, mergeShopCategoryGroups, flattenShopCategoryGroups } from '@/utils/shopCategories.js';
import { groupProducts, sectionOf, OTHER_SECTION } from '@/utils/adminProductList.js';
import { shopCategorySlug } from '@/utils/shopProductUrl.js';
import { categoryNameError } from '@/components/admin/ShopCategoryManager.jsx';

// Admin-edited categories (shop_categories) layered over the built-in taxonomy.

const rows = [
  { id: 'r1', section_slug: 'protection', name: 'Booster Box Protectors', description: 'Cases for sealed boxes', hidden: false },
  { id: 'r2', section_slug: 'shipping', name: 'Packing Tape', hidden: true },
];

describe('mergeShopCategoryGroups', () => {
  const merged = mergeShopCategoryGroups(SHOP_CATEGORY_GROUPS, rows);
  const items = (slug) => merged.find((g) => g.slug === slug).items;

  it('appends custom categories to their section with a URL-compatible slug', () => {
    const added = items('protection').at(-1);
    expect(added).toMatchObject({ id: 'r1', name: 'Booster Box Protectors', desc: 'Cases for sealed boxes', custom: true });
    expect(added.slug).toBe(shopCategorySlug({ category: 'Booster Box Protectors' }));
  });

  it('hides removed categories and leaves the built-in list untouched', () => {
    expect(items('shipping').map((i) => i.name)).not.toContain('Packing Tape');
    expect(SHOP_CATEGORY_GROUPS.find((g) => g.slug === 'shipping').items.map((i) => i.name)).toContain('Packing Tape');
  });

  it('ignores a custom row duplicating an existing name or naming an unknown section', () => {
    const again = mergeShopCategoryGroups(SHOP_CATEGORY_GROUPS, [
      { id: 'x', section_slug: 'storage', name: 'binders', hidden: false },
      { id: 'y', section_slug: 'nowhere', name: 'Lost', hidden: false },
    ]);
    expect(flattenShopCategoryGroups(again)).toHaveLength(SHOP_CATEGORIES.length);
  });

  it('feeds the admin list sections', () => {
    const products = [{ category: 'Booster Box Protectors' }, { category: 'Packing Tape' }];
    expect(sectionOf(products[0], merged)).toBe('Protection');
    expect(sectionOf(products[1], merged)).toBe(OTHER_SECTION);
    expect(sectionOf(products[0])).toBe(OTHER_SECTION); // built-ins only
    expect(groupProducts(products, merged).map((s) => s.section)).toEqual(['Protection', OTHER_SECTION]);
  });
});

describe('categoryNameError', () => {
  const categories = flattenShopCategoryGroups(SHOP_CATEGORY_GROUPS);
  it('accepts a plain new name', () => {
    expect(categoryNameError('Booster Box Protectors', categories)).toBeNull();
    expect(categoryNameError("Collector's 3+ Packs", categories)).toBeNull();
  });
  it('rejects blanks, duplicates, reserved and filter-breaking names', () => {
    expect(categoryNameError('  ', categories)).toMatch(/Enter/);
    expect(categoryNameError('top loaders', categories)).toMatch(/already exists under Protection/);
    expect(categoryNameError('Category', categories)).toMatch(/reserved/);
    expect(categoryNameError('Sleeves, cheap', categories)).toMatch(/letters/);
    expect(categoryNameError('100% cotton', categories)).toMatch(/letters/);
  });
});
