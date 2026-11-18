import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const homeEvents = vi.hoisted(() => ({ result: { data: [], error: null } }));
vi.mock('@/lib/homepageData.js', () => ({
  getHomepageEvents: () => Promise.resolve(homeEvents.result),
}));

import HomepageFeaturedEvents, { homepageEventsToShow } from '@/components/home/HomepageFeaturedEvents.jsx';
import { queryHomepageEvents, queryHomepageBundle, bundleHasErrors, HOMEPAGE_EVENTS_LIMIT } from '@/lib/homepageQueries.js';

const TODAY = '2026-11-10';
const ev = (over = {}) => ({
  id: 'e1', slug: 'sydney-card-show', title: 'Sydney Card Show', status: 'approved',
  homepage_featured: true, start_date: '2026-11-20', end_date: null, suburb: 'Parramatta', state: 'NSW',
  ...over,
});

describe('homepageEventsToShow', () => {
  it('keeps upcoming homepage-featured approved events, more than three, capped at the limit', () => {
    const rows = Array.from({ length: HOMEPAGE_EVENTS_LIMIT + 3 }, (_, i) => ev({ id: `e${i}` }));
    const shown = homepageEventsToShow(rows, TODAY);
    expect(HOMEPAGE_EVENTS_LIMIT).toBeGreaterThan(3);
    expect(shown).toHaveLength(HOMEPAGE_EVENTS_LIMIT);
    expect(shown[0].id).toBe('e0');
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

  it('invites organisers to take the spot when there is no featured event', async () => {
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    expect(await screen.findByTestId('home-featured-events-empty')).toHaveTextContent('No featured events right now');
    expect(screen.getByRole('heading', { name: /Featured events/ })).toBeInTheDocument();
    // List event lives under the section: sign up first, then the submit form.
    expect(screen.getByRole('link', { name: /list event/i }))
      .toHaveAttribute('href', `/signup?next=${encodeURIComponent('/account/events?new=1')}`);
    expect(screen.getByRole('link', { name: /feature it here/i })).toHaveAttribute('href', '/list-your-event#featured-packages');
  });

  it('shows each featured event with its details', async () => {
    homeEvents.result = {
      data: [ev({
        start_date: '2099-01-01', start_time: '09:00', end_time: '16:00', venue_name: 'Town Hall',
        entry_fee_aud: 10, organizer_name: 'Card Shows Co', short_description: 'Two halls of traders.',
      })],
      error: null,
    };
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    const link = (await screen.findByText('Sydney Card Show')).closest('a');
    expect(link).toHaveTextContent('Two halls of traders.');
    expect(link).toHaveTextContent('9am – 4pm');
    expect(link).toHaveTextContent('Town Hall, Parramatta, NSW');
    expect(link).toHaveTextContent('$10.00 AUD');
    expect(link).toHaveTextContent('Card Shows Co');
    expect(screen.queryByTestId('home-featured-events-empty')).toBeNull();
    expect(screen.getByRole('link', { name: /list event/i })).toBeInTheDocument();
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

  it('shows the whole poster, and falls back to the full image when the thumb is missing', async () => {
    const stored = 'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/events/events/1794868624345.jpg';
    homeEvents.result = { data: [ev({ start_date: '2099-01-01', image_url: stored })], error: null };
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    const link = (await screen.findByText('Sydney Card Show')).closest('a');
    const poster = () => link.querySelector('img.object-contain');
    expect(poster().getAttribute('src')).toContain('.thumb.webp');
    fireEvent.error(poster());
    expect(poster().getAttribute('src')).toContain('1794868624345.jpg');
    fireEvent.error(poster());
    expect(link.querySelector('img')).toBeNull();
  });

  it('serves a poster bundled with the site from its own path', async () => {
    homeEvents.result = { data: [ev({ start_date: '2099-01-01', image_url: '/images/events/show.jpg' })], error: null };
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    const link = (await screen.findByText('Sydney Card Show')).closest('a');
    expect(link.querySelector('img.object-contain')).toHaveAttribute('src', '/images/events/show.jpg');
  });

  it('holds each card to its slot width however long a line in it is', async () => {
    homeEvents.result = { data: [ev({ start_date: '2099-01-01' })], error: null };
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    const link = (await screen.findByText('Sydney Card Show')).closest('a');
    expect(link.parentElement.className).toContain('min-w-0');
  });

  it('lays events out in a carousel track, not a full-width grid, so one event is one card wide', async () => {
    homeEvents.result = { data: [ev({ start_date: '2099-01-01' })], error: null };
    render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
    const link = (await screen.findByText('Sydney Card Show')).closest('a');
    const slot = link.parentElement;
    expect(slot.className).toContain('snap-start');
    expect(slot.className).toContain('lg:basis-[calc((100%_-_3rem)/3)]');
    expect(slot.parentElement).toBe(screen.getByTestId('home-featured-events-track'));
    // Nothing overflows with one event, so no arrows.
    expect(screen.queryByLabelText('Next events')).toBeNull();
  });

  it('renders every featured event in the track and pages through them with arrows', async () => {
    const clientWidth = 900;
    const proto = HTMLElement.prototype;
    const saved = {
      clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
      scrollWidth: Object.getOwnPropertyDescriptor(proto, 'scrollWidth'),
    };
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => clientWidth });
    Object.defineProperty(proto, 'scrollWidth', { configurable: true, get: () => 1800 });
    try {
      homeEvents.result = {
        data: ['a', 'b', 'c', 'd', 'e'].map((id) => ev({ id, slug: id, title: `Show ${id}`, start_date: '2099-01-01' })),
        error: null,
      };
      render(<MemoryRouter><HomepageFeaturedEvents /></MemoryRouter>);
      const track = await screen.findByTestId('home-featured-events-track');
      expect(track.querySelectorAll('a[href^="/events/"]')).toHaveLength(5);

      const scrollTo = vi.fn();
      track.scrollTo = scrollTo;
      track.scrollLeft = 0;
      fireEvent.click(screen.getByLabelText('Next events'));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'smooth' });
      track.scrollLeft = 900; // last page → wraps round to the first
      fireEvent.click(screen.getByLabelText('Next events'));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
      track.scrollLeft = 0; // first page → Previous wraps to the last
      fireEvent.click(screen.getByLabelText('Previous events'));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'smooth' });
    } finally {
      for (const [k, d] of Object.entries(saved)) {
        if (d) Object.defineProperty(proto, k, d); else delete proto[k];
      }
    }
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
    expect(c.calls.find((x) => x[0] === 'limit')[1]).toBeLessThanOrEqual(HOMEPAGE_EVENTS_LIMIT * 2);
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
