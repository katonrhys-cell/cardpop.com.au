import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const deletes = vi.hoisted(() => []);
const rows = vi.hoisted(() => [
  { id: 'd1', status: 'draft', title: 'CollectFest Melbourne 2027', start_date: '2027-04-03', state: 'VIC' },
  { id: 'p1', status: 'pending_review', title: 'Pending Show', start_date: '2027-05-01', state: 'NSW' },
  { id: 'a1', status: 'approved', title: 'Live Show', slug: 'live-show', start_date: '2027-06-01', state: 'QLD' },
]);

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({ default: ({ children, actions }) => <div>{actions}{children}</div> }));
vi.mock('@/components/EventFormModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/OrganiserVendorsDialog.jsx', () => ({ default: () => null }));
vi.mock('@/components/events/EventBadgeDialog.jsx', () => ({ default: () => null }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    let op = 'select';
    const filters = [];
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          let data = null;
          if (table === 'events' && op === 'select') data = rows;
          if (table === 'events' && op === 'delete') { deletes.push(filters); data = [{ id: filters.find((f) => f[0] === 'id')?.[1] }]; }
          return (res, rej) => Promise.resolve({ data, error: null }).then(res, rej);
        }
        return (...args) => {
          if (prop === 'delete') op = 'delete';
          if (prop === 'eq') filters.push(args);
          return b;
        };
      },
    });
    return b;
  };
  return { supabase: { from: vi.fn((t) => builder(t)) } };
});

import AccountEvents from '@/pages/account/AccountEvents.jsx';

beforeEach(() => { deletes.length = 0; });

describe('My Events — drafts', () => {
  it('shows drafts in their own section, apart from submitted and live events', async () => {
    render(<MemoryRouter><AccountEvents /></MemoryRouter>);
    const drafts = await screen.findByRole('region', { name: /Drafts/ });
    expect(within(drafts).getByText('CollectFest Melbourne 2027')).toBeInTheDocument();
    expect(within(drafts).queryByText('Pending Show')).not.toBeInTheDocument();
    const submitted = screen.getByRole('region', { name: /Submitted & live/ });
    expect(within(submitted).getByText('Pending Show')).toBeInTheDocument();
    expect(within(submitted).getByText('Live Show')).toBeInTheDocument();
    expect(within(drafts).getByRole('button', { name: /Edit & submit/ })).toBeInTheDocument();
  });

  it('deletes only a draft', async () => {
    window.confirm = vi.fn(() => true);
    render(<MemoryRouter><AccountEvents /></MemoryRouter>);
    const drafts = await screen.findByRole('region', { name: /Drafts/ });
    fireEvent.click(within(drafts).getByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(deletes[0]).toEqual(expect.arrayContaining([['id', 'd1'], ['status', 'draft']]));
    await waitFor(() => expect(screen.queryByText('CollectFest Melbourne 2027')).not.toBeInTheDocument());
    // Submitted and live events have no Delete.
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
