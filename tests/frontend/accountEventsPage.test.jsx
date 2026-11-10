import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

// Account → My Events: every action names the event it acts on, a pending
// event says it's with the team, a save refreshes the list in place, and a
// failed load can be retried.

const state = vi.hoisted(() => ({ selects: 0, fail: false, modalProps: null }));
const rows = vi.hoisted(() => [
  { id: 'p1', status: 'pending_review', title: 'Pending Show', start_date: '2027-05-01', state: 'NSW' },
  { id: 'a1', status: 'approved', title: 'Live Show', slug: 'live-show', start_date: '2027-06-01', state: 'QLD' },
  { id: 'r1', status: 'rejected', title: 'Rejected Show', start_date: '2027-07-01', state: 'VIC', rejection_reason: 'Add the venue' },
]);

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children, actions }) => <div>{actions}{children}</div> }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: (props) => { state.modalProps = props; return null; } }));
vi.mock('@/components/events/OrganiserVendorsDialog.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventBadgeDialog.jsx', () => ({ default: () => null }));
vi.mock('@/components/WorkspaceReferralCard.jsx', () => ({ default: () => null }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          let result = { data: null, error: null };
          if (table === 'events') {
            state.selects += 1;
            result = state.fail ? { data: null, error: new Error('boom') } : { data: rows, error: null };
          }
          return (res, rej) => Promise.resolve(result).then(res, rej);
        }
        return () => b;
      },
    });
    return b;
  };
  return { supabase: { from: vi.fn((t) => builder(t)) } };
});

import AccountEvents from '@/pages/account/AccountEvents.jsx';

const renderPage = () => render(<MemoryRouter><AccountEvents /></MemoryRouter>);

beforeEach(() => { state.selects = 0; state.fail = false; state.modalProps = null; });

describe('My Events page', () => {
  it('names the event on every action and explains each status', async () => {
    renderPage();
    await screen.findByText('Pending Show');
    expect(screen.getByRole('button', { name: 'Edit Pending Show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Live Show' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Live Show live' })).toHaveAttribute('href', expect.stringContaining('live-show'));
    expect(screen.getByRole('button', { name: 'Edit & resubmit Rejected Show' })).toBeInTheDocument();
    expect(screen.getByText(/With the CardPop team for review/)).toBeInTheDocument();
    expect(screen.getByText(/Reason: Add the venue/)).toBeInTheDocument();
    // Each event is an article named by its title.
    expect(screen.getByRole('article', { name: 'Live Show' })).toBeInTheDocument();
    // With no drafts, the list is still a labelled region.
    expect(screen.getByRole('region', { name: /Submitted & live/ })).toBeInTheDocument();
  });

  it('opens the form on an event for editing', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Live Show' }));
    expect(state.modalProps).toMatchObject({ isOpen: true, mode: 'user', event: expect.objectContaining({ id: 'a1' }) });
  });

  it('refreshes after a save without swapping the list for skeletons', async () => {
    renderPage();
    await screen.findByText('Live Show');
    const before = state.selects;
    await act(async () => { await state.modalProps.onSaved(); });
    expect(state.selects).toBe(before + 1);
    expect(screen.getByText('Live Show')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading your events' })).not.toBeInTheDocument();
  });

  it('shows a retry when the list fails to load', async () => {
    state.fail = true;
    renderPage();
    expect(await screen.findByText(/Couldn’t load your events/)).toBeInTheDocument();
    state.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Live Show')).toBeInTheDocument());
  });

  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><main><AccountEvents /></main></MemoryRouter>);
    await screen.findByText('Live Show');
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

describe('My Events status tabs', () => {
  it('filters to one lifecycle bucket from ?status=', async () => {
    render(<MemoryRouter initialEntries={['/account/events?status=pending']}><AccountEvents /></MemoryRouter>);
    await screen.findByText('Pending Show');
    expect(screen.queryByText('Live Show')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pending approval/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Live/ }));
    expect(await screen.findByText('Live Show')).toBeInTheDocument();
    expect(screen.queryByText('Pending Show')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(await screen.findByText('Pending Show')).toBeInTheDocument();
    expect(screen.getByText('Rejected Show')).toBeInTheDocument();
  });
});
