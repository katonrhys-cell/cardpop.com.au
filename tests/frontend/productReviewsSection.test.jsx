import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import ProductReviews from '@/components/shop/ProductReviews.jsx';

const renderIt = (props) => render(<MemoryRouter><ProductReviews title="Zip Binder" {...props} /></MemoryRouter>);

describe('ProductReviews', () => {
  it('renders nothing while loading', () => {
    const { container } = renderIt({ loading: true, stats: null, reviews: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it('points buyers at Account → Orders when there are no reviews yet', () => {
    renderIt({ loading: false, stats: null, reviews: [] });
    expect(screen.getByText(/No reviews yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Account → Orders/ })).toHaveAttribute('href', '/account/orders');
  });

  it('shows the average, the count and each verified review', () => {
    renderIt({
      loading: false,
      stats: { review_count: 2, average_rating: 4.5 },
      reviews: [
        { id: 'a', rating: 5, title: 'Great', body: 'Holds heaps', reviewer_name: 'Sam', created_at: '2026-10-01T03:00:00Z' },
        { id: 'b', rating: 4, title: null, body: null, reviewer_name: 'Alex', created_at: '2026-09-30T03:00:00Z' },
      ],
    });
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('2 reviews')).toBeInTheDocument();
    expect(screen.getByText('Great')).toBeInTheDocument();
    expect(screen.getByText('Holds heaps')).toBeInTheDocument();
    expect(screen.getAllByText('Verified purchase')).toHaveLength(2);
  });

  it('uses the singular for one review', () => {
    renderIt({ loading: false, stats: { review_count: 1, average_rating: 5 }, reviews: [{ id: 'a', rating: 5, reviewer_name: 'Sam', created_at: '2026-10-01T03:00:00Z' }] });
    expect(screen.getByText('1 review')).toBeInTheDocument();
  });
});
