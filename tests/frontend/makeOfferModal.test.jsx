import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The offer is posted to the backend (which emails the seller), not inserted
// straight into `offers` — see src/routes/offers.js and docs/email.md.
const mockApiFetch = vi.fn();
vi.mock('@/lib/apiServerClient.js', () => ({
  apiServerClient: { fetch: (...args) => mockApiFetch(...args) },
  default: { fetch: (...args) => mockApiFetch(...args) },
}));

import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import MakeOfferModal from '@/components/MakeOfferModal.jsx';

/** The parsed JSON body of the nth POST /offers call. */
const offerBody = (n = 0) => JSON.parse(mockApiFetch.mock.calls[n][1].body);

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: true, currentUser: { id: 'buyer-1' } });
  mockApiFetch.mockResolvedValue({ ok: true, json: async () => ({ offer: { id: 'offer-1' }, emailed: true }) });
});

const fixedListing = {
  id: 'listing-1',
  seller_id: 'seller-1',
  price_aud: 100,
  vault_item: { card_name: 'Charizard' },
};

// Expression-of-interest listing: no fixed price, seller publishes a range.
const eoiListing = {
  id: 'listing-2',
  seller_id: 'seller-1',
  price_aud: null,
  price_min_aud: 80,
  price_max_aud: 120,
  vault_item: { card_name: 'Pikachu' },
};

describe('MakeOfferModal — fixed-price listing', () => {
  it('shows the asking price and percentage quick picks', () => {
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);
    expect(screen.getByText('Asking Price')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /90%/ })).toBeInTheDocument();
  });

  it('posts the offer to the backend so the seller is emailed', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);

    await user.type(screen.getByLabelText(/your offer amount/i), '90');
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    expect(mockApiFetch.mock.calls[0][0]).toBe('/offers');
    expect(mockApiFetch.mock.calls[0][1].method).toBe('POST');
    expect(offerBody()).toMatchObject({
      listingId: 'listing-1',
      sellerId: 'seller-1',
      amountAud: 90,
    });
  });

  it('surfaces a backend failure to the buyer', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Listing is no longer active' }) });
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);

    await user.type(screen.getByLabelText(/your offer amount/i), '90');
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Listing is no longer active'));
  });
});

describe('MakeOfferModal — expression-of-interest listing', () => {
  it("shows the seller's price range and range-based quick picks", () => {
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={eoiListing} />);
    expect(screen.getByText('Seller Is Looking For')).toBeInTheDocument();
    expect(screen.getByText('$80.00 – $120.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /low end/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /middle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top end/i })).toBeInTheDocument();
  });

  it('flags whether the typed amount is inside the range', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={eoiListing} />);

    const input = screen.getByLabelText(/your offer amount/i);
    await user.type(input, '100');
    expect(screen.getByText(/within the seller's range/i)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '50');
    expect(screen.getByText(/below the seller's range/i)).toBeInTheDocument();
  });

  it('quick pick fills the middle of the range and submits it', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={eoiListing} />);

    await user.click(screen.getByRole('button', { name: /middle/i }));
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    expect(offerBody()).toMatchObject({
      listingId: 'listing-2',
      amountAud: 100,
    });
  });

  it('rejects an amount wildly above the range instead of using the $0 price', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={eoiListing} />);

    await user.type(screen.getByLabelText(/your offer amount/i), '500');
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    expect(toast.error).toHaveBeenCalledWith('Offer amount seems unusually high');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe('MakeOfferModal — binding offer', () => {
  it('explains the 48-hour binding terms before the buyer sends', () => {
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);
    expect(screen.getByText(/offers are binding/i)).toBeInTheDocument();
    expect(screen.getByText(/committed to buy/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /binding for 48 hours unless I withdraw it/i })).toBeInTheDocument();
  });

  it('keeps Send disabled until the buyer ticks the binding acknowledgement', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);
    await user.type(screen.getByLabelText(/your offer amount/i), '90');

    const send = screen.getByRole('button', { name: /send offer/i });
    expect(send).toBeDisabled();
    await user.click(send);
    expect(mockApiFetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    expect(send).toBeEnabled();
  });

  it('sends acknowledgedBinding: true with the offer', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);
    await user.type(screen.getByLabelText(/your offer amount/i), '90');
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    expect(offerBody()).toMatchObject({ acknowledgedBinding: true, amountAud: 90 });
  });

  it('confirms the offer is binding, with its expiry, and how to withdraw', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => ({ offer: { id: 'offer-1', expires_at: '2026-09-30T07:12:00.000Z' } }) });
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);
    await user.type(screen.getByLabelText(/your offer amount/i), '90');
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    expect(await screen.findByText(/offer sent/i)).toBeInTheDocument();
    expect(screen.getByText(/binding until/i)).toHaveTextContent(/30 Sep/);
    expect(screen.getByText(/withdraw it from my offers before they accept/i)).toBeInTheDocument();
  });

  it('allows any positive amount well below asking', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);
    await user.type(screen.getByLabelText(/your offer amount/i), '5');
    await user.click(screen.getByRole('checkbox', { name: /binding/i }));
    await user.click(screen.getByRole('button', { name: /send offer/i }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    expect(offerBody().amountAud).toBe(5);
  });
});
