import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories (which vitest lifts above the imports) can see them.
const { auth, api } = vi.hoisted(() => ({
  auth: { currentUser: null, isAuthenticated: false, isAdmin: false },
  api: {
    fetchEventReviews: vi.fn(),
    fetchReviewStatsMap: vi.fn(),
    submitEventReview: vi.fn(),
    updateEventReview: vi.fn(),
    deleteEventReview: vi.fn(),
    hideEventReview: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));
vi.mock('@/lib/eventAttendeeReviews.js', () => api);

import EventAttendeeReviews from '@/components/events/EventAttendeeReviews.jsx';

const past = { id: 'e1', slug: 'last-month', title: 'Last Month Show', status: 'approved', start_date: '2000-01-01' };
const upcoming = { ...past, id: 'e2', start_date: '2999-01-01' };
const review = (over = {}) => ({
  id: 'r1', event_id: 'e1', reviewer_id: 'u2', reviewer_name: 'Sam', rating: 4,
  title: 'Solid show', body: 'Good vendor mix, parking was rough.', created_at: '2026-10-01T00:00:00Z',
  profiles: { id: 'u2', display_name: 'Sam Collector' }, ...over,
});

const wrap = (ui) => render(<MemoryRouter initialEntries={['/events/last-month']}>{ui}</MemoryRouter>);

beforeEach(() => {
  Object.assign(auth, { currentUser: null, isAuthenticated: false, isAdmin: false });
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchEventReviews.mockResolvedValue([review()]);
  api.fetchReviewStatsMap.mockResolvedValue({ e1: { event_id: 'e1', review_count: 1, average_rating: 4 } });
});

describe('EventAttendeeReviews', () => {
  it('renders nothing for an event that has not finished', () => {
    const { container } = wrap(<EventAttendeeReviews event={upcoming} />);
    expect(container).toBeEmptyDOMElement();
    expect(api.fetchEventReviews).not.toHaveBeenCalled();
  });

  it('shows the reviews and a sign-in prompt to a visitor', async () => {
    wrap(<EventAttendeeReviews event={past} />);
    expect(await screen.findByText('Good vendor mix, parking was rough.')).toBeInTheDocument();
    expect(screen.getByText('Sam Collector')).toBeInTheDocument();
    expect(screen.getByText(/from 1 review$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('lets a signed-in collector post one review, with the stars and words validated first', async () => {
    Object.assign(auth, { currentUser: { id: 'u1' }, isAuthenticated: true });
    api.submitEventReview.mockResolvedValue(review({ id: 'r2', reviewer_id: 'u1', rating: 5, title: '', body: 'Best show of the year by a mile.', profiles: { id: 'u1', display_name: 'Me' } }));
    wrap(<EventAttendeeReviews event={past} />);
    await screen.findByText('Good vendor mix, parking was rough.');

    fireEvent.click(screen.getByRole('button', { name: 'Post review' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/star rating/);
    expect(api.submitEventReview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    fireEvent.change(screen.getByLabelText('Your review'), { target: { value: 'Best show of the year by a mile.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() => expect(api.submitEventReview).toHaveBeenCalledWith({
      eventId: 'e1', userId: 'u1', rating: 5, title: '', body: 'Best show of the year by a mile.',
    }));
    expect(await screen.findByText('Your review')).toBeInTheDocument();
    // One review each: the form is gone, replaced by the collector's own review with Edit/Remove.
    expect(screen.queryByRole('button', { name: 'Post review' })).toBeNull();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
  });

  it('gives an admin a Hide action on other people\'s reviews', async () => {
    Object.assign(auth, { currentUser: { id: 'admin' }, isAuthenticated: true, isAdmin: true });
    api.hideEventReview.mockResolvedValue();
    window.confirm = vi.fn(() => true);
    wrap(<EventAttendeeReviews event={past} />);
    await screen.findByText('Good vendor mix, parking was rough.');
    fireEvent.click(screen.getByRole('button', { name: /Hide/ }));
    await waitFor(() => expect(api.hideEventReview).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(screen.queryByText('Good vendor mix, parking was rough.')).toBeNull());
  });
});
