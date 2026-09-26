import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  typeLabel, typeKey, buildTypeOptions, buildColourOptions, filterFacetRows,
} from '@/utils/shopFacets.js';
import ShopCategoryFilters from '@/components/shop/ShopCategoryFilters.jsx';

const BRAND = 'Palms Off Gaming';
const row = (id, family, title, colour, hex) => ({
  id, sku: `${family}-${colour.slice(0, 3).toUpperCase()}`, family_sku: family, brand: BRAND,
  title: `${BRAND} ${title} — ${colour}`, colour, colour_hex: hex,
});

const ROWS = [
  row('1', 'ZB-04', "Collector's Series 4-Pocket Zip Binder", 'Pink', '#f9a8d4'),
  row('2', 'ZB-04', "Collector's Series 4-Pocket Zip Binder", 'Black', '#000000'),
  row('3', 'ZB-12', "Collector's Series 12-Pocket Zip Binder", 'Pink', '#f9a8d4'),
  row('4', 'ZB-12', "Collector's Series 12-Pocket Zip Binder", 'Blue', '#2563eb'),
  row('5', 'ZB-09', "Collector's Series 9-Pocket Zip Binder", 'black', null),
  { id: '6', sku: 'RB-BLK', brand: BRAND, title: `${BRAND} Collector's Series Ring Binder`, colour: null },
];

describe('shopFacets', () => {
  it('labels a line without brand prefix or colour suffix', () => {
    expect(typeLabel(ROWS[0])).toBe("Collector's Series 4-Pocket Zip Binder");
    expect(typeLabel(ROWS[5])).toBe("Collector's Series Ring Binder");
  });

  it('groups by family, falling back to the SKU', () => {
    expect(typeKey(ROWS[0])).toBe('ZB-04');
    expect(typeKey(ROWS[5])).toBe('RB-BLK');
  });

  it('builds type options in natural order with counts', () => {
    const opts = buildTypeOptions(ROWS);
    expect(opts.map((o) => o.value)).toEqual(['ZB-04', 'ZB-09', 'ZB-12', 'RB-BLK']);
    expect(opts.find((o) => o.value === 'ZB-04').count).toBe(2);
  });

  it('offers no type filter when every type is a single product', () => {
    expect(buildTypeOptions([ROWS[0], ROWS[2], ROWS[5]])).toEqual([]);
  });

  it('dedupes colours case-insensitively in swatch order', () => {
    const opts = buildColourOptions(ROWS);
    expect(opts.map((o) => o.value)).toEqual(['black', 'blue', 'pink']);
    expect(opts[0]).toMatchObject({ label: 'Black', hex: '#000000', count: 2 });
  });

  it('offers no colour filter with fewer than two colours', () => {
    expect(buildColourOptions([ROWS[0]])).toEqual([]);
  });

  it('filters by type and colour together', () => {
    expect(filterFacetRows(ROWS, { colour: 'pink' }).map((p) => p.id)).toEqual(['1', '3']);
    expect(filterFacetRows(ROWS, { type: 'zb-12', colour: 'Pink' }).map((p) => p.id)).toEqual(['3']);
    expect(filterFacetRows(ROWS, {})).toHaveLength(6);
  });
});

describe('ShopCategoryFilters', () => {
  const setup = (props = {}) => {
    const handlers = { onTypeChange: vi.fn(), onColourChange: vi.fn(), onClear: vi.fn() };
    render(
      <ShopCategoryFilters
        typeOptions={buildTypeOptions(ROWS)}
        colourOptions={buildColourOptions(ROWS)}
        facetRows={ROWS}
        type=""
        colour=""
        {...handlers}
        {...props}
      />,
    );
    return handlers;
  };

  it('selects a type and a colour', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('radio', { name: /12-Pocket/ }));
    expect(h.onTypeChange).toHaveBeenCalledWith('ZB-12');
    fireEvent.click(screen.getByRole('radio', { name: /Pink/ }));
    expect(h.onColourChange).toHaveBeenCalledWith('pink');
  });

  it('disables colours the chosen type does not come in', () => {
    setup({ type: 'ZB-04' });
    expect(screen.getByRole('radio', { name: /Blue/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Pink/ })).not.toBeDisabled();
  });

  it('hides Clear filters when nothing is filtered', () => {
    setup();
    expect(screen.queryByText('Clear filters')).toBeNull();
  });

  it('clears an active filter', () => {
    const h = setup({ colour: 'pink' });
    fireEvent.click(screen.getByText('Clear filters'));
    expect(h.onClear).toHaveBeenCalled();
  });

  it('renders nothing when the category has no filters', () => {
    const { container } = render(
      <ShopCategoryFilters typeOptions={[]} colourOptions={[]} facetRows={[]} type="" colour="" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
