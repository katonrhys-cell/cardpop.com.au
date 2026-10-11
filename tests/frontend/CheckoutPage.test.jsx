import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: mockFetch } }));

const h = vi.hoisted(() => ({
  cartItems: [],
  // Auth defaults to an identity-verified buyer so the normal checkout flow
  // renders; the marketplace identity gate is exercised in its own test.
  auth: { currentUser: { email: 'user@x.com' }, isIdentityVerified: true, profileLoading: false },
}));
vi.mock('@/hooks/useCart.jsx', () => ({ useCart: () => ({ cartItems: h.cartItems, removeFromCart: vi.fn(), setIsCartOpen: vi.fn() }) }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => h.auth }));

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    storage: { from: vi.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) })) },
  },
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

// Minimal stubs that expose each section's values as plain testids.
vi.mock('@/components/checkout/OrderSummary.jsx', () => ({
  default: ({ subtotal, total, serviceFee, gst }) => (
    <div>
      <span data-testid="subtotal">{subtotal}</span>
      <span data-testid="service-fee">{serviceFee}</span>
      <span data-testid="gst">{gst}</span>
      <span data-testid="total">{total}</span>
    </div>
  ),
}));
vi.mock('@/components/checkout/ShippingAddressForm.jsx', () => ({
  default: ({ onChange }) => (
    <button onClick={() => onChange({
      firstName: 'Ada', lastName: 'L', address: '1 St', suburb: 'Town',
      state: 'NSW', postcode: '2000', email: 'a@b.com',
    })}>fill-shipping</button>
  ),
}));
vi.mock('@/components/checkout/BillingAddressForm.jsx', () => ({ default: () => <div>billing-form</div> }));
vi.mock('@/components/checkout/PaymentMethodSelector.jsx', () => ({ default: () => <div>payment-selector</div> }));
vi.mock('@/components/checkout/OrderReviewSection.jsx', () => ({
  default: ({ total }) => <div data-testid="review-total">{total}</div>,
}));
// The inline Stripe form loads @stripe/js at runtime; stub it and surface the
// request body it would send so we can assert the order is built correctly.
vi.mock('@/components/checkout/EmbeddedStripeCheckout.jsx', () => ({
  default: ({ requestBody }) => <div data-testid="embedded-checkout">{JSON.stringify(requestBody)}</div>,
}));

import CheckoutPage from '@/pages/CheckoutPage.jsx';

const PRICING = { subtotalAud: 100, totalAud: 110, commissionAud: 8, gstAud: 2 };

function setFetch({ pricing = PRICING, checkout = { ok: true, url: 'https://stripe.test/session' } } = {}) {
  mockFetch.mockImplementation((url) => {
    if (url === '/stripe/calculate-cart') {
      return Promise.resolve({ ok: true, json: async () => pricing });
    }
    if (url === '/stripe/create-cart-checkout') {
      return Promise.resolve({
        ok: checkout.ok,
        json: async () => (checkout.ok ? { clientSecret: 'cs_test_123' } : { error: checkout.error }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

function cartItem(id, price) {
  return { product: { id, type: 'listing', title: 'Charizard', price }, quantity: 1, variant: null };
}

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/marketplace" element={<div>Marketplace Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  h.cartItems = [cartItem('l1', 100)];
  h.auth = { currentUser: { email: 'user@x.com' }, isIdentityVerified: true, profileLoading: false };
  setFetch();
  // Avoid happy-dom navigation when the success path assigns window.location.href.
  delete window.location;
  window.location = { origin: 'http://localhost', href: 'http://localhost/checkout' };
});

// ─── server pricing ─────────────────────────────────────────────────────────

describe('CheckoutPage — server pricing', () => {
  it('fetches authoritative pricing and shows the server totals', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('110'));

    expect(mockFetch).toHaveBeenCalledWith('/stripe/calculate-cart', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(mockFetch.mock.calls.find(([u]) => u === '/stripe/calculate-cart')[1].body);
    expect(body.items).toEqual([{ type: 'listing', id: 'l1', quantity: 1 }]);

    expect(screen.getByTestId('subtotal')).toHaveTextContent('100');
    expect(screen.getByTestId('service-fee')).toHaveTextContent('8'); // commission, shown separately
    expect(screen.getByTestId('gst')).toHaveTextContent('2'); // GST, shown separately
  });

  it('falls back to the client subtotal when pricing is unavailable', async () => {
    setFetch({ pricing: null });
    mockFetch.mockImplementation((url) => {
      if (url === '/stripe/calculate-cart') return Promise.resolve({ ok: false, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    renderCheckout();
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('100')); // client subtotal
  });
});

// ─── guards & validation ─────────────────────────────────────────────────────

describe('CheckoutPage — guards & validation', () => {
  it('shows an empty-cart state instead of the checkout form', async () => {
    h.cartItems = [];
    renderCheckout();
    await screen.findByText(/your cart is empty/i);
    // No shipping form / payment when there's nothing to buy.
    expect(screen.queryByText('fill-shipping')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review & pay/i })).not.toBeInTheDocument();
  });

  it('requires a complete shipping address before revealing payment', async () => {
    renderCheckout();
    await screen.findByText('fill-shipping');
    // Try to pay without filling the address.
    await userEvent.click(screen.getByRole('button', { name: /review & pay/i }));
    expect(mockToast.error).toHaveBeenCalledWith('Please fill in all shipping address fields.');
    expect(screen.queryByTestId('embedded-checkout')).not.toBeInTheDocument();
  });
});

// ─── marketplace identity gate ───────────────────────────────────────────────

describe('CheckoutPage — marketplace identity gate', () => {
  it('asks a signed-out buyer for an account on any marketplace card, with a return path', async () => {
    h.auth = { currentUser: null, isIdentityVerified: false, profileLoading: false };
    renderCheckout();
    await waitFor(() => expect(screen.getByText(/sign in to buy marketplace cards/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /create a free account/i })).toHaveAttribute('href', '/signup?next=%2Fcheckout');
    // The order summary / payment flow is not rendered while blocked.
    expect(screen.queryByText('fill-shipping')).not.toBeInTheDocument();
  });

  it('lets an unverified member buy a marketplace card under the ID threshold', async () => {
    h.auth = { currentUser: { email: 'user@x.com' }, isIdentityVerified: false, profileLoading: false };
    h.cartItems = [cartItem('l1', 499)];
    renderCheckout();
    await screen.findByText('fill-shipping');
    expect(screen.queryByText(/one quick id check/i)).not.toBeInTheDocument();
  });

  it('asks an unverified member for the ID check once the marketplace items reach the threshold', async () => {
    h.auth = { currentUser: { email: 'user@x.com' }, isIdentityVerified: false, profileLoading: false };
    h.cartItems = [cartItem('l1', 300), cartItem('l2', 200)];
    renderCheckout();
    await waitFor(() => expect(screen.getByText(/one quick id check before this purchase/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /verify with stripe/i })).toHaveAttribute('href', '/verify-identity?next=%2Fcheckout');
    expect(screen.queryByText('fill-shipping')).not.toBeInTheDocument();
  });

  it('lets a mixed cart pay for its shop items while the cards wait', async () => {
    h.auth = { currentUser: null, isIdentityVerified: false, profileLoading: false };
    h.cartItems = [cartItem('l1', 100), { product: { id: 'p1', type: 'shop', title: 'Booster', price: 10 }, quantity: 1, variant: null }];
    renderCheckout();
    await userEvent.click(await screen.findByRole('button', { name: /check out the shop item now/i }));
    await screen.findByText('fill-shipping');
    expect(screen.getByText(/paying for your shop items only/i)).toBeInTheDocument();
    const priced = mockFetch.mock.calls.filter(([url]) => url === '/stripe/calculate-cart').at(-1);
    expect(JSON.parse(priced[1].body).items).toEqual([{ type: 'shop', id: 'p1', quantity: 1 }]);
  });

  it('does NOT gate a shop-only cart for an unverified buyer', async () => {
    h.auth = { currentUser: { email: 'user@x.com' }, isIdentityVerified: false, profileLoading: false };
    h.cartItems = [{ product: { id: 'p1', type: 'shop', title: 'Booster', price: 10 }, quantity: 1, variant: null }];
    renderCheckout();
    await screen.findByText('fill-shipping');
    expect(screen.queryByText(/sign in to buy marketplace cards/i)).not.toBeInTheDocument();
  });

  it('does NOT gate an Official CardPop Store listing for a guest', async () => {
    h.auth = { currentUser: null, isIdentityVerified: false, profileLoading: false };
    h.cartItems = [{ product: { id: 'l1', type: 'listing', officialStore: true, title: 'Charizard', price: 100 }, quantity: 1, variant: null }];
    renderCheckout();
    await screen.findByText('fill-shipping');
    expect(screen.queryByText(/sign in to buy marketplace cards/i)).not.toBeInTheDocument();
  });

  it('still gates a guest when the cart mixes an official and a community listing', async () => {
    h.auth = { currentUser: null, isIdentityVerified: false, profileLoading: false };
    h.cartItems = [
      { product: { id: 'l1', type: 'listing', officialStore: true, title: 'Charizard', price: 100 }, quantity: 1, variant: null },
      { product: { id: 'l2', type: 'listing', title: 'Pikachu', price: 20 }, quantity: 1, variant: null },
    ];
    renderCheckout();
    await waitFor(() =>
      expect(screen.getByText(/sign in to buy marketplace cards/i)).toBeInTheDocument(),
    );
  });
});

// ─── full checkout flow ──────────────────────────────────────────────────────

describe('CheckoutPage — checkout flow', () => {
  async function reachPayment() {
    await screen.findByText('fill-shipping');
    await userEvent.click(screen.getByText('fill-shipping'));                    // populate address
    await userEvent.click(screen.getByRole('button', { name: /review & pay/i })); // reveal payment
    await screen.findByTestId('embedded-checkout');
  }

  it('reveals the inline payment form and passes items + shipping to Stripe', async () => {
    renderCheckout();
    await reachPayment();

    // The inline Stripe form is mounted with the authoritative order body — no
    // redirect off the page.
    const body = JSON.parse(screen.getByTestId('embedded-checkout').textContent);
    expect(body.items).toEqual([{ type: 'listing', id: 'l1', quantity: 1 }]);
    expect(body.shippingAddress).toMatchObject({ name: 'Ada L', postcode: '2000', state: 'NSW' });
    expect(window.location.href).toBe('http://localhost/checkout'); // stayed on-page
  });

  it('flags the address to be saved for a signed-in buyer', async () => {
    renderCheckout();
    await reachPayment();
    const body = JSON.parse(screen.getByTestId('embedded-checkout').textContent);
    expect(body.saveShippingAddress).toBe(true);
  });
});
