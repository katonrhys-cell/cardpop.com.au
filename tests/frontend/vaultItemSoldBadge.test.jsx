import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import VaultListingCard from '@/components/VaultListingCard.jsx';
import { vaultItemListing, isSoldVaultItem } from '@/lib/vaultItemListing.js';

// Regression: marking a card sold only ever flips `listings.status` — the vault
// row keeps its 'For Sale' listing_type forever. Every grid that reads
// vault_items directly (homepage featured cards, seller stores, collection
// rails) therefore advertised sold cards as still available, which is how two
// sold Wembanyama cards stayed "For Sale" across the site after their listings
// were marked sold.
const renderCard = (vaultItem, props = {}) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <VaultListingCard vaultItem={vaultItem} {...props} />
    </MemoryRouter>,
  );

const soldCard = {
  id: 'v-sold',
  card_name: 'Victor Wembanyama',
  listing_type: 'For Sale',
  estimated_value_aud: '400.00',
  listings: [{ id: 'l-sold', status: 'sold', price_aud: '400.00', sold_at: '2026-08-16T03:26:07Z' }],
};

describe('VaultListingCard sold state', () => {
  it('badges a card whose listing has sold instead of showing its listing_type', () => {
    renderCard(soldCard);
    expect(screen.getAllByText('Sold').length).toBeGreaterThan(0);
    expect(screen.queryByText('For Sale')).not.toBeInTheDocument();
  });

  it('strikes through the price of a sold card', () => {
    renderCard(soldCard);
    expect(screen.getByText('$400.00').className).toContain('line-through');
  });

  it('still shows the listing type while the listing is active', () => {
    renderCard({ ...soldCard, id: 'v-live', listings: [{ id: 'l-live', status: 'active', price_aud: '400.00' }] });
    expect(screen.getByText('For Sale')).toBeInTheDocument();
    expect(screen.queryByText('Sold')).not.toBeInTheDocument();
    expect(screen.getByText('$400.00').className).not.toContain('line-through');
  });

  it('links a card with a listing through to that listing', () => {
    renderCard(soldCard);
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links.some(h => h?.startsWith('/marketplace/l-sold'))).toBe(true);
  });

  it('falls back to the vault detail page when no listing is attached', () => {
    renderCard({ ...soldCard, id: 'v-none', listings: [] });
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links.some(h => h?.startsWith('/product/vault/v-none'))).toBe(true);
  });
});

describe('vaultItemListing', () => {
  it('prefers a live listing over an older sold one after a relist', () => {
    const item = { listings: [{ id: 'old', status: 'sold' }, { id: 'new', status: 'active' }] };
    expect(vaultItemListing(item).id).toBe('new');
    expect(isSoldVaultItem(item)).toBe(false);
  });

  it('ignores archived listings', () => {
    const item = { listings: [{ id: 'gone', status: 'archived' }] };
    expect(vaultItemListing(item)).toBeNull();
    expect(isSoldVaultItem(item)).toBe(false);
  });

  it('accepts an explicitly passed listing over the embed', () => {
    const item = { listings: [{ id: 'embedded', status: 'active' }] };
    expect(vaultItemListing(item, { id: 'explicit', status: 'sold' }).id).toBe('explicit');
  });

  it('survives a vault row fetched without the listing embed', () => {
    expect(vaultItemListing({ id: 'v' })).toBeNull();
    expect(isSoldVaultItem({ id: 'v' })).toBe(false);
  });
});
