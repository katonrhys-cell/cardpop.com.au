import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { rpc } }));
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: vi.fn() }, apiServerClient: { fetch: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'seller-1' } }) }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ title, children }) => <div><h1>{title}</h1>{children}</div> }));

import AccountSales from '@/pages/account/AccountSales.jsx';

const sale = (order_id, extra = {}) => ({
  order_id, sold_at: '2026-11-01T10:00:00Z', order_status: 'payment_confirmed', listing_id: 'l1',
  item_title: 'Charizard', item_price_aud: 100, commission_aud: 5, proceeds_aud: 95, payout_status: 'pending',
  buyer_name: 'Sam', is_cart_order: false, ...extra,
});

const NUMBERED = '11111111-1111-4111-8111-111111111111';
const UNNUMBERED = 'abcd1234-0000-4000-8000-000000000000';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountSales — order references', () => {
  it('shows the order\'s sequential number, and the short id for one without a number', async () => {
    rpc.mockImplementation(async (fn) => {
      if (fn === 'seller_sales') return { data: [sale(NUMBERED), sale(UNNUMBERED)], error: null };
      if (fn === 'seller_order_numbers') return { data: [{ order_id: NUMBERED, order_number: 'CP-000321' }], error: null };
      return { data: null, error: null };
    });
    render(<AccountSales />);
    expect(await screen.findByText('CP-000321')).toBeInTheDocument();
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
    expect(screen.queryByText('11111111')).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('seller_order_numbers', { p_order_ids: expect.arrayContaining([NUMBERED, UNNUMBERED]) });
  });

  it('falls back to the short id when the lookup fails (migration not applied yet)', async () => {
    rpc.mockImplementation(async (fn) => {
      if (fn === 'seller_sales') return { data: [sale(NUMBERED)], error: null };
      throw new Error('function public.seller_order_numbers does not exist');
    });
    render(<AccountSales />);
    expect(await screen.findByText('11111111')).toBeInTheDocument();
  });

  it('does not call the lookup when there are no sales', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    render(<AccountSales />);
    await screen.findByText('My Sales');
    expect(rpc).not.toHaveBeenCalledWith('seller_order_numbers', expect.anything());
  });
});
