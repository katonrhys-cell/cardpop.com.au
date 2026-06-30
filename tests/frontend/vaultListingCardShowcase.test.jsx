import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import VaultListingCard from '@/components/VaultListingCard.jsx';

const renderCard = (vaultItem) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <VaultListingCard vaultItem={vaultItem} />
    </MemoryRouter>,
  );

describe('VaultListingCard × CardShowcase integration', () => {
  it('renders the listing in its chosen display style', () => {
    const { container } = renderCard({
      id: 'v1',
      card_name: 'Charizard',
      display_style: 'glass',
      listing_type: 'For Sale',
      estimated_value_aud: 100,
      card_image: 'https://cdn/object/charizard.jpg',
    });
    expect(container.querySelector('.cardshowcase--glass')).toBeTruthy();
    // The card photo is still rendered as the hero.
    expect(screen.getByAltText('Charizard')).toBeInTheDocument();
    // And the status badge still layers on top.
    expect(screen.getByText('For Sale')).toBeInTheDocument();
  });

  it('falls back to the classic baseline when no style is stored', () => {
    const { container } = renderCard({
      id: 'v2',
      card_name: 'Pikachu',
      estimated_value_aud: 20,
      card_image: 'https://cdn/object/pikachu.jpg',
    });
    expect(container.querySelector('.cardshowcase--classic')).toBeTruthy();
  });
});
