import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const ORDERS = vi.hoisted(() => [
  // Guest checkout: buyer_id (and therefore the `buyer` join) is null, and
  // `orders` has no order_number column — the shape that used to be dropped.
  {
    id: '42d5b6ed-8a99-428f-bfbf-18f63ee3fa97',
    created_at: '2026-09-13T01:03:19Z',
    status: 'payment_confirmed',
    buyer_id: null, buyer: null, seller: null,
    buyer_email: 'jordan@example.com', shipping_name: 'Jordan Carnelley',
    total_aud: 50.96, platform_fee_aud: 2.5, refund_status: null,
  },
  {
    id: '60cbb06e-f227-4e3b-a38a-5ef124c0f332',
    created_at: '2026-08-02T11:20:46Z',
    status: 'cancelled',
    buyer_id: '239faa6f', buyer: { id: '239faa6f', display_name: 'Ryan Conway', username: 'ryanc' }, seller: null,
    buyer_email: null, shipping_name: 'R K',
    total_aud: 11.33, platform_fee_aud: 1.33, refund_status: null,
  },
]);

const supabaseFrom = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { from: supabaseFrom } }));
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: vi.fn() }, default: { fetch: vi.fn() } }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({ default: ({ title, children }) => <div><h1>{title}</h1>{children}</div> }));
vi.mock('@/components/admin/OrderDetailDialog.jsx', () => ({ default: () => null }));

import OrderManagementPage, { pickOrderRefund, ordersToCsv } from '@/pages/admin/OrderManagementPage.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFrom.mockImplementation(() => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: ORDERS, error: null }) }) }),
  }));
});

describe('OrderManagementPage', () => {
  it('lists guest orders, which have no buyer profile and no order number', async () => {
    render(<OrderManagementPage />);
    expect(await screen.findByText('Jordan Carnelley')).toBeInTheDocument();
    expect(screen.getByText('Ryan Conway')).toBeInTheDocument();
    expect(screen.getByText('42D5B6ED')).toBeInTheDocument();
  });

  it('marks an order with no account as a guest', async () => {
    render(<OrderManagementPage />);
    await screen.findByText('Jordan Carnelley');
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('searches a guest order by shipping name', async () => {
    const user = userEvent.setup();
    render(<OrderManagementPage />);
    await screen.findByText('Jordan Carnelley');

    await user.type(screen.getByPlaceholderText(/search by order/i), 'jordan');
    await waitFor(() => expect(screen.queryByText('Ryan Conway')).not.toBeInTheDocument());
    expect(screen.getByText('Jordan Carnelley')).toBeInTheDocument();
  });

  it('searches by the order id shown in the Order # column', async () => {
    const user = userEvent.setup();
    render(<OrderManagementPage />);
    await screen.findByText('Jordan Carnelley');

    await user.type(screen.getByPlaceholderText(/search by order/i), '60CBB06E');
    await waitFor(() => expect(screen.queryByText('Jordan Carnelley')).not.toBeInTheDocument());
    expect(screen.getByText('Ryan Conway')).toBeInTheDocument();
  });
});

describe('pickOrderRefund', () => {
  it('prefers the active refund over an older rejected one', () => {
    // newest first, as the page queries them
    const rows = [
      { id: 'r2', status: 'pending', created_at: '2026-09-20' },
      { id: 'r1', status: 'rejected', created_at: '2026-09-10' },
    ];
    expect(pickOrderRefund(rows).id).toBe('r2');
    expect(pickOrderRefund([{ id: 'r9', status: 'rejected' }, rows[0]]).id).toBe('r2');
  });

  it('falls back to the latest rejected refund, or null', () => {
    expect(pickOrderRefund([{ id: 'a', status: 'rejected' }, { id: 'b', status: 'rejected' }]).id).toBe('a');
    expect(pickOrderRefund([])).toBeNull();
    expect(pickOrderRefund(null)).toBeNull();
  });
});

describe('ordersToCsv', () => {
  it('exports one row per order with buyer, totals and status', () => {
    const csv = ordersToCsv(ORDERS).trim().split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[0]).toMatch(/^Order id,Order date,Buyer,/);
    expect(csv[1]).toContain('42d5b6ed-8a99-428f-bfbf-18f63ee3fa97');
    expect(csv[1]).toContain('Jordan Carnelley');
    expect(csv[1]).toContain('jordan@example.com');
    expect(csv[1]).toContain('50.96');
    expect(csv[2]).toContain('Ryan Conway');
    expect(csv[2]).toContain('cancelled');
  });
});
