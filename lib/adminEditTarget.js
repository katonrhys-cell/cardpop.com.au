import { useEffect, useSyncExternalStore } from 'react';

// A public page that shows one editable thing (a shop product, an event, a
// marketplace listing) says so here, and the floating "Edit in admin" button
// (components/AdminEditButton.jsx) links to that thing's admin editor. One
// slot is enough: only one such page is on screen at a time.

let target = null;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => target;

/** Set (or, with null, clear) the target. Exported for tests. */
export function setAdminEditTarget(next) {
  if (next === target) return;
  target = next;
  emit();
}

/**
 * Register what this page edits: `{ label, to }`, or null while it has nothing
 * (still loading, not found). Cleared when the page unmounts. Primitives in the
 * deps keep the effect from re-running on every render.
 */
export function useAdminEditTarget(label, to) {
  useEffect(() => {
    if (!to) return undefined;
    const mine = { label, to };
    setAdminEditTarget(mine);
    return () => { if (target === mine) setAdminEditTarget(null); };
  }, [label, to]);
}

/** The current target, or null. */
export function useCurrentAdminEditTarget() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
