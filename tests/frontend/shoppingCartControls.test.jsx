import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [] }) })) },
}));
vi.mock('@/components/BnplMessage.jsx', () => ({ default: () => null }));
const apiFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })));
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: apiFetch } }));
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: auth.user, isIdentityVerified: false }) }));
vi.mock('@/contexts/PlatformSettingsContext.jsx', () => ({
  usePlatformSettings: () => ({ settings: { marketplace_identity_threshold_aud: 500, free_shipping_threshold_aud: 100, default_shipping_rate_aud: 15 } }),
}));

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

beforeEach(() => { cart.items = []; auth.user = null; apiFetch.mockReset(); apiFetch.mockImplementation(() => Promise.resolve({ ok: false, json: async () => ({}) })); });

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

// ─── honest totals, free-shipping bar, marketplace notice ─────────────────────

describe('ShoppingCart — totals and notices', () => {
  it('shows the server estimate (fees + shipping) as the Total once it arrives', async () => {
    cart.items = [line(1, 5)];
    apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ totalAud: 27.85, commissionAud: 0, processingAud: 0.85, shippingAud: 15, includedGstAud: 2.53 }) });
    renderCart();
    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent('$27.85'));
    expect(screen.getByText('Payment processing')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).items).toEqual([{ type: 'shop', id: 'p1', quantity: 1 }]);
  });

  it('falls back to an honest "fees & shipping at checkout" line when the estimate fails', async () => {
    cart.items = [line(1, 5)];
    apiFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'nope' }) });
    renderCart();
    await waitFor(() => expect(screen.getByText(/shown at checkout/i)).toBeInTheDocument());
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$0.00');
  });

  it('tells the shopper how far they are from free shipping on shop items', async () => {
    cart.items = [line(2, 5)]; // 2 × $10 of shop items, threshold $100
    renderCart();
    expect(screen.getByTestId('free-shipping-bar')).toHaveTextContent('Add $80.00 more');
  });

  it('warns a signed-out shopper that marketplace cards need an account', () => {
    cart.items = [{ product: { id: 'l1', type: 'listing', title: 'Charizard', price: 50, source: 'marketplace' }, variant: null, quantity: 1 }];
    renderCart();
    expect(screen.getByTestId('marketplace-gate-note')).toHaveTextContent(/free CardPop account/i);
  });

  it('warns a signed-in, unverified shopper only once the cards reach the ID threshold', () => {
    auth.user = { id: 'u1' };
    cart.items = [{ product: { id: 'l1', type: 'listing', title: 'Charizard', price: 50, source: 'marketplace' }, variant: null, quantity: 1 }];
    const { unmount } = renderCart();
    expect(screen.queryByTestId('marketplace-gate-note')).not.toBeInTheDocument();
    unmount();
    cart.items = [{ product: { id: 'l1', type: 'listing', title: 'Charizard', price: 500, source: 'marketplace' }, variant: null, quantity: 1 }];
    renderCart();
    expect(screen.getByTestId('marketplace-gate-note')).toHaveTextContent(/ID check/i);
  });
});
