import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  draftStorageKey,
  loadListingDraft,
  saveListingDraft,
  clearListingDraft,
  hasMeaningfulContent,
} from '@/lib/listingDraft.js';

const USER = 'user-123';
const emptyForm = {
  cardName: '',
  setName: '',
  variant: [],
  condition: 'near_mint',
  listingType: 'private',
};

describe('listing draft persistence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a saved draft', () => {
    const formData = { ...emptyForm, cardName: 'Charizard' };
    const hierarchy = { franchiseId: 'f1' };
    saveListingDraft(USER, { formData, hierarchy });

    const draft = loadListingDraft(USER);
    expect(draft.formData).toEqual(formData);
    expect(draft.hierarchy).toEqual(hierarchy);
    expect(typeof draft.savedAt).toBe('number');
  });

  it('is scoped per user', () => {
    saveListingDraft(USER, { formData: { cardName: 'Pikachu' }, hierarchy: {} });
    expect(loadListingDraft('someone-else')).toBeNull();
    expect(loadListingDraft(USER)).not.toBeNull();
  });

  it('returns null when no draft exists', () => {
    expect(loadListingDraft(USER)).toBeNull();
  });

  it('rejects corrupt JSON without throwing', () => {
    localStorage.setItem(draftStorageKey(USER), '{not json');
    expect(loadListingDraft(USER)).toBeNull();
  });

  it('rejects drafts with an unknown version', () => {
    localStorage.setItem(
      draftStorageKey(USER),
      JSON.stringify({ version: 999, savedAt: Date.now(), formData: {} })
    );
    expect(loadListingDraft(USER)).toBeNull();
  });

  it('rejects expired drafts', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      draftStorageKey(USER),
      JSON.stringify({ version: 1, savedAt: eightDaysAgo, formData: { cardName: 'x' } })
    );
    expect(loadListingDraft(USER)).toBeNull();
  });

  it('clearListingDraft removes the draft', () => {
    saveListingDraft(USER, { formData: { cardName: 'x' }, hierarchy: {} });
    clearListingDraft(USER);
    expect(loadListingDraft(USER)).toBeNull();
  });

  it('save and clear swallow storage failures', () => {
    const broken = {
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: () => { throw new Error('unavailable'); },
      getItem: () => { throw new Error('unavailable'); },
    };
    expect(() => saveListingDraft(USER, { formData: {}, hierarchy: {} }, broken)).not.toThrow();
    expect(() => clearListingDraft(USER, broken)).not.toThrow();
    expect(loadListingDraft(USER, broken)).toBeNull();
  });
});

describe('hasMeaningfulContent', () => {
  it('is false for a pristine form', () => {
    expect(hasMeaningfulContent({ ...emptyForm }, emptyForm, {})).toBe(false);
  });

  it('is true when a text field differs from its default', () => {
    expect(hasMeaningfulContent({ ...emptyForm, cardName: 'Blastoise' }, emptyForm, {})).toBe(true);
  });

  it('is true when a non-empty default was changed', () => {
    expect(hasMeaningfulContent({ ...emptyForm, listingType: 'For Sale' }, emptyForm, {})).toBe(true);
  });

  it('is true when an array field has entries', () => {
    expect(hasMeaningfulContent({ ...emptyForm, variant: ['Refractor'] }, emptyForm, {})).toBe(true);
  });

  it('is true when any hierarchy selection exists', () => {
    expect(hasMeaningfulContent({ ...emptyForm }, emptyForm, { franchiseId: 'f1' })).toBe(true);
  });

  it('ignores fields added after the draft was saved', () => {
    // Draft saved before `newField` existed: missing key must not read as dirty.
    const withNewField = { ...emptyForm, newField: 'default' };
    expect(hasMeaningfulContent({ ...emptyForm }, withNewField, {})).toBe(false);
  });

  it('handles a missing formData safely', () => {
    expect(hasMeaningfulContent(null, emptyForm, {})).toBe(false);
    expect(hasMeaningfulContent(null, emptyForm, { setId: 's1' })).toBe(true);
  });
});
