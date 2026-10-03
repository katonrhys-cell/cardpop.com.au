/**
 * Binder capacity — how many cards (or loaded cards) each Palms Off Gaming
 * binder line holds, keyed by line SKU (= shop_products.family_sku).
 *
 * The single source for every place a capacity is shown: the binder product
 * page's "Binder capacity" picker and spec table, the binders hub, the
 * prerendered pages, and the "Capacity" filter chip on shop grids. Kept
 * dependency-free because api/prerender.js imports it via the binder data.
 *
 * `group` links lines that are the same binder at different capacities, so the
 * product page can offer them as one picker — the way the supplier's own page
 * shows "Binder Capacity: 128 | 216" on the top loader binders.
 *
 * Figures are from the manufacturer's listings (palmsoffgaming.com.au and its
 * retail partners). The ring binder takes interchangeable pages sold
 * separately, so it has no fixed capacity and is deliberately absent.
 */

export const BINDER_CAPACITY = {
  'ZB-04': { slots: 160, unit: 'cards', pages: '20 double-sided pages, 2 × 2 layout', group: 'collectors-zip' },
  'ZB-09': { slots: 360, unit: 'cards', pages: '20 double-sided pages, 3 × 3 layout', group: 'collectors-zip' },
  'ZB-12': { slots: 480, unit: 'cards', pages: '20 double-sided pages, 3 × 4 layout', group: 'collectors-zip' },
  'TOP-04': { slots: 128, unit: '35pt top loaders', pages: '16 double-sided pages, 2 × 2 layout', group: 'collectors-top-loader' },
  'TOP-09': { slots: 216, unit: '35pt top loaders', pages: '12 double-sided pages, 3 × 3 layout', group: 'collectors-top-loader' },
  'STL-09': { slots: 360, unit: 'cards', pages: '20 double-sided pages, 3 × 3 layout', group: 'stealth-zip' },
  'STL-12': { slots: 480, unit: 'cards', pages: '20 double-sided pages, 3 × 4 layout', group: 'stealth-zip' },
};

/** Capacity for a line SKU or a colour SKU ("TOP-09-RED" → TOP-09), else null. */
export function binderCapacity(sku) {
  const key = String(sku || '').trim().toUpperCase();
  if (!key) return null;
  if (BINDER_CAPACITY[key]) return BINDER_CAPACITY[key];
  // Colour SKUs are the line SKU plus a colour code: TOP-09-RED, STL-12-BLK.
  const line = Object.keys(BINDER_CAPACITY).find((k) => key.startsWith(`${k}-`));
  return line ? BINDER_CAPACITY[line] : null;
}

/** "216 × 35pt top loaders" / "360 cards", or null. */
export function binderCapacityText(sku) {
  const c = binderCapacity(sku);
  if (!c) return null;
  return c.unit === 'cards' ? `${c.slots} cards` : `${c.slots} × ${c.unit}`;
}

/** Line SKUs sharing `sku`'s capacity group, smallest first (incl. itself). */
export function binderCapacitySiblings(sku) {
  const c = binderCapacity(sku);
  if (!c) return [];
  return Object.entries(BINDER_CAPACITY)
    .filter(([, v]) => v.group === c.group)
    .sort(([, a], [, b]) => a.slots - b.slots)
    .map(([lineSku, v]) => ({ sku: lineSku, ...v }));
}
