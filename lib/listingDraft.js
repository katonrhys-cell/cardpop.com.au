// Best-effort draft persistence for the Add Card listing form. The form is
// long (5 sections, ~40 fields) and has no server-side draft state, so a
// refresh, accidental back-swipe, or tab close used to lose everything the
// seller had entered. Field values and hierarchy selections are persisted to
// localStorage per user; images are deliberately NOT stored (they can be tens
// of MB as data URLs and would blow the localStorage quota) — the restore UI
// tells the seller to re-add photos.
//
// Every operation is fail-safe: storage may be unavailable (private browsing,
// disabled cookies) or full, and a draft must never break the form itself.

const DRAFT_VERSION = 1;
// Drafts older than this are treated as abandoned rather than restored.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const draftStorageKey = (userId) => `cardpop.listingDraft.${userId || 'anon'}`;

export const loadListingDraft = (userId, storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(draftStorageKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.version !== DRAFT_VERSION) return null;
    if (typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > MAX_AGE_MS) return null;
    if (!draft.formData || typeof draft.formData !== 'object') return null;
    return draft;
  } catch {
    return null;
  }
};

export const saveListingDraft = (userId, { formData, hierarchy }, storage = globalThis.localStorage) => {
  try {
    storage?.setItem(
      draftStorageKey(userId),
      JSON.stringify({ version: DRAFT_VERSION, savedAt: Date.now(), formData, hierarchy })
    );
  } catch {
    // Quota exceeded / storage unavailable — drafts are best-effort.
  }
};

export const clearListingDraft = (userId, storage = globalThis.localStorage) => {
  try {
    storage?.removeItem(draftStorageKey(userId));
  } catch {
    // Storage unavailable — nothing to clear.
  }
};

// Whether the form differs from its pristine state enough to be worth saving
// or offering to restore. Compares against the form's own empty defaults so a
// new default field added later never makes an untouched form look dirty.
export const hasMeaningfulContent = (formData, emptyForm, hierarchy = {}) => {
  if (Object.values(hierarchy).some(Boolean)) return true;
  if (!formData) return false;
  return Object.keys(emptyForm).some((key) => {
    const value = formData[key];
    const initial = emptyForm[key];
    if (Array.isArray(initial)) return Array.isArray(value) && value.length > 0;
    return value !== undefined && value !== initial;
  });
};
