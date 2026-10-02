import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Admin → Products → Categories: add / remove / restore write the
// shop_categories overlay, never shop_products.

const db = vi.hoisted(() => ({ rows: [], calls: [] }));

vi.mock('@/lib/supabaseClient.js', () => {
  const from = (table) => {
    const b = {
      select: () => b,
      order: () => b,
      insert: (row) => { db.calls.push({ table, op: 'insert', row }); db.rows.push({ id: `n${db.rows.length}`, ...row }); return b; },
      delete: () => { db.calls.push({ table, op: 'delete' }); b._delete = true; return b; },
      eq: (_col, id) => { if (b._delete) { db.calls.at(-1).id = id; db.rows = db.rows.filter((r) => r.id !== id); } return b; },
      then: (resolve, reject) => Promise.resolve({ data: [...db.rows], error: null }).then(resolve, reject),
    };
    return b;
  };
  return { supabase: { from } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ShopCategoryManager from '@/components/admin/ShopCategoryManager.jsx';
import { resetShopCategoryCache } from '@/hooks/useShopCategoryGroups.js';

const products = [{ id: 'p1', category: 'Packing Tape' }, { id: 'p2', category: 'Packing Tape' }];
const renderManager = () => render(<ShopCategoryManager open onOpenChange={() => {}} products={products} />);

describe('ShopCategoryManager', () => {
  beforeEach(() => {
    db.rows = [];
    db.calls = [];
    resetShopCategoryCache();
    window.confirm = vi.fn(() => true);
  });

  it('adds a custom category under the chosen section', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.type(screen.getByLabelText('Name'), 'Booster Box Protectors');
    await user.click(screen.getByRole('button', { name: /Add category/ }));
    expect(db.calls).toEqual([{ table: 'shop_categories', op: 'insert', row: { section_slug: 'protection', name: 'Booster Box Protectors', description: null } }]);
    const protection = screen.getByRole('region', { name: 'Protection' });
    expect(await within(protection).findByText('Booster Box Protectors')).toBeInTheDocument();
  });

  it('blocks a duplicate name', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.type(screen.getByLabelText('Name'), 'Binders');
    expect(screen.getByText(/already exists under Storage/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add category/ })).toBeDisabled();
  });

  it('removes a built-in (warning about its products) and restores it', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(screen.getByRole('button', { name: 'Remove Packing Tape' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/2 products use it/));
    expect(db.calls[0]).toEqual({ table: 'shop_categories', op: 'insert', row: { section_slug: 'shipping', name: 'Packing Tape', hidden: true } });
    const shipping = screen.getByRole('region', { name: 'Shipping' });
    expect(within(shipping).queryByText('Packing Tape')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Restore Packing Tape' }));
    expect(db.calls[1]).toMatchObject({ op: 'delete', id: 'n0' });
    expect(await within(shipping).findByText('Packing Tape')).toBeInTheDocument();
  });
});
