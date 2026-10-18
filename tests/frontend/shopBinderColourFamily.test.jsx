import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A binder line whose colours are separate products (family_sku = line SKU):
// the page lists the colours, and picking one swaps price, photos and the
// product that goes in the cart.

const state = vi.hoisted(() => ({ family: [], added: [] }));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const filters = {};
    const b = {
      select: () => b,
      eq: (k, v) => { filters[k] = v; return b; },
      in: () => b,
      maybeSingle: () => Promise.resolve({ data: null, error: null }), // the combined line row is archived
      then: (resolve, reject) => Promise.resolve({
        data: table === 'shop_products' && filters.family_sku ? state.family : [],
        error: null,
      }).then(resolve, reject),
    };
    return b;
  };
  // The related-binder cards build their image URLs through utils/imageUrl.js,
  // which reads supabase.storage — give it a plain public-URL shape.
  const storage = {
    from: (bucket) => ({
      getPublicUrl: (path) => ({
        data: { publicUrl: `https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/${bucket}/${path}` },
      }),
    }),
  };
  return { supabase: { from: (t) => builder(t), storage } };
});
vi.mock('@/hooks/useCart.jsx', () => ({
  useCart: () => ({
    addToCart: (product, variant) => { state.added.push({ product, variant }); return Promise.resolve(); },
    setIsCartOpen: vi.fn(),
  }),
}));
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));
vi.mock('@/components/ProductImageCarousel.jsx', () => ({
  default: ({ images }) => <div data-testid="gallery">{images[0]}</div>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ShopBinderProductPage from '@/pages/shop/ShopBinderProductPage.jsx';
import { BINDER_PRODUCTS } from '@/data/shopBinderProducts.js';

const line = BINDER_PRODUCTS.find((p) => p.sku === 'ZB-04');
const colour = (c, code, price, extra = {}) => ({
  id: `id-${code}`, sku: `ZB-04-${code}`, title: `${line.title} — ${c}`, colour: c, colour_hex: null,
  stock_quantity: 5, price_aud: price, retail_price_aud: null, status: 'active',
  images: [`https://img/${code}.png`], image_url: `https://img/${code}.png`, family_sku: 'ZB-04', ...extra,
});

const renderPage = () => render(
  <MemoryRouter initialEntries={[`/shop/binders/${line.slug}`]}>
    <Routes><Route path="/shop/binders/:productSlug" element={<ShopBinderProductPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  state.added = [];
  state.family = [colour('Pink', 'PNK', 36.95), colour('Black', 'BLK', 33.95)];
});

describe('Binder page with colours as separate products', () => {
  it('shows every colour, defaults to the first swatch and its own price and photo', async () => {
    renderPage();
    expect(await screen.findByRole('radio', { name: 'Black' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Pink' })).toBeInTheDocument();
    expect(screen.getAllByText(/33\.95/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('gallery')).toHaveTextContent('https://img/BLK.png');
  });

  it('switching colour swaps the price, photo and the product added to the cart', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('radio', { name: 'Pink' }));
    expect(screen.getAllByText(/36\.95/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('gallery')).toHaveTextContent('https://img/PNK.png');
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(state.added[0].product).toMatchObject({ id: 'id-PNK', title: `${line.title} — Pink`, price: 36.95 });
    expect(state.added[0].variant).toMatchObject({ id: 'id-PNK', price_in_cents: 3695 });
  });
});
