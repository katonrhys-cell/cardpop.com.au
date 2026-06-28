import { describe, it, expect } from 'vitest';
import {
  GAME_KEYS,
  GAME_VARIANT_GROUPS,
  ALL_VARIANT_GROUPS,
  CARD_VARIANTS,
  VARIANT_BADGES,
  resolveGameKey,
  getVariantGroups,
  getCardVariants,
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
