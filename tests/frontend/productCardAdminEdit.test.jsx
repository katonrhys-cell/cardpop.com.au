import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';

const auth = vi.hoisted(() => ({ value: { isAdmin: true } }));
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn() }, apiServerClient: { fetch: vi.fn() } }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProductCard from '@/components/ProductCard.jsx';

const shop = { id: 'shop-1', source: 'shop', type: 'shop', title: '9-Pocket Binder', price_aud: 49.95, images: [], stock_quantity: 5, status: 'active' };
const listing = { id: 'list-1', source: 'marketplace', name: 'Charizard', price: 100, images: [] };

const renderCard = (product) => render(
  <MemoryRouter><ProductCard product={product} onAddToCart={vi.fn()} /></MemoryRouter>,
);

afterEach(() => { cleanup(); auth.value = { isAdmin: true }; });

describe('ProductCard admin pencil', () => {
  it('links a shop card to its product form', () => {
    renderCard(shop);
    expect(screen.getByTestId('admin-card-edit')).toHaveAttribute('href', '/admin/products?edit=shop-1');
  });

  it('links a marketplace card to its listing dialog', () => {
    renderCard(listing);
    expect(screen.getByTestId('admin-card-edit')).toHaveAttribute('href', '/admin/all-listings?listing=list-1');
  });

  it('is not shown to a non-admin', () => {
    auth.value = { isAdmin: false };
    renderCard(shop);
    expect(screen.queryByTestId('admin-card-edit')).toBeNull();
  });

  it('is not shown to a signed-out visitor / outside the auth provider', () => {
    auth.value = undefined;
    renderCard(shop);
    expect(screen.queryByTestId('admin-card-edit')).toBeNull();
  });
});
