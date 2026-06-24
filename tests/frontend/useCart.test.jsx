import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Capture the auth-state callback so tests can drive SIGNED_OUT.
const h = vi.hoisted(() => ({ authCallback: null }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        h.authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

import { CartProvider, useCart } from '@/hooks/useCart.jsx';

const CART_KEY = 'e-commerce-cart';

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
const mount = () => renderHook(() => useCart(), { wrapper });

// A simple product with an inventory-managed variant and currency info.
function makeProduct(id, { price, salePrice, manageInventory = false } = {}) {
  return {
    id,
    title: `Product ${id}`,
    variants: [{
      id: `${id}-v1`,
      price_in_cents: price,
      sale_price_in_cents: salePrice,
      manage_inventory: manageInventory,
      currency_info: { symbol: '$' },
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.authCallback = null;
  localStorage.clear();
});

// ─── initial state ──────────────────────────────────────────────────────────────

describe('CartProvider — initialization', () => {
  it('starts empty when localStorage has no cart', () => {
    const { result } = mount();
    expect(result.current.cartItems).toEqual([]);
    expect(result.current.isCartOpen).toBe(false);
  });

  it('hydrates the cart from localStorage', () => {
    const stored = [{ product: { id: 'p1' }, variant: { id: 'p1-v1' }, quantity: 2 }];
    localStorage.setItem(CART_KEY, JSON.stringify(stored));
    const { result } = mount();
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(2);
  });

  it('falls back to an empty cart when stored JSON is corrupt', () => {
    localStorage.setItem(CART_KEY, '{not json');
    const { result } = mount();
    expect(result.current.cartItems).toEqual([]);
  });
});

// ─── addToCart ────────────────────────────────────────────────────────────────

describe('addToCart', () => {
  it('adds a new item and opens the cart', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000 });
    await act(async () => { await result.current.addToCart(product); });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(1);
    expect(result.current.isCartOpen).toBe(true);
  });

  it('increments quantity when the same variant is added again', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000 });
    await act(async () => { await result.current.addToCart(product, undefined, 1); });
    await act(async () => { await result.current.addToCart(product, undefined, 2); });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(3);
  });

  it('rejects when inventory-managed stock would be exceeded', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000, manageInventory: true });
    const variant = product.variants[0];

    await expect(
      act(async () => { await result.current.addToCart(product, variant, 5, 3); }),
    ).rejects.toThrow(/Only 3 left/);
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('allows adding up to the available stock', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000, manageInventory: true });
    const variant = product.variants[0];
    await act(async () => { await result.current.addToCart(product, variant, 3, 3); });
    expect(result.current.cartItems[0].quantity).toBe(3);
  });
});

// ─── remove / update / clear ─────────────────────────────────────────────────

describe('removeFromCart / updateQuantity / clearCart', () => {
  it('removes an item by its variant id', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000 });
    await act(async () => { await result.current.addToCart(product); });
    act(() => { result.current.removeFromCart('p1-v1'); });
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('updates the quantity of an item', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000 });
    await act(async () => { await result.current.addToCart(product); });
    act(() => { result.current.updateQuantity('p1-v1', 5); });
    expect(result.current.cartItems[0].quantity).toBe(5);
  });

  it('removes the item when quantity is updated below 1', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1000 });
    await act(async () => { await result.current.addToCart(product); });
    act(() => { result.current.updateQuantity('p1-v1', 0); });
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('clears the entire cart', async () => {
    const { result } = mount();
    await act(async () => { await result.current.addToCart(makeProduct('p1', { price: 1000 })); });
    await act(async () => { await result.current.addToCart(makeProduct('p2', { price: 500 })); });
    act(() => { result.current.clearCart(); });
    expect(result.current.cartItems).toEqual([]);
  });
});

// ─── getCartTotal ─────────────────────────────────────────────────────────────

describe('getCartTotal', () => {
  it('returns $0.00 for an empty cart', () => {
    const { result } = mount();
    expect(result.current.getCartTotal()).toBe('$0.00');
  });

  it('sums price_in_cents across quantities', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 1500 }); // $15.00
    await act(async () => { await result.current.addToCart(product, undefined, 2); });
    expect(result.current.getCartTotal()).toBe('$30.00');
  });

  it('prefers sale_price_in_cents over price_in_cents', async () => {
    const { result } = mount();
    const product = makeProduct('p1', { price: 2000, salePrice: 1200 }); // sale $12.00
    await act(async () => { await result.current.addToCart(product); });
    expect(result.current.getCartTotal()).toBe('$12.00');
  });

  it('adds the totals of multiple distinct items', async () => {
    const { result } = mount();
    await act(async () => { await result.current.addToCart(makeProduct('p1', { price: 1000 })); });
    await act(async () => { await result.current.addToCart(makeProduct('p2', { price: 250 }), undefined, 2); });
    // 1000 + 250*2 = 1500
    expect(result.current.getCartTotal()).toBe('$15.00');
  });
});

// ─── persistence & sync ───────────────────────────────────────────────────────

describe('persistence and session sync', () => {
  it('persists the cart to localStorage', async () => {
    const { result } = mount();
    await act(async () => { await result.current.addToCart(makeProduct('p1', { price: 1000 })); });
    const stored = JSON.parse(localStorage.getItem(CART_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].product.id).toBe('p1');
  });

  it('clears the cart and storage on sign-out', async () => {
    const { result } = mount();
    await act(async () => { await result.current.addToCart(makeProduct('p1', { price: 1000 })); });
    expect(result.current.cartItems).toHaveLength(1);

    act(() => { h.authCallback('SIGNED_OUT', null); });
    expect(result.current.cartItems).toEqual([]);
    // The previous user's items must not remain in storage. (The persistence
    // effect re-writes an empty array right after the explicit removeItem.)
    expect(JSON.parse(localStorage.getItem(CART_KEY) ?? '[]')).toEqual([]);
  });

  it('syncs the cart across tabs via the storage event', () => {
    const { result } = mount();
    const incoming = [{ product: { id: 'x' }, variant: { id: 'x-v1' }, quantity: 4 }];
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: CART_KEY,
        newValue: JSON.stringify(incoming),
      }));
    });
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(4);
  });
});
