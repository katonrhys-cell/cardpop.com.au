import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));

import EventReviewScorecard from '@/components/reviews/EventReviewScorecard.jsx';
import EventReviewQuickFacts from '@/components/reviews/EventReviewQuickFacts.jsx';
import EventReviewGallery from '@/components/reviews/EventReviewGallery.jsx';
import EventReviewPickups from '@/components/reviews/EventReviewPickups.jsx';
import HalfStars from '@/components/reviews/HalfStars.jsx';
import StarInput from '@/components/admin/StarInput.jsx';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const review = {
  overall_rating: 4.5,
  scores: { vendors: 5, prices: 4, venue: 4.5 },
  go_again: 'yes',
  verdict: 'Worth the drive for the vintage tables alone',
  attended_on: '2026-10-04',
  ticket_paid_aud: 15,
  hours_spent: 3.5,
  crowd_level: 'busy',
  headline_pickup: 'Base Set Charizard, PSA 7',
  gallery: [
    { url: 'https://x.test/a.webp', caption: 'Doors open', alt: 'Queue outside the hall' },
    { url: 'https://x.test/b.webp', caption: 'Vintage row' },
    { url: 'https://x.test/c.webp' },
  ],
  pickups: [
    { name: 'Base Set Charizard', price_aud: 1200, url: '/marketplace/abc', note: 'Table 14, talked down from $1,350' },
    { name: 'Free promo', price_aud: 0, url: 'https://example.com/promo' },
  ],
};

const event = { id: 'e1', slug: 'vault-melbourne', title: 'Vault – Melbourne', start_date: '2026-10-04', venue_name: 'Melbourne Showgrounds', suburb: 'Ascot Vale', state: 'VIC' };

describe('HalfStars', () => {
  it('announces the value and renders five stars', () => {
    render(<HalfStars value={3.5} />);
    expect(screen.getByRole('img', { name: '3.5 out of 5 stars' })).toBeInTheDocument();
  });
});

describe('EventReviewScorecard', () => {
  it('shows the overall, each scored category and the verdict', () => {
    wrap(<EventReviewScorecard review={review} />);
    expect(screen.getByText('How the day rated')).toBeInTheDocument();
    expect(screen.getAllByText('4.5').length).toBeGreaterThanOrEqual(1); // overall + venue sub-score
    expect(screen.getByText('Vendors & stock')).toBeInTheDocument();
    expect(screen.getByText('Prices')).toBeInTheDocument();
    expect(screen.getByText('Venue & organisation')).toBeInTheDocument();
    expect(screen.queryByText('Atmosphere')).not.toBeInTheDocument(); // unscored → hidden
    expect(screen.getByText(/Would we go again\? Yes/)).toBeInTheDocument();
    expect(screen.getByText(/Worth the drive/)).toBeInTheDocument();
  });

  it('renders nothing when there are no scores', () => {
    const { container } = wrap(<EventReviewScorecard review={{ scores: {}, overall_rating: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EventReviewQuickFacts', () => {
  it('lists the facts and links to the event page', () => {
    wrap(<EventReviewQuickFacts review={review} event={event} />);
    expect(screen.getByText('At a glance')).toBeInTheDocument();
    expect(screen.getByText(/4 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText('Melbourne Showgrounds, Ascot Vale, VIC')).toBeInTheDocument();
    expect(screen.getByText('$15')).toBeInTheDocument();
    expect(screen.getByText('3.5 hours')).toBeInTheDocument();
    expect(screen.getByText(/Busy/)).toBeInTheDocument();
    expect(screen.getByText('Base Set Charizard, PSA 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Event page/ })).toHaveAttribute('href', '/events/vault-melbourne');
  });

  it('says Free for a $0 ticket and hides blank facts', () => {
    wrap(<EventReviewQuickFacts review={{ ticket_paid_aud: 0 }} event={null} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.queryByText('Time on the floor')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('EventReviewGallery', () => {
  it('renders a tile per photo and opens the lightbox on click', () => {
    wrap(<EventReviewGallery gallery={review.gallery} />);
    expect(screen.getByText('Photos from the day')).toBeInTheDocument();
    const tiles = screen.getAllByRole('button', { name: /Open photo/ });
    expect(tiles).toHaveLength(3);
    expect(screen.getByAltText('Queue outside the hall')).toBeInTheDocument();
    fireEvent.click(tiles[1]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('drops unsafe urls and renders nothing when empty', () => {
    const { container } = wrap(<EventReviewGallery gallery={[{ url: 'javascript:alert(1)' }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EventReviewPickups', () => {
  it('lists pickups with prices, notes, internal and external links, and the total', () => {
    wrap(<EventReviewPickups pickups={review.pickups} />);
    expect(screen.getByText('Pickups from the show')).toBeInTheDocument();
    expect(screen.getByText(/2 pickups · \$1,200 spent/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Base Set Charizard/ })).toHaveAttribute('href', '/marketplace/abc');
    const ext = screen.getByRole('link', { name: /Free promo/ });
    expect(ext).toHaveAttribute('href', 'https://example.com/promo');
    expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/Table 14/)).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });
});

describe('StarInput', () => {
  it('sets half and whole values and can be cleared', () => {
    const onChange = vi.fn();
    render(<StarInput label="Prices" value={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '3.5 stars' }));
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    expect(onChange).toHaveBeenLastCalledWith(5);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Prices' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute('aria-checked', 'true');
  });
});
