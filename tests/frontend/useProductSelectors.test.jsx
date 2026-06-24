import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ categories: [] }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: h.categories, error: null })),
  };
  return { supabase: { from: vi.fn(() => builder) } };
});

import { useProductSelectors } from '@/hooks/useProductSelectors.js';

const CATS = [
  { id: 'c1', name: 'Pokemon', parent_id: null },
  { id: 'c2', name: 'Base Set', parent_id: 'c1' },
  { id: 'c3', name: 'Jungle', parent_id: 'c1' },
  { id: 'c4', name: 'NBA', parent_id: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.categories = CATS;
});

describe('useProductSelectors', () => {
  it('loads active categories', async () => {
    const { result } = renderHook(() => useProductSelectors());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(4);
  });

  it('derives subcategories as children of the selected category', async () => {
    const { result } = renderHook(() => useProductSelectors());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setCategory('c1'); });
    expect(result.current.subcategories.map((c) => c.id)).toEqual(['c2', 'c3']);
    expect(result.current.filteredSubcategories.map((c) => c.id)).toEqual(['c2', 'c3']);
  });

  it('clears the subcategory when the category changes', async () => {
    const { result } = renderHook(() => useProductSelectors());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setCategory('c1'); });
    act(() => { result.current.setSubcategory('c2'); });
    expect(result.current.selectedSubcategory).toBe('c2');

    act(() => { result.current.setCategory('c4'); });
    expect(result.current.selectedSubcategory).toBe('');
  });

  it('seeds selection from initial values', async () => {
    const { result } = renderHook(() => useProductSelectors({ categoryId: 'c1', subcategoryId: 'c2' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectedCategory).toBe('c1');
    expect(result.current.selectedSubcategory).toBe('c2');
  });
});
