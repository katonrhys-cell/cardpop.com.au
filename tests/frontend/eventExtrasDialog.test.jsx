import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockFetch = vi.hoisted(() => vi.fn());
const mockPaid = vi.hoisted(() => ({ rows: [], calls: [] }));
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockFetch } }));
vi.mock('@/lib/supabaseClient.js', () => {
  // supabase.from('event_feature_purchases').select('package').eq(...).eq(...)
  const builder = (table) => {
    const b = {
      select: (...a) => { mockPaid.calls.push([table, 'select', ...a]); return b; },
      eq: (...a) => { mockPaid.calls.push([table, 'eq', ...a]); return b; },
      then: (res, rej) => Promise.resolve({ data: mockPaid.rows, error: null }).then(res, rej),
    };
    return b;
  };
  return { supabase: { from: builder } };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import EventExtrasDialog from '@/components/events/EventExtrasDialog.jsx';
import { todayInAustralia } from '@/utils/featuredPackages.js';

const addDays = (n) => {
  const d = new Date(`${todayInAustralia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const EVENT = { id: 'ev-1', title: 'Sydney Card Show', status: 'approved', start_date: addDays(20), is_featured: false };

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'stop here' }) });
  mockPaid.rows = [];
  mockPaid.calls = [];
});

describe('EventExtrasDialog', () => {
  it('renders nothing without an event', () => {
    render(<EventExtrasDialog event={null} onClose={() => {}} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('offers the three extras with their prices and the review conditions', async () => {
    render(<EventExtrasDialog event={EVENT} onClose={() => {}} />);

    expect(screen.getByText('Promote Sydney Card Show')).toBeInTheDocument();
    expect(screen.getByText(/separate from featured\s+placement and from membership/)).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Instagram story.*\$49/s })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Instagram post.*\$99/s })).toBeEnabled();
    const review = screen.getByRole('radio', { name: /Full event review.*\$199/s });
    expect(review).toBeEnabled();
    expect(review.textContent).toMatch(/free entry/);
    expect(review.textContent).toMatch(/on the day/);
    // Anything beyond the list goes to email.
    expect(screen.getByRole('link', { name: 'admin@cardpop.com.au' })).toHaveAttribute('href', 'mailto:admin@cardpop.com.au');
    // Nothing chosen yet: nothing to pay.
    expect(screen.getByRole('button', { name: 'Choose an extra' })).toBeDisabled();
    // It asked only for this event's paid rows.
    await waitFor(() => expect(mockPaid.calls).toContainEqual(['event_feature_purchases', 'eq', 'event_id', 'ev-1']));
    expect(mockPaid.calls).toContainEqual(['event_feature_purchases', 'eq', 'status', 'paid']);
  });

  it('marks an extra already bought as Booked and disables it, ignoring a paid featuring', async () => {
    mockPaid.rows = [{ package: 'story' }, { package: 'spotlight' }];
    render(<EventExtrasDialog event={EVENT} onClose={() => {}} />);

    const story = await screen.findByRole('radio', { name: /Instagram story.*Booked/s });
    expect(story).toBeDisabled();
    expect(screen.getAllByText('Booked')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /^Instagram post/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /^Full event review/ })).toBeEnabled();
  });

  it('is offered for an event the Ultimate membership already features', () => {
    render(<EventExtrasDialog event={{ ...EVENT, is_featured: true, membership_featured: true }} onClose={() => {}} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeEnabled();
  });

  it('disables every extra for an event that has started', () => {
    render(<EventExtrasDialog event={{ ...EVENT, start_date: addDays(-1) }} onClose={() => {}} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getAllByText('This event has already started.')).toHaveLength(3);
  });

  it('pays for the chosen extra through the extra checkout', async () => {
    render(<EventExtrasDialog event={EVENT} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('radio', { name: /^Instagram post/ }));
    expect(screen.getByRole('radio', { name: /^Instagram post/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pay $99 for Instagram post' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/events/ev-1/extra-checkout');
    expect(opts.method).toBe('POST');
    const sent = JSON.parse(opts.body);
    expect(sent.extra).toBe('post');
    expect(sent.successUrl).toMatch(/\/account\/events\?extra=success$/);
    expect(sent.cancelUrl).toMatch(/\/account\/events$/);
    // The price is the server's to set: none is sent.
    expect(sent).not.toHaveProperty('amount');
    expect(sent).not.toHaveProperty('price');
  });
});
