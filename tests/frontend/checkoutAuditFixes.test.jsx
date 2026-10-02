import React from 'react';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── shared mocks ──────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({
  default: { fetch: mockFetch },
  apiServerClient: { fetch: mockFetch },
}));

const h = vi.hoisted(() => ({
  auth: { currentUser: { email: 'user@x.com' }, isIdentityVerified: true, profileLoading: false },
}));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => h.auth }));

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    storage: { from: vi.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) })) },
  },
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/components/checkout/OrderSummary.jsx', () => ({ default: () => <div>summary</div> }));
vi.mock('@/components/checkout/ShippingAddressForm.jsx', () => ({
  default: ({ values, onChange }) => (
    <div>
      <button onClick={() => onChange({
        firstName: 'Ada', lastName: 'L', address: '1 St', suburb: 'Town',
        state: 'NSW', postcode: '2000', email: 'a@b.com',
      })}>fill-shipping</button>
      <input
        aria-label="Street address"
        value={values.address || ''}
        onChange={(e) => onChange({ ...values, address: e.target.value })}
      />
    </div>
  ),
}));
vi.mock('@/components/checkout/BillingAddressForm.jsx', () => ({ default: () => <div>billing-form</div> }));
vi.mock('@/components/checkout/PaymentMethodSelector.jsx', () => ({ default: () => <div>payment-selector</div> }));
vi.mock('@/components/checkout/OrderReviewSection.jsx', () => ({ default: () => <div>review</div> }));

// Count how many times the Stripe form is handed a *new* request body — each
// new body is a new Checkout Session + pending order on the server.
const bodies = vi.hoisted(() => ({ seen: [] }));
vi.mock('@/components/checkout/EmbeddedStripeCheckout.jsx', async () => {
  const ReactMod = await import('react');
  const EmbeddedStripeCheckoutStub = ({ requestBody }) => {
    ReactMod.useEffect(() => { bodies.seen.push(requestBody); }, [requestBody]);
    return <div data-testid="embedded-checkout">{JSON.stringify(requestBody)}</div>;
  };
  return { default: EmbeddedStripeCheckoutStub };
});

const cartState = vi.hoisted(() => ({ items: [] }));
vi.mock('@/hooks/useCart.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useCart: () => ({ cartItems: cartState.items, setIsCartOpen: vi.fn() }) };
});

import CheckoutPage from '@/pages/CheckoutPage.jsx';
import CheckoutModal from '@/components/CheckoutModal.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  bodies.seen = [];
  cartState.items = [{ product: { id: 'l1', type: 'listing', title: 'Charizard', price: 100 }, quantity: 1, variant: null }];
  mockFetch.mockImplementation((url) => {
    if (url === '/stripe/calculate-cart') {
      return Promise.resolve({ ok: true, json: async () => ({ subtotalAud: 100, totalAud: 110 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes><Route path="/checkout" element={<CheckoutPage />} /></Routes>
    </MemoryRouter>,
  );
}

// ─── 1. Stripe session is created once per "Review & pay" ─────────────────────

describe('CheckoutPage — payment request is snapshotted at Review & pay', () => {
  it('locks the details so edits cannot create another Stripe session', async () => {
    const user = userEvent.setup();
    renderCheckout();
    await user.click(await screen.findByText('fill-shipping'));
    await user.click(screen.getByRole('button', { name: /review & pay/i }));
    await screen.findByTestId('embedded-checkout');

    const address = screen.getByLabelText('Street address');
    expect(address).toBeDisabled();
    expect(screen.getByTestId('checkout-details')).toBeDisabled();

    // Even a forced edit attempt doesn't reach the payment request.
    await user.type(address, 'xyz');
    expect(bodies.seen).toHaveLength(1);
    expect(JSON.parse(screen.getByTestId('embedded-checkout').textContent).shippingAddress.address).toBe('1 St');
  });

  it('"Edit details" returns to the form; re-submitting snapshots the new details', async () => {
    const user = userEvent.setup();
    renderCheckout();
    await user.click(await screen.findByText('fill-shipping'));
    await user.click(screen.getByRole('button', { name: /review & pay/i }));
    await screen.findByTestId('embedded-checkout');

    await user.click(screen.getByRole('button', { name: /edit details/i }));
    expect(screen.queryByTestId('embedded-checkout')).not.toBeInTheDocument();
    const address = screen.getByLabelText('Street address');
    expect(address).not.toBeDisabled();
    await user.clear(address);
    await user.type(address, '2 Rd');
    // Typing with the form open never creates a session.
    expect(bodies.seen).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /review & pay/i }));
    await screen.findByTestId('embedded-checkout');
    expect(bodies.seen).toHaveLength(2);
    expect(bodies.seen[1].shippingAddress.address).toBe('2 Rd');
  });
});

// ─── 2. Single-item checkout returns to /checkout-success with the session id ─

describe('CheckoutModal — success URL', () => {
  it('sends the buyer to /checkout-success with the Stripe session placeholder', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.startsWith('/stripe/calculate')) {
        return Promise.resolve({ ok: true, json: async () => ({ itemPrice: 100, commissionAud: 0, shippingAud: 0, total: 100 }) });
      }
      if (url === '/stripe/create-checkout') {
        return Promise.resolve({ ok: true, json: async () => ({ url: 'https://stripe.test/s' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    const realLocation = window.location;
    delete window.location;
    window.location = { origin: 'http://localhost', href: 'http://localhost/marketplace/l1' };
    try {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <CheckoutModal isOpen onClose={() => {}} listingId="l1" />
        </MemoryRouter>,
      );
      const pay = await screen.findByRole('button', { name: /pay \$100\.00/i });
      await user.click(pay);
      await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/stripe/create-checkout', expect.anything()));
      const body = JSON.parse(mockFetch.mock.calls.find(([u]) => u === '/stripe/create-checkout')[1].body);
      expect(body.successUrl).toBe('http://localhost/checkout-success?session_id={CHECKOUT_SESSION_ID}&single=1');
    } finally {
      window.location = realLocation;
    }
  });
});

// ─── 3. updateQuantity respects stock ─────────────────────────────────────────

describe('useCart — updateQuantity clamps to stock', () => {
  it('never raises a line above inventory_quantity, but still allows decreases', async () => {
    const { CartProvider, useCart: realUseCart } = await vi.importActual('@/hooks/useCart.jsx');
    localStorage.clear();
    const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
    const { result } = renderHook(() => realUseCart(), { wrapper });
    const product = { id: 'p1', title: 'Sleeves', type: 'shop' };
    const variant = { id: 'p1-v', manage_inventory: true, inventory_quantity: 3 };
    await act(() => result.current.addToCart(product, variant, 1, 3));

    act(() => result.current.updateQuantity('p1-v', 5));
    expect(result.current.cartItems[0].quantity).toBe(3);
    act(() => result.current.updateQuantity('p1-v', 2));
    expect(result.current.cartItems[0].quantity).toBe(2);
  });

  it('leaves unmanaged stock unbounded', async () => {
    const { CartProvider, useCart: realUseCart } = await vi.importActual('@/hooks/useCart.jsx');
    localStorage.clear();
    const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
    const { result } = renderHook(() => realUseCart(), { wrapper });
    await act(() => result.current.addToCart({ id: 'p2', type: 'shop' }, { id: 'p2-v', manage_inventory: false }, 1));
    act(() => result.current.updateQuantity('p2-v', 50));
    expect(result.current.cartItems[0].quantity).toBe(50);
  });
});
