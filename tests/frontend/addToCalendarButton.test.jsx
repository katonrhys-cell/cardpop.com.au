import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AddToCalendarButton from '@/components/AddToCalendarButton.jsx';
import { toast } from 'sonner';

const event = {
  id: 'evt-1',
  slug: 'melbourne-card-fair-thornbury-2026-08-02',
  title: 'Melbourne Card Fair — Thornbury',
  start_date: '2026-08-02',
  start_time: '10:00',
  end_time: '15:00',
  venue_name: 'Thornbury Theatre',
  suburb: 'Thornbury',
  state: 'VIC',
};

describe('AddToCalendarButton', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    // happy-dom has no object-URL implementation for blob downloads.
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders nothing for an event with no start date', () => {
    const { container } = render(<AddToCalendarButton event={{ title: 'TBA' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers Google, Apple, Outlook and a raw .ics download', async () => {
    const user = userEvent.setup();
    render(<AddToCalendarButton event={event} />);
    await user.click(screen.getByRole('button', { name: /add to my calendar/i }));

    for (const label of ['Google Calendar', 'Apple Calendar', 'Outlook', 'Download .ics file']) {
      expect(await screen.findByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('opens Google Calendar in a new tab', async () => {
    const user = userEvent.setup();
    render(<AddToCalendarButton event={event} />);
    await user.click(screen.getByRole('button', { name: /add to my calendar/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Google Calendar' }));

    await waitFor(() => expect(window.open).toHaveBeenCalled());
    const [url, target] = window.open.mock.calls[0];
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('20260802T000000Z');
    expect(target).toBe('_blank');
  });

  it('downloads an .ics for Apple Calendar', async () => {
    const user = userEvent.setup();
    render(<AddToCalendarButton event={event} />);
    await user.click(screen.getByRole('button', { name: /add to my calendar/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Apple Calendar' }));

    await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled());
    expect(window.open).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });
});
