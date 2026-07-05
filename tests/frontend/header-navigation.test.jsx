import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useCart.jsx', () => ({ useCart: vi.fn() }));
vi.mock('@/hooks/useDarkMode.js', () => ({ useDarkMode: () => ({ isDark: false, toggle: vi.fn() }) }));
vi.mock('@/components/SearchBar.jsx', () => ({ default: () => <div data-testid="searchbar" /> }));
vi.mock('@/components/NotificationBell.jsx', () => ({ default: () => <div /> }));
vi.mock('@/components/VaultDropdown.jsx', () => ({ default: () => <div /> }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ count: 0 }) })),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import Header from '@/components/Header.jsx';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

function renderHeader() {
  useAuth.mockReturnValue({
    isAuthenticated: false,
    currentUser: null,
    isAdmin: false,
    logout: vi.fn(),
    isVerified: false,
    loading: false,
  });
  useCart.mockReturnValue({ cartItems: [], setIsCartOpen: vi.fn() });

  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/shop" element={<div>Shop Page</div>} />
        <Route path="/marketplace" element={<div>Marketplace Page</div>} />
        <Route path="/grading" element={<div>Grading Page</div>} />
        <Route path="/collections/:collectionSlug" element={<div>Collection Page</div>} />
        <Route path="/blog" element={<div>Blog Page</div>} />
        <Route path="/blog/category/:category" element={<div>Blog Category Page</div>} />
        <Route path="/community" element={<div>Community Hub Page</div>} />
        <Route path="/community/forum" element={<div>Forum Page</div>} />
        <Route path="*" element={<div>Fallback Page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.style.pointerEvents = '';
  // The Header's desktop Row-2 nav is gated behind useIsDesktop (a min-width
  // media query). Report a desktop viewport so the dropdown tests exercise it;
  // the mobile hamburger tests are unaffected (the Sheet renders regardless).
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('min-width: 1024px'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

// ─── Mobile hamburger menu ────────────────────────────────────────────────────

describe('Header mobile hamburger menu — consecutive navigations', () => {
  it('navigates on the first selection, then again on a second selection', async () => {
    const user = userEvent.setup();
    renderHeader();

    // First selection: open hamburger, tap "Shop". The Sheet body is lazily
    // loaded, so wait for its links to appear.
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Shop' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/shop'));

    // Sheet must be fully closed and the page must be interactive again
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');

    // Second selection: open hamburger again, tap "Marketplace"
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(await screen.findByRole('link', { name: 'Marketplace' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/marketplace'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('navigates twice in a row through the Browse Collections accordion', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(await screen.findByRole('button', { name: /trading card games/i }));
    await user.click(await screen.findByRole('button', { name: 'Pokémon' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/pokemon'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(await screen.findByRole('button', { name: /sporting cards/i }));
    await user.click(await screen.findByRole('button', { name: 'NBA' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/nba'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');
  });
});

// ─── Desktop nav dropdowns ────────────────────────────────────────────────────

describe('Header desktop dropdowns — consecutive navigations', () => {
  it('Browse Collections dropdown (mouse hover) navigates twice in a row', async () => {
    const user = userEvent.setup();
    renderHeader();

    // The Row-2 nav is lazy; wait for the trigger before interacting.
    await user.hover(await screen.findByRole('button', { name: /browse collections/i }));
    await user.click(await screen.findByRole('link', { name: 'Pokémon' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/pokemon'));

    await user.unhover(screen.getByTestId('current-path'));
    await user.hover(await screen.findByRole('button', { name: /browse collections/i }));
    await user.click(await screen.findByRole('link', { name: 'NBA' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/nba'));
  });

  it('Community dropdown (mouse hover) then a plain nav link both navigate', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.hover(await screen.findByRole('button', { name: 'Community' }));
    await user.click(await screen.findByRole('link', { name: /forum/i }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/community/forum'));

    // Marketplace is a plain top-level nav link (Grading is now a dropdown).
    await user.click(await screen.findByRole('link', { name: 'Marketplace' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/marketplace'));
  });

  it('mouse click on a hover-opened trigger keeps the menu open instead of toggling it shut', async () => {
    const user = userEvent.setup();
    renderHeader();

    // user.click moves the mouse onto the trigger first, so the hover handler
    // opens the menu and the click must not immediately close it again.
    await user.click(await screen.findByRole('button', { name: /browse collections/i }));
    expect(await screen.findByRole('link', { name: 'Pokémon' })).toBeInTheDocument();
  });

  it('touch tap opens the dropdown and a second tap navigates', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.pointer({ keys: '[TouchA]', target: await screen.findByRole('button', { name: /browse collections/i }) });
    const pokemonLink = await screen.findByRole('link', { name: 'Pokémon' });
    await user.pointer({ keys: '[TouchA]', target: pokemonLink });
    await user.click(pokemonLink);
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/pokemon'));
  });
});

// ─── Stuck body pointer-events failsafe ───────────────────────────────────────

describe('Header body pointer-events failsafe', () => {
  it('clears a leftover pointer-events:none on <body> after navigation', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(await screen.findByRole('link', { name: 'Shop' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/shop'));

    // Simulate the Radix scroll-lock leak: body left unclickable after close
    document.body.style.pointerEvents = 'none';

    await waitFor(
      () => expect(document.body.style.pointerEvents).not.toBe('none'),
      { timeout: 1500 },
    );
  });

  it('does not run the body-style sweep after the component unmounts', async () => {
    const { unmount } = renderHeader();

    // A body style mutation makes the MutationObserver schedule a 350ms
    // settle timeout. Unmounting before it fires must cancel it — otherwise
    // the callback runs against a torn-down document and throws.
    document.body.style.overflow = 'hidden';
    // Let the observer deliver and schedule its timeout.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const querySpy = vi.spyOn(document, 'querySelector');
    unmount();

    // Wait past the 350ms settle delay and the 500ms periodic sweep.
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(querySpy).not.toHaveBeenCalled();
    querySpy.mockRestore();
    document.body.style.overflow = '';
  });
});
