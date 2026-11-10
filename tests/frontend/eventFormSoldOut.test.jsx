import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Sold out, waitlist link, booking fee and organiser-named tickets on the
// event form (docs/event-organiser-links.md): they load from the event, can
// be edited on the Organiser tab, and reach the save payload cleaned.

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

const live = {
  id: 'evt-1', status: 'pending_review', title: 'Show', start_date: '2027-04-03', event_type: 'community_event',
  is_free: false, entry_fee_aud: 65, start_time: '10:00:00',
};
const eventUpdates = () => calls.filter(([t, op]) => t === 'events' && op === 'update').map((c) => c[2]);
const openOrganiser = () => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Organiser' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Organiser' }));
};
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
const renderForm = (event) => render(<EventFormModal isOpen onClose={() => {}} event={event} onSaved={() => {}} mode="user" />);

beforeEach(() => {
  calls.length = 0;
  state.updateRows = [{ id: 'evt-1' }];
  Object.values(toastMock).forEach((f) => f.mockClear());
});

describe('EventFormModal — sold out, waitlist, booking fee', () => {
  it('round-trips the saved values untouched', async () => {
    renderForm({
      ...live, tickets_sold_out: true, waitlist_url: 'https://events.humanitix.com/w', booking_fee_aud: 3.95,
      ticket_prices: [{ type: 'custom', label: 'Player Entry', price_aud: 65, sold_out: true, waitlist_url: 'https://events.humanitix.com/p' }],
    });
    save();
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    const u = eventUpdates()[0];
    expect(u.tickets_sold_out).toBe(true);
    expect(u.waitlist_url).toBe('https://events.humanitix.com/w');
    expect(u.booking_fee_aud).toBe(3.95);
    expect(u.ticket_prices).toEqual([
      { type: 'custom', label: 'Player Entry', price_aud: 65, sold_out: true, waitlist_url: 'https://events.humanitix.com/p' },
    ]);
  });

  it('defaults to not sold out, no waitlist and no fee', async () => {
    renderForm(live);
    save();
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    const u = eventUpdates()[0];
    expect(u.tickets_sold_out).toBe(false);
    expect(u.waitlist_url).toBeNull();
    expect(u.booking_fee_aud).toBeNull();
  });

  it('saves what the organiser sets on the Organiser tab, fixing a waitlist link typed without https://', async () => {
    renderForm(live);
    openOrganiser();
    fireEvent.click(screen.getByRole('switch', { name: 'Tickets sold out' }));
    fireEvent.change(screen.getByLabelText(/Join the waitlist URL/), { target: { value: 'events.humanitix.com/waitlist' } });
    fireEvent.change(screen.getByLabelText(/Booking \/ Service Fee/), { target: { value: '3.95' } });
    save();
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    const u = eventUpdates()[0];
    expect(u.tickets_sold_out).toBe(true);
    expect(u.waitlist_url).toBe('https://events.humanitix.com/waitlist');
    expect(u.booking_fee_aud).toBe(3.95);
  });

  it('adds a free-text ticket from the editor and saves it', async () => {
    renderForm(live);
    openOrganiser();
    fireEvent.click(screen.getByRole('button', { name: /Add a ticket type/ }));
    fireEvent.change(screen.getByLabelText('Ticket name'), { target: { value: 'Flame Flame Fruit Coliseum Player Entry' } });
    fireEvent.change(screen.getAllByLabelText(/Price \(AUD\)/).at(-1), { target: { value: '65' } });
    // The waitlist field only exists once the ticket is marked sold out.
    expect(screen.queryByLabelText(/Join the waitlist URL \(optional\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /Custom ticket 1 sold out/ }));
    fireEvent.change(screen.getByLabelText(/Join the waitlist URL \(optional\)/), { target: { value: 'https://events.humanitix.com/p' } });
    save();
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    expect(eventUpdates()[0].ticket_prices).toEqual([
      { type: 'custom', label: 'Flame Flame Fruit Coliseum Player Entry', price_aud: 65, sold_out: true, waitlist_url: 'https://events.humanitix.com/p' },
    ]);
  });

  it('refuses to save a custom ticket with no name, and says why', async () => {
    renderForm(live);
    openOrganiser();
    fireEvent.click(screen.getByRole('button', { name: /Add a ticket type/ }));
    save();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/name/i)));
    expect(eventUpdates()).toHaveLength(0);
  });

  it('refuses a bad booking fee', async () => {
    renderForm(live);
    openOrganiser();
    fireEvent.change(screen.getByLabelText(/Booking \/ Service Fee/), { target: { value: '-2' } });
    save();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(eventUpdates()).toHaveLength(0);
  });

  it('drops the booking fee and custom tickets when the event is made free', async () => {
    renderForm({ ...live, booking_fee_aud: 3.95, ticket_prices: [{ type: 'custom', label: 'Player', price_aud: 5 }] });
    openOrganiser();
    fireEvent.click(screen.getByRole('switch', { name: 'Free Entry' }));
    save();
    await waitFor(() => expect(eventUpdates()).toHaveLength(1));
    expect(eventUpdates()[0].booking_fee_aud).toBeNull();
    expect(eventUpdates()[0].ticket_prices).toEqual([]);
  });
});
