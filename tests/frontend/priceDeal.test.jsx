import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn() }, apiServerClient: { fetch: vi.fn() } }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: null, profile: null }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProductCard from '@/components/ProductCard.jsx';
import { getPriceDeal, formatSaving } from '@/utils/priceDeal.js';

describe('getPriceDeal', () => {
  it('computes saving and whole-number percent', () => {
    expect(getPriceDeal(9.95, 12.95)).toEqual({ rrp: 12.95, price: 9.95, saving: 3, pct: 23 });
  });
  it('is null unless the RRP is genuinely higher', () => {
    expect(getPriceDeal(10, 10)).toBeNull();
    expect(getPriceDeal(12, 10)).toBeNull();
    expect(getPriceDeal(10, null)).toBeNull();
    expect(getPriceDeal(0, 10)).toBeNull();
    expect(getPriceDeal(9.99, 10)).toBeNull(); // rounds to 0%
  });
  it('formats savings', () => {
    expect(formatSaving(3)).toBe('$3');
    expect(formatSaving(3.5)).toBe('$3.50');
  });
});

const shop = { id: 'a', source: 'shop', title: 'Top Loaders 75pt', price_aud: 9.95, retail_price_aud: 12.95, images: [], stock_quantity: 5 };
const renderCard = (p) => render(<MemoryRouter><ProductCard product={p} onAddToCart={vi.fn()} /></MemoryRouter>);

describe('ProductCard deal presentation', () => {
  it('shows the percent ribbon, saving line and red price', () => {
    renderCard(shop);
    expect(screen.getByText('23% off')).toBeTruthy();
    expect(screen.getByText(/You save \$3 \(23% off RRP\)/)).toBeTruthy();
    expect(screen.getByTestId('deal-price').className).toContain('text-brand-red');
  });
  it('shows nothing promotional without a real RRP', () => {
    renderCard({ ...shop, retail_price_aud: null });
    expect(screen.queryByText(/You save/)).toBeNull();
  });
  it('hides the deal on sold-out items', () => {
    renderCard({ ...shop, stock_quantity: 0 });
    expect(screen.queryByText(/You save/)).toBeNull();
  });
});
