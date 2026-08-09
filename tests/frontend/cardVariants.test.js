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
  productFinishNames,
  mergeIdentifiedVariants,
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

// ─── product-implied finishes ────────────────────────────────────────────────
// Two Topps Chrome fixtures expected a `Chrome` chip while a third asserted
// nothing, and the OCR prompt forbids the model from naming a treatment it
// cannot see printed. "Chrome" is the product name, so it is derived here
// instead of asked for — the same way `Numbered` follows from a printed serial.
describe('productFinishNames', () => {
  it('derives the finish from a product whose name is the finish', () => {
    expect(productFinishNames('Topps Chrome')).toEqual(['Chrome']);
    expect(productFinishNames('Mosaic')).toEqual(['Mosaic']);
    expect(productFinishNames('Donruss Optic')).toEqual(['Optic']);
    expect(productFinishNames('Panini Prizm')).toEqual(['Prizm']);
  });

  it('keeps the finish when the product has a suffix', () => {
    expect(productFinishNames('Topps Chrome Sapphire')).toEqual(['Chrome']);
  });

  it('derives nothing from products whose base cards carry no finish', () => {
    expect(productFinishNames('Donruss')).toEqual([]);
    expect(productFinishNames('Obsidian')).toEqual([]);
    expect(productFinishNames('Topps Series One')).toEqual([]);
  });

  it('matches whole words only', () => {
    // Guards the substring trap that broke set matching before: "Chromebook"
    // must not read as Chrome.
    expect(productFinishNames('Chromebook Classics')).toEqual([]);
    expect(productFinishNames('Optical Illusions')).toEqual([]);
  });

  it('is case and punctuation insensitive', () => {
    expect(productFinishNames('TOPPS CHROME')).toEqual(['Chrome']);
    expect(productFinishNames('topps-chrome')).toEqual(['Chrome']);
  });

  it('handles missing input', () => {
    expect(productFinishNames(null)).toEqual([]);
    expect(productFinishNames(undefined)).toEqual([]);
    expect(productFinishNames('')).toEqual([]);
  });
});

describe('mergeIdentifiedVariants — product-implied finish', () => {
  it('ticks Chrome for a Topps Chrome card without the model naming it', () => {
    const merged = mergeIdentifiedVariants([], { cardSetName: 'Topps Chrome' }, 'NBA');
    expect(merged).toContain('Chrome');
  });

  it('combines the product finish with the rookie designation', () => {
    const merged = mergeIdentifiedVariants(
      [], { cardSetName: 'Topps Chrome', rookie: 'Rookie Card (RC)' }, 'NBA',
    );
    expect(merged).toContain('Chrome');
    expect(merged).toContain('Rookie Card (RC)');
  });

  it('adds nothing for a product that implies no finish', () => {
    expect(mergeIdentifiedVariants([], { cardSetName: 'Donruss' }, 'NBA')).toEqual([]);
  });

  it('does not duplicate a finish the seller already picked', () => {
    const merged = mergeIdentifiedVariants(['Chrome'], { cardSetName: 'Topps Chrome' }, 'NBA');
    expect(merged.filter(v => v === 'Chrome')).toHaveLength(1);
  });

  it('drops a finish that is not a chip for the collection', () => {
    // resolveVariantChips still gates on the game's taxonomy — Pokemon has no
    // Mosaic chip, so a product name mentioning it contributes nothing.
    expect(mergeIdentifiedVariants([], { cardSetName: 'Mosaic' }, 'Pokemon')).toEqual([]);
  });

  it('a coloured chrome finish is a refractor parallel', () => {
    // Base chrome is plain silver, so an observed colour on a chrome product
    // identifies a colour refractor — without the model naming a parallel.
    const merged = mergeIdentifiedVariants(
      [], { cardSetName: 'Topps Chrome', parallelColor: 'Teal' }, 'NBA',
    );
    expect(merged).toContain('Chrome');
    expect(merged).toContain('Refractor');
  });

  it('an observed colour without a chrome product names nothing', () => {
    const merged = mergeIdentifiedVariants(
      [], { cardSetName: 'Donruss', parallelColor: 'Teal' }, 'NBA',
    );
    expect(merged).not.toContain('Refractor');
  });
});
