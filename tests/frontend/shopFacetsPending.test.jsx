import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The filter row's place is held while facet rows load — but only for a grid
// that had filters last time, so a category with none doesn't get a gap that
// then closes. See hooks/useShopFacets.js (`pending`).

const h = vi.hoisted(() => ({ rows: [] }));
vi.mock('@/lib/supabaseClient.js', () => {
  const query = () => {
    const q = { select: () => q, in: () => q, ilike: () => q, or: () => q, then: (res) => Promise.resolve({ data: h.rows, error: null }).then(res) };
    return q;
  };
  return { supabase: { from: () => query() } };
});

import { useShopFacets } from '@/hooks/useShopFacets.js';
import ShopFilterPanel from '@/components/shop/ShopFilterPanel.jsx';

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const product = (id, colour, price) => ({
  id, sku: `S-${id}`, family_sku: 'ZB-04', brand: 'Palms Off Gaming', title: `Binder — ${colour}`, colour,
  colour_hex: '#000000', category: 'Binders', price_aud: price, retail_price_aud: price, stock_quantity: 5,
  status: 'active', created_at: '2026-09-01T00:00:00Z',
});
const scoped = (scopeKey, extra = {}) => ({ scope: (q) => q, scopeKey, ...extra });

describe('useShopFacets pending', () => {
  beforeEach(() => { h.rows = []; });

  it('does not hold a place for a grid it has never seen', async () => {
    h.rows = [product('1', 'Pink', 10), product('2', 'Black', 60)];
    const { result } = renderHook(() => useShopFacets(scoped('first-visit')), { wrapper });
    expect(result.current.pending).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(Object.keys(result.current.options).length).toBeGreaterThan(0);
  });

  it('holds the place next time for a grid that had filters', async () => {
    h.rows = [product('1', 'Pink', 10), product('2', 'Black', 60)];
    const first = renderHook(() => useShopFacets(scoped('with-filters')), { wrapper });
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    first.unmount();

    const second = renderHook(() => useShopFacets(scoped('with-filters')), { wrapper });
    expect(second.result.current.pending).toBe(true);
    await waitFor(() => expect(second.result.current.pending).toBe(false));
  });

  it('does not hold it for a grid that had none, even when told to expect them', async () => {
    h.rows = [product('1', 'Pink', 10)]; // one product: nothing to filter by
    const first = renderHook(() => useShopFacets(scoped('no-filters', { expectFilters: true })), { wrapper });
    expect(first.result.current.pending).toBe(true); // unknown grid, caller's default
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(Object.keys(first.result.current.options)).toHaveLength(0);
    first.unmount();

    const second = renderHook(() => useShopFacets(scoped('no-filters', { expectFilters: true })), { wrapper });
    expect(second.result.current.pending).toBe(false);
  });
});

describe('ShopFilterPanel loading', () => {
  it('renders a row-sized placeholder only while loading with no facets yet', () => {
    const props = { options: {}, rows: [], selection: {}, onChange: () => {}, onClear: () => {} };
    const loading = render(<ShopFilterPanel {...props} loading />);
    expect(loading.getByTestId('shop-filter-placeholder').className).toContain('h-9');
    loading.unmount();
    const idle = render(<ShopFilterPanel {...props} />);
    expect(idle.container.firstChild).toBeNull();
  });
});
