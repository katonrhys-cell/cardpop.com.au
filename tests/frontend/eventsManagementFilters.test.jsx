import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';

// Admin → Event Management: the search box, dropdown filters (URL-driven) and
// sortable column headers narrow and order the list without a refetch, and
// the table is split into Current & upcoming / Past sections.

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/EventScraperPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventScanPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/admin/EventRsvpListDialog.jsx', () => ({ default: () => null }));
vi.mock('@/lib/supabaseClient.js', () => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: () => ({ order: async () => ({ data: fixtureEvents(), error: null }) }),
      })),
      channel: () => channel,
      removeChannel: vi.fn(),
    },
  };
});

import EventsManagementPage from '@/pages/admin/EventsManagementPage.jsx';

const fixtureEvents = () => [
  { id: 'perth',  title: 'Supanova Perth 2027',   status: 'approved',  state: 'WA',  suburb: 'Perth',     venue_name: 'PCEC', start_date: '2027-06-25', event_type: 'card_show' },
  { id: 'sydney', title: 'Supanova Sydney 2027',  status: 'approved',  state: 'NSW', suburb: 'Olympic Park', start_date: '2027-06-18', event_type: 'card_show' },
  { id: 'tcxpo',  title: 'TCXPO Oran Park',       status: 'cancelled', state: 'NSW', suburb: 'Oran Park', start_date: '2027-05-16', event_type: 'trade_event' },
  { id: 'old',    title: 'Brisbane Swap Meet',    status: 'completed', state: 'QLD', start_date: '2025-03-01' },
];

const renderPage = (url = '/admin/events') =>
  render(<MemoryRouter initialEntries={[url]}><EventsManagementPage /></MemoryRouter>);

const titles = () => screen.getAllByRole('row').slice(1)
  .map((r) => within(r).getAllByRole('cell')[0].querySelector('p.font-bold')?.textContent)
  .filter(Boolean);

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('EventsManagementPage — search, filter and sort', () => {
  it('splits the list into Current & upcoming (soonest first) and Past (most recent first)', async () => {
    renderPage();
    await screen.findByText('Supanova Perth 2027');
    expect(screen.getByRole('button', { name: /Current & upcoming · 3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Past · 1/ })).toBeInTheDocument();
    expect(titles()).toEqual(['TCXPO Oran Park', 'Supanova Sydney 2027', 'Supanova Perth 2027', 'Brisbane Swap Meet']);
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Date & Location/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('collapses a section and remembers it for the next visit', async () => {
    const { unmount } = renderPage();
    await screen.findByText('Supanova Perth 2027');

    fireEvent.click(screen.getByRole('button', { name: /Past · 1/ }));
    expect(titles()).toEqual(['TCXPO Oran Park', 'Supanova Sydney 2027', 'Supanova Perth 2027']);
    expect(screen.getByRole('button', { name: /Past · 1/ })).toHaveAttribute('aria-expanded', 'false');
    // The count in the bar is unchanged — collapsing hides rows, it doesn't filter.
    expect(screen.getByText('4 of 4')).toBeInTheDocument();

    unmount();
    renderPage();
    await screen.findByText('Supanova Perth 2027');
    expect(screen.queryByText('Brisbane Swap Meet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Past · 1/ }));
    expect(screen.getByText('Brisbane Swap Meet')).toBeInTheDocument();
  });

  it('leaves out a section with nothing in it', async () => {
    renderPage('/admin/events?status=completed');
    await screen.findByText('Brisbane Swap Meet');
    expect(screen.queryByRole('button', { name: /Current & upcoming/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Past · 1/ })).toBeInTheDocument();
  });

  it('narrows the list as the admin types, matching venue and suburb too', async () => {
    renderPage();
    await screen.findByText('Supanova Perth 2027');
    const box = screen.getByRole('searchbox', { name: 'Search events' });

    fireEvent.change(box, { target: { value: 'supanova' } });
    expect(titles()).toEqual(['Supanova Sydney 2027', 'Supanova Perth 2027']);
    expect(screen.getByText('2 of 4')).toBeInTheDocument();

    fireEvent.change(box, { target: { value: 'pcec' } });
    expect(titles()).toEqual(['Supanova Perth 2027']);

    fireEvent.change(box, { target: { value: 'oran park' } });
    expect(titles()).toEqual(['TCXPO Oran Park']);

    fireEvent.change(box, { target: { value: 'nothing here' } });
    expect(screen.getByText('No events match')).toBeInTheDocument();
    expect(screen.queryByText('Create your first event')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(titles()).toHaveLength(4);
  });

  it('reads filters from the URL and clears them', async () => {
    renderPage('/admin/events?status=cancelled');
    await screen.findByText('TCXPO Oran Park');
    expect(titles()).toEqual(['TCXPO Oran Park']);
    expect(screen.getByText('1 of 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear \(1\)/ }));
    expect(titles()).toHaveLength(4);
  });

  it('combines a state filter from the URL with the search box', async () => {
    renderPage('/admin/events?state=NSW');
    await screen.findByText('Supanova Sydney 2027');
    expect(titles()).toEqual(['TCXPO Oran Park', 'Supanova Sydney 2027']);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), { target: { value: 'supanova' } });
    expect(titles()).toEqual(['Supanova Sydney 2027']);
    expect(screen.getByRole('button', { name: /Clear \(2\)/ })).toBeInTheDocument();
  });

  it('sorts by a column on click and flips direction on a second click', async () => {
    renderPage();
    await screen.findByText('Supanova Perth 2027');

    // Title A→Z within each section (Past always follows Current).
    fireEvent.click(screen.getByRole('button', { name: /^Event$/ }));
    expect(titles()).toEqual(['Supanova Perth 2027', 'Supanova Sydney 2027', 'TCXPO Oran Park', 'Brisbane Swap Meet']);
    expect(screen.getByRole('columnheader', { name: /^Event$/ })).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: /^Event$/ }));
    expect(titles()).toEqual(['TCXPO Oran Park', 'Supanova Sydney 2027', 'Supanova Perth 2027', 'Brisbane Swap Meet']);

    // Status: live first, then cancelled — within each section.
    fireEvent.click(screen.getByRole('button', { name: /^Status$/ }));
    expect(titles()).toEqual(['Supanova Perth 2027', 'Supanova Sydney 2027', 'TCXPO Oran Park', 'Brisbane Swap Meet']);

    // Back to the date column: soonest first in Current; the second click
    // flips it so the furthest-away event leads.
    fireEvent.click(screen.getByRole('button', { name: /Date & Location/ }));
    expect(titles()[0]).toBe('TCXPO Oran Park');
    fireEvent.click(screen.getByRole('button', { name: /Date & Location/ }));
    expect(titles()[0]).toBe('Supanova Perth 2027');
  });
});
