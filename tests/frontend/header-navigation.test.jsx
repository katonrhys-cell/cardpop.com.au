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
});

// ─── Mobile hamburger menu ────────────────────────────────────────────────────

describe('Header mobile hamburger menu — consecutive navigations', () => {
  it('navigates on the first selection, then again on a second selection', async () => {
    const user = userEvent.setup();
    renderHeader();

    // First selection: open hamburger, tap "Shop"
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Shop' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/shop'));

    // Sheet must be fully closed and the page must be interactive again
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');

    // Second selection: open hamburger again, tap "Marketplace"
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('link', { name: 'Marketplace' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/marketplace'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('navigates twice in a row through the Browse Collections accordion', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /trading card games/i }));
    await user.click(screen.getByRole('button', { name: 'Pokémon' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/pokemon'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /sporting cards/i }));
    await user.click(screen.getByRole('button', { name: 'NBA' }));
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

    await user.hover(screen.getByRole('button', { name: /browse collections/i }));
    await user.click(screen.getByRole('link', { name: 'Pokémon' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/pokemon'));

    await user.unhover(screen.getByTestId('current-path'));
    await user.hover(screen.getByRole('button', { name: /browse collections/i }));
    await user.click(screen.getByRole('link', { name: 'NBA' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/collections/nba'));
  });

  it('Community dropdown (mouse hover) then a plain nav link both navigate', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.hover(screen.getByRole('button', { name: 'Community' }));
    await user.click(screen.getByRole('link', { name: /forum/i }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/community/forum'));

    await user.click(screen.getByRole('link', { name: 'Grading' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/grading'));
  });

  it('mouse click on a hover-opened trigger keeps the menu open instead of toggling it shut', async () => {
    const user = userEvent.setup();
    renderHeader();

    // user.click moves the mouse onto the trigger first, so the hover handler
    // opens the menu and the click must not immediately close it again.
    await user.click(screen.getByRole('button', { name: /browse collections/i }));
    expect(screen.queryByRole('link', { name: 'Pokémon' })).toBeInTheDocument();
  });

  it('touch tap opens the dropdown and a second tap navigates', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: /browse collections/i }) });
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
    await user.click(screen.getByRole('link', { name: 'Shop' }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/shop'));

    // Simulate the Radix scroll-lock leak: body left unclickable after close
    document.body.style.pointerEvents = 'none';

    await waitFor(
      () => expect(document.body.style.pointerEvents).not.toBe('none'),
      { timeout: 1500 },
    );
  });
});
