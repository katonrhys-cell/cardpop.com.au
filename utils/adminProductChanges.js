/**
 * Admin → Shop Products: turn what the admin has typed or ticked into an
 * explicit list of changes, so the page can show "this is what will change"
 * before anything is written. Pure — no React, no Supabase.
 */

export const PRODUCT_STATUS_LABELS = {
  active: 'Active',
  preorder: 'Pre-order',
  coming_soon: 'Coming soon',
  draft: 'Draft',
  archived: 'Archived',
};

export const statusLabel = (status) => PRODUCT_STATUS_LABELS[status] || status || '—';

const PRICE_FIELDS = [
  { field: 'price', label: 'Sale price' },
  { field: 'rrp', label: 'RRP' },
  { field: 'cost', label: 'Cost (inc GST)' },
];

const formatMoney = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);

const savedPriceValue = (product, costs, field) => {
  const raw = field === 'price' ? product?.price_aud
    : field === 'rrp' ? product?.retail_price_aud
    : costs?.[product?.id]?.wholesale_inc_gst_aud;
  return raw == null || raw === '' ? null : Number(raw);
};

/**
 * Validate the inline price drafts ({ [id]: { price?, rrp?, cost? } }, input
 * strings) and describe each change.
 *
 * @returns {{ error: string|null, changes: Array<{ id, title, sku, values: object, lines: Array<{label, from, to}> }> }}
 *   `values` holds the parsed numbers (null = clear) for the fields that changed.
 */
export function buildPriceChanges(drafts, products, costs) {
  const changes = [];
  for (const [id, draft] of Object.entries(drafts || {})) {
    const product = (products || []).find((p) => p.id === id);
    if (!product) continue;
    const values = {};
    const lines = [];
    for (const { field, label } of PRICE_FIELDS) {
      if (draft[field] === undefined) continue;
      const raw = String(draft[field]).trim();
      const n = raw === '' ? null : Number(raw);
      if (n !== null && (!Number.isFinite(n) || n < 0)) {
        return { error: `"${product.title}": ${label} must be a valid amount`, changes: [] };
      }
      if (field === 'price' && n === null) {
        return { error: `"${product.title}": a sale price is required`, changes: [] };
      }
      const rounded = n === null ? null : Math.round(n * 100) / 100;
      values[field] = rounded;
      lines.push({ label, from: formatMoney(savedPriceValue(product, costs, field)), to: rounded === null ? 'removed' : formatMoney(rounded) });
    }
    if (lines.length) changes.push({ id, title: product.title, sku: product.sku, values, lines });
  }
  return { error: null, changes };
}

/**
 * Describe a bulk status change for the ticked products. Products already in
 * the target status are counted, not changed.
 *
 * @returns {{ changes: Array<{ id, title, sku, from, needsEta, lines }>, unchanged: number, notes: string[] }}
 */
export function buildStatusChanges(products, selectedIds, status) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const picked = (products || []).filter((p) => ids.has(p.id));
  const changes = picked
    .filter((p) => p.status !== status)
    .map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      from: p.status,
      // A pre-order must say when it ships (the DB refuses a blank estimate).
      needsEta: status === 'preorder' && !String(p.preorder_eta ?? '').trim(),
      lines: [{ label: 'Status', from: statusLabel(p.status), to: statusLabel(status) }],
    }));

  // Things worth knowing before products go in front of shoppers.
  const notes = [];
  const changed = picked.filter((p) => p.status !== status);
  const plural = (n) => (n === 1 ? '1 product has' : `${n} products have`);
  if (status === 'active' || status === 'preorder' || status === 'coming_soon') {
    const noPhoto = changed.filter((p) => !(Array.isArray(p.images) && p.images.some(Boolean))).length;
    if (noPhoto) notes.push(`${plural(noPhoto)} no photo and will show in the shop without one.`);
  }
  if (status === 'active') {
    const noStock = changed.filter((p) => !(Number(p.stock_quantity) > 0)).length;
    if (noStock) notes.push(`${plural(noStock)} no stock and will show as sold out.`);
  }
  if (status === 'archived' || status === 'draft') {
    const live = changed.filter((p) => ['active', 'preorder', 'coming_soon'].includes(p.status)).length;
    if (live) notes.push(`${live === 1 ? '1 product is' : `${live} products are`} currently visible in the shop and will be hidden.`);
  }
  return { changes, unchanged: picked.length - changes.length, notes };
}
