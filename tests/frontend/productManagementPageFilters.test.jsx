import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Admin Shop Products: the table is split into Shop-menu sections, columns
// sort on click, and the status cards filter the list.

const rows = vi.hoisted(() => ({
  shop_products: [
    { id: 'a', sku: 'TL-55PT', title: 'Palms Off Top Loaders 55pt', category: 'Top Loaders', price_aud: 7.5, stock_quantity: 0, status: 'coming_soon', brand: 'Palms Off Gaming' },
    { id: 'b', sku: 'CP-TL-25', title: 'Top Loaders 25 Pack', category: 'Top Loaders', price_aud: 9.99, stock_quantity: 12, status: 'active', brand: null },
    { id: 'c', sku: 'CP-BM-10', title: 'Bubble Mailers 10 Pack', category: 'Bubble Mailers', price_aud: 6.95, stock_quantity: 5, status: 'active', brand: null },
  ],
  shop_product_costs: [],
  shop_product_variants: [],
}));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = {
      select: () => b, order: () => b, limit: () => b,
      then: (resolve, reject) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject),
    };
    return b;
  };
  return { supabase: { from: (table) => builder(table) } };
});
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));
vi.mock('@/components/ShopProductForm.jsx', () => ({ default: () => null }));

import ProductManagementPage from '@/pages/admin/ProductManagementPage.jsx';

const renderPage = () => render(<MemoryRouter><ProductManagementPage /></MemoryRouter>);
const productNames = () => screen.getAllByRole('row')
  .map((r) => within(r).queryAllByRole('cell')[0]?.textContent)
  .filter((t) => t && !t.includes('·'));

describe('ProductManagementPage filters, sorting and sections', () => {
  beforeEach(() => window.localStorage.clear());

  it('groups products under their Shop section and category', async () => {
    renderPage();
    expect(await screen.findByText('Protection')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Top Loaders · 2')).toBeInTheDocument();
    expect(screen.getByText('Bubble Mailers · 1')).toBeInTheDocument();
  });

  it('sorts by a column in the flat list view', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Protection');
    await user.click(screen.getByRole('button', { name: /List/ }));
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    expect(productNames()).toEqual(['Top Loaders 25 Pack', 'Palms Off Top Loaders 55pt', 'Bubble Mailers 10 Pack']);
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    expect(productNames()).toEqual(['Bubble Mailers 10 Pack', 'Palms Off Top Loaders 55pt', 'Top Loaders 25 Pack']);
  });

  it('filters by status from the summary cards and can clear it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Protection');
    await user.click(screen.getByRole('button', { name: /Coming Soon/ }));
    expect(productNames()).toEqual(['Palms Off Top Loaders 55pt']);
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear \(1\)/ }));
    expect(productNames()).toHaveLength(3);
  });

  it('collapses and expands sections and categories, remembering the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await screen.findByText('Protection');
    expect(productNames()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /Top Loaders · 2/ }));
    expect(productNames()).toEqual(['Bubble Mailers 10 Pack']);
    expect(screen.getByRole('button', { name: /Top Loaders · 2/ })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: /Shipping/ }));
    expect(productNames()).toEqual([]);
    expect(screen.queryByText('Bubble Mailers · 1')).not.toBeInTheDocument();

    unmount();
    renderPage();
    await screen.findByText('Protection');
    expect(productNames()).toEqual([]);

    await user.click(screen.getByRole('button', { name: /Expand all/ }));
    expect(productNames()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /Collapse all/ }));
    expect(productNames()).toEqual([]);
  });
});
