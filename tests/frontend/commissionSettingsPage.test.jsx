import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────
// The page talks to Supabase directly. The mock records every update so the
// tests can assert WHICH settings key each admin toggle writes — the guard
// this file exists for: two toggles bound to the same key silently disabled
// Buy Now commission (the platform's main revenue path) whenever the offers
// toggle was switched off.

const state = vi.hoisted(() => ({
  tables: {},
  updates: [],
  updateResult: { data: [{ key: 'x' }], error: null },
}));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const ctx = { table, update: null, eqs: [] };
    const b = {
      select: vi.fn(() => b),
      in: vi.fn(() => b),
      gte: vi.fn(() => b),
      order: vi.fn(() => b),
      range: vi.fn(() => b),
      limit: vi.fn(() => b),
      update: vi.fn((payload) => { ctx.update = payload; return b; }),
      eq: vi.fn((col, val) => { ctx.eqs.push([col, val]); return b; }),
      then: (resolve, reject) => {
        if (ctx.update) {
          state.updates.push({ table: ctx.table, payload: ctx.update, eqs: ctx.eqs });
          return Promise.resolve(state.updateResult).then(resolve, reject);
        }
        return Promise.resolve(state.tables[ctx.table] ?? { data: [], error: null }).then(resolve, reject);
      },
    };
    return b;
  };
  return { supabase: { from: vi.fn((table) => builder(table)) } };
});

vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));

import { toast } from 'sonner';
import CommissionSettingsPage from '@/pages/admin/CommissionSettingsPage.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const SETTINGS_ROWS = [
  { key: 'commissions_enabled', value: true },
  { key: 'gst_enabled', value: true },
  { key: 'gst_on_commission_only', value: false },
  { key: 'commission_on_fixed', value: true },
  { key: 'commission_on_offers', value: true },
  { key: 'commission_on_auctions', value: true },
  { key: 'commission_on_trades', value: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.updates = [];
  state.updateResult = { data: [{ key: 'x' }], error: null };
  state.tables = {
    fee_config: { data: [], error: null },
    platform_settings: { data: SETTINGS_ROWS, error: null },
    orders: { data: [], error: null },
  };
});

// The switch has no accessible name of its own — resolve it from the visible
// toggle label it sits beside.
const toggleFor = (label) => {
  const row = screen.getByText(label).closest('div').parentElement;
  const el = row.querySelector('[role="switch"]');
  expect(el).toBeTruthy();
  return el;
};

const settingsUpdates = () => state.updates.filter((u) => u.table === 'platform_settings');
const updatedKey = (u) => u.eqs.find(([col]) => col === 'key')?.[1];

describe('CommissionSettingsPage toggles', () => {
  it('binds every commission toggle to its own distinct settings key', async () => {
    const user = userEvent.setup();
    render(<CommissionSettingsPage />);
    await screen.findByText('Commission on Buy Now / Fixed');

    await user.click(toggleFor('Commission on Buy Now / Fixed'));
    await user.click(toggleFor('Commission on Offers'));
    await user.click(toggleFor('Commission on Auctions'));
    await user.click(toggleFor('Commission on Trades'));

    await waitFor(() => expect(settingsUpdates()).toHaveLength(4));
    const keys = settingsUpdates().map(updatedKey);

    // The revenue regression this guards: "Buy Now / Fixed" and "Offers" were
    // both bound to commission_on_offers, so the four toggles wrote 3 keys and
    // disabling offer commission silently disabled Buy Now commission too.
    expect(keys).toContain('commission_on_fixed');
    expect(keys).toContain('commission_on_offers');
    expect(new Set(keys).size).toBe(4);
  });

  it('writes the toggled value for the targeted key only', async () => {
    const user = userEvent.setup();
    render(<CommissionSettingsPage />);
    await screen.findByText('Commission on Buy Now / Fixed');

    await user.click(toggleFor('Commission on Buy Now / Fixed'));

    await waitFor(() => expect(settingsUpdates()).toHaveLength(1));
    const [u] = settingsUpdates();
    expect(updatedKey(u)).toBe('commission_on_fixed');
    expect(u.payload).toEqual({ value: false }); // seeded true → toggled off
    expect(toast.success).toHaveBeenCalled();
  });

  it('reports an error instead of "Setting saved" when the key has no row', async () => {
    const user = userEvent.setup();
    render(<CommissionSettingsPage />);
    await screen.findByText('Commission on Buy Now / Fixed');

    // UPDATE matching zero rows: no error, no data — previously shown as saved.
    state.updateResult = { data: [], error: null };
    await user.click(toggleFor('Commission on Buy Now / Fixed'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toMatch(/does not exist/i);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
