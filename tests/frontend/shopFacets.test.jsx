import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  typeLabel, typeKey, pocketCount, priceBand, availability, onSale,
  buildFacetOptions, readSelection, filterFacetRows, facetCounts, sortFacetRows, matchesSearch,
  fetchShopProductsByIds,
} from '@/utils/shopFacets.js';
import ShopFilterPanel from '@/components/shop/ShopFilterPanel.jsx';

const BRAND = 'Palms Off Gaming';
let seq = 0;
const row = (family, title, colour, hex, extra = {}) => ({
  id: String(++seq), sku: `${family}-${colour.slice(0, 3).toUpperCase()}`, family_sku: family, brand: BRAND,
  title: `${BRAND} ${title} — ${colour}`, colour, colour_hex: hex, category: 'Binders',
  price_aud: 49.95, retail_price_aud: 49.95, stock_quantity: 5, status: 'active',
  created_at: `2026-09-0${seq}T00:00:00Z`, ...extra,
});

const ROWS = [
  row('ZB-04', "Collector's Series 4-Pocket Zip Binder", 'Pink', '#f9a8d4', { price_aud: 39.95, retail_price_aud: 39.95 }),
  row('ZB-04', "Collector's Series 4-Pocket Zip Binder", 'Black', '#000000', { status: 'coming_soon' }),
  row('ZB-12', "Collector's Series 12-Pocket Zip Binder", 'Pink', '#f9a8d4', { stock_quantity: 0 }),
  row('ZB-12', "Collector's Series 12-Pocket Zip Binder", 'Blue', '#2563eb', { price_aud: 59.95, retail_price_aud: 69.95 }),
  row('ZB-09', "Collector's Series 9-Pocket Zip Binder", 'black', null, { brand: 'Ultra Pro', title: 'Ultra Pro 9-Pocket Zip Binder — black' }),
  { id: 'ring', sku: 'RB-BLK', brand: BRAND, title: `${BRAND} Collector's Series Ring Binder`, colour: null,
    category: 'Binders', price_aud: 19.95, stock_quantity: 3, status: 'active', created_at: '2026-08-01T00:00:00Z' },
];

describe('shopFacets values', () => {
  it('labels a line without brand prefix or colour suffix', () => {
    expect(typeLabel(ROWS[0])).toBe("Collector's Series 4-Pocket Zip Binder");
    expect(typeLabel(ROWS[5])).toBe("Collector's Series Ring Binder");
  });

  it('groups by family, falling back to the SKU', () => {
    expect(typeKey(ROWS[0])).toBe('ZB-04');
    expect(typeKey(ROWS[5])).toBe('RB-BLK');
  });

  it('reads pockets per page from the title', () => {
    expect(pocketCount(ROWS[2])).toBe('12');
    expect(pocketCount({ title: '9 Pocket Pages' })).toBe('9');
    expect(pocketCount(ROWS[5])).toBeNull();
  });

  it('bands prices, availability and sale', () => {
    expect(priceBand({ price_aud: 19.95 })).toBe('under-20');
    expect(priceBand({ price_aud: 50 })).toBe('50-100');
    expect(priceBand({ price_aud: 300 })).toBe('250-plus');
    expect(availability(ROWS[0])).toBe('in-stock');
    expect(availability(ROWS[1])).toBe('coming-soon');
    expect(availability(ROWS[2])).toBe('sold-out');
    expect(onSale(ROWS[3])).toBe(true);
    expect(onSale(ROWS[0])).toBe(false);
  });
});

describe('buildFacetOptions', () => {
  const opts = buildFacetOptions(ROWS);

  it('offers every facet the products vary on', () => {
    expect(Object.keys(opts)).toEqual(['type', 'pockets', 'colour', 'price', 'availability', 'brand', 'sale']);
    expect(opts.type.map((o) => o.value)).toEqual(['ZB-09', 'ZB-04', 'ZB-12', 'RB-BLK']); // '9-Pocket…' (Ultra Pro) sorts first
    expect(opts.pockets.map((o) => o.label)).toEqual(['4-pocket', '9-pocket', '12-pocket']);
    expect(opts.colour.map((o) => o.value)).toEqual(['black', 'blue', 'pink']);
    expect(opts.colour[0]).toMatchObject({ label: 'Black', hex: '#000000', count: 2 });
    expect(opts.availability.map((o) => o.value)).toEqual(['in-stock', 'coming-soon', 'sold-out']);
    expect(opts.sale).toEqual([{ value: 'on-sale', label: 'On sale', count: 1 }]);
  });

  it('hides facets that would not narrow anything', () => {
    const singles = [ROWS[0], ROWS[2], ROWS[5]].map((r) => ({ ...r, brand: BRAND }));
    const o = buildFacetOptions(singles);
    expect(o.type).toBeUndefined(); // every type is one product
    expect(o.brand).toBeUndefined(); // one brand
    expect(o.sale).toBeUndefined(); // nothing on sale
    expect(buildFacetOptions([ROWS[3]], ['sale']).sale).toBeUndefined(); // everything on sale
  });

  it('only builds the requested facets', () => {
    expect(Object.keys(buildFacetOptions(ROWS, ['category', 'brand']))).toEqual(['brand']);
  });
});

describe('selection + filtering', () => {
  const opts = buildFacetOptions(ROWS);

  it('reads only valid values from the URL', () => {
    const params = new URLSearchParams('type=zb-12&colour=PINK&brand=nope&pockets=');
    expect(readSelection(params, opts)).toEqual({ type: 'ZB-12', colour: 'pink' });
  });

  it('filters by every selected facet', () => {
    expect(filterFacetRows(ROWS, { colour: 'pink' }).map((p) => p.id)).toEqual(['1', '3']);
    expect(filterFacetRows(ROWS, { type: 'ZB-12', colour: 'pink' }).map((p) => p.id)).toEqual(['3']);
    expect(filterFacetRows(ROWS, { availability: 'in-stock', pockets: '4' }).map((p) => p.id)).toEqual(['1']);
    expect(filterFacetRows(ROWS, {})).toHaveLength(6);
  });

  it('cross-filters counts, ignoring the facet being counted', () => {
    const counts = facetCounts(ROWS, { type: 'ZB-04', colour: 'pink' }, 'colour');
    expect(Object.fromEntries(counts)).toEqual({ pink: 1, black: 1 });
  });

  it('sorts and searches like the server queries', () => {
    expect(sortFacetRows(ROWS, 'price_asc')[0].id).toBe('ring');
    expect(sortFacetRows(ROWS, 'newest')[0].id).toBe('5');
    expect(sortFacetRows(ROWS, 'oldest')[0].id).toBe('ring');
    expect(matchesSearch(ROWS[0], '4-POCKET')).toBe(true);
    expect(matchesSearch(ROWS[0], 'ring')).toBe(false);
  });

  it('fetches full rows by id in the requested order', async () => {
    const chain = {
      select: () => chain,
      in: vi.fn(() => chain),
      then: (res) => res({ data: [{ id: 'b' }, { id: 'a' }], error: null }),
    };
    const supabase = { from: () => chain };
    expect(await fetchShopProductsByIds(supabase, ['a', 'b', 'gone'])).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(await fetchShopProductsByIds(supabase, [])).toEqual([]);
  });
});

describe('ShopFilterPanel', () => {
  const setup = (selection = {}) => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <ShopFilterPanel
        options={buildFacetOptions(ROWS)}
        rows={ROWS}
        selection={selection}
        onChange={onChange}
        onClear={onClear}
      />,
    );
    return { onChange, onClear };
  };

  it('selects a type and a colour', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Type/ }));
    fireEvent.click(screen.getByRole('radio', { name: /12-Pocket Zip/ }));
    expect(onChange).toHaveBeenCalledWith('type', 'ZB-12');
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Pink/ }));
    expect(onChange).toHaveBeenCalledWith('colour', 'pink');
  });

  it('disables options the other selections rule out', () => {
    setup({ type: 'ZB-04' });
    expect(screen.getByRole('button', { name: /^Type/ })).toHaveTextContent('4-Pocket');
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }));
    expect(screen.getByRole('radio', { name: /Blue/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Pink/ })).not.toBeDisabled();
  });

  it('clears filters only while one is active', () => {
    setup();
    expect(screen.queryByText('Clear filters')).toBeNull();
  });

  it('clears an active filter', () => {
    const { onClear } = setup({ colour: 'pink' });
    fireEvent.click(screen.getByText('Clear filters'));
    expect(onClear).toHaveBeenCalled();
  });

  it('renders nothing when there is nothing to filter', () => {
    const { container } = render(<ShopFilterPanel options={{}} rows={[]} selection={{}} />);
    expect(container.firstChild).toBeNull();
  });
});
