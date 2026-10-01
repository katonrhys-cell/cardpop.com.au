import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VariantPicker from '@/components/shop/VariantPicker.jsx';
import { familyAsVariants } from '@/utils/shopFamily.js';

// The live Blackout Deck Sleeves family: six colours were imported without a hex.
const LIVE = {
  Black: '#1B1B1D', White: null, Clear: null, Navy: '#1E2A4A', Blue: '#2E6FD9', Turquoise: '#2FB3AE',
  Jade: null, Green: null, Yellow: '#E8B93B', Orange: null, Red: '#C8202F', Rose: null, Pink: '#E56BA3', Purple: '#7A4FB5',
};
const family = Object.entries(LIVE).map(([colour, hex], i) => ({
  id: `p${i}`, sku: `BODS-ST-M-${i}`, colour, colour_hex: hex, stock_quantity: 0,
}));

describe('colour picker swatches', () => {
  it('draws a dot in every chip, including colours stored without a hex', () => {
    render(<VariantPicker product={{ variants: familyAsVariants(family) }} value="p3" onChange={() => {}} showAvailability={false} />);
    const chips = screen.getAllByRole('radio');
    expect(chips).toHaveLength(14);
    for (const chip of chips) {
      const dot = chip.querySelector('span[aria-hidden="true"]');
      expect(dot, chip.textContent).not.toBeNull();
      expect(dot.style.backgroundColor || dot.style.backgroundImage, chip.textContent).toBeTruthy();
    }
  });
});
