import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Regression: the Featured Cards / Sellers grids mount LATE (only once `loading`
// flips to false). The reveal-on-scroll hook must still attach its
// IntersectionObserver to those late-mounted grids — otherwise the reveal never
// fires and the grid stays at its initial `opacity-0`, so the whole section
// looks blank even though the cards rendered. This test drives an
// IntersectionObserver stub that DOES fire, and asserts the card's reveal
// wrapper ends up revealed (anim-reveal-up), not stuck at opacity-0.

vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));
vi.mock('@/components/HeroCardShowcase.jsx', () => ({ default: () => null }));
vi.mock('@/components/LiveActivityTicker.jsx', () => ({ default: () => null }));
vi.mock('@/components/VaultListingCard.jsx', () => ({
  default: ({ vaultItem }) => <div data-testid="featured-card">{vaultItem.card_name}</div>,
}));
vi.mock('@/components/FeaturedSellerCard.jsx', () => ({
  default: ({ seller }) => <div data-testid="seller-card">{seller.display_name}</div>,
}));
vi.mock('@/lib/heroShowcase.js', () => ({ fetchActiveShowcaseCards: async () => [] }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: {} }));
vi.mock('@/lib/queryCache.js', () => ({
  cachedQuery: async (key) =>
    key.includes('sellers')
      ? { data: [{ id: 's1', display_name: 'CLEET Collectables', username: 'cleet', is_verified: true }], error: null }
      : { data: [{ id: 'c1', card_name: 'Victor Wembanyama', listing_type: 'For Sale', estimated_value_aud: '400.00' }], error: null },
  invalidateCache: () => {},
}));

import HomePage from '@/pages/HomePage.jsx';

beforeAll(() => {
  window.scrollTo = window.scrollTo || vi.fn();
  window.matchMedia = window.matchMedia || vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  // A firing IntersectionObserver: reports the target as intersecting the moment
  // it is observed. The bug was that the observer was never attached to the
  // late-mounted grid, so a firing stub only reveals with the fix in place.
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
  window.IntersectionObserver = globalThis.IntersectionObserver;
});

describe('HomePage featured grids reveal after late mount', () => {
  it('reveals the Featured Cards grid (not stuck at opacity-0)', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId('featured-card');
    // The reveal wrapper is the card's parent element in HomePage.
    const wrapper = card.parentElement;
    await waitFor(() => {
      expect(wrapper.className).toContain('anim-reveal-up');
    });
    expect(wrapper.className).not.toContain('opacity-0');
  });

  it('reveals the Featured Sellers grid too', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>,
    );
    const seller = await screen.findByTestId('seller-card');
    const wrapper = seller.parentElement;
    await waitFor(() => {
      expect(wrapper.className).toContain('anim-reveal-up');
    });
    expect(wrapper.className).not.toContain('opacity-0');
  });
});
