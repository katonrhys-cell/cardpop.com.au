import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SellerRatingDisplay, { ratingsFromSummary } from '@/components/SellerRatingDisplay.jsx';

// A grid of listing cards must not call /api/seller-ratings once per seller:
// the seller embed already carries the average and the count.
describe('SellerRatingDisplay', () => {
  let fetchSpy;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ stats: { total: 2, average: '4.5', distribution: {} } }),
    });
  });
  afterEach(() => fetchSpy.mockRestore());

  it('renders the compact line from the seller embed without fetching', () => {
    render(<SellerRatingDisplay sellerId="seller-a" compact summary={{ rating: 4.8, reviews_count: 12 }} />);
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('(12)')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows New Seller for a seller with no reviews, still without fetching', () => {
    render(<SellerRatingDisplay sellerId="seller-b" compact summary={{ rating: null, reviews_count: 0 }} />);
    expect(screen.getByText('New Seller')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the API when the embed has no rating columns', async () => {
    render(<SellerRatingDisplay sellerId="seller-c" compact summary={{ display_name: 'Sam' }} />);
    await waitFor(() => expect(screen.getByText('(2)')).toBeTruthy());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/seller-ratings/seller-c');
  });

  it('ratingsFromSummary needs a review count to stand in for the API', () => {
    expect(ratingsFromSummary(null)).toBeNull();
    expect(ratingsFromSummary({ rating: 5 })).toBeNull();
    expect(ratingsFromSummary({ rating: '4.25', reviews_count: 3 })).toEqual({ stats: { total: 3, average: '4.3' } });
  });
});
