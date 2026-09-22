import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: mockFetch }, apiServerClient: { fetch: mockFetch } }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: { email: 'ash@example.com' }, profile: { display_name: 'Ash' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProductCard from '@/components/ProductCard.jsx';
import { isSoldOut } from '@/utils/shopStock.js';

const base = {
  id: '11111111-2222-4333-8444-555555555555',
  source: 'shop',
  type: 'shop',
  title: 'Palms Off 9-Pocket Binder',
  price_aud: 49.95,
  images: [],
};

const renderCard = (product, onAddToCart = vi.fn()) =>
  render(
    <MemoryRouter>
      <ProductCard product={product} onAddToCart={onAddToCart} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockFetch.mockReset();
});

describe('isSoldOut', () => {
  it('is true only when stock is tracked and zero', () => {
    expect(isSoldOut({ stock_quantity: 0 })).toBe(true);
    expect(isSoldOut({ stock_quantity: '0' })).toBe(true);
    expect(isSoldOut({ stockQuantity: 0 })).toBe(true);
    expect(isSoldOut({ stock_quantity: 3 })).toBe(false);
    expect(isSoldOut({ stock_quantity: null })).toBe(false);
    expect(isSoldOut({})).toBe(false);
    expect(isSoldOut(null)).toBe(false);
  });
});

describe('ProductCard sold-out state', () => {
  it('shows Add to Cart for an in-stock shop product', () => {
    renderCard({ ...base, stock_quantity: 5 });
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    expect(screen.queryByText(/sold out/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enquire/i })).not.toBeInTheDocument();
  });

  it('replaces Add to Cart with Sold out + Enquire when stock is 0', () => {
    const onAddToCart = vi.fn();
    renderCard({ ...base, stock_quantity: 0 }, onAddToCart);
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/sold out/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /enquire/i })).toBeInTheDocument();
    expect(onAddToCart).not.toHaveBeenCalled();
  });

  it('shows a Coming soon button (not Add to Cart) for a coming_soon product and posts reason=coming_soon', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderCard({ ...base, status: 'coming_soon', stock_quantity: 0 });
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
    // Coming soon wins over sold out even with 0 stock.
    expect(screen.queryByText(/sold out/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /coming soon/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/register your interest/i);
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ productId: base.id, reason: 'coming_soon' });
  });

  it('does not flag marketplace/vault items that have no stock column', () => {
    renderCard({ ...base, source: 'marketplace', stock_quantity: undefined });
    expect(screen.queryByText(/sold out/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
  });

  it('Enquire opens a dialog that posts to /shop-enquiry with the product id', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderCard({ ...base, stock_quantity: 0 });

    fireEvent.click(screen.getByRole('button', { name: /enquire/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/enquire about this item/i);

    // Pre-filled from the signed-in account.
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Ash');
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ash@example.com');

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Restock soon?' } });
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/shop-enquiry');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      productId: base.id,
      name: 'Ash',
      email: 'ash@example.com',
      message: 'Restock soon?',
      company: '',
    });

    expect(await screen.findByText(/enquiry sent/i)).toBeInTheDocument();
  });

  it('surfaces a server error with a mailto fallback to admin', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'Provider down' }) });
    renderCard({ ...base, stock_quantity: 0 });
    fireEvent.click(screen.getByRole('button', { name: /enquire/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Provider down');
    expect(alert.querySelector('a').getAttribute('href')).toMatch(/^mailto:noreply@cardpop\.com\.au/);
  });
});
