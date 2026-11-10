import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

// Admin → Event Management shows who submitted each event (events.organiser_id
// → profiles) under its title, and the search box matches the submitter.

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/EventScraperPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventScanPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/admin/EventRsvpListDialog.jsx', () => ({ default: () => null }));

const profileQuery = vi.fn();
vi.mock('@/lib/supabaseClient.js', () => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return {
    supabase: {
      from: vi.fn((table) => {
        if (table === 'profiles') {
          return { select: () => ({ in: async (_col, ids) => { profileQuery(ids); return { data: fixtureProfiles().filter((p) => ids.includes(p.id)), error: null }; } }) };
        }
        return { select: () => ({ order: async () => ({ data: fixtureEvents(), error: null }) }) };
      }),
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

import EventsManagementPage from '@/pages/admin/EventsManagementPage.jsx';

const fixtureEvents = () => [
  { id: 'tas',  title: 'Collector Con Tasmania', status: 'pending_review', start_date: '2027-01-16', organiser_id: 'u-member' },
  { id: 'mel',  title: 'CollectFest Melbourne',  status: 'approved',       start_date: '2027-04-03', organiser_id: 'u-admin' },
  { id: 'scan', title: 'Gundam Oceania',         status: 'pending_review', start_date: '2027-01-16', organiser_id: null, auto_discovered: true },
  { id: 'gone', title: 'Orphaned Swap Meet',     status: 'approved',       start_date: '2027-02-01', organiser_id: 'u-deleted' },
];
const fixtureProfiles = () => [
  { id: 'u-member', username: 'tascards', display_name: 'Jamie Smith', is_admin: false },
  { id: 'u-admin',  username: 'cardpop',  display_name: null,          is_admin: true },
];

const rowFor = (title) => screen.getByText(title).closest('tr');

afterEach(() => vi.clearAllMocks());

describe('EventsManagementPage — submitted by', () => {
  it('names the member, admin, scanner or deleted account behind each event', async () => {
    render(<MemoryRouter initialEntries={['/admin/events']}><EventsManagementPage /></MemoryRouter>);
    const member = await screen.findByRole('link', { name: 'Jamie Smith' });
    expect(member).toHaveAttribute('href', '/seller/u-member');
    expect(within(rowFor('Collector Con Tasmania')).getByText(/Submitted by/)).toHaveTextContent('Submitted by Jamie Smith @tascards');
    expect(within(rowFor('CollectFest Melbourne')).getByText(/Added by/)).toHaveTextContent('Added by cardpop (CardPop admin)');
    expect(within(rowFor('Gundam Oceania')).getByText('Found by the automated scan')).toBeInTheDocument();
    expect(within(rowFor('Orphaned Swap Meet')).getByText('Submitted by a deleted account')).toBeInTheDocument();
    // One batched lookup, no repeat for the account that no longer exists.
    expect(profileQuery).toHaveBeenCalledTimes(1);
  });

  it('finds events by the submitter in the search box', async () => {
    render(<MemoryRouter initialEntries={['/admin/events']}><EventsManagementPage /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Jamie Smith' });
    fireEvent.change(screen.getByPlaceholderText(/Search by title/), { target: { value: 'tascards' } });
    expect(screen.getByText('Collector Con Tasmania')).toBeInTheDocument();
    expect(screen.queryByText('CollectFest Melbourne')).not.toBeInTheDocument();
  });
});
