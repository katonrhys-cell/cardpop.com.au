import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Dropship fulfilment lifecycle. Writes to supply_fulfilments go exclusively
// through this service (service role); RLS gives customers read-only access to
// their own rows and admins read access to all.
export const FULFILMENT_TRANSITIONS = {
  awaiting_fulfilment: ['ordered_with_supplier', 'shipped', 'cancelled'],
  ordered_with_supplier: ['shipped', 'cancelled'],
  shipped: ['complete', 'refunded'],
  complete: ['refunded'],
  cancelled: [],
  refunded: [],
};

/**
 * Split a paid order's supply lines into fulfilments, one per supplier, and
 * queue them for admin approval. Idempotent per order: a second webhook
 * delivery creates nothing. Non-supply lines (owned stock, listings) are
 * untouched — this is the "split behind the scenes" half of mixed carts.
 */
export async function createFulfilmentsForOrder(order) {
  const lines = (Array.isArray(order.order_items) ? order.order_items : [])
    .filter((l) => l.type === 'shop' && l.is_supply === true && l.id);
  if (lines.length === 0) return [];

  const { data: existing, error: existingErr } = await supabase
    .from('supply_fulfilments')
    .select('id')
    .eq('order_id', order.id)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing?.length) {
    logger.info(`[SUPPLIES] Fulfilments already exist for order ${order.id}, skipping`);
    return [];
  }

  const { data: sourcing, error: sourcingErr } = await supabase
    .from('shop_product_sourcing')
    .select('product_id, supplier_id, supplier_sku, cost_price_aud')
    .in('product_id', lines.map((l) => l.id));
  if (sourcingErr) throw sourcingErr;

  const bySupplier = new Map();
  for (const line of lines) {
    const source = sourcing?.find((s) => s.product_id === line.id);
    const supplierId = source?.supplier_id || null;
    const key = supplierId || 'unassigned';
    if (!bySupplier.has(key)) bySupplier.set(key, { supplierId, items: [] });
    bySupplier.get(key).items.push({
      product_id: line.id,
      title: line.title,
      supplier_sku: source?.supplier_sku || null,
      quantity: line.quantity || 1,
      unit_price_aud: line.unit_price_aud,
      cost_price_aud: source?.cost_price_aud ?? null,
    });
  }

  const rows = [...bySupplier.values()].map(({ supplierId, items }) => ({
    order_id: order.id,
    buyer_id: order.buyer_id || null,
    supplier_id: supplierId,
    status: 'awaiting_fulfilment',
    items,
    shipping_name: order.shipping_name || null,
    shipping_address: order.shipping_address || null,
    shipping_suburb: order.shipping_suburb || null,
    shipping_state: order.shipping_state || null,
    shipping_postcode: order.shipping_postcode || null,
  }));

  const { data: created, error: insertErr } = await supabase
    .from('supply_fulfilments')
    .insert(rows)
    .select('id');
  if (insertErr) throw insertErr;

  const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
  if (admins?.length) {
    await supabase.from('notifications').insert(admins.map((a) => ({
      user_id: a.id,
      type: 'supply_order_new',
      title: 'Supply order awaiting fulfilment',
      body: `Order ${order.id} contains ${lines.length} supply item(s). Review the fulfilment queue to place the supplier order.`,
    }))).catch(() => {});
  }

  logger.info(`[SUPPLIES] Created ${rows.length} fulfilment(s) for order ${order.id}`);
  return created || [];
}

/**
 * The pre-filled supplier order an admin approves with one click: a
 * ready-to-send email body plus a CSV of the lines. Works for any supplier
 * that takes orders by email or portal — no API assumed.
 */
export function buildSupplierOrder(fulfilment, supplier) {
  const reference = `CP-${String(fulfilment.id).slice(0, 8).toUpperCase()}`;
  const items = Array.isArray(fulfilment.items) ? fulfilment.items : [];

  const itemLines = items
    .map((i) => `  - ${i.quantity} x ${i.supplier_sku ? `[${i.supplier_sku}] ` : ''}${i.title}`)
    .join('\n');

  const address = [
    fulfilment.shipping_name,
    fulfilment.shipping_address,
    [fulfilment.shipping_suburb, fulfilment.shipping_state, fulfilment.shipping_postcode].filter(Boolean).join(' '),
    'Australia',
  ].filter(Boolean).join('\n  ');

  const blindShipNote = supplier?.supports_blind_shipping
    ? 'Please blind-ship this order: no supplier branding, invoices or promotional material in the parcel.'
    : 'If possible, please ship with no supplier invoices or promotional material in the parcel.';

  const text = [
    `Hi ${supplier?.name || 'team'},`,
    '',
    `Please dispatch the following order. Our reference: ${reference}`,
    '',
    itemLines,
    '',
    'Deliver to:',
    `  ${address}`,
    '',
    blindShipNote,
    '',
    'Please reply with tracking details once dispatched.',
    '',
    'Thanks,',
    'CardPop — cardpop.com.au',
  ].join('\n');

  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    'supplier_sku,title,quantity,ship_name,ship_address,ship_suburb,ship_state,ship_postcode,reference',
    ...items.map((i) => [
      i.supplier_sku, i.title, i.quantity || 1,
      fulfilment.shipping_name, fulfilment.shipping_address, fulfilment.shipping_suburb,
      fulfilment.shipping_state, fulfilment.shipping_postcode, reference,
    ].map(csvEscape).join(',')),
  ].join('\n');

  return {
    reference,
    to: supplier?.contact_email || null,
    subject: `Dropship order ${reference} — CardPop`,
    text,
    csv,
  };
}

/**
 * Atomically move a fulfilment to the next status. The update is guarded on
 * the set of statuses allowed to transition to `nextStatus`, so concurrent
 * admin clicks can't double-apply. Returns the updated row or null when the
 * transition wasn't allowed (already moved on / terminal).
 */
export async function transitionFulfilment(id, nextStatus, patch = {}) {
  const allowedFrom = Object.entries(FULFILMENT_TRANSITIONS)
    .filter(([, targets]) => targets.includes(nextStatus))
    .map(([from]) => from);
  if (allowedFrom.length === 0) return null;

  const { data, error } = await supabase
    .from('supply_fulfilments')
    .update({ ...patch, status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', allowedFrom)
    .select('*, supplier:suppliers(*)');
  if (error) throw error;
  return data?.[0] || null;
}
