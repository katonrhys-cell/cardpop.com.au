import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn() }, apiServerClient: { fetch: vi.fn() } }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: null, profile: null }) }));

import ProductCard from '@/components/ProductCard.jsx';
import SoldBadge from '@/components/SoldBadge.jsx';

// Vault rows reach ProductCard (seller profile grids) carrying their marketplace
// listing via VAULT_ITEM_CARD_SELECT. The vault row's listing_type still reads
// "For Sale" after a sale — only the embedded listing knows it sold.
const vaultRow = (listings) => ({
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  source: 'vault',
  name: 'Victor Wembanyama',
  listing_type: 'For Sale',
  price: 400,
  images: [],
  listings,
});

const renderCard = (product) =>
  render(
    <MemoryRouter>
      <ProductCard product={product} onAddToCart={vi.fn()} />
    </MemoryRouter>,
  );

describe('SoldBadge', () => {
  it('renders the red "Sold" pill', () => {
    render(<SoldBadge />);
    const pill = screen.getByText('Sold');
    expect(pill.className).toMatch(/bg-brand-red/);
    expect(pill.className).toMatch(/rounded-full/);
  });
});

describe('ProductCard sold listing', () => {
  it('pills a vault card whose listing has sold and hides Add to Cart', () => {
    renderCard(vaultRow([{ id: 'l1', status: 'sold' }]));
    expect(screen.getAllByText('Sold').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it('does not pill a relisted card (active listing wins over the old sold one)', () => {
    renderCard(vaultRow([{ id: 'l1', status: 'sold' }, { id: 'l2', status: 'active' }]));
    expect(screen.queryByText('Sold')).not.toBeInTheDocument();
  });

  it('pills a sold marketplace-sourced row', () => {
    renderCard({ ...vaultRow(undefined), source: 'marketplace', status: 'sold' });
    expect(screen.getAllByText('Sold').length).toBeGreaterThan(0);
  });

  it('does not pill an available card', () => {
    renderCard(vaultRow([{ id: 'l1', status: 'active' }]));
    expect(screen.queryByText('Sold')).not.toBeInTheDocument();
  });
});
