import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import VaultListingCard from '@/components/VaultListingCard.jsx';
import { getAutographLabel, genericVariantChips } from '@/lib/cardAttributeLabels.js';

const renderCard = (vaultItem) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <VaultListingCard vaultItem={vaultItem} />
    </MemoryRouter>,
  );

describe('getAutographLabel', () => {
  it('words the autograph from whatever detail is recorded', () => {
    expect(getAutographLabel({ is_auto: true })).toBe('Auto');
    expect(getAutographLabel({ is_auto: true, auto_type: 'on_card' })).toBe('On-Card Auto');
    expect(getAutographLabel({ is_auto: true, auto_type: 'on_card', auto_signers: 2 })).toBe('Dual On-Card Auto');
  });

  it('reads the designation off the variant chip alone', () => {
    expect(getAutographLabel({ variant: 'Auto, Numbered' })).toBe('Auto');
    expect(getAutographLabel({ cardVariants: ['Auto'] })).toBe('Auto');
    expect(getAutographLabel({ isAuto: true })).toBe('Auto');
  });

  it('returns null for a card with no autograph', () => {
    expect(getAutographLabel(null)).toBeNull();
    expect(getAutographLabel({ variant: 'Numbered, Prizm' })).toBeNull();
    // An RPA is its own chip and does not, on its own, mean an autograph pill.
    expect(getAutographLabel({ variant: 'Rookie Patch Auto (RPA)' })).toBeNull();
  });
});

describe('genericVariantChips', () => {
  it('drops the chips that already have a dedicated pill', () => {
    expect(genericVariantChips(['Auto', 'Refractor', 'Rookie Card (RC)', 'Numbered']))
      .toEqual(['Numbered']);
  });

  it('keeps every other chip, including the RPA chip', () => {
    expect(genericVariantChips(['Rookie Patch Auto (RPA)', 'Patch', '1/1']))
      .toEqual(['Rookie Patch Auto (RPA)', 'Patch', '1/1']);
    expect(genericVariantChips(null)).toEqual([]);
  });
});

describe('VaultListingCard autograph pill', () => {
  it('shows one pill when the card carries both the flag and the chip', () => {
    renderCard({
      id: 'v1',
      card_name: 'Ricky Council IV',
      listing_type: 'For Sale',
      estimated_value_aud: 40,
      is_auto: true,
      auto_type: 'on_card',
      variant: 'Auto, Numbered',
    });
    expect(screen.getByText('On-Card Auto')).toBeInTheDocument();
    // The generic chip row must not repeat it in the plainer wording.
    expect(screen.queryAllByText('Auto')).toHaveLength(0);
    expect(screen.getByText('Numbered')).toBeInTheDocument();
  });

  it('still shows one pill when only the chip is set', () => {
    renderCard({
      id: 'v2',
      card_name: 'Charizard',
      listing_type: 'For Sale',
      estimated_value_aud: 100,
      variant: 'Auto',
    });
    expect(screen.queryAllByText('Auto')).toHaveLength(1);
  });
});
