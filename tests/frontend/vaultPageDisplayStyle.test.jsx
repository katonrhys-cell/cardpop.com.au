import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// A card's chosen display style (holographic, slab, glass…) has to render in
// the owner's own vault, not just on the marketplace surfaces. Both vault
// pages used to render a plain <img> and silently dropped display_style.

const h = vi.hoisted(() => ({ vaultResult: { data: [], count: 0, error: null } }));

vi.mock('@/lib/supabaseClient.js', () => {
  function makeBuilder(result) {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        return () => b;
      },
    });
    return b;
  }
  const supabase = {
    from: vi.fn((table) =>
      makeBuilder(table === 'vault_items' ? h.vaultResult : { data: [], error: null })),
  };
  return { supabase, default: supabase };
});

vi.mock('@/contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: { id: 'u1' } }),
}));
vi.mock('@/components/Header.jsx', () => ({ COLLECTIONS_LIST: ['Pokemon'] }));
vi.mock('@/components/VaultListingModal.jsx', () => ({ default: () => null }));
vi.mock('@/components/PSAPopPanel.jsx', () => ({ default: () => null }));
vi.mock('@/components/account/AccountPageShell.jsx', () => ({
  default: ({ children, actions }) => <div>{actions}{children}</div>,
}));
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

const MyVaultPage = (await import('@/pages/MyVaultPage.jsx')).default;
const AccountVault = (await import('@/pages/account/AccountVault.jsx')).default;

const card = (displayStyle) => ({
  id: 'v1',
  card_name: 'Charizard',
  display_style: displayStyle,
  listing_type: 'Private',
  estimated_value_aud: 100,
  card_image: 'https://cdn/object/charizard.jpg',
});

const renderPage = (Page) =>
  render(<MemoryRouter><Page /></MemoryRouter>);

describe.each([
  ['MyVaultPage', MyVaultPage],
  ['AccountVault', AccountVault],
])('%s × display style', (_name, Page) => {
  beforeEach(() => {
    h.vaultResult = { data: [], count: 0, error: null };
  });
  afterEach(cleanup);

  it("renders each card in the vault in the card's chosen style", async () => {
    h.vaultResult = { data: [card('holographic')], count: 1, error: null };
    const { container } = renderPage(Page);
    // Both assertions live inside the waitFor: the page re-renders as its
    // fetches settle, so a synchronous assertion after a passing waitFor can
    // catch the DOM mid-swap and flake (seen intermittently in CI). The holo
    // overlay layer is what produces the shine.
    await waitFor(() => {
      expect(container.querySelector('.cardshowcase--holographic')).toBeTruthy();
      expect(container.querySelector('.cardshowcase__holo')).toBeTruthy();
    });
  });

  it('keeps the flat vault image for classic cards', async () => {
    h.vaultResult = { data: [card('classic')], count: 1, error: null };
    const { container } = renderPage(Page);
    await waitFor(() => {
      expect(container.querySelector('img[alt="Charizard"]')).toBeTruthy();
    });
    expect(container.querySelector('.cardshowcase')).toBeNull();
  });

  it('keeps the flat vault image when no style is stored', async () => {
    h.vaultResult = { data: [card(undefined)], count: 1, error: null };
    const { container } = renderPage(Page);
    await waitFor(() => {
      expect(container.querySelector('img[alt="Charizard"]')).toBeTruthy();
    });
    expect(container.querySelector('.cardshowcase')).toBeNull();
  });
});
