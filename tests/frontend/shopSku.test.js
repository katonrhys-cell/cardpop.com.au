import { describe, it, expect } from 'vitest';
import { suggestSku, normalizeSku, isValidSku, SKU_MAX_LENGTH } from '@/utils/shopSku.js';

describe('suggestSku', () => {
  it('derives CP-<SLUG> from a title', () => {
    expect(suggestSku('Acrylic Card Stand - 5 Pack')).toBe('CP-ACRYLIC-CARD-STAND-5-PACK');
    expect(suggestSku("Collector's Series 9-Pocket Zip Binder")).toBe('CP-COLLECTOR-S-SERIES-9-POCKET-ZIP-BINDER');
    expect(suggestSku('Top Loaders 3x4in — 100 Pack')).toBe('CP-TOP-LOADERS-3X4IN-100-PACK');
  });

  it('strips accents, expands & and caps the length', () => {
    expect(suggestSku('Pokémon & Friends')).toBe('CP-POKEMON-AND-FRIENDS');
    const long = suggestSku('A'.repeat(100));
    expect(long.length).toBeLessThanOrEqual(SKU_MAX_LENGTH);
    expect(long.endsWith('-')).toBe(false);
  });

  it('returns empty for an unusable title', () => {
    expect(suggestSku('')).toBe('');
    expect(suggestSku('!!!')).toBe('');
  });
});

describe('normalizeSku / isValidSku', () => {
  it('trims and upper-cases', () => {
    expect(normalizeSku('  zb-09 ')).toBe('ZB-09');
  });

  it('accepts brand and house SKUs, rejects blanks, spaces and junk', () => {
    expect(isValidSku('ZB-09')).toBe(true);
    expect(isValidSku('MF-TL-35PT')).toBe(true);
    expect(isValidSku('cp-acrylic-stand-5-pack')).toBe(true);
    expect(isValidSku('')).toBe(false);
    expect(isValidSku('   ')).toBe(false);
    expect(isValidSku('ZB 09')).toBe(false);
    expect(isValidSku('-ZB09')).toBe(false);
    expect(isValidSku('X'.repeat(SKU_MAX_LENGTH + 1))).toBe(false);
  });
});
