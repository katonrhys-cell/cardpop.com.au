import { useEffect, useSyncExternalStore } from 'react';

// A public page that shows one editable thing (a shop product, an event, a
// marketplace listing) says so here, and the floating "Edit in admin" button
// (components/AdminEditButton.jsx) links to that thing's admin editor. One
// slot is enough: only one such page is on screen at a time. A page can also
// offer `also` links (a shop category page: its products *and* the category
// manager) which the button stacks above the main one.

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
 * Register what this page edits: `label` + `to`, plus optional extra
 * `[{ label, to }]` links. Pass `to` null while the page has nothing yet
 * (still loading, not found). Cleared when the page unmounts. The extras are
 * compared by value so a fresh array each render doesn't re-run the effect.
 */
export function useAdminEditTarget(label, to, also = null) {
  const alsoKey = also?.length ? JSON.stringify(also) : '';
  useEffect(() => {
    if (!to) return undefined;
    const mine = { label, to, also: alsoKey ? JSON.parse(alsoKey) : [] };
    setAdminEditTarget(mine);
    return () => { if (target === mine) setAdminEditTarget(null); };
  }, [label, to, alsoKey]);
}

/** The current target, or null. */
export function useCurrentAdminEditTarget() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
