import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// EventRsvp pulls in auth + supabase; the sections under test don't need it.
vi.mock('@/components/EventRsvp.jsx', () => ({ default: () => <div data-testid="rsvp" /> }));

import EventDetailCard from '@/components/EventDetailCard.jsx';
import EventDetailModal from '@/components/EventDetailModal.jsx';

const baseEvent = {
  id: 'evt-1',
  name: 'Test Card Show',
  title: 'Test Card Show',
  type: 'Card Show',
  image: 'https://example.com/poster.jpg',
  description: 'A great show.',
  date: 'October 1, 2026',
  time: '10:00 AM',
  location: 'Sydney, NSW',
  start_date: '2026-10-01',
};

const renderCard = (event) => render(
  <MemoryRouter><EventDetailCard event={event} /></MemoryRouter>,
);

const renderModal = (event) => render(
  <MemoryRouter>
    <EventDetailModal isOpen={true} onClose={() => {}} event={event} />
  </MemoryRouter>,
);

describe('EventDetailCard — accessibility & age restriction sections', () => {
  it('hides both sections when the fields are empty', () => {
    renderCard(baseEvent);
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument();
    expect(screen.queryByText('Age Restrictions')).not.toBeInTheDocument();
  });

  it('shows the Accessibility section under About This Event when filled', () => {
    renderCard({ ...baseEvent, accessibility_info: 'Wheelchair accessible venue with step-free entry' });
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Wheelchair accessible venue with step-free entry')).toBeInTheDocument();
    expect(screen.queryByText('Age Restrictions')).not.toBeInTheDocument();
  });

  it('shows the Age Restrictions section when filled', () => {
    renderCard({ ...baseEvent, age_restrictions: '18+' });
    expect(screen.getByText('Age Restrictions')).toBeInTheDocument();
    expect(screen.getByText('18+')).toBeInTheDocument();
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument();
  });
});

describe('EventDetailModal — accessibility & age restriction sections', () => {
  it('hides both sections when the fields are empty', () => {
    renderModal(baseEvent);
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument();
    expect(screen.queryByText('Age Restrictions')).not.toBeInTheDocument();
  });

  it('shows both sections when the fields are filled', () => {
    renderModal({
      ...baseEvent,
      accessibility_info: 'Accessible parking and toilets available',
      age_restrictions: 'All ages — under 15s must be accompanied by an adult',
    });
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Accessible parking and toilets available')).toBeInTheDocument();
    expect(screen.getByText('Age Restrictions')).toBeInTheDocument();
    expect(screen.getByText('All ages — under 15s must be accompanied by an adult')).toBeInTheDocument();
  });
});
