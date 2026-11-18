/**
 * Admin → Shop Products: turn what the admin has typed or ticked into an
 * explicit list of changes, so the page can show "this is what will change"
 * before anything is written. Pure — no React, no Supabase.
 */

/**
 * "Sold out" is not a database status: it is an active product with no stock,
 * which is exactly what the shop shows as sold out. The admin list treats it
 * as a status of its own so the table says what shoppers see.
 */
export const SOLD_OUT = 'sold_out';

export const PRODUCT_STATUS_LABELS = {
  active: 'Active',
  [SOLD_OUT]: 'Sold out',
  preorder: 'Pre-order',
  coming_soon: 'Coming soon',
  draft: 'Draft',
  archived: 'Archived',
};

export const statusLabel = (status) => PRODUCT_STATUS_LABELS[status] || status || '—';

/** The status the admin list shows and filters by: the row's own, or sold out. */
export function displayStatus(product) {
  if (product?.status === 'active' && !(Number(product.stock_quantity) > 0)) return SOLD_OUT;
  return product?.status;
}

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
 * the target status are counted, not changed. `sold_out` is the one target
 * that isn't a stored status — the page writes it as active with 0 stock.
 *
 * @returns {{ changes: Array<{ id, title, sku, from, needsEta, lines }>, unchanged: number, notes: string[] }}
 */
export function buildStatusChanges(products, selectedIds, status) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const picked = (products || []).filter((p) => ids.has(p.id));
  // Sold out is written as active + no stock, so "already there" is judged on
  // what the list shows rather than on the stored status.
  const isChange = (p) => (status === SOLD_OUT ? displayStatus(p) !== SOLD_OUT : p.status !== status);
  const changes = picked
    .filter(isChange)
    .map((p) => {
      const lines = [{ label: 'Status', from: statusLabel(displayStatus(p)), to: statusLabel(status) }];
      const stock = Number(p.stock_quantity) || 0;
      if (status === SOLD_OUT && stock > 0) lines.push({ label: 'Stock', from: String(stock), to: '0' });
      return {
        id: p.id,
        title: p.title,
        sku: p.sku,
        from: p.status,
        // A pre-order must say when it ships (the DB refuses a blank estimate).
        needsEta: status === 'preorder' && !String(p.preorder_eta ?? '').trim(),
        lines,
      };
    });

  // Things worth knowing before products go in front of shoppers.
  const notes = [];
  const changed = picked.filter(isChange);
  const plural = (n) => (n === 1 ? '1 product has' : `${n} products have`);
  if (status === 'active' || status === 'preorder' || status === 'coming_soon') {
    const noPhoto = changed.filter((p) => !(Array.isArray(p.images) && p.images.some(Boolean))).length;
    if (noPhoto) notes.push(`${plural(noPhoto)} no photo and will show in the shop without one.`);
  }
  if (status === 'active') {
    const noStock = changed.filter((p) => !(Number(p.stock_quantity) > 0)).length;
    if (noStock) notes.push(`${plural(noStock)} no stock and will show as sold out.`);
  }
  if (status === SOLD_OUT) {
    const withStock = changed.filter((p) => Number(p.stock_quantity) > 0).length;
    if (withStock) notes.push(`${plural(withStock)} stock on hand, which will be set to 0. Enter the stock again to put ${withStock === 1 ? 'it' : 'them'} back on sale.`);
    const preorders = changed.filter((p) => p.status === 'preorder').length;
    if (preorders) notes.push(`${preorders === 1 ? '1 product is' : `${preorders} products are`} on pre-order and will stop taking orders.`);
    notes.push('Sold-out products stay visible in the shop with an Enquire button.');
  }
  if (status === 'archived' || status === 'draft') {
    const live = changed.filter((p) => ['active', 'preorder', 'coming_soon'].includes(p.status)).length;
    if (live) notes.push(`${live === 1 ? '1 product is' : `${live} products are`} currently visible in the shop and will be hidden.`);
  }
  return { changes, unchanged: picked.length - changes.length, notes };
}
