import { describe, it, expect } from 'vitest';
import {
  resolveVariantChips,
  mergeIdentifiedVariants,
  impliesFoil,
  ROOKIE_VARIANT,
  FOIL_VARIANT,
  splitFoilFinishes,
} from '@/lib/cardVariants.js';

describe('resolveVariantChips', () => {
  it('resolves a treatment to the chip that exists for that game', () => {
    expect(resolveVariantChips(['Refractor'], 'NBA')).toEqual(['Refractor']);
    expect(resolveVariantChips(['Reverse Holo'], 'Pokemon')).toEqual(['Reverse Holo']);
  });

  it('matches regardless of case', () => {
    expect(resolveVariantChips(['refractor', 'AUTO'], 'NBA')).toEqual(['Refractor', 'Auto']);
  });

  it('maps the wording a model is likely to use', () => {
    expect(resolveVariantChips(['Autograph'], 'NBA')).toEqual(['Auto']);
    expect(resolveVariantChips(['game-worn'], 'NBA')).toEqual(['Relic / Jersey']);
    expect(resolveVariantChips(['one of one'], 'NBA')).toEqual(['1/1']);
    expect(resolveVariantChips(['first edition'], 'Pokemon')).toEqual(['1st Edition']);
  });

  it('will not give a game a chip from another game', () => {
    // The taxonomy is per-game and these strings are persisted and filtered on;
    // an identification must never invent one.
    expect(resolveVariantChips(['Refractor'], 'Pokemon')).toEqual([]);
    expect(resolveVariantChips(['Cosmos Holo'], 'NBA')).toEqual([]);
  });

  it('resolves a bare "foil" to the umbrella finish chip', () => {
    // No specific treatment was named, so there is nothing to tick in the
    // details panel — the chip alone is the honest answer.
    expect(resolveVariantChips(['foil'], 'Pokemon')).toEqual([FOIL_VARIANT]);
    // Magic prints a finish actually called "Foil", so the exact match wins.
    expect(resolveVariantChips(['foil'], 'Magic')).toEqual(['Foil']);
  });

  it('feeds an identified finish into the details panel, not the chip list', () => {
    const chips = resolveVariantChips(['reverse holofoil'], 'Pokemon');
    expect(splitFoilFinishes(chips, 'Pokemon')).toEqual({
      variants: [FOIL_VARIANT],
      foilFinishes: ['Reverse Holo'],
    });
  });

  it('drops anything that is not a real chip', () => {
    expect(resolveVariantChips(['shiny sparkly thing', ''], 'NBA')).toEqual([]);
  });

  it('de-duplicates when several terms resolve to one chip', () => {
    expect(resolveVariantChips(['Auto', 'Autograph', 'signed'], 'NBA')).toEqual(['Auto']);
  });

  it('is safe on missing input', () => {
    expect(resolveVariantChips(null, 'NBA')).toEqual([]);
    expect(resolveVariantChips(undefined, undefined)).toEqual([]);
  });
});

describe('impliesFoil', () => {
  it('recognises foil and holo finishes', () => {
    expect(impliesFoil(['Refractor'])).toBe(true);
    expect(impliesFoil(['Reverse Holo'])).toBe(true);
    expect(impliesFoil(['Surge Foil'])).toBe(true);
    expect(impliesFoil([FOIL_VARIANT])).toBe(true);
  });

  it('does not treat Nonfoil as foil', () => {
    // "Nonfoil" contains "foil" — a substring test gets this exactly backwards.
    expect(impliesFoil(['Nonfoil'])).toBe(false);
    expect(impliesFoil(['Base'])).toBe(false);
  });

  it('is false for non-finish attributes', () => {
    expect(impliesFoil(['Auto', 'Patch', ROOKIE_VARIANT])).toBe(false);
    expect(impliesFoil([])).toBe(false);
  });
});

describe('mergeIdentifiedVariants', () => {
  it('combines the rookie designation with the treatments read off the card', () => {
    expect(mergeIdentifiedVariants([], { rookie: 'RC', attributes: ['Refractor', 'Auto'] }, 'NBA'))
      .toEqual([ROOKIE_VARIANT, 'Refractor', 'Auto']);
  });

  it('treats a printed serial as proof the card is numbered', () => {
    expect(mergeIdentifiedVariants([], { serialNumber: '23/99' }, 'NBA')).toEqual(['Numbered']);
  });

  it('does not add Numbered without a serial', () => {
    expect(mergeIdentifiedVariants([], { serialNumber: '' }, 'NBA')).toEqual([]);
    expect(mergeIdentifiedVariants([], {}, 'NBA')).toEqual([]);
  });

  it('keeps the seller selections and does not duplicate', () => {
    expect(mergeIdentifiedVariants(['Refractor'], { attributes: ['Refractor', 'Auto'] }, 'NBA'))
      .toEqual(['Refractor', 'Auto']);
  });

  it('never removes anything the seller picked', () => {
    const existing = ['Die-Cut', 'Case Hit'];
    expect(mergeIdentifiedVariants(existing, {}, 'NBA')).toEqual(existing);
  });

  it('is safe with nothing identified', () => {
    expect(mergeIdentifiedVariants([], {}, 'Pokemon')).toEqual([]);
    expect(mergeIdentifiedVariants(undefined, undefined, undefined)).toEqual([]);
  });
});
