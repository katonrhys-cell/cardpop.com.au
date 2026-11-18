import { describe, it, expect } from 'vitest';
import { buildPriceChanges, buildStatusChanges, displayStatus, statusLabel, SOLD_OUT } from '@/utils/adminProductChanges.js';

const products = [
  { id: 'a', sku: 'A-1', title: 'Sleeves', price_aud: 4.95, retail_price_aud: null, status: 'draft', stock_quantity: 0, images: [] },
  { id: 'b', sku: 'B-1', title: 'Binder', price_aud: 30, retail_price_aud: 35, status: 'active', stock_quantity: 4, images: ['x.webp'] },
  { id: 'c', sku: 'C-1', title: 'Playmat', price_aud: 40, status: 'preorder', preorder_eta: 'Ships in 2–4 weeks', stock_quantity: 0, images: ['y.webp'] },
];
const costs = { b: { wholesale_inc_gst_aud: 11 } };

describe('buildPriceChanges', () => {
  it('describes each changed field before → after', () => {
    const { error, changes } = buildPriceChanges({ a: { price: '5.5', rrp: '6.95' }, b: { cost: '' } }, products, costs);
    expect(error).toBeNull();
    expect(changes).toEqual([
      { id: 'a', title: 'Sleeves', sku: 'A-1', values: { price: 5.5, rrp: 6.95 }, lines: [
        { label: 'Sale price', from: '$4.95', to: '$5.50' },
        { label: 'RRP', from: '—', to: '$6.95' },
      ] },
      { id: 'b', title: 'Binder', sku: 'B-1', values: { cost: null }, lines: [
        { label: 'Cost (inc GST)', from: '$11.00', to: 'removed' },
      ] },
    ]);
  });

  it('refuses a blank sale price and an invalid amount', () => {
    expect(buildPriceChanges({ a: { price: ' ' } }, products, costs).error).toMatch(/sale price is required/);
    expect(buildPriceChanges({ a: { rrp: '-1' } }, products, costs).error).toMatch(/RRP must be a valid amount/);
  });
});

describe('buildStatusChanges', () => {
  it('lists only the products whose status actually changes', () => {
    const r = buildStatusChanges(products, new Set(['a', 'b']), 'active');
    expect(r.changes.map((c) => c.id)).toEqual(['a']);
    expect(r.changes[0].lines).toEqual([{ label: 'Status', from: 'Draft', to: 'Active' }]);
    expect(r.unchanged).toBe(1);
    expect(r.notes).toEqual([
      '1 product has no photo and will show in the shop without one.',
      '1 product has no stock and will show as sold out.',
    ]);
  });

  it('asks for a dispatch estimate only for pre-orders that lack one', () => {
    const r = buildStatusChanges(products, ['a', 'b', 'c'], 'preorder');
    expect(r.changes.map((c) => [c.id, c.needsEta])).toEqual([['a', true], ['b', true]]);
    expect(r.unchanged).toBe(1);
  });

  it('warns when live products are about to be hidden', () => {
    expect(buildStatusChanges(products, ['a', 'b', 'c'], 'archived').notes)
      .toEqual(['2 products are currently visible in the shop and will be hidden.']);
  });
});

describe('sold out as a status', () => {
  const rows = [
    { id: 'in', title: 'In stock', sku: 'A', status: 'active', stock_quantity: 4, images: ['x'] },
    { id: 'out', title: 'Out', sku: 'B', status: 'active', stock_quantity: 0, images: ['x'] },
    { id: 'pre', title: 'Pre', sku: 'C', status: 'preorder', preorder_eta: 'Ships in 5–7 days', stock_quantity: 0, images: ['x'] },
    { id: 'soon', title: 'Soon', sku: 'D', status: 'coming_soon', stock_quantity: 0, images: ['x'] },
  ];

  it('shows an active product with no stock as sold out, and nothing else', () => {
    expect(rows.map(displayStatus)).toEqual(['active', SOLD_OUT, 'preorder', 'coming_soon']);
    expect(statusLabel(SOLD_OUT)).toBe('Sold out');
  });

  it('leaves products that are already sold out alone and zeroes the stock of the rest', () => {
    const r = buildStatusChanges(rows, ['in', 'out', 'pre'], SOLD_OUT);
    expect(r.changes.map((c) => c.id)).toEqual(['in', 'pre']);
    expect(r.unchanged).toBe(1);
    expect(r.changes[0].lines).toEqual([
      { label: 'Status', from: 'Active', to: 'Sold out' },
      { label: 'Stock', from: '4', to: '0' },
    ]);
    expect(r.changes[1].lines).toEqual([{ label: 'Status', from: 'Pre-order', to: 'Sold out' }]);
    expect(r.changes.some((c) => c.needsEta)).toBe(false);
    expect(r.notes.join(' ')).toMatch(/set to 0/);
    expect(r.notes.join(' ')).toMatch(/stop taking orders/);
  });
});
