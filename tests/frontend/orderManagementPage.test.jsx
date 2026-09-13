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

import OrderManagementPage from '@/pages/admin/OrderManagementPage.jsx';

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
