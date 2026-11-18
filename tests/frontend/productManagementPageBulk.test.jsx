import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Admin Shop Products: tick several products, change their status together,
// edit prices in place — and nothing is written until the admin confirms the
// listed changes.

const db = vi.hoisted(() => ({
  rows: {
    shop_products: [
      { id: 'a', sku: 'TL-55PT', title: 'Top Loaders 55pt', category: 'Top Loaders', price_aud: 7.5, stock_quantity: 3, status: 'draft' },
      { id: 'b', sku: 'CP-TL-25', title: 'Top Loaders 25 Pack', category: 'Top Loaders', price_aud: 9.99, stock_quantity: 12, status: 'draft' },
      { id: 'c', sku: 'CP-BM-10', title: 'Bubble Mailers 10 Pack', category: 'Bubble Mailers', price_aud: 6.95, stock_quantity: 5, status: 'active' },
    ],
    shop_product_costs: [],
    shop_product_variants: [],
  },
  writes: [],
}));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    let write = null;
    const b = {
      select: () => b, order: () => b, limit: () => b,
      update: (patch) => { write = { table, patch }; db.writes.push(write); return b; },
      in: (col, ids) => { if (write) write.ids = ids; return b; },
      eq: (col, id) => { if (write) write.ids = [id]; return b; },
      then: (resolve, reject) => Promise.resolve({ data: write ? null : db.rows[table] ?? [], error: null }).then(resolve, reject),
    };
    return b;
  };
  return { supabase: { from: (table) => builder(table) } };
});
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));
vi.mock('@/components/ShopProductForm.jsx', () => ({ default: () => null }));
// Radix Select needs pointer APIs happy-dom lacks; a native select stands in.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }) => {
    const label = React.Children.toArray(children).map((c) => c.props?.['aria-label']).find(Boolean);
    return (
      <select aria-label={label} value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="" />
        {children}
      </select>
    );
  },
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));

import ProductManagementPage from '@/pages/admin/ProductManagementPage.jsx';

const open = async (user) => {
  render(<MemoryRouter><ProductManagementPage /></MemoryRouter>);
  await screen.findByText('Protection');
  await user.click(screen.getByRole('button', { name: /Expand all/ }));
};

describe('ProductManagementPage bulk status and confirmed price edits', () => {
  beforeEach(() => { window.localStorage.clear(); db.writes.length = 0; });

  it('selects a whole category from its header row', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole('checkbox', { name: 'Select all 2 products in Top Loaders' }));
    expect(screen.getByRole('checkbox', { name: 'Select Top Loaders 55pt' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Top Loaders 25 Pack' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Bubble Mailers 10 Pack' })).not.toBeChecked();
    expect(within(screen.getByRole('region', { name: 'Selected products' })).getByText('2 selected')).toBeInTheDocument();
  });

  it('lists a price change and writes it only after it is confirmed', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Edit sale price for Top Loaders 55pt' }));
    const input = screen.getByRole('spinbutton', { name: 'Sale price for Top Loaders 55pt' });
    await user.clear(input);
    await user.type(input, '8.25');
    await user.click(screen.getByRole('button', { name: /Save 1 change/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Top Loaders 55pt')).toBeInTheDocument();
    expect(within(dialog).getByText('$7.50')).toBeInTheDocument();
    expect(within(dialog).getByText('$8.25')).toBeInTheDocument();
    expect(db.writes).toEqual([]);

    // Cancel writes nothing and keeps the typed value.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(db.writes).toEqual([]);
    expect(screen.getByRole('spinbutton', { name: 'Sale price for Top Loaders 55pt' })).toHaveValue(8.25);

    await user.click(screen.getByRole('button', { name: /Save 1 change/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes, save changes' }));
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ table: 'shop_products', ids: ['a'], patch: { price_aud: 8.25 } });
  });
});

describe('ProductManagementPage bulk status change', () => {
  beforeEach(() => { window.localStorage.clear(); db.writes.length = 0; });

  it('changes the status of the ticked products once confirmed, skipping ones already there', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole('checkbox', { name: 'Select all products shown' }));
    const bar = screen.getByRole('region', { name: 'Selected products' });
    expect(within(bar).getByText('3 selected')).toBeInTheDocument();
    await user.selectOptions(within(bar).getByRole('combobox'), 'active');
    await user.click(within(bar).getByRole('button', { name: 'Change status' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Change 2 products to Active?')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 of the selected products is already Active/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Bubble Mailers 10 Pack')).not.toBeInTheDocument();
    expect(db.writes).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Yes, change status' }));
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ table: 'shop_products', ids: ['a', 'b'], patch: { status: 'active' } });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('needs a dispatch estimate before products can become pre-orders', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole('checkbox', { name: 'Select Top Loaders 55pt' }));
    const bar = screen.getByRole('region', { name: 'Selected products' });
    await user.selectOptions(within(bar).getByRole('combobox'), 'preorder');
    await user.click(within(bar).getByRole('button', { name: 'Change status' }));

    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Yes, change status' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Estimated dispatch/), 'Ships in 4–6 weeks');
    await user.click(confirm);
    expect(db.writes[0]).toMatchObject({ ids: ['a'], patch: { status: 'preorder', preorder_eta: 'Ships in 4–6 weeks' } });
  });
});
