import { describe, it, expect } from 'vitest';
import { buildVaultItemRow, validateVaultItemRow } from '../../src/utils/vaultItemInput.js';

const USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const baseItem = {
  card_name: 'Charizard',
  year: '1999',
  category_id: 'cat-1',
  franchise_id: 'fr-1',
  estimated_value_aud: 100,
  listing_type: 'Private',
  card_image: `${USER}/123.jpg`,
};

const build = (item = {}, opts = {}) =>
  buildVaultItemRow({ ...baseItem, ...item }, { userId: USER, tier: 'free', isEdit: false, ...opts });

describe('buildVaultItemRow', () => {
  it('sets the owner from the authenticated user, never the body', () => {
    const { row } = build({ owner_id: 'someone-else' });
    expect(row.owner_id).toBe(USER);
  });

  it('drops columns outside the whitelist (locked/admin columns)', () => {
    const { row } = build({
      is_featured: true,
      locked_base_value_aud: 1,
      base_value_source: 'admin',
      base_value_set_at: '2026-01-01',
      created_at: '2020-01-01',
    });
    expect(row).not.toHaveProperty('is_featured');
    expect(row).not.toHaveProperty('locked_base_value_aud');
    expect(row).not.toHaveProperty('base_value_source');
    expect(row).not.toHaveProperty('base_value_set_at');
    expect(row).not.toHaveProperty('created_at');
  });

  it('rejects storage paths outside the caller\'s own folder', () => {
    const { pathErrors } = build({ card_image: 'other-user/steal.jpg' });
    expect(pathErrors.length).toBeGreaterThan(0);
  });

  it('rejects traversal in storage paths', () => {
    const { pathErrors } = build({ card_image: `${USER}/../victim/x.jpg` });
    expect(pathErrors.length).toBeGreaterThan(0);
  });

  it('filters foreign paths out of card_images', () => {
    const { row, pathErrors } = build({ card_images: [`${USER}/a.jpg`, 'intruder/b.jpg'] });
    expect(row.card_images).toEqual([`${USER}/a.jpg`]);
    expect(pathErrors.length).toBe(1);
  });

  it('derives rookie/refractor/foil flags from the variant chips', () => {
    const { row } = build({ variant: 'Rookie Card (RC), Refractor, Foil / Holo', is_foil: false });
    expect(row.is_rookie).toBe(true);
    expect(row.is_refractor).toBe(true);
    expect(row.is_foil).toBe(true);
  });

  it('nulls variant detail fields when their chip is absent', () => {
    const { row } = build({ variant: '', auto_type: 'on-card', patch_type: 'logo', rookie_type: 'true' });
    expect(row.auto_type).toBeNull();
    expect(row.patch_type).toBeNull();
    expect(row.rookie_type).toBeNull();
  });

  it('derives is_auto from the Auto chip', () => {
    const { row } = build({ variant: 'Auto', is_auto: false });
    expect(row.is_auto).toBe(true);
    expect(row.auto_signers).toBe(1);
  });

  it('keeps autograph detail when only the flag is set', () => {
    const { row } = build({ is_auto: true, variant: '', auto_type: 'on_card' });
    expect(row.is_auto).toBe(true);
    expect(row.auto_type).toBe('on_card');
  });

  it('clears is_auto when neither the flag nor the chip is present', () => {
    const { row } = build({ is_auto: false, variant: 'Numbered', auto_type: 'on_card' });
    expect(row.is_auto).toBe(false);
    expect(row.auto_type).toBeNull();
    expect(row.auto_signers).toBeNull();
  });

  it('normalises unknown listing types to Private', () => {
    const { row } = build({ listing_type: 'private' });
    expect(row.listing_type).toBe('Private');
    expect(row.is_public).toBe(false);
  });

  it('marks public listing types as public', () => {
    const { row } = build({ listing_type: 'For Sale' });
    expect(row.is_public).toBe(true);
  });

  it('clears grade and cert for raw cards', () => {
    const { row } = build({ grading_company: 'raw', grade: '10', cert_number: '123' });
    expect(row.grade).toBeNull();
    expect(row.cert_number).toBeNull();
  });

  it('keeps grade for graded cards', () => {
    const { row } = build({ grading_company: 'psa', grade: '10' });
    expect(row.grade).toBe('10');
  });

  it('clamps a locked display style to classic for a free tier', () => {
    const { row } = build({ display_style: 'holographic' });
    expect(row.display_style).toBe('classic');
  });

  it('keeps an entitled display style', () => {
    const { row } = buildVaultItemRow(
      { ...baseItem, display_style: 'holographic' },
      { userId: USER, tier: 'ultimate', isEdit: false },
    );
    expect(row.display_style).toBe('holographic');
  });

  it('locks the trade value flag when a trade value is set', () => {
    const { row } = build({ trade_value_aud: 50 });
    expect(row.trade_value_locked).toBe(true);
  });

  it('stamps cardsight_identified_at server-side when a match is supplied', () => {
    const { row } = build({ cardsight_card_id: 'xy7-54', cardsight_identified_at: '1999-01-01T00:00:00Z' });
    expect(row.cardsight_card_id).toBe('xy7-54');
    expect(new Date(row.cardsight_identified_at).getFullYear()).toBeGreaterThan(2020);
  });

  it('leaves stored CardSight identity alone when the body omits it', () => {
    const { row } = build();
    expect(row).not.toHaveProperty('cardsight_card_id');
    expect(row).not.toHaveProperty('cardsight_identified_at');
  });
});

describe('validateVaultItemRow', () => {
  const shape = (item = {}, opts = {}) => {
    const { row } = build(item, opts);
    return validateVaultItemRow(row, { pricing: {}, isEdit: false, ...opts });
  };

  it('passes a clean private item', () => {
    expect(shape()).toEqual({});
  });

  it('requires a card name', () => {
    expect(shape({ card_name: '' })).toHaveProperty('cardName');
  });

  it('requires the category/franchise hierarchy', () => {
    expect(shape({ category_id: null, franchise_id: null })).toHaveProperty('hierarchy');
  });

  it('requires a photo', () => {
    expect(shape({ card_image: null })).toHaveProperty('cardImage');
  });

  it('accepts a stored photo on edit when the body sends none', () => {
    const { row } = buildVaultItemRow(
      { ...baseItem, card_image: undefined },
      { userId: USER, tier: 'free', isEdit: true },
    );
    const errors = validateVaultItemRow(row, {
      pricing: {}, isEdit: true,
      existing: { card_image: `${USER}/old.jpg`, category_id: 'c', franchise_id: 'f', locked_base_value_aud: null },
    });
    expect(errors).not.toHaveProperty('cardImage');
  });

  it('rejects a nonsense year but accepts a season', () => {
    expect(shape({ year: 'about 1999' })).toHaveProperty('year');
    expect(shape({ year: '2025-26' })).not.toHaveProperty('year');
  });

  it('requires an asking price for sale listings', () => {
    const { row } = build({ listing_type: 'For Sale' });
    const errors = validateVaultItemRow(row, { pricing: { askingPrice: null }, isEdit: false });
    expect(errors).toHaveProperty('askingPrice');
  });

  it('requires a coherent offer range for Expression of Interest', () => {
    const { row } = build({ listing_type: 'Expression of Interest' });
    const errors = validateVaultItemRow(row, { pricing: { offerMin: 100, offerMax: 50 }, isEdit: false });
    expect(errors).toHaveProperty('offerMax');
  });

  it('blocks setting the estimated value below the locked base value on edit', () => {
    const { row } = buildVaultItemRow(
      { ...baseItem, estimated_value_aud: 10 },
      { userId: USER, tier: 'free', isEdit: true },
    );
    const errors = validateVaultItemRow(row, {
      pricing: {}, isEdit: true,
      existing: { card_image: `${USER}/x.jpg`, category_id: 'c', franchise_id: 'f', locked_base_value_aud: 50 },
    });
    expect(errors).toHaveProperty('estimatedValue');
  });
});
