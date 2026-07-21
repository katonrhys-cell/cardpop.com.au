import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import VaultListingCard from '@/components/VaultListingCard.jsx';

// Regression: Postgres `numeric` columns (estimated_value_aud, profiles.rating)
// come back from PostgREST as JSON *strings* (e.g. "40.00"), not numbers.
// Calling `.toFixed()` directly on a string throws `TypeError: not a function`,
// which bubbled to the route-level ErrorBoundary and blanked the whole HomePage
// — so both the Featured Cards AND Featured Sellers sections disappeared.
// These cards must render string-typed numerics without crashing.
const renderCard = (vaultItem) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <VaultListingCard vaultItem={vaultItem} />
    </MemoryRouter>,
  );

describe('VaultListingCard with PostgREST numeric-as-string values', () => {
  it('formats a string estimated_value_aud without throwing', () => {
    expect(() =>
      renderCard({
        id: 'v1',
        card_name: 'Victor Wembanyama',
        listing_type: 'For Sale',
        estimated_value_aud: '400.00', // string, as PostgREST returns numeric
      }),
    ).not.toThrow();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
  });

  it('formats a string seller rating without throwing', () => {
    expect(() =>
      renderCard({
        id: 'v2',
        card_name: 'Shai Gilgeous-Alexander',
        listing_type: 'For Sale',
        estimated_value_aud: '40.00',
        owner: {
          id: 'seller-1',
          display_name: 'CLEET Collectables',
          rating: '5.00', // string, as PostgREST returns numeric
          reviews_count: 3,
        },
      }),
    ).not.toThrow();
    expect(screen.getByText('5.0')).toBeInTheDocument();
  });
});
