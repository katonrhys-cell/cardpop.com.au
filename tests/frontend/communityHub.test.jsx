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
});
