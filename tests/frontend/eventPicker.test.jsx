import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// A chainable stand-in for the supabase query builder that records the calls.
const calls = vi.hoisted(() => []);
const rows = vi.hoisted(() => ({ current: [] }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = () => {
    const chain = {};
    for (const method of ['select', 'limit', 'or', 'order', 'gte', 'eq']) {
      chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
    }
    chain.then = (resolve) => resolve({ data: rows.current, error: null });
    return chain;
  };
  return { supabase: { from: (table) => { calls.push(['from', table]); return builder(); } } };
});

import EventPicker from '@/components/events/EventPicker.jsx';
import { sanitizeEventQuery, formatEventDates, eventSubtitle } from '@/utils/eventPicker.js';

const EVENTS = [
  { id: 'e1', slug: 'vault-melbourne-card-show', title: 'Vault Melbourne Card Show', start_date: '2026-11-14', end_date: '2026-11-15', venue_name: 'Caulfield Racecourse', suburb: 'Caulfield', state: 'VIC' },
  { id: 'e2', slug: 'sydney-card-expo', title: 'Sydney Card Expo', start_date: '2026-12-01', end_date: null, venue_name: null, suburb: 'Parramatta', state: 'NSW' },
];

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  calls.length = 0;
  rows.current = EVENTS;
});

const renderPicker = (props = {}) => render(
  <MemoryRouter><EventPicker {...props} /></MemoryRouter>,
);

describe('EventPicker', () => {
  it('lists recent and upcoming events on open and returns the chosen row', async () => {
    const onSelect = vi.fn();
    renderPicker({ value: null, onSelect });

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Sydney Card Expo'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }));
    expect(calls).toContainEqual(['from', 'events_public']);
    expect(calls.some(([m]) => m === 'gte')).toBe(true);
    expect(calls.some(([m]) => m === 'or')).toBe(false);
  });

  it('searches title, venue and suburb in the database when typing', async () => {
    renderPicker({ value: null, onSelect: vi.fn() });
    fireEvent.click(screen.getByRole('combobox'));
    const input = await screen.findByPlaceholderText(/event, venue or suburb/i);
    fireEvent.change(input, { target: { value: 'melb,ourne' } });

    await waitFor(() => expect(calls.some(([m]) => m === 'or')).toBe(true));
    const [, filter] = calls.find(([m]) => m === 'or');
    expect(filter).toBe('title.ilike.%melb ourne%,venue_name.ilike.%melb ourne%,suburb.ilike.%melb ourne%');
  });

  it('shows the linked event with a link to its page and can unlink it', async () => {
    const onSelect = vi.fn();
    renderPicker({ value: EVENTS[0], onSelect });

    expect(screen.getByRole('link', { name: /view event/i })).toHaveAttribute('href', '/events/vault-melbourne-card-show');
    fireEvent.click(screen.getByRole('button', { name: /unlink event/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('eventPicker helpers', () => {
  it('strips PostgREST filter syntax from the search term', () => {
    expect(sanitizeEventQuery(' a,b(c)*%d ')).toBe('a b c d');
    expect(sanitizeEventQuery(null)).toBe('');
  });

  it('formats single-day, same-month and cross-month dates', () => {
    expect(formatEventDates({ start_date: '2026-12-01' })).toBe('1 Dec 2026');
    expect(formatEventDates(EVENTS[0])).toBe('14–15 Nov 2026');
    expect(formatEventDates({ start_date: '2026-11-30', end_date: '2026-12-01' })).toBe('30 Nov – 1 Dec 2026');
    expect(eventSubtitle(EVENTS[1])).toBe('1 Dec 2026 · Parramatta NSW');
  });
});
