import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Every Supabase read on the hub resolves to an empty, error-free result so
// the page renders its directory and empty states without a network.
const emptyQuery = () => {
  const q = {};
  for (const m of ['select', 'eq', 'gte', 'order', 'limit']) q[m] = vi.fn(() => q);
  q.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
  return q;
};
const from = vi.fn(() => emptyQuery());

vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: (...args) => from(...args),
    storage: { from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://storage.test/${p}` } }) }) },
  },
}));
vi.mock('@/contexts/PlatformSettingsContext.jsx', () => ({ usePlatformSettings: () => ({ settings: {} }) }));
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));

import CommunityPage from '@/pages/community/CommunityPage.jsx';
import { COMMUNITY_ITEMS, EVENT_ITEMS, READS_ITEM, badgeStyle } from '@/lib/communityNav.js';

describe('lib/communityNav', () => {
  it('describes every area with a route, label, blurb and icon', () => {
    for (const item of [...COMMUNITY_ITEMS, ...EVENT_ITEMS, READS_ITEM]) {
      expect(item.href).toMatch(/^\/(community|events|blog)/);
      expect(item.label).toBeTruthy();
      expect(item.desc).toBeTruthy();
      // lucide icons are forwardRef objects; WhatnotIcon is a plain component.
      expect(['function', 'object']).toContain(typeof item.Icon);
      expect(item.Icon).toBeTruthy();
    }
    expect(COMMUNITY_ITEMS.every(i => i.href.startsWith('/community/'))).toBe(true);
    expect(EVENT_ITEMS.every(i => i.href.startsWith('/events/'))).toBe(true);
  });

  it('gives Whatnot its black tile and Local Traders the verified-badge colour', () => {
    expect(badgeStyle(COMMUNITY_ITEMS.find(i => i.isWhatnot)).className).toBe('bg-black');
    expect(badgeStyle(COMMUNITY_ITEMS.find(i => i.label === 'Local Traders')).style.backgroundImage).toContain('--verified-badge');
    expect(badgeStyle(EVENT_ITEMS[0]).className).toContain(EVENT_ITEMS[0].gradient);
  });
});

describe('CommunityPage', () => {
  beforeEach(() => {
    from.mockClear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ leaders: [] }) })));
  });

  it('links to every area of the Community menu', async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Community Hub' })).toBeInTheDocument();
    for (const item of [...COMMUNITY_ITEMS, ...EVENT_ITEMS, READS_ITEM]) {
      const links = screen.getAllByRole('link', { name: new RegExp(item.label) });
      expect(links.some(l => l.getAttribute('href') === item.href)).toBe(true);
    }
  });

  it('previews each area with a bounded, explicit projection and shows empty states', async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    expect(await screen.findByText('No discussions yet')).toBeInTheDocument();
    expect(await screen.findByText('No upcoming events listed')).toBeInTheDocument();
    expect(await screen.findByText('No points on the board yet')).toBeInTheDocument();
    expect(await screen.findByText('No articles yet')).toBeInTheDocument();

    const tables = from.mock.calls.map(([t]) => t);
    for (const t of ['posts', 'events_public', 'blog_articles', 'profiles', 'business_profiles']) expect(tables).toContain(t);
    for (const q of from.mock.results.map(r => r.value)) {
      expect(q.limit).toHaveBeenCalled();
      for (const [cols] of q.select.mock.calls) expect(cols).not.toBe('*');
    }
    expect(fetch).toHaveBeenCalledWith('/api/points/leaderboard');
  });

  it('shows the event poster as the tile thumbnail, and the type icon only when there is none', async () => {
    const rowsQuery = (rows) => {
      const q = emptyQuery();
      q.then = (resolve) => Promise.resolve({ data: rows, error: null }).then(resolve);
      return q;
    };
    from.mockImplementation((table) => (table === 'events_public'
      ? rowsQuery([
        // Uploaded after EVENT_THUMBNAILS_SINCE → the tile loads the thumb companion.
        { id: 'e1', slug: 'hobby-hangout', event_type: 'card_show', title: 'The Hobby Hangout XL', start_date: '2099-11-01', suburb: 'Eveleigh', state: 'NSW', image_url: 'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/events/events/1793400000000.webp' },
        { id: 'e2', slug: 'no-poster', event_type: 'card_show', title: 'Poster-less Show', start_date: '2099-11-02', suburb: 'Keilor Park', state: 'VIC', image_url: null },
        // Legacy poster (before the cutoff) → the full image, no 404-chasing.
        { id: 'e3', slug: 'old-poster', event_type: 'card_show', title: 'Legacy Poster Show', start_date: '2099-11-03', suburb: 'Brisbane', state: 'QLD', image_url: 'https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/events/events/1.webp' },
      ])
      : emptyQuery()));

    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    const withPoster = (await screen.findByText('The Hobby Hangout XL')).closest('a');
    const thumb = withPoster.querySelector('[data-testid="event-thumb"]');
    expect(thumb).toBeTruthy();
    expect(thumb.getAttribute('src')).toContain('events/1793400000000.thumb.webp');
    expect(thumb.getAttribute('alt')).toBe(''); // decorative — the title is the accessible name

    const legacy = screen.getByText('Legacy Poster Show').closest('a').querySelector('[data-testid="event-thumb"]');
    expect(legacy.getAttribute('src')).toContain('events/1.webp');
    expect(legacy.getAttribute('src')).not.toContain('.thumb.webp');

    const withoutPoster = screen.getByText('Poster-less Show').closest('a');
    expect(withoutPoster.querySelector('[data-testid="event-thumb"]')).toBeNull();
    expect(withoutPoster.querySelector('svg')).toBeTruthy(); // falls back to the type icon
  });

  it('fills every event tile with the brand gradient and leads with a date leaf', async () => {
    const rowsQuery = (rows) => {
      const q = emptyQuery();
      q.then = (resolve) => Promise.resolve({ data: rows, error: null }).then(resolve);
      return q;
    };
    from.mockImplementation((table) => (table === 'events_public'
      ? rowsQuery([
        { id: 'e1', slug: 'collectorama', event_type: 'card_show', title: 'Collectorama Melbourne', start_date: '2099-11-01', suburb: 'Keilor Park', state: 'VIC', image_url: null },
        { id: 'e2', slug: 'supanova', event_type: 'community_event', title: 'Supanova Brisbane', start_date: '2099-11-06', end_date: '2099-11-08', suburb: 'South Brisbane', state: 'QLD', image_url: null },
      ])
      : emptyQuery()));

    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    const tile = (await screen.findByText('Collectorama Melbourne')).closest('a');
    expect(tile.getAttribute('data-testid')).toBe('event-tile');
    // CardPop red + charcoal, never the page's card/border tokens.
    expect(tile.style.background).toMatch(/#CE1126|rgb\(206, 17, 38\)/i);
    expect(tile.style.background).toMatch(/#1F2937|rgb\(31, 41, 55\)/i);
    expect(tile.className).toContain('text-white');
    expect(tile.className).not.toContain('bg-card');
    // Date leaf: start day numeral over its month.
    expect(tile.textContent).toContain('1Nov');
    expect(tile.textContent).toContain('View event');

    const multiDay = screen.getByText('Supanova Brisbane').closest('a');
    expect(multiDay.textContent).toContain('6Nov');
    expect(multiDay.textContent).toMatch(/Fri, 6 Nov 2099 – Sun, 8 Nov 2099/);
    expect(screen.getByText('Community Event')).toBeInTheDocument();
  });
});
