import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockFetch }, default: { fetch: mockFetch } }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }) => <>{children}</> }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/AdminPageHeader.jsx', () => ({ default: ({ title, subtitle, children }) => <div><h1>{title}</h1><p>{subtitle}</p>{children}</div> }));

import { toast } from 'sonner';
import OffersAdminPage from '@/pages/admin/OffersAdminPage.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const HOUR = 3600 * 1000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const party = (name, email) => ({ display_name: name, email });

const OFFERS = [
  {
    id: 'o1', listing_id: 'l1', amount_aud: 4000, counter_amount_aud: 4500, status: 'countered',
    expires_at: iso(10 * HOUR), created_at: iso(-HOUR),
    listing: { price_aud: 4999.99, vault_item: { card_name: 'Kevin Durant RC' } },
    buyer: party('Ash', 'ash@example.com'), seller: party('Kat', 'kat@example.com'),
  },
  {
    id: 'o2', listing_id: 'l2', amount_aud: 900, status: 'accepted', payment_due_at: iso(-HOUR), created_at: iso(-60 * HOUR),
    listing: { price_aud: 1000, vault_item: { card_name: 'Charizard' } },
    buyer: party('Bo', 'bo@example.com'), seller: party('Kat', 'kat@example.com'),
  },
  {
    id: 'o3', listing_id: 'l3', amount_aud: 50, status: 'accepted', payment_due_at: iso(-HOUR), paid_at: iso(-2 * HOUR), created_at: iso(-10 * HOUR),
    listing: { price_aud: 60, vault_item: { card_name: 'Pikachu' } },
    buyer: party('Cy', 'cy@example.com'), seller: party('Kat', 'kat@example.com'),
  },
];
const json = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue(json({ offers: OFFERS, counts: { open: 1, awaiting_payment: 0, paid: 1, expired: 1 } }));
});

const rowFor = (card) => screen.getByText(card).closest('tr');

describe('OffersAdminPage', () => {
  it('loads every offer through the admin endpoint and shows both parties with their emails', async () => {
    render(<OffersAdminPage />);
    expect(await screen.findByText('Kevin Durant RC')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/admin/offers');
    const row = rowFor('Kevin Durant RC');
    for (const text of ['$4000.00', 'Counter $4500.00', 'Ash', 'ash@example.com', 'Kat', 'kat@example.com', 'Asking $4999.99', 'Respond by']) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
    expect(within(row).getByText('Kevin Durant RC').closest('a')).toHaveAttribute('href', '/product/marketplace/l1');
  });

  it('shows the stat counts from the backend', async () => {
    render(<OffersAdminPage />);
    await screen.findByText('Kevin Durant RC');
    expect(screen.getByText('1 awaiting a response · 0 awaiting payment')).toBeInTheDocument();
  });

  it('shows an accepted offer past its payment window as expired, flagged "Buyer didn’t pay"', async () => {
    render(<OffersAdminPage />);
    await screen.findByText('Charizard');
    const row = rowFor('Charizard');
    expect(within(row).getByText('expired')).toBeInTheDocument();
    expect(within(row).getByText(/Buyer didn.t pay/)).toBeInTheDocument();
  });

  it('shows a paid offer as paid, even past its payment window', async () => {
    render(<OffersAdminPage />);
    await screen.findByText('Pikachu');
    const row = rowFor('Pikachu');
    expect(within(row).getByText('paid')).toBeInTheDocument();
    expect(within(row).queryByText(/Buyer didn.t pay/)).not.toBeInTheDocument();
  });

  it('refetches with the chosen status filter', async () => {
    const user = userEvent.setup();
    render(<OffersAdminPage />);
    await screen.findByText('Kevin Durant RC');
    await user.click(screen.getByRole('combobox', { name: /filter by status/i }));
    await user.click(await screen.findByRole('option', { name: /awaiting payment/i }));
    expect(mockFetch).toHaveBeenLastCalledWith('/admin/offers?status=awaiting_payment');
  });

  it('toasts when the load fails', async () => {
    mockFetch.mockResolvedValue(json({ error: 'nope' }, false));
    render(<OffersAdminPage />);
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load offers'));
  });
});
