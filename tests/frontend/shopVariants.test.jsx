import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VariantPicker from '@/components/shop/VariantPicker.jsx';
import { activeVariants, chooseVariantLabel, hasVariants, isSizeName, pickDefaultVariant, toCartVariant, variantKind, variantPrice } from '@/utils/shopVariants.js';

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

const gloves = {
  id: 'p-gloves', price_aud: '12.95', has_variants: true,
  variants: [
    { id: 'v-s', sku: 'SR1361', colour: 'Small', stock_quantity: 10, status: 'active', sort_order: 0 },
    { id: 'v-m', sku: 'SR1362', colour: 'Medium', stock_quantity: 10, status: 'active', sort_order: 1 },
    { id: 'v-xl', sku: 'SR1364', colour: 'XL', stock_quantity: 0, status: 'active', sort_order: 3 },
    { id: 'v-2xl', sku: 'SR1365', colour: '2XL', stock_quantity: 10, status: 'active', sort_order: 4 },
  ],
};

describe('size variants', () => {
  it('recognises size names regardless of case or spacing', () => {
    ['S', 'm', 'XL', '2xl', 'Small', 'Extra Large', ' Medium '].forEach((n) => expect(isSizeName(n)).toBe(true));
    ['Black', 'Red', '', null, 'Clear'].forEach((n) => expect(isSizeName(n)).toBe(false));
  });

  it('calls a product Size when every variant is a size, otherwise Colour', () => {
    expect(variantKind(gloves)).toBe('Size');
    expect(variantKind(product)).toBe('Colour');
    // A mix is still a colour choice, and a grid row (no rows embedded) stays neutral.
    expect(variantKind({ variants: [{ id: 'a', colour: 'Small' }, { id: 'b', colour: 'Black' }] })).toBe('Colour');
    expect(variantKind({ has_variants: true })).toBe('Colour');
    expect(chooseVariantLabel(gloves)).toBe('Choose size');
    expect(chooseVariantLabel(product)).toBe('Choose colour');
    expect(chooseVariantLabel({ has_variants: true })).toBe('Choose options');
  });

  it('keeps sizes in their sort order, not alphabetical', () => {
    expect(activeVariants(gloves).map((v) => v.colour)).toEqual(['Small', 'Medium', 'XL', '2XL']);
  });
});

describe('VariantPicker', () => {
  it('labels a sized product "Size" and lists the sizes with no swatch', () => {
    render(<VariantPicker product={gloves} value="v-m" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Size · 4 options$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'XL (sold out)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2XL' })).toBeInTheDocument();
  });


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

  it('never marks a pre-order colour sibling sold out, but still marks a sold-out active one', () => {
    const variants = [
      { id: 'p-blk', sku: 'ZB-BLK', colour: 'Black', stock_quantity: 0, status: 'active', sort_order: 0 },
      { id: 'p-red', sku: 'ZB-RED', colour: 'Red', stock_quantity: 0, status: 'active', preorder: true, sort_order: 1 },
    ];
    render(<VariantPicker product={{ variants }} value="p-red" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Black (sold out)' })).toBeInTheDocument();
    expect(screen.getByText(/pre-order/)).toBeInTheDocument();
  });

  it('renders nothing for a product without variants', () => {
    const { container } = render(<VariantPicker product={{ id: 'x', variants: [] }} value={null} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
