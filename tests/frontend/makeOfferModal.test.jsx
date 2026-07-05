import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockInsert = vi.fn();
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => ({ insert: mockInsert })) },
}));

import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import MakeOfferModal from '@/components/MakeOfferModal.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: true, currentUser: { id: 'buyer-1' } });
  mockInsert.mockResolvedValue({ error: null });
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

  it('submits an offer to the offers table', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={fixedListing} />);

    await user.type(screen.getByLabelText(/your offer amount/i), '90');
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(supabase.from).toHaveBeenCalledWith('offers');
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      amount_aud: 90,
    });
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
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      listing_id: 'listing-2',
      amount_aud: 100,
    });
  });

  it('rejects an amount wildly above the range instead of using the $0 price', async () => {
    const user = userEvent.setup();
    render(<MakeOfferModal isOpen onClose={vi.fn()} listing={eoiListing} />);

    await user.type(screen.getByLabelText(/your offer amount/i), '500');
    await user.click(screen.getByRole('button', { name: /send offer/i }));

    expect(toast.error).toHaveBeenCalledWith('Offer amount seems unusually high');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
