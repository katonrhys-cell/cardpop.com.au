import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [] }) })) },
}));
vi.mock('@/components/BnplMessage.jsx', () => ({ default: () => null }));

const cart = vi.hoisted(() => ({ items: [] }));
vi.mock('@/hooks/useCart.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCart: () => ({
      cartItems: cart.items,
      isCartOpen: true,
      setIsCartOpen: vi.fn(),
      removeFromCart: vi.fn(),
      updateQuantity: vi.fn(),
      getCartTotal: () => '$0.00',
    }),
  };
});

import ShoppingCart from '@/components/ShoppingCart.jsx';

const line = (quantity, stock) => ({
  product: { id: 'p1', type: 'shop', title: 'Sleeves', price: 10, source: 'shop' },
  variant: { id: 'p1-v', manage_inventory: true, inventory_quantity: stock, price_in_cents: 1000 },
  quantity,
});

const renderCart = () => render(<MemoryRouter><ShoppingCart /></MemoryRouter>);

beforeEach(() => { cart.items = []; });

describe('ShoppingCart — line controls', () => {
  it('labels the icon-only remove / decrease / increase buttons', () => {
    cart.items = [line(1, 5)];
    renderCart();
    expect(screen.getByRole('button', { name: /remove sleeves from cart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decrease quantity of sleeves/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase quantity of sleeves/i })).toBeEnabled();
  });

  it('disables + once the line reaches the available stock', () => {
    cart.items = [line(3, 3)];
    renderCart();
    expect(screen.getByRole('button', { name: /increase quantity of sleeves/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /decrease quantity of sleeves/i })).toBeEnabled();
  });
});
