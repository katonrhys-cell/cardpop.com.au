import React from 'react';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── mocks ────────────────────────────────────────────────────────────────────

// Configurable listings result + a record of the query chain calls so we can
// assert how filters/search are translated into the Supabase query.
const h = vi.hoisted(() => ({ result: { data: [], error: null }, lastCalls: [] }));

vi.mock('@/lib/supabaseClient.js', () => {
  function makeBuilder() {
    const calls = [];
    h.lastCalls = calls;
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve, reject) => Promise.resolve(h.result).then(resolve, reject);
        return (...args) => { calls.push([prop, ...args]); return b; };
      },
    });
    return b;
  }
  const supabase = {
    from: vi.fn(() => makeBuilder()),
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(function() { return this; }),
        subscribe: vi.fn(() => ({})),
      };
      return channel;
    }),
    removeChannel: vi.fn(),
  };
  return { supabase, default: supabase };
});

vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));
vi.mock('@/components/MarketplaceListingCard.jsx', () => ({
  default: ({ listing }) => <div data-testid="listing">{listing.vault_item?.card_name ?? listing.id}</div>,
}));
// IMPORTANT: return the SAME object each call. The page lists these getters in
// effect dependency arrays; fresh refs per render would re-fire the effects →
// setState → infinite render loop (hang), since the real hook memoizes them.
const arr = async () => [];
const categoriesValue = {
  loading: false, error: null,
  getCategories: vi.fn(arr), getRootCategories: vi.fn(arr), getFranchisesByCategory: vi.fn(arr),
  getManufacturersByFranchise: vi.fn(arr), getTeamsByFranchise: vi.fn(arr),
  getSetsByFranchiseAndManufacturer: vi.fn(arr), getCategoriesByGroup: vi.fn(arr),
  getParallelsByFranchise: vi.fn(arr), getSubsetsBySet: vi.fn(arr),
  getAllFranchises: vi.fn(arr), getAllManufacturers: vi.fn(arr), getAllTeams: vi.fn(arr),
  getAllSets: vi.fn(arr), getAllParallels: vi.fn(arr), getAllSubsets: vi.fn(arr),
  getSubcategoriesByCategory: vi.fn(arr), getBrandsBySubcategory: vi.fn(arr),
  getSeriesByBrand: vi.fn(arr), buildNameMap: vi.fn(async () => ({})),
};
vi.mock('@/hooks/useCategories.js', () => ({ useCategories: () => categoriesValue }));
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

import { supabase } from '@/lib/supabaseClient.js';
import MarketplacePage from '@/pages/marketplace/MarketplacePage.jsx';

function listing(id, cardName) {
  return { id, source: 'cardpop', vault_item: { card_name: cardName }, price_aud: 100 };
}

function renderPage() {
  return render(<MemoryRouter><MarketplacePage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { data: [], error: null };
});

afterEach(() => {
  cleanup();
});

// ─── data states ─────────────────────────────────────────────────────────────

describe('MarketplacePage — listing states', () => {
  it('renders a card for each active listing returned from the database', async () => {
    h.result = { data: [listing('l1', 'Charizard'), listing('l2', 'Pikachu')], error: null };
    renderPage();

    await waitFor(() => expect(screen.getAllByTestId('listing')).toHaveLength(2));
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText('Pikachu')).toBeInTheDocument();
    expect(supabase.from).toHaveBeenCalledWith('listings');
  });

  it('queries active + sold (badged "Sold"), non-vault listings — archived are hidden', async () => {
    renderPage();
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    expect(h.lastCalls).toContainEqual(['in', 'status', ['active', 'sold']]);
    expect(h.lastCalls).toContainEqual(['neq', 'listing_type', 'vault']);
  });

  it('shows the empty state when there are no listings', async () => {
    h.result = { data: [], error: null };
    renderPage();
    await waitFor(() => expect(screen.getByText('No items available')).toBeInTheDocument());
    expect(screen.queryByTestId('listing')).not.toBeInTheDocument();
  });

  it('shows an error state when the query fails', async () => {
    h.result = { data: null, error: new Error('DB unreachable') };
    renderPage();
    await waitFor(() => expect(screen.getByText('Connection Error')).toBeInTheDocument());
    expect(screen.getByText('DB unreachable')).toBeInTheDocument();
  });
});

// ─── search & refresh ─────────────────────────────────────────────────────────

describe('MarketplacePage — search and refresh', () => {
  it('applies the debounced search term across card name, set name and number', async () => {
    h.result = { data: [listing('l1', 'Charizard')], error: null };
    renderPage();
    await waitFor(() => expect(screen.getByText('Charizard')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search card, set or number...'), 'charizard');

    // Debounced (~400ms) before the effect re-runs the query with the filter.
    await waitFor(
      () => expect(h.lastCalls).toContainEqual([
        'or',
        'card_name.ilike."%charizard%",set_name.ilike."%charizard%",card_number.ilike."%charizard%"',
        { referencedTable: 'vault_item' },
      ]),
      { timeout: 1500 },
    );
  });

  it('re-fetches and toasts when the refresh button is clicked', async () => {
    h.result = { data: [listing('l1', 'Charizard')], error: null };
    renderPage();
    await waitFor(() => expect(screen.getByText('Charizard')).toBeInTheDocument());

    const before = supabase.from.mock.calls.length;
    const refreshBtn = document.querySelector('button .lucide-refresh-cw')?.closest('button')
      ?? screen.getAllByRole('button').find((b) => b.querySelector('svg'));
    await act(async () => { refreshBtn.click(); });

    await waitFor(() => expect(supabase.from.mock.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Marketplace data refreshed'));
  });
});
