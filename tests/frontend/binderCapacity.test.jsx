import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BINDER_CAPACITY, binderCapacity, binderCapacityText, binderCapacitySiblings } from '@/utils/binderCapacity.js';
import { BINDER_PRODUCTS, binderSpecs } from '@/data/shopBinderProducts.js';
import BinderCapacityPicker from '@/components/shop/BinderCapacityPicker.jsx';

describe('binder capacity', () => {
  it('every pocket binder in the catalogue states its capacity', () => {
    for (const p of BINDER_PRODUCTS.filter((b) => b.pocketsPerPage)) {
      expect(p.capacity, p.sku).toBeTruthy();
      const rows = binderSpecs(p).filter((r) => r.label === 'Capacity');
      expect(rows, p.sku).toHaveLength(1);
      expect(rows[0].value).toBe(binderCapacityText(p.sku));
    }
  });

  it('capacity is pages × pockets × 2 sides', () => {
    for (const p of BINDER_PRODUCTS.filter((b) => b.capacity)) {
      const pages = Number(p.capacity.pages.match(/^(\d+)/)[1]);
      expect(pages * p.pocketsPerPage * 2, p.sku).toBe(p.capacity.slots);
    }
  });

  it('matches the manufacturer figures', () => {
    expect(binderCapacity('TOP-04').slots).toBe(128);
    expect(binderCapacity('TOP-09-RED').slots).toBe(216);
    expect(binderCapacityText('TOP-09')).toBe('216 × 35pt top loaders');
    expect(binderCapacityText('ZB-12')).toBe('480 cards');
    expect(binderCapacity('RB-BLK')).toBeNull();
    expect(Object.keys(BINDER_CAPACITY)).toHaveLength(7);
  });

  it('groups the top loader binders as 128 | 216', () => {
    expect(binderCapacitySiblings('TOP-09').map((s) => s.slots)).toEqual([128, 216]);
    expect(binderCapacitySiblings('ZB-04').map((s) => s.sku)).toEqual(['ZB-04', 'ZB-09', 'ZB-12']);
  });

  it('picker links to the other capacity, keeping the colour', () => {
    render(<MemoryRouter><BinderCapacityPicker sku="TOP-09" colour="Red" /></MemoryRouter>);
    expect(screen.getByRole('radio', { name: /216 slots/ })).toHaveAttribute('aria-checked', 'true');
    const other = screen.getByRole('radio', { name: /128 slots/ });
    expect(other.getAttribute('href')).toBe('/shop/binders/palms-off-gaming-collectors-series-4-pocket-top-loader-zip-binder?colour=red');
  });
});
