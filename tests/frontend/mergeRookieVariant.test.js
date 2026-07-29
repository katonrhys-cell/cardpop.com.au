import { describe, it, expect } from 'vitest';
import {
  mergeRookieVariant,
  ROOKIE_VARIANT,
  ROOKIE_PATCH_AUTO_VARIANT,
} from '@/lib/cardVariants.js';

describe('mergeRookieVariant', () => {
  it('ticks the rookie chip when a rookie card is identified', () => {
    expect(mergeRookieVariant([], 'Rookie Card (RC)')).toEqual([ROOKIE_VARIANT]);
  });

  it('accepts the shorthand a model is likely to return', () => {
    expect(mergeRookieVariant([], 'RC')).toEqual([ROOKIE_VARIANT]);
    expect(mergeRookieVariant([], 'rookie card (rc)')).toEqual([ROOKIE_VARIANT]);
  });

  it('ticks the rookie chip too for a rookie patch auto', () => {
    // RPA is a kind of rookie card, and everything rookie-related — the
    // is_rookie flag, the rookie panel, the pill — hangs off ROOKIE_VARIANT
    // alone, so an RPA that only ticked its own chip would lose all of it.
    expect(mergeRookieVariant([], 'Rookie Patch Auto (RPA)'))
      .toEqual([ROOKIE_VARIANT, ROOKIE_PATCH_AUTO_VARIANT]);
    expect(mergeRookieVariant([], 'RPA'))
      .toEqual([ROOKIE_VARIANT, ROOKIE_PATCH_AUTO_VARIANT]);
  });

  it('keeps what the seller already selected', () => {
    expect(mergeRookieVariant(['Refractor', 'Numbered'], 'RC'))
      .toEqual(['Refractor', 'Numbered', ROOKIE_VARIANT]);
  });

  it('does not duplicate a chip already selected', () => {
    const existing = [ROOKIE_VARIANT, 'Auto'];
    expect(mergeRookieVariant(existing, 'RC')).toEqual(existing);
    expect(mergeRookieVariant(existing, 'RC')).toBe(existing);
  });

  it('adds only the missing half when RPA is already ticked', () => {
    expect(mergeRookieVariant([ROOKIE_PATCH_AUTO_VARIANT], 'RPA'))
      .toEqual([ROOKIE_PATCH_AUTO_VARIANT, ROOKIE_VARIANT]);
  });

  it('changes nothing when no rookie marking was found', () => {
    const existing = ['Refractor'];
    expect(mergeRookieVariant(existing, null)).toBe(existing);
    expect(mergeRookieVariant(existing, '')).toBe(existing);
    expect(mergeRookieVariant(existing, undefined)).toBe(existing);
  });

  it('ignores a value that is not a known designation', () => {
    // An unrecognised string must not become a free-text chip.
    expect(mergeRookieVariant([], 'first year player')).toEqual([]);
  });

  it('never removes a chip the seller picked', () => {
    // Identification can tell us a card IS a rookie, never that the seller's
    // other selections are wrong.
    const existing = ['Refractor', ROOKIE_VARIANT];
    expect(mergeRookieVariant(existing, null)).toEqual(existing);
  });

  it('is safe when the current selection is missing', () => {
    expect(mergeRookieVariant(undefined, 'RC')).toEqual([ROOKIE_VARIANT]);
    expect(mergeRookieVariant(null, null)).toEqual([]);
  });
});
