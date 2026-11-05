import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderSummary from '@/components/checkout/OrderSummary.jsx';

// The checkout summary shows each line at 40 px. A photo uploaded after
// THUMBNAILS_SINCE has a 480 px companion thumbnail, and that is what the row
// should load, not the full multi-megabyte upload.
const NEW_TS = 1790000000000;
const LEGACY_TS = 1700000000000;
const storageUrl = (path) =>
  `https://vrfsaazuqjxotnieqlkd.supabase.co/storage/v1/object/public/vault-images/${path}`;

describe('OrderSummary line images', () => {
  it('loads the companion thumbnail for a recent upload', () => {
    render(<OrderSummary cartItems={[{ id: 'a', name: 'Charizard', image: storageUrl(`u/${NEW_TS}.jpg`), price: 10, quantity: 1 }]} />);
    expect(screen.getByAltText('Charizard').getAttribute('src')).toMatch(new RegExp(`u/${NEW_TS}\\.thumb\\.webp$`));
  });

  it('keeps the original for an upload that predates thumbnails', () => {
    render(<OrderSummary cartItems={[{ id: 'b', name: 'Pikachu', image: storageUrl(`u/${LEGACY_TS}.jpg`), price: 10, quantity: 1 }]} />);
    expect(screen.getByAltText('Pikachu').getAttribute('src')).toMatch(new RegExp(`u/${LEGACY_TS}\\.jpg$`));
  });
});
