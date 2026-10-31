import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// The home page stats strip is two panels: "Found on Google" (Search Console
// impressions → clicks → GA4 visitors) and "The CardPop community" (cards in
// vaults, members, events) with a Join free nudge for signed-out visitors.
// Live Listings is no longer a tile. Every figure is a real count: the Google
// panel only appears once the nightly sync has figures over the public floors.

vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));
vi.mock('@/components/HeroCardShowcase.jsx', () => ({ default: () => null }));
vi.mock('@/components/LiveActivityTicker.jsx', () => ({ default: () => null }));
vi.mock('@/components/VaultListingCard.jsx', () => ({ default: () => null }));
vi.mock('@/components/FeaturedSellerCard.jsx', () => ({ default: () => null }));
vi.mock('@/lib/heroShowcase.js', () => ({ fetchActiveShowcaseCards: async () => [] }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({ traffic: null, authed: false }));
vi.mock('@/lib/queryCache.js', () => ({
  cachedQuery: async (key) => {
    if (key.includes('stats')) return { data: { sellers: 79, vaultCards: 47, events: 86 }, error: null };
    if (key.includes('traffic')) return { data: state.traffic, error: null };
    return { data: [], error: null };
  },
  invalidateCache: () => {},
}));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ isAuthenticated: state.authed }) }));

import HomePage from '@/pages/HomePage.jsx';

const freshSummary = () => ({
  visitors_30d: 4210,
  visitors_all_time: 15300,
  since_date: '2026-06-03',
  synced_at: new Date().toISOString(),
  search_impressions_30d: 18400,
  search_clicks_30d: 620,
  search_impressions_all_time: 61000,
  search_clicks_all_time: 2100,
  search_since_date: '2026-05-20',
  search_synced_at: new Date().toISOString(),
});

beforeAll(() => {
  window.scrollTo = window.scrollTo || vi.fn();
  window.matchMedia = window.matchMedia || vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
  window.IntersectionObserver = globalThis.IntersectionObserver;
});

const renderHome = () => render(<MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>);

describe('HomePage stats strip', () => {
  it('shows the Google panel beside the community panel, with no Live Listings tile', async () => {
    state.traffic = freshSummary();
    state.authed = false;
    renderHome();

    const google = await screen.findByTestId('stats-google');
    expect(google).toHaveTextContent('Found on Google');
    // Funnel order: shown on Google → clicked → visited.
    const labels = [...google.querySelectorAll('div.text-center')].map((el) => el.textContent);
    expect(labels[0]).toContain('Google Search impressions');
    expect(labels[1]).toContain('Clicks from Google');
    expect(labels[2]).toContain('Visitors');
    expect(google).toHaveTextContent('61k since May 2026');

    const community = screen.getByTestId('stats-community');
    expect(community).toHaveTextContent('Cards in Member Vaults');
    expect(community).toHaveTextContent('Active Members');
    expect(community).toHaveTextContent('Events Listed');
    expect(community).toHaveTextContent('Join free');
    expect(screen.getAllByRole('link', { name: /join free/i })[0]).toHaveAttribute('href', '/signup');

    expect(screen.queryByText('Live Listings')).toBeNull();
  });

  it('keeps the community panel on its own when there are no Google figures, and drops the nudge for members', async () => {
    state.traffic = null;
    state.authed = true;
    renderHome();

    const community = await screen.findByTestId('stats-community');
    expect(community).toHaveTextContent('Events Listed');
    expect(screen.queryByTestId('stats-google')).toBeNull();
    expect(screen.queryByText('Join free')).toBeNull();
  });
});
