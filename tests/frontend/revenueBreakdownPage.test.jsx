import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────
// The page reads `orders` and `refunds` straight from Supabase. The mock serves
// a fixed set of rows so the tests can assert the exact figures the ledger shows
// — the guard this file exists for: the dashboard's headline number and this
// page's breakdown must add up to the same money.

const state = vi.hoisted(() => ({ tables: {} }));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = {
      select: vi.fn(() => b),
      in: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      then: (resolve, reject) =>
        Promise.resolve(state.tables[table] ?? { data: [], error: null }).then(resolve, reject),
    };
    return b;
  };
  return { supabase: { from: vi.fn((table) => builder(table)) } };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));
// Recharts needs real layout measurements happy-dom doesn't provide; the chart
// itself isn't what these tests are about.
vi.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough, BarChart: Passthrough, Bar: () => null,
    XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
  };
});

import RevenueBreakdownPage from '@/pages/admin/RevenueBreakdownPage.jsx';

const ORDERS = [
  {
    id: '42d5b6ed-8a99-428f-bfbf-18f63ee3fa97',
    status: 'payment_confirmed',
    created_at: '2026-09-13T01:03:19.165Z',
    item_price_aud: '40.96', shipping_aud: '10.00', platform_fee_aud: '0.00',
    gst_aud: '0.00', gst_included_aud: '4.63', discount_aud: '0', total_aud: '50.96',
    transaction_type: 'cart',
    buyer: { display_name: 'Ash Ketchum' },
    order_items: [{ id: 'a', type: 'shop', title: 'Top Loaders 3x4in', quantity: 1, line_total_aud: 9.99 }],
  },
  {
    id: '60cbb06e-f227-4e3b-a38a-5ef124c0f332',
    status: 'cancelled',
    created_at: '2026-09-10T00:00:00.000Z',
    item_price_aud: '10.00', shipping_aud: '0.00', platform_fee_aud: '1.33',
    gst_aud: '1.03', gst_included_aud: '0', discount_aud: '0', total_aud: '11.33',
    transaction_type: 'cart',
    buyer: { display_name: 'Misty Waterflower' },
    order_items: [{ id: 'b', type: 'listing', title: 'Charizard Base Set', quantity: 1, line_total_aud: 10 }],
  },
];

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  state.tables = {
    orders: { data: ORDERS, error: null },
    refunds: { data: [], error: null },
  };
});

const renderPage = () => render(<MemoryRouter><RevenueBreakdownPage /></MemoryRouter>);

describe('RevenueBreakdownPage', () => {
  it('shows gross, net and order count for the paid orders only', async () => {
    renderPage();
    // $50.96 is the single paid order; the $11.33 cancelled one took no money.
    await waitFor(() => expect(screen.getAllByText('$50.96').length).toBeGreaterThan(0));

    const grossCard = screen.getByText('Gross Revenue').closest('[class*="rounded-card"]');
    expect(within(grossCard).getByText('$50.96')).toBeInTheDocument();
    expect(screen.getByText('Paid Orders')).toBeInTheDocument();
    expect(screen.getByText(/Avg \$50\.96 per order/)).toBeInTheDocument();
  });

  it('lists the sale with its date and amount in the ledger', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Ash Ketchum')).toBeInTheDocument());
    expect(screen.getByText('13 Sep 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '42D5B6ED' })).toBeInTheDocument();
    // 'CardPop Shop' shows in the channel split table and again on the ledger row.
    expect(screen.getAllByText('CardPop Shop')).toHaveLength(2);
  });

  it('hides orders that took no payment by default', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Ash Ketchum')).toBeInTheDocument());
    expect(screen.queryByText('Misty Waterflower')).not.toBeInTheDocument();
  });

  it('subtracts a settled refund from net revenue but leaves gross alone', async () => {
    state.tables.refunds = {
      data: [{ id: 'r1', order_id: ORDERS[0].id, status: 'processed', refund_amount_aud: '20.00' }],
      error: null,
    };
    renderPage();
    await waitFor(() => expect(screen.getByText('Net Revenue')).toBeInTheDocument());
    expect(screen.getByText('−$20.00')).toBeInTheDocument();
    expect(screen.getByText(/Gross \$50\.96 · Net \$30\.96/)).toBeInTheDocument();
  });

  it('filters the ledger by search term', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Ash Ketchum')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Search order, buyer or item/), 'nothing-matches');
    await waitFor(() => expect(screen.getByText('No orders match these filters.')).toBeInTheDocument());
  });

  it('surfaces a load failure instead of rendering a misleading $0.00', async () => {
    state.tables.orders = { data: null, error: { message: 'permission denied for table orders' } };
    renderPage();
    await waitFor(() => expect(screen.getByText('permission denied for table orders')).toBeInTheDocument());
  });
});
