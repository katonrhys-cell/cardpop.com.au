import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const homeEvents = vi.hoisted(() => ({ result: { data: [], error: null } }));
vi.mock('@/lib/homepageData.js', () => ({
  getHomepageEvents: () => Promise.resolve(homeEvents.result),
}));

import HomepageFeaturedEvents, { homepageEventsToShow } from '@/components/home/HomepageFeaturedEvents.jsx';
import { queryHomepageEvents, queryHomepageBundle, bundleHasErrors } from '@/lib/homepageQueries.js';

const TODAY = '2026-11-10';
const ev = (over = {}) => ({
  id: 'e1', slug: 'sydney-card-show', title: 'Sydney Card Show', status: 'approved',
  homepage_featured: true, start_date: '2026-11-20', end_date: null, suburb: 'Parramatta', state: 'NSW',
  ...over,
});

describe('homepageEventsToShow', () => {
  it('keeps upcoming homepage-featured approved events, at most three', () => {
    const rows = [ev({ id: 'a' }), ev({ id: 'b' }), ev({ id: 'c' }), ev({ id: 'd' })];
    expect(homepageEventsToShow(rows, TODAY).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops ended, unapproved and unflagged events', () => {
    const rows = [
      ev({ id: 'ended', start_date: '2026-11-01' }),
      ev({ id: 'running', start_date: '2026-11-08', end_date: '2026-11-12' }),
      ev({ id: 'pending', status: 'pending_review' }),
      ev({ id: 'calendar-only', homepage_featured: false }),
    ];
    expect(homepageEventsToShow(rows, TODAY).map((e) => e.id)).toEqual(['running']);
    expect(homepageEventsToShow(null, TODAY)).toEqual([]);
  });
});

describe('<HomepageFeaturedEvents />', () => {
  beforeEach(() => { homeEvents.result = { data: [], error: null }; });

  it('renders nothing when there is no featured event', async () => {
    const { container } = render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows featured events as gold cards linking to their pages', async () => {
    homeEvents.result = { data: [ev({ start_date: '2099-01-01' })], error: null };
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    const title = await screen.findByText('Sydney Card Show');
    const link = title.closest('a');
    expect(link).toHaveAttribute('href', '/events/sydney-card-show');
    expect(link.className).toMatch(/border-amber-400/);
    expect(screen.getByRole('heading', { name: /Featured events/ })).toBeInTheDocument();
  });
});

describe('queryHomepageEvents', () => {
  const client = (result) => {
    const calls = [];
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
        return (...args) => { calls.push([prop, ...args]); return b; };
      },
    });
    return { calls, from: (t) => { calls.push(['from', t]); return b; } };
  };

  it('reads approved homepage-featured events from the public view, bounded', async () => {
    const c = client({ data: [ev()], error: null });
    const res = await queryHomepageEvents(c);
    expect(res.data).toHaveLength(1);
    expect(c.calls).toContainEqual(['from', 'events_public']);
    expect(c.calls).toContainEqual(['eq', 'homepage_featured', true]);
    expect(c.calls).toContainEqual(['eq', 'status', 'approved']);
    expect(c.calls.find((x) => x[0] === 'limit')[1]).toBeLessThanOrEqual(6);
  });

  it('answers empty, not failed, before the column exists', async () => {
    const res = await queryHomepageEvents(client({ data: null, error: { code: '42703', message: 'column does not exist' } }));
    expect(res).toEqual({ data: [], error: null });
  });

  it('is carried in the bundle without making it required', async () => {
    const ok = { data: [], error: null };
    const bundle = { cards: ok, sellers: ok, stats: ok, traffic: ok };
    expect(bundleHasErrors(bundle)).toBe(false);
    expect(bundleHasErrors({ ...bundle, events: { data: null, error: { message: 'x' } } })).toBe(false);
    expect(typeof queryHomepageBundle).toBe('function');
  });
});
