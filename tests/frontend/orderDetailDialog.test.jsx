import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const GUEST_ORDER = vi.hoisted(() => ({
  id: '42d5b6ed-8a99-428f-bfbf-18f63ee3fa97',
  created_at: '2026-09-13T01:03:19Z',
  status: 'payment_confirmed',
  buyer_id: null,
  buyer: null,
  seller: null,
  buyer_email: 'jordan@example.com',
  shipping_name: 'Jordan Carnelley',
  shipping_address: '12 Example St',
  shipping_suburb: 'Bondi',
  shipping_state: 'NSW',
  shipping_postcode: '2026',
  order_items: [{ title: 'Charizard VMAX', quantity: 1, line_total_aud: 48.46 }],
  item_price_aud: 48.46,
  shipping_aud: 2.5,
  platform_fee_aud: 2.5,
  total_aud: 50.96,
  refund_status: null,
}));

const MEMBER_ORDER = vi.hoisted(() => ({
  ...GUEST_ORDER,
  id: '60cbb06e-f227-4e3b-a38a-5ef124c0f332',
  buyer_id: '239faa6f',
  buyer: { id: '239faa6f', display_name: 'Ryan Conway', username: 'ryanc' },
  buyer_email: null,
}));

const selectSpy = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());
const apiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: () => ({
      select: (cols) => {
        selectSpy(cols);
        return { eq: () => ({ maybeSingle }) };
      },
    }),
  },
}));
vi.mock('@/lib/apiServerClient.js', () => ({
  apiServerClient: { fetch: apiFetch },
  default: { fetch: apiFetch },
}));

import OrderDetailDialog from '@/components/admin/OrderDetailDialog.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: GUEST_ORDER, error: null });
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ emails: {} }) });
});

describe('OrderDetailDialog', () => {
  // Regression guard for the bug that made the dialog unopenable: profiles.email
  // has no column grant for the browser roles (migration 20260715210000), so
  // embedding it fails the entire select with a permission error and the dialog
  // renders nothing but that error — for every order.
  it('never asks the browser client for profiles.email', async () => {
    render(<OrderDetailDialog orderId={GUEST_ORDER.id} onClose={vi.fn()} />);
    await waitFor(() => expect(selectSpy).toHaveBeenCalled());

    const cols = selectSpy.mock.calls[0][0];
    expect(cols).toContain('buyer:profiles!buyer_id');
    expect(cols).not.toMatch(/email/);
  });

  it('shows the order once it loads', async () => {
    render(<OrderDetailDialog orderId={GUEST_ORDER.id} onClose={vi.fn()} />);

    expect(await screen.findByText('Charizard VMAX')).toBeInTheDocument();
    expect(screen.getByText('payment confirmed')).toBeInTheDocument();
    expect(screen.getByText('$50.96')).toBeInTheDocument();
    expect(screen.getByText('12 Example St')).toBeInTheDocument();
  });

  it('surfaces a permission error instead of an empty dialog', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied for column email' } });
    render(<OrderDetailDialog orderId={GUEST_ORDER.id} onClose={vi.fn()} />);

    expect(await screen.findByText(/permission denied for column email/)).toBeInTheDocument();
  });

  it("reads a guest buyer's email off the order row, without calling the backend", async () => {
    render(<OrderDetailDialog orderId={GUEST_ORDER.id} onClose={vi.fn()} />);

    expect(await screen.findByText('jordan@example.com')).toBeInTheDocument();
    expect(screen.getByText('Guest checkout')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("fetches a registered buyer's email from the admin-only endpoint", async () => {
    maybeSingle.mockResolvedValue({ data: MEMBER_ORDER, error: null });
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ emails: { '239faa6f': 'ryan@example.com' } }),
    });

    render(<OrderDetailDialog orderId={MEMBER_ORDER.id} onClose={vi.fn()} />);

    expect(await screen.findByText('Ryan Conway')).toBeInTheDocument();
    expect(await screen.findByText('ryan@example.com')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/admin/user-emails', expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByText('Guest checkout')).not.toBeInTheDocument();
  });

  it('still renders the order when the email lookup fails', async () => {
    maybeSingle.mockResolvedValue({ data: MEMBER_ORDER, error: null });
    apiFetch.mockRejectedValue(new Error('network down'));

    render(<OrderDetailDialog orderId={MEMBER_ORDER.id} onClose={vi.fn()} />);

    expect(await screen.findByText('Ryan Conway')).toBeInTheDocument();
    expect(screen.getByText('Charizard VMAX')).toBeInTheDocument();
  });
});
