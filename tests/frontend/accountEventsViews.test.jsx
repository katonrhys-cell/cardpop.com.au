import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// My Events: an owner's view counts and the Search (Google) button.

const [P1, A1, A2, C1, R1, D1] = [1, 2, 3, 4, 5, 6].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
const state = vi.hoisted(() => ({ statsIds: null, stats: {}, searchOpen: null }));
const rows = vi.hoisted(() => [
  { id: '00000000-0000-4000-8000-000000000001', status: 'pending_review', title: 'Pending Show', start_date: '2027-05-01', state: 'NSW' },
  { id: '00000000-0000-4000-8000-000000000002', status: 'approved', title: 'Live Show', slug: 'live-show', start_date: '2027-06-01', state: 'QLD' },
  { id: '00000000-0000-4000-8000-000000000003', status: 'approved', title: 'Quiet Show', slug: 'quiet-show', start_date: '2027-07-01', state: 'SA' },
  { id: '00000000-0000-4000-8000-000000000004', status: 'completed', title: 'Finished Show', slug: 'finished-show', start_date: '2025-01-01', state: 'VIC' },
  { id: '00000000-0000-4000-8000-000000000005', status: 'rejected', title: 'Rejected Show', start_date: '2027-08-01', state: 'WA', rejection_reason: 'Add the venue' },
  { id: '00000000-0000-4000-8000-000000000006', status: 'draft', title: 'Draft Show', start_date: '2027-09-01', state: 'TAS' },
]);

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/OrganiserVendorsDialog.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventBadgeDialog.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/FeatureEventDialog.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/OrganiserAccessCard.jsx', () => ({ default: () => null }));
vi.mock('@/hooks/useOrganiserAccess.js', () => ({ useOrganiserAccess: () => ({ loading: false }) }));
vi.mock('@/components/WorkspaceReferralCard.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventViewsDialog.jsx', () => ({
  default: ({ event, open }) => (open ? <div role="dialog">Trend for {event.title}</div> : null),
}));
vi.mock('@/components/events/EventSearchDialog.jsx', () => ({
  default: ({ event, open }) => { state.searchOpen = open ? event.id : null; return open ? <div role="dialog">Search for {event.title}</div> : null; },
}));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = table === 'events' ? { data: rows, error: null } : { data: null, error: null };
          return (res, rej) => Promise.resolve(result).then(res, rej);
        }
        return () => b;
      },
    });
    return b;
  };
  return {
    supabase: {
      from: vi.fn((t) => builder(t)),
      rpc: vi.fn(async (name, args) => {
        if (name === 'event_view_stats') {
          state.statsIds = args.p_event_ids;
          return { data: Object.entries(state.stats).map(([event_id, v]) => ({ event_id, ...v })), error: null };
        }
        return { data: null, error: null };
      }),
    },
  };
});

import AccountEvents from '@/pages/account/AccountEvents.jsx';

const renderPage = () => render(<MemoryRouter initialEntries={['/account/events?status=all']}><AccountEvents /></MemoryRouter>);

beforeEach(() => {
  state.statsIds = null;
  state.searchOpen = null;
  state.stats = { [A1]: { total: 1234, last_7: 56, last_30: 300 } };
});

describe('My Events — view counts', () => {
  it('shows total, 7-day and 30-day views on a live event', async () => {
    renderPage();
    const card = await screen.findByRole('article', { name: 'Live Show' });
    const views = await within(card).findByTestId(`event-views-${A1}`);
    expect(views).toHaveTextContent('1,234 views');
    expect(views).toHaveTextContent('56 in the last 7 days');
    expect(views).toHaveTextContent('300 in the last 30 days');
  });

  it('shows zero for a live event nobody has opened yet, and "1 view" in the singular', async () => {
    state.stats = { [C1]: { total: 1, last_7: 0, last_30: 0 } };
    renderPage();
    expect(await screen.findByTestId(`event-views-${A2}`)).toHaveTextContent('0 views');
    expect(await screen.findByTestId(`event-views-${C1}`)).toHaveTextContent('1 view');
  });

  it('shows views only on live and completed events, and asks only about those', async () => {
    renderPage();
    await screen.findByTestId(`event-views-${A1}`);
    for (const id of [P1, R1, D1]) expect(screen.queryByTestId(`event-views-${id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`event-views-${C1}`)).toBeInTheDocument();
    expect([...state.statsIds].sort()).toEqual([A1, A2, C1].sort());
  });
});

describe('My Events — Search button', () => {
  it('appears on live and completed events only', async () => {
    renderPage();
    await screen.findByRole('article', { name: 'Live Show' });
    expect(screen.getByRole('button', { name: 'Google search figures for Live Show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google search figures for Finished Show' })).toBeInTheDocument();
    for (const title of ['Pending Show', 'Rejected Show', 'Draft Show']) {
      expect(screen.queryByRole('button', { name: `Google search figures for ${title}` })).not.toBeInTheDocument();
    }
  });

  it('opens that event’s search figures, and closes again', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Google search figures for Live Show' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Search for Live Show');
    expect(state.searchOpen).toBe(A1);
  });
});

describe('My Events — views trend', () => {
  it('offers "See trend" only on events that have views, and opens that event’s chart', async () => {
    renderPage();
    await screen.findByTestId(`event-views-${A1}`);
    expect(screen.getByRole('button', { name: 'Daily views trend for Live Show' })).toBeInTheDocument();
    // A live event with no views has nothing to chart.
    expect(screen.queryByRole('button', { name: 'Daily views trend for Quiet Show' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Daily views trend for Live Show' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Trend for Live Show');
  });
});
