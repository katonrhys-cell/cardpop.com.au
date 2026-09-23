import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VariantPicker from '@/components/shop/VariantPicker.jsx';
import { activeVariants, hasVariants, pickDefaultVariant, toCartVariant, variantPrice } from '@/utils/shopVariants.js';

const product = {
  id: 'p1', price_aud: '44.95', stock_quantity: 3, has_variants: true,
  variants: [
    { id: 'v-red', sku: 'ZB-09-RED', colour: 'Red', colour_hex: '#C8202F', stock_quantity: 0, status: 'active', sort_order: 1 },
    { id: 'v-blk', sku: 'ZB-09-BLK', colour: 'Black', colour_hex: '#1B1B1D', stock_quantity: 3, status: 'active', sort_order: 0 },
    { id: 'v-old', sku: 'ZB-09-OLD', colour: 'Olive', stock_quantity: 9, status: 'archived', sort_order: 2 },
  ],
};

describe('shopVariants helpers', () => {
  it('lists active variants in sort order and detects variants', () => {
    expect(activeVariants(product).map((v) => v.colour)).toEqual(['Black', 'Red']);
    expect(hasVariants(product)).toBe(true);
    expect(hasVariants({ id: 'x', variants: [] })).toBe(false);
    expect(hasVariants({ id: 'x', has_variants: true })).toBe(true); // grid rows have no variants embedded
  });

  it('defaults to the first in-stock variant', () => {
    expect(pickDefaultVariant(product).id).toBe('v-blk');
    expect(pickDefaultVariant({ variants: [] })).toBeNull();
  });

  it('builds a cart variant with per-colour identity and stock, honouring price overrides', () => {
    const cv = toCartVariant(product, product.variants[0]);
    expect(cv).toMatchObject({ id: 'v-red', variant_id: 'v-red', title: 'Red', sku: 'ZB-09-RED', price_in_cents: 4495, manage_inventory: true, inventory_quantity: 0 });
    expect(variantPrice(product, { price_aud: '47.95' })).toBe(47.95);
    expect(toCartVariant(product, null).id).toBe('p1');
  });
});

describe('VariantPicker', () => {
  it('renders a chip per active colour, marks sold-out ones, and reports the choice', () => {
    const onChange = vi.fn();
    render(<VariantPicker product={product} value="v-blk" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Black' })).toHaveAttribute('aria-checked', 'true');
    const red = screen.getByRole('radio', { name: 'Red (sold out)' });
    expect(red).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Olive/ })).not.toBeInTheDocument();
    fireEvent.click(red);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-red' }));
    expect(screen.getByText(/only 3 left/)).toBeInTheDocument();
  });

  it('renders nothing for a product without variants', () => {
    const { container } = render(<VariantPicker product={{ id: 'x', variants: [] }} value={null} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
