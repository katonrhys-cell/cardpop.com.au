import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import VaultListingCard from '@/components/VaultListingCard.jsx';
import { VAULT_ITEM_LISTING_EMBED } from '@/lib/listingCardColumns.js';

// Regression: an Expression of Interest listing has no price_aud, so the
// homepage / store card fell through to the vault's old estimated_value_aud
// and read "Est. value $600.00" while the seller was asking $1000.
const renderCard = (vaultItem) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <VaultListingCard vaultItem={vaultItem} />
    </MemoryRouter>,
  );

const eoiCard = (listing) => ({
  id: 'v-eoi',
  card_name: 'Nikola Jokic',
  listing_type: 'Expression of Interest',
  estimated_value_aud: '600.00',
  listings: [{ id: 'l-eoi', status: 'active', price_aud: null, listing_type: 'expression_of_interest', ...listing }],
});

describe('VaultListingCard expression of interest', () => {
  it('embeds the EOI range columns with the listing', () => {
    for (const col of ['listing_type', 'price_min_aud', 'price_max_aud']) {
      expect(VAULT_ITEM_LISTING_EMBED).toContain(col);
    }
  });

  it("shows the seller's range, not the stale vault estimate", () => {
    renderCard(eoiCard({ price_min_aud: '1000.00', price_max_aud: '1000.00' }));
    expect(screen.getByText(/\$1000\.00 – \$1000\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/\$600\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Est\. value/i)).not.toBeInTheDocument();
    expect(screen.getByText('Seeking offers')).toBeInTheDocument();
  });

  it('shows "From $X" for an open-ended range', () => {
    renderCard(eoiCard({ price_min_aud: '1000.00', price_max_aud: null }));
    expect(screen.getByText(/From \$1000\.00/)).toBeInTheDocument();
  });
});
