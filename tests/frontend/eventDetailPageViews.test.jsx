import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// The event page counts a view once its (public) event has loaded — and not for
// an event that doesn't exist.

const db = vi.hoisted(() => ({ row: null }));
const record = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient.js', () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: db.row, error: null }) };
  return { supabase: { from: () => q } };
});
vi.mock('@/lib/eventViews.js', () => ({ recordEventView: (...a) => record(...a) }));
vi.mock('@/components/EventDetailCard.jsx', () => ({ default: ({ event }) => <div>card: {event.title}</div> }));
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventInfoBoard.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventDiscussion.jsx', () => ({ default: () => null }));
vi.mock('@/components/RelatedEvents.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/NextEditionBanner.jsx', () => ({ default: () => null }));
vi.mock('@/components/reviews/EventReviewTeaser.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventAttendeeReviews.jsx', () => ({ default: () => null }));

import EventDetailPage from '@/pages/EventDetailPage.jsx';

const ID = '11111111-1111-4111-8111-111111111111';
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/events/:eventId" element={<EventDetailPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => { record.mockReset(); db.row = null; });

describe('EventDetailPage views', () => {
  it('counts one view when the event has loaded', async () => {
    db.row = { id: ID, slug: 'oz-comic-con', title: 'Oz Comic-Con', status: 'approved', start_date: '2099-01-01', end_date: '2099-01-02', state: 'SA', suburb: 'Wayville' };
    renderAt('/events/oz-comic-con');
    await screen.findByText(/card: Oz Comic-Con/);
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith(ID);
  });

  it('does not count an event that doesn’t exist', async () => {
    renderAt('/events/nope');
    await waitFor(() => expect(screen.queryByText(/card:/)).not.toBeInTheDocument());
    expect(record).not.toHaveBeenCalled();
  });
});
