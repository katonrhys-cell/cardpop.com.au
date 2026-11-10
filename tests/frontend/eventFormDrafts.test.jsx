import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Organiser drafts (docs/event-submissions.md): "Save Draft" keeps the event
// private and tells nobody; "Submit for Review" sends it to the queue and
// emails the admins.

const calls = vi.hoisted(() => []);
const mockApiFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ ok: true })));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const data = table === 'events' ? [{ id: 'evt-1' }] : null;
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
  const client = { fetch: mockApiFetch };
  return { default: client, apiServerClient: client };
});

import EventFormModal from '@/components/EventFormModal.jsx';

const draft = {
  id: 'evt-1', status: 'draft', title: 'CollectFest Melbourne 2027', start_date: '2027-04-03',
  event_type: 'community_event', is_free: false,
};

const renderForm = (event = draft) => render(
  <EventFormModal isOpen onClose={() => {}} event={event} scrapedData={null} onSaved={() => {}} mode="user" />,
);

const eventUpdates = () => calls.filter(([t, op]) => t === 'events' && op === 'update').map((c) => c[2]);

beforeEach(() => { calls.length = 0; mockApiFetch.mockClear(); });

describe('EventFormModal — organiser drafts', () => {
  it('offers Save Draft and Submit for Review on a draft', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Edit Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for Review' })).toBeInTheDocument();
  });

  it('Save Draft keeps it a draft and notifies nobody', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    expect(eventUpdates()[0].status).toBe('draft');
    expect(mockApiFetch).not.toHaveBeenCalledWith('/events/notify-submission', expect.anything());
  });

  it('Submit for Review sends it to the queue and emails the admins', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Review' }));
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    expect(eventUpdates()[0].status).toBe('pending_review');
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/events/notify-submission', expect.objectContaining({ method: 'POST' })));
  });

  it('a live event has no Save Draft — it stays live', () => {
    renderForm({ ...draft, status: 'approved' });
    expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Publish Changes' })).toBeInTheDocument();
  });
});
