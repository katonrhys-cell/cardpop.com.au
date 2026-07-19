import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoisted spies so the vi.mock factory can reference them.
const fetchRsvpCounts = vi.hoisted(() => vi.fn(() => Promise.resolve({})));
const fetchMyRsvps = vi.hoisted(() => vi.fn(() => Promise.resolve({})));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: null, isAuthenticated: false }),
}));
vi.mock('@/lib/eventRsvp.js', () => ({
  RSVP_ROLES: {
    buyer: { value: 'buyer', label: 'Buyer', plural: 'Attendees' },
    vendor: { value: 'vendor', label: 'Vendor', plural: 'Vendors' },
  },
  emptyCounts: () => ({ buyer: 0, vendor: 0 }),
  fetchRsvpCounts,
  fetchMyRsvps,
  setRsvp: vi.fn(),
  removeRsvp: vi.fn(),
}));

import EventRsvp from '@/components/EventRsvp.jsx';

const renderRsvp = (props) => render(
  <MemoryRouter><EventRsvp event={{ id: 'e1' }} {...props} /></MemoryRouter>,
);

beforeEach(() => {
  fetchRsvpCounts.mockClear();
  fetchMyRsvps.mockClear();
});

describe('EventRsvp — batched (managed) vs standalone data loading', () => {
  it('does NOT fetch per-event when a parent supplies rsvpData (avoids the list N+1)', async () => {
    renderRsvp({ variant: 'card', rsvpData: { counts: { buyer: 5, vendor: 2 }, myRole: 'buyer' } });

    // The whole point: no per-card requests when the list already batch-loaded.
    expect(fetchRsvpCounts).not.toHaveBeenCalled();
    expect(fetchMyRsvps).not.toHaveBeenCalled();

    // And it renders the supplied counts + role immediately.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Attending')).toBeInTheDocument();
  });

  it('self-fetches when used standalone (no rsvpData) — e.g. the detail modal', async () => {
    renderRsvp({ variant: 'detail' });
    await waitFor(() => expect(fetchRsvpCounts).toHaveBeenCalledWith(['e1']));
  });
});
