import { vi, describe, it, expect } from 'vitest';

// categoryUtils imports supabase at the top level; mock it so no network calls fire
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));

import {
  generateSlug,
  findNodeBySlug,
  getCategoryBySlug,
  getBreadcrumbs,
  getFullCategoryPath,
} from '@/utils/categoryUtils.js';

// ─── sample category tree ─────────────────────────────────────────────────────

const HOLO = { id: 'pt-holo', name: 'Holographic' };
const VINTAGE = {
  id: 'sub-vintage',
  name: 'Vintage',
  productTypes: [HOLO],
};
const POKEMON = {
  id: 'cat-pokemon',
  name: 'Pokemon',
  subcategories: [VINTAGE],
};
const MAGIC = { id: 'cat-magic', name: 'Magic: The Gathering', subcategories: [] };
const TREE = [POKEMON, MAGIC];

// ─── generateSlug ─────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('returns empty string for falsy input', () => {
    expect(generateSlug('')).toBe('');
    expect(generateSlug(null)).toBe('');
    expect(generateSlug(undefined)).toBe('');
  });

  it('lowercases the input', () => {
    expect(generateSlug('Pokemon')).toBe('pokemon');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('Magic The Gathering')).toBe('magic-the-gathering');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(generateSlug('foo   bar')).toBe('foo-bar');
  });

  it('collapses multiple hyphens into a single hyphen', () => {
    expect(generateSlug('foo--bar')).toBe('foo-bar');
  });

  it('trims leading and trailing whitespace', () => {
    expect(generateSlug('  pokemon  ')).toBe('pokemon');
  });

  it('removes non-word characters (except hyphens)', () => {
    // \w keeps alphanumeric and underscores; : and . are stripped
    expect(generateSlug('Magic: The Gathering')).toBe('magic-the-gathering');
    expect(generateSlug('price $99.99')).toBe('price-9999');
  });

  it('preserves underscores (\\w includes underscore)', () => {
    expect(generateSlug('base_set')).toBe('base_set');
  });

  it('converts a number to its string representation', () => {
    expect(generateSlug(2024)).toBe('2024');
  });

  it('handles a string that is all special characters', () => {
    expect(generateSlug('!!!')).toBe('');
  });
});

// ─── findNodeBySlug ───────────────────────────────────────────────────────────

describe('findNodeBySlug', () => {
  it('returns null when tree is null', () => {
    expect(findNodeBySlug(null, 'pokemon')).toBeNull();
  });

  it('returns null when tree is undefined', () => {
    expect(findNodeBySlug(undefined, 'pokemon')).toBeNull();
  });

  it('finds a node whose generated slug matches', () => {
    expect(findNodeBySlug(TREE, 'pokemon')).toBe(POKEMON);
  });

  it('finds a node by exact id match', () => {
    expect(findNodeBySlug(TREE, 'cat-pokemon')).toBe(POKEMON);
  });

  it('returns undefined when no node matches', () => {
    expect(findNodeBySlug(TREE, 'nonexistent')).toBeUndefined();
  });

  it('returns null for a non-category type (no implementation yet)', () => {
    expect(findNodeBySlug(TREE, 'pokemon', 'subcategory')).toBeNull();
  });

  it('handles slugs that require special-char removal', () => {
    // "Magic: The Gathering" → "magic-the-gathering"
    expect(findNodeBySlug(TREE, 'magic-the-gathering')).toBe(MAGIC);
  });
});

// ─── getCategoryBySlug ────────────────────────────────────────────────────────

describe('getCategoryBySlug', () => {
  it('returns null when categories is null', () => {
    expect(getCategoryBySlug(null, 'pokemon')).toBeNull();
  });

  it('returns null when categorySlug is null', () => {
    expect(getCategoryBySlug(TREE, null)).toBeNull();
  });

  it('returns null when category is not found', () => {
    expect(getCategoryBySlug(TREE, 'yugioh')).toBeNull();
  });

  it('returns { category } when only the category is matched', () => {
    const result = getCategoryBySlug(TREE, 'pokemon');
    expect(result).toEqual({ category: POKEMON });
  });

  it('also finds by category id', () => {
    const result = getCategoryBySlug(TREE, 'cat-pokemon');
    expect(result.category).toBe(POKEMON);
  });

  it('includes subcategory in result when subcategorySlug matches', () => {
    const result = getCategoryBySlug(TREE, 'pokemon', 'vintage');
    expect(result.category).toBe(POKEMON);
    expect(result.subcategory).toBe(VINTAGE);
  });

  it('also resolves subcategory by id', () => {
    const result = getCategoryBySlug(TREE, 'cat-pokemon', 'sub-vintage');
    expect(result.subcategory).toBe(VINTAGE);
  });

  it('includes productType when all three slugs match', () => {
    const result = getCategoryBySlug(TREE, 'pokemon', 'vintage', 'holographic');
    expect(result.category).toBe(POKEMON);
    expect(result.subcategory).toBe(VINTAGE);
    expect(result.productType).toBe(HOLO);
  });

  it('omits productType key when productTypeSlug does not match', () => {
    const result = getCategoryBySlug(TREE, 'pokemon', 'vintage', 'nonexistent');
    expect(result).not.toHaveProperty('productType');
  });

  it('omits subcategory key when subcategorySlug does not match', () => {
    const result = getCategoryBySlug(TREE, 'pokemon', 'nonexistent');
    expect(result).not.toHaveProperty('subcategory');
  });

  it('ignores subcategorySlug when category has no subcategories array', () => {
    const flat = [{ id: 'cat-flat', name: 'Flat' }];
    const result = getCategoryBySlug(flat, 'flat', 'anything');
    expect(result).toEqual({ category: flat[0] });
  });
});

// ─── getBreadcrumbs ───────────────────────────────────────────────────────────

describe('getBreadcrumbs', () => {
  it('returns Home + Vault when no category is given', () => {
    const crumbs = getBreadcrumbs(null);
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ label: 'Home', path: '/' });
    expect(crumbs[1]).toEqual({ label: 'Vault', path: '/vault' });
  });

  it('uses "Shop" label when basePath is /shop', () => {
    const crumbs = getBreadcrumbs(null, null, null, '/shop');
    expect(crumbs[1].label).toBe('Shop');
  });

  it('appends the category breadcrumb', () => {
    const crumbs = getBreadcrumbs(POKEMON);
    expect(crumbs).toHaveLength(3);
    expect(crumbs[2]).toEqual({ label: 'Pokemon', path: '/vault/pokemon' });
  });

  it('appends subcategory breadcrumb when provided', () => {
    const crumbs = getBreadcrumbs(POKEMON, VINTAGE);
    expect(crumbs).toHaveLength(4);
    expect(crumbs[3]).toEqual({ label: 'Vintage', path: '/vault/pokemon/vintage' });
  });

  it('appends productType breadcrumb when provided', () => {
    const crumbs = getBreadcrumbs(POKEMON, VINTAGE, HOLO);
    expect(crumbs).toHaveLength(5);
    expect(crumbs[4]).toEqual({ label: 'Holographic', path: '/vault/pokemon/vintage/holographic' });
  });

  it('uses the category id as slug fallback when name generates an empty slug', () => {
    const noName = { id: 'cat-99', name: '!!!' }; // generateSlug('!!!') === ''
    const crumbs = getBreadcrumbs(noName);
    expect(crumbs[2].path).toBe('/vault/cat-99');
  });
});

// ─── getFullCategoryPath ──────────────────────────────────────────────────────

describe('getFullCategoryPath', () => {
  it('returns null when tree is null', () => {
    expect(getFullCategoryPath(null, 'cat-pokemon')).toBeNull();
  });

  it('returns null when category id is not in the tree', () => {
    expect(getFullCategoryPath(TREE, 'nonexistent')).toBeNull();
  });

  it('returns { category } when only categoryId is provided', () => {
    const path = getFullCategoryPath(TREE, 'cat-pokemon');
    expect(path).toEqual({ category: POKEMON });
  });

  it('includes subcategory when subcategoryId matches', () => {
    const path = getFullCategoryPath(TREE, 'cat-pokemon', 'sub-vintage');
    expect(path.subcategory).toBe(VINTAGE);
  });

  it('includes productType when all three IDs match', () => {
    const path = getFullCategoryPath(TREE, 'cat-pokemon', 'sub-vintage', 'pt-holo');
    expect(path.productType).toBe(HOLO);
  });

  it('omits subcategory when subcategoryId is not found', () => {
    const path = getFullCategoryPath(TREE, 'cat-pokemon', 'nonexistent');
    expect(path).not.toHaveProperty('subcategory');
  });
});
