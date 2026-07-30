import { describe, it, expect } from 'vitest';
import {
  GAME_KEYS,
  GAME_VARIANT_GROUPS,
  ALL_VARIANT_GROUPS,
  CARD_VARIANTS,
  VARIANT_BADGES,
  resolveGameKey,
  getVariantGroups,
  getVariantChips,
  getCardVariants,
  getFoilFinishes,
  splitFoilFinishes,
  expandFoilFinishes,
  FOIL_VARIANT,
} from '@/lib/cardVariants.js';

describe('resolveGameKey', () => {
  it('maps Pokémon names, slugs and catalogue sources', () => {
    expect(resolveGameKey('Pokemon')).toBe(GAME_KEYS.POKEMON);
    expect(resolveGameKey('Pokémon')).toBe(GAME_KEYS.POKEMON);
    expect(resolveGameKey('pokemon-tcg')).toBe(GAME_KEYS.POKEMON);
  });

  it('maps Magic including the scryfall source', () => {
    expect(resolveGameKey('Magic: The Gathering')).toBe(GAME_KEYS.MAGIC);
    expect(resolveGameKey('MTG')).toBe(GAME_KEYS.MAGIC);
    expect(resolveGameKey('scryfall')).toBe(GAME_KEYS.MAGIC);
  });

  it('maps Yu-Gi-Oh variants', () => {
    expect(resolveGameKey('Yu-Gi-Oh')).toBe(GAME_KEYS.YUGIOH);
    expect(resolveGameKey('Yugioh')).toBe(GAME_KEYS.YUGIOH);
  });

  it('maps sports collections to the sports taxonomy', () => {
    expect(resolveGameKey('NBA')).toBe(GAME_KEYS.SPORTS);
    expect(resolveGameKey('AFL')).toBe(GAME_KEYS.SPORTS);
    expect(resolveGameKey('Formula 1')).toBe(GAME_KEYS.SPORTS);
  });

  it('returns null for unknown / empty input', () => {
    expect(resolveGameKey('')).toBeNull();
    expect(resolveGameKey(null)).toBeNull();
    expect(resolveGameKey('One Piece')).toBeNull();
  });
});

describe('getVariantGroups / getCardVariants', () => {
  it('returns the game-specific groups for a known collection', () => {
    expect(getVariantGroups('Pokemon')).toBe(GAME_VARIANT_GROUPS[GAME_KEYS.POKEMON]);
    expect(getCardVariants('NBA')).toContain('Prizm');
    expect(getCardVariants('Magic: The Gathering')).toContain('Surge Foil');
    expect(getCardVariants('Yu-Gi-Oh')).toContain('Starlight Rare');
  });

  it('does not leak one game\'s exclusive foils into another', () => {
    expect(getCardVariants('Pokemon')).not.toContain('Surge Foil');
    expect(getCardVariants('Magic')).not.toContain('Cosmos Holo');
  });

  it('falls back to the combined list when no game matches', () => {
    expect(getVariantGroups('One Piece')).toBe(ALL_VARIANT_GROUPS);
    expect(getVariantGroups(undefined)).toBe(ALL_VARIANT_GROUPS);
  });
});

describe('foil / holo finishes', () => {
  it('offers one finish chip, not one per named holo', () => {
    const chips = getVariantChips('Pokemon');
    expect(chips).toContain(FOIL_VARIANT);
    expect(chips).not.toContain('Cosmos Holo');
    expect(chips).not.toContain('Reverse Holo');
    expect(getVariantChips('Magic')).not.toContain('Surge Foil');
  });

  it('keeps the named finishes in the persisted vocabulary', () => {
    // Browse filters and identifications resolve against this list, so the
    // strings must survive the move into the details panel.
    expect(getCardVariants('Pokemon')).toContain('Reverse Holo');
    expect(getCardVariants('Magic')).toContain('Surge Foil');
  });

  it('lists the finishes for the panel, per game', () => {
    const pokemon = getFoilFinishes('Pokemon').map(f => f.value);
    expect(pokemon).toContain('Cosmos Holo');
    expect(pokemon).not.toContain('Surge Foil');
    expect(getFoilFinishes('Magic').map(f => f.value)).toContain('Etched Foil');
  });

  it('leaves the sports taxonomy alone', () => {
    // Sports finishes are parallels with their own chips (and Prizm/Refractor
    // panels) — there is no umbrella foil chip to reveal a panel behind.
    expect(getVariantChips('NBA')).toContain('Holo');
    expect(getVariantChips('NBA')).not.toContain(FOIL_VARIANT);
    expect(getFoilFinishes('NBA')).toEqual([]);
  });

  it('never offers the same finish as both a chip and a panel option', () => {
    for (const collection of ['Pokemon', 'Magic', 'NBA', 'Yu-Gi-Oh', 'One Piece', undefined]) {
      const chips = new Set(getVariantChips(collection));
      for (const { value } of getFoilFinishes(collection)) {
        expect(chips.has(value)).toBe(false);
      }
    }
  });
});

describe('splitFoilFinishes / expandFoilFinishes', () => {
  it('routes a saved finish into the panel behind the finish chip', () => {
    expect(splitFoilFinishes(['Reverse Holo', 'Full Art'], 'Pokemon')).toEqual({
      variants: [FOIL_VARIANT, 'Full Art'],
      foilFinishes: ['Reverse Holo'],
    });
  });

  it('adds the chip once for several finishes', () => {
    const { variants, foilFinishes } = splitFoilFinishes(['Holo', 'Textured', FOIL_VARIANT], 'Pokemon');
    expect(variants).toEqual([FOIL_VARIANT]);
    expect(foilFinishes).toEqual(['Holo', 'Textured']);
  });

  it('leaves a sports parallel chip as a chip', () => {
    expect(splitFoilFinishes(['Holo', 'Prizm'], 'NBA')).toEqual({
      variants: ['Holo', 'Prizm'],
      foilFinishes: [],
    });
  });

  it('keeps the chip on its own when no finish was recorded', () => {
    expect(splitFoilFinishes([FOIL_VARIANT], 'Pokemon')).toEqual({
      variants: [FOIL_VARIANT],
      foilFinishes: [],
    });
  });

  it('is safe on missing input', () => {
    expect(splitFoilFinishes(null, 'Pokemon')).toEqual({ variants: [], foilFinishes: [] });
    expect(splitFoilFinishes(undefined, undefined)).toEqual({ variants: [], foilFinishes: [] });
  });

  it('round-trips what was saved, adding the chip a legacy row never had', () => {
    const saved = ['Reverse Holo', 'Full Art', '1st Edition'];
    const { variants, foilFinishes } = splitFoilFinishes(saved, 'Pokemon');
    const resaved = expandFoilFinishes(variants, foilFinishes);
    // Nothing is lost, and the finish chip is now alongside the finish itself.
    for (const v of saved) expect(resaved).toContain(v);
    expect(resaved).toContain(FOIL_VARIANT);
    // Stable from there on — loading and saving again changes nothing.
    const second = splitFoilFinishes(resaved, 'Pokemon');
    expect(expandFoilFinishes(second.variants, second.foilFinishes)).toEqual(resaved);
  });

  it('drops the finishes when the finish chip is unticked', () => {
    // Otherwise unticking Foil / Holo would leave a stale holo on the listing.
    expect(expandFoilFinishes(['Full Art'], ['Reverse Holo'])).toEqual(['Full Art']);
  });

  it('does not duplicate a finish already in the chip list', () => {
    expect(expandFoilFinishes([FOIL_VARIANT, 'Holo'], ['Holo'])).toEqual([FOIL_VARIANT, 'Holo']);
  });

  it('is safe on missing input', () => {
    expect(expandFoilFinishes(null, null)).toEqual([]);
    expect(expandFoilFinishes([FOIL_VARIANT], null)).toEqual([FOIL_VARIANT]);
  });
});

describe('backward compatibility', () => {
  it('preserves every legacy variant string in the combined list', () => {
    const legacy = [
      'Base', 'Holo', 'Reverse Holo', 'Refractor', 'Chrome', 'Prizm',
      'Parallel', 'Rainbow', 'Gold', 'Silver', 'Foil',
      'Rookie Card (RC)', 'Auto', 'Patch', 'Relic / Jersey', 'Numbered',
      'Short Print (SP)', 'Full Art', 'Alt Art', 'Extended Art', 'Showcase',
      'Borderless', '1st Edition', 'Shadowless', 'Promo', 'Error / Misprint',
    ];
    for (const v of legacy) expect(CARD_VARIANTS).toContain(v);
  });

  it('keeps badge keys present so badges keep rendering', () => {
    for (const key of Object.keys(VARIANT_BADGES)) {
      expect(CARD_VARIANTS).toContain(key);
    }
  });

  it('has no duplicate variants within any single group', () => {
    for (const groups of Object.values(GAME_VARIANT_GROUPS)) {
      for (const group of groups) {
        expect(new Set(group.variants).size).toBe(group.variants.length);
      }
    }
  });
});
