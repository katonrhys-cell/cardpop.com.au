import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn() }, apiServerClient: { fetch: vi.fn() } }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: null, profile: null }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProductCard from '@/components/ProductCard.jsx';
import OrderSummary from '@/components/checkout/OrderSummary.jsx';
import {
  PUBLIC_SHOP_STATUSES, PURCHASABLE_SHOP_STATUSES, isPurchasableStatus, isPreorder, preorderEta,
  preorderCartFields, orderPreorderLines, isAwaitingPreorderStock, isSoldOut, hasUnlimitedStock,
} from '@/utils/shopStock.js';
import { availability } from '@/utils/shopFacets.js';

const base = {
  id: '11111111-2222-4333-8444-555555555555',
  source: 'shop',
  type: 'shop',
  title: 'Prismatic Booster Box',
  price_aud: 249.95,
  images: [],
  stock_quantity: 12,
  status: 'preorder',
  preorder_eta: 'Ships in 4–6 weeks',
};

describe('pre-order status helpers', () => {
  it('is public and purchasable; coming soon stays look-only', () => {
    expect(PUBLIC_SHOP_STATUSES).toEqual(expect.arrayContaining(['active', 'preorder', 'coming_soon']));
    expect(PURCHASABLE_SHOP_STATUSES).toEqual(['active', 'preorder']);
    expect(isPurchasableStatus('preorder')).toBe(true);
    expect(isPurchasableStatus('active')).toBe(true);
    expect(isPurchasableStatus('coming_soon')).toBe(false);
    expect(isPurchasableStatus('draft')).toBe(false);
  });

  it('reads the estimate from the row, the camelCase copy or the order line', () => {
    expect(isPreorder(base)).toBe(true);
    expect(preorderEta(base)).toBe('Ships in 4–6 weeks');
    expect(preorderEta({ status: 'preorder', preorderEta: ' Late November ' })).toBe('Late November');
    expect(preorderEta({ preorder: true, preorder_eta: 'Mid-Dec' })).toBe('Mid-Dec');
    expect(preorderEta({ status: 'preorder', preorder_eta: '' })).toBe('Ships when stock arrives');
    expect(preorderEta({ status: 'active', preorder_eta: 'stale text' })).toBe('');
  });

  it('is never sold out and never capped by stock', () => {
    expect(isSoldOut({ ...base, stock_quantity: 0 })).toBe(false);
    expect(isSoldOut({ ...base, status: 'active', stock_quantity: 0 })).toBe(true);
    expect(hasUnlimitedStock(base)).toBe(true);
    expect(hasUnlimitedStock({ ...base, status: 'active' })).toBe(false);
  });

  it('only adds cart fields for a pre-order', () => {
    expect(preorderCartFields(base)).toEqual({ preorder: true, preorderEta: 'Ships in 4–6 weeks' });
    expect(preorderCartFields({ ...base, status: 'active' })).toEqual({});
  });

  it('finds pre-order lines on an order and knows when they still need stock', () => {
    const order = {
      status: 'payment_confirmed',
      order_items: [{ id: 'a', title: 'Sleeves' }, { id: 'b', title: 'Box', preorder: true, preorder_eta: 'Ships in 2–4 weeks' }],
    };
    expect(orderPreorderLines(order).map((l) => l.id)).toEqual(['b']);
    expect(isAwaitingPreorderStock(order)).toBe(true);
    expect(isAwaitingPreorderStock({ ...order, status: 'shipped' })).toBe(false);
    expect(isAwaitingPreorderStock({ status: 'payment_confirmed', order_items: [{ id: 'a' }] })).toBe(false);
    expect(orderPreorderLines({})).toEqual([]);
  });

  it('gets its own Availability filter option', () => {
    expect(availability(base)).toBe('pre-order');
    expect(availability({ ...base, stock_quantity: 0 })).toBe('pre-order');
    expect(availability({ ...base, status: 'active' })).toBe('in-stock');
  });
});

describe('ProductCard pre-order state', () => {
  const renderCard = (product, onAddToCart = vi.fn()) => render(
    <MemoryRouter><ProductCard product={product} onAddToCart={onAddToCart} /></MemoryRouter>,
  );

  it('labels the card, shows the estimate and still lets it go in the cart', () => {
    const onAddToCart = vi.fn();
    renderCard(base, onAddToCart);
    expect(screen.getAllByText(/pre-order/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ships in 4–6 weeks/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^pre-order$/i }));
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ id: base.id }));
  });

  it('never shows Sold out — pre-orders are unlimited, even at 0 stock', () => {
    const onAddToCart = vi.fn();
    renderCard({ ...base, stock_quantity: 0 }, onAddToCart);
    expect(screen.queryByLabelText(/sold out/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ships in 4–6 weeks/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^pre-order$/i }));
    expect(onAddToCart).toHaveBeenCalled();
  });
});

describe('OrderSummary pre-order notice', () => {
  it('flags pre-order lines and explains the order', () => {
    render(
      <OrderSummary
        cartItems={[{ id: 'a', name: 'Sleeves', price: 5 }, { id: 'b', name: 'Booster Box', price: 249.95, preorderEta: 'Ships in 4–6 weeks' }]}
        hasPreorder
        subtotal={254.95}
        total={254.95}
      />,
    );
    expect(screen.getByText(/Pre-order · Ships in 4–6 weeks/)).toBeInTheDocument();
    expect(screen.getByText(/This order includes pre-order items/)).toBeInTheDocument();
  });

  it('says nothing about pre-orders for a normal order', () => {
    render(<OrderSummary cartItems={[{ id: 'a', name: 'Sleeves', price: 5 }]} subtotal={5} total={5} />);
    expect(screen.queryByText(/pre-order/i)).not.toBeInTheDocument();
  });
});
