import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Organiser saves from My Events (docs/event-submissions.md): links typed
// without https:// are fixed rather than blocking the submit, a save the
// database refused is never reported as saved, and a bad date stops the save
// on the right field.

const calls = vi.hoisted(() => []);
const state = vi.hoisted(() => ({ updateRows: [{ id: 'evt-1' }] }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const data = table === 'events' ? state.updateRows : null;
          return (res, rej) => Promise.resolve({ data, error: null }).then(res, rej);
        }
        return (...args) => { calls.push([table, prop, ...args]); return b; };
      },
    });
    return b;
  };
  return { supabase: { from: vi.fn((t) => builder(t)), storage: { from: vi.fn() } } };
});
vi.mock('@/lib/apiServerClient.js', () => {
  const client = { fetch: vi.fn(() => Promise.resolve({ ok: true })) };
  return { default: client, apiServerClient: client };
});

import EventFormModal from '@/components/EventFormModal.jsx';

const pending = {
  id: 'evt-1', status: 'pending_review', title: 'Show', start_date: '2027-04-03',
  event_type: 'community_event', is_free: true, instagram_url: 'instagram.com/myshow',
  start_time: '10:00:00',
};
const eventUpdates = () => calls.filter(([t, op]) => t === 'events' && op === 'update').map((c) => c[2]);

beforeEach(() => {
  calls.length = 0;
  state.updateRows = [{ id: 'evt-1' }];
  Object.values(toastMock).forEach((f) => f.mockClear());
});

describe('EventFormModal — organiser saves', () => {
  it('saves a link typed without https:// as a full URL', async () => {
    const onClose = vi.fn();
    render(<EventFormModal isOpen onClose={onClose} event={pending} onSaved={() => {}} mode="user" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    expect(eventUpdates()[0].instagram_url).toBe('https://instagram.com/myshow');
    expect(eventUpdates()[0].start_time).toBe('10:00');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not report a save the database refused (zero rows) as saved', async () => {
    state.updateRows = [];
    const onClose = vi.fn();
    render(<EventFormModal isOpen onClose={onClose} event={pending} onSaved={() => {}} mode="user" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls[0][0]).toMatch(/Refresh My Events/);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops on an end date before the start date', async () => {
    render(<EventFormModal isOpen onClose={() => {}} event={{ ...pending, end_date: '2027-04-01' }} onSaved={() => {}} mode="user" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/end date/)));
    expect(eventUpdates()).toHaveLength(0);
  });

  it('asks before closing with unsaved changes', () => {
    const onClose = vi.fn();
    window.confirm = vi.fn(() => false);
    render(<EventFormModal isOpen onClose={onClose} event={pending} onSaved={() => {}} mode="user" />);
    // Untouched: closes straight away.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/Event Title/), { target: { value: 'Show 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only offers Clear Form on a new event', () => {
    const { unmount } = render(<EventFormModal isOpen onClose={() => {}} event={pending} onSaved={() => {}} mode="user" />);
    expect(screen.queryByRole('button', { name: /Clear Form/ })).not.toBeInTheDocument();
    unmount();
    render(<EventFormModal isOpen onClose={() => {}} event={null} onSaved={() => {}} mode="user" />);
    expect(screen.getByRole('button', { name: /Clear Form/ })).toBeInTheDocument();
  });
});
