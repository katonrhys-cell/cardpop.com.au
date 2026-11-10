import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// A member creating an event from My Events (docs/event-submissions.md):
// new submissions and drafts, every event type, errors that land on the
// field to fix, photo-type checks and the form's accessible names.

const calls = vi.hoisted(() => []);
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const mockApiFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ ok: true })));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'user-1' } }) }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    let single = false;
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const data = table === 'events' ? (single ? { id: 'new-1' } : [{ id: 'new-1' }]) : null;
          return (res, rej) => Promise.resolve({ data, error: null }).then(res, rej);
        }
        return (...args) => {
          if (prop === 'single') single = true;
          calls.push([table, prop, ...args]);
          return b;
        };
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

const inserts = () => calls.filter(([t, op]) => t === 'events' && op === 'insert').map((c) => c[2]);
const renderNew = () => render(<EventFormModal isOpen onClose={() => {}} event={null} onSaved={() => {}} mode="user" />);
const openTab = (name) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name }));
  fireEvent.click(screen.getByRole('tab', { name }));
};
const fillRequired = () => {
  fireEvent.change(screen.getByLabelText(/Event Title/), { target: { value: 'Test Card Show' } });
  openTab('Venue & Dates');
  fireEvent.change(screen.getByLabelText(/Start Date/), { target: { value: '2027-05-01' } });
};

beforeEach(() => {
  calls.length = 0;
  mockApiFetch.mockClear();
  Object.values(toastMock).forEach((f) => f.mockClear());
});

describe('EventFormModal — a member creating an event', () => {
  it('submits a new event for review and emails the admins', async () => {
    renderNew();
    fillRequired();
    openTab('Organiser');
    fireEvent.change(screen.getByLabelText('Event Website'), { target: { value: 'www.testshow.com.au' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Review' }));
    await waitFor(() => expect(inserts()).toHaveLength(1));
    const row = inserts()[0];
    expect(row).toMatchObject({
      title: 'Test Card Show', start_date: '2027-05-01', status: 'pending_review',
      organiser_id: 'user-1', is_featured: false, website_url: 'https://www.testshow.com.au',
    });
    expect(row.slug).toBe('test-card-show-2027-05-01');
    // SEO + tags are the team's — an organiser insert never carries them.
    for (const k of ['seo_title', 'seo_description', 'seo_keywords', 'tags']) expect(row).not.toHaveProperty(k);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/events/notify-submission', expect.objectContaining({ method: 'POST' })));
  });

  it('saves a new draft without telling anyone', async () => {
    renderNew();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(inserts()).toHaveLength(1));
    expect(inserts()[0].status).toBe('draft');
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/Draft saved/)));
    expect(mockApiFetch).not.toHaveBeenCalledWith('/events/notify-submission', expect.anything());
  });

  it('offers every event type the database allows', () => {
    renderNew();
    fireEvent.click(screen.getByLabelText('Event Type'));
    for (const label of ['Card Show', 'Trade Event', 'Community Event', 'LGS (Local Game Store) Event']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('lands on the title when it is missing', async () => {
    renderNew();
    openTab('Venue & Dates');
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Review' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/title/)));
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.activeElement?.id).toBe('title'));
    expect(inserts()).toHaveLength(0);
  });

  it('lands on a broken link on the Organiser tab', async () => {
    renderNew();
    fillRequired();
    openTab('Organiser');
    fireEvent.change(screen.getByLabelText('Tickets / Registration URL'), { target: { value: 'pay at the door' } });
    openTab('Details');
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Review' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/Tickets/)));
    expect(screen.getByRole('tab', { name: 'Organiser' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.activeElement?.id).toBe('ticket_url'));
    expect(inserts()).toHaveLength(0);
  });

  it('refuses a HEIC cover photo when it is picked', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    const { container } = renderNew();
    const input = container.ownerDocument.querySelector('input[type=file][aria-labelledby="cover_image_label"]');
    fireEvent.change(input, { target: { files: [new File(['x'], 'IMG_1.HEIC', { type: 'image/heic' })] } });
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/HEIC/));
    expect(screen.queryByAltText('Cover image preview')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['x'], 'poster.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByAltText('Cover image preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove cover image' })).toBeInTheDocument();
  });

  it('names its controls for screen readers', () => {
    renderNew();
    expect(screen.getByLabelText('Event Type')).toBeInTheDocument();
    const pokemon = screen.getByRole('button', { name: 'Pokémon' });
    expect(pokemon).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pokemon);
    expect(pokemon).toHaveAttribute('aria-pressed', 'true');
    openTab('Venue & Dates');
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    openTab('Organiser');
    expect(screen.getByRole('switch', { name: 'Free Entry' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Registration Required' })).toBeInTheDocument();
  });

  it('keeps SEO and tags out of the organiser form and its insert', () => {
    renderNew();
    expect(screen.queryByRole('tab', { name: 'SEO' })).not.toBeInTheDocument();
  });

  it('keeps a tag typed without pressing Enter, and labels its remove button (admin form)', () => {
    render(<EventFormModal isOpen onClose={() => {}} event={null} onSaved={() => {}} mode="admin" />);
    openTab('SEO');
    const tags = screen.getByLabelText(/Event Tags/);
    fireEvent.change(tags, { target: { value: 'pokemon' } });
    fireEvent.blur(tags);
    expect(screen.getByRole('button', { name: 'Remove pokemon' })).toBeInTheDocument();
  });
});
