import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// useCart pulls in Supabase auth (for the sign-out clear) and the Ecommerce
// currency formatter — stub both so the hook can mount in isolation.
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));
vi.mock('@/api/EcommerceApi.js', () => ({
  formatCurrency: (cents) => `$${(cents / 100).toFixed(2)}`,
}));

import { CartProvider, useCart } from '@/hooks/useCart.jsx';

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

// A stock-managed product: addToCart must respect availableQuantity.
const trackedProduct = {
  id: 'prod-1',
  title: 'Booster Box',
  variants: [{ id: 'var-1', manage_inventory: true }],
};
// A product without inventory management: quantity is never gated.
const untrackedProduct = {
  id: 'prod-2',
  title: 'Digital Code',
  variants: [{ id: 'var-2', manage_inventory: false }],
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('useCart addToCart inventory guard', () => {
  it('rejects when the requested quantity exceeds available stock', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await expect(
        result.current.addToCart(trackedProduct, trackedProduct.variants[0], 5, 3),
      ).rejects.toThrow(/Not enough stock/);
    });

    // The over-stock add must not have mutated the cart.
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('adds the item when the requested quantity is within stock', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addToCart(trackedProduct, trackedProduct.variants[0], 2, 3);
    });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(2);
  });

  it('accounts for quantity already in the cart across successive adds', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    // 2 of 3 in stock — allowed.
    await act(async () => {
      await result.current.addToCart(trackedProduct, trackedProduct.variants[0], 2, 3);
    });
    expect(result.current.cartItems[0].quantity).toBe(2);

    // Adding 2 more would make 4 > 3 — must reject, and not bump the quantity.
    await act(async () => {
      await expect(
        result.current.addToCart(trackedProduct, trackedProduct.variants[0], 2, 3),
      ).rejects.toThrow(/Not enough stock/);
    });
    expect(result.current.cartItems[0].quantity).toBe(2);
  });

  it('does not gate quantity for products without inventory management', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addToCart(untrackedProduct, untrackedProduct.variants[0], 99, 1);
    });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(99);
  });
});
