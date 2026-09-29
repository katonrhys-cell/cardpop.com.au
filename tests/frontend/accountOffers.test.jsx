import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// My Offers: every response goes through PATCH /offers/:id (so the other side
// is emailed), never a direct table write; deadlines are shown.

const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockApiFetch }, default: { fetch: mockApiFetch } }));

const mockLists = vi.hoisted(() => ({ received: [], sent: [] }));
const mockUpdate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: () => ({
      update: mockUpdate,
      select: () => ({
        eq: (col) => ({ order: async () => ({ data: col === 'seller_id' ? mockLists.received : mockLists.sent, error: null }) }),
      }),
    }),
  },
}));
const mockAuth = vi.hoisted(() => ({ currentUser: { id: 'me' } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => mockAuth }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/CheckoutModal.jsx', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import AccountOffers from '@/pages/account/AccountOffers.jsx';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const HOUR = 3600 * 1000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const listing = (card) => ({ id: 'l1', status: 'active', price_aud: 5000, vault_item: { card_name: card } });
const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  mockLists.received = [];
  mockLists.sent = [];
  mockApiFetch.mockResolvedValue(ok({ offer: {} }));
});

const patchBody = (n = 0) => JSON.parse(mockApiFetch.mock.calls[n][1].body);

describe('AccountOffers — responses go through the backend', () => {
  it('seller Accept → PATCH /offers/:id { action: "accept" }', async () => {
    mockLists.received = [{ id: 'o1', status: 'pending', amount_aud: 4000, expires_at: iso(10 * HOUR), created_at: iso(-HOUR), listing: listing('KD RC'), buyer: { display_name: 'Ash' } }];
    const user = userEvent.setup();
    render(<AccountOffers />);
    await user.click(await screen.findByRole('button', { name: /^accept$/i }));
    expect(mockApiFetch).toHaveBeenCalledWith('/offers/o1', expect.objectContaining({ method: 'PATCH' }));
    expect(patchBody()).toEqual({ action: 'accept' });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/48 hours to pay/));
  });

  it('seller Counter → PATCH { action: "counter", counterAmountAud, counterMessage }', async () => {
    mockLists.received = [{ id: 'o1', status: 'pending', amount_aud: 4000, expires_at: iso(10 * HOUR), created_at: iso(-HOUR), listing: listing('KD RC'), buyer: { display_name: 'Ash' } }];
    const user = userEvent.setup();
    render(<AccountOffers />);
    await user.click(await screen.findByRole('button', { name: /^counter$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/your counter amount/i), '4500');
    await user.type(within(dialog).getByPlaceholderText(/explain your counter/i), 'Meet me here');
    await user.click(within(dialog).getByRole('button', { name: /send counter/i }));
    expect(patchBody()).toEqual({ action: 'counter', counterAmountAud: 4500, counterMessage: 'Meet me here' });
  });

  it('buyer Accept Counter → "accept_counter"; Withdraw → "withdraw"', async () => {
    mockLists.sent = [
      { id: 'o1', status: 'countered', amount_aud: 4000, counter_amount_aud: 4500, expires_at: iso(10 * HOUR), created_at: iso(-HOUR), listing: listing('KD RC'), seller: { display_name: 'Kat' } },
      { id: 'o2', status: 'pending', amount_aud: 100, expires_at: iso(10 * HOUR), created_at: iso(-HOUR), listing: listing('Pikachu'), seller: { display_name: 'Kat' } },
    ];
    const user = userEvent.setup();
    render(<AccountOffers />);
    await user.click(await screen.findByRole('tab', { name: /sent/i }));
    await user.click(await screen.findByRole('button', { name: /accept counter/i }));
    expect(mockApiFetch.mock.calls[0][0]).toBe('/offers/o1');
    expect(patchBody(0)).toEqual({ action: 'accept_counter' });
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    expect(mockApiFetch.mock.calls[1][0]).toBe('/offers/o2');
    expect(patchBody(1)).toEqual({ action: 'withdraw' });
  });

  it('shows the backend’s error (e.g. the offer expired) instead of succeeding', async () => {
    mockLists.received = [{ id: 'o1', status: 'pending', amount_aud: 4000, expires_at: iso(10 * HOUR), created_at: iso(-HOUR), listing: listing('KD RC'), buyer: { display_name: 'Ash' } }];
    mockApiFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'This offer has expired' }) });
    const user = userEvent.setup();
    render(<AccountOffers />);
    await user.click(await screen.findByRole('button', { name: /^accept$/i }));
    expect(toast.error).toHaveBeenCalledWith('This offer has expired');
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('AccountOffers — payment deadline', () => {
  it('shows the buyer a Pay button and their pay-by time on an accepted offer', async () => {
    mockLists.sent = [{ id: 'o1', status: 'accepted', amount_aud: 4000, payment_due_at: iso(20 * HOUR), created_at: iso(-HOUR), listing: listing('KD RC'), seller: { display_name: 'Kat' } }];
    const user = userEvent.setup();
    render(<AccountOffers />);
    await user.click(await screen.findByRole('tab', { name: /sent/i }));
    expect(await screen.findByRole('button', { name: /pay \$4000\.00/i })).toBeInTheDocument();
    expect(screen.getByText(/please pay by/i)).toBeInTheDocument();
  });

  it('shows an accepted offer past its payment window as Expired with no Pay button', async () => {
    mockLists.sent = [{ id: 'o1', status: 'accepted', amount_aud: 4000, payment_due_at: iso(-HOUR), created_at: iso(-60 * HOUR), listing: listing('KD RC'), seller: { display_name: 'Kat' } }];
    const user = userEvent.setup();
    render(<AccountOffers />);
    await user.click(await screen.findByRole('tab', { name: /sent/i }));
    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('shows a paid offer as Paid', async () => {
    mockLists.received = [{ id: 'o1', status: 'accepted', amount_aud: 4000, payment_due_at: iso(-HOUR), paid_at: iso(-2 * HOUR), created_at: iso(-10 * HOUR), listing: listing('KD RC'), buyer: { display_name: 'Ash' } }];
    render(<AccountOffers />);
    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });

  it('tells the seller when the buyer’s payment is due', async () => {
    mockLists.received = [{ id: 'o1', status: 'accepted', amount_aud: 4000, payment_due_at: iso(20 * HOUR), created_at: iso(-HOUR), listing: listing('KD RC'), buyer: { display_name: 'Ash' } }];
    render(<AccountOffers />);
    expect(await screen.findByText(/waiting on the buyer's payment \(due/i)).toBeInTheDocument();
  });
});
