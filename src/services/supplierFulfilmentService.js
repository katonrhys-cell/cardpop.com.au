import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendSupplierOrder } from '../utils/emailService.js';
import { getAdminNotificationEmail } from '../utils/adminNotificationRecipient.js';

// ─────────────────────────────────────────────────────────────────────────────
// Drop-ship fulfilment hand-off.
//
// Some shop_products are supplied by a third party (see the `suppliers` table):
// the buyer pays CardPop, and the supplier posts the parcel straight to the
// buyer under CardPop's name. This turns a paid order into that supplier's
// picking instruction.
//
// Two properties are non-negotiable, and both come from the
// supplier_dispatches table rather than from care in this file:
//
//   * EXACTLY ONCE. Stripe retries webhook deliveries and can have two in
//     flight at once. Sending twice means the supplier posts two parcels and
//     CardPop pays for both. The INSERT of the dispatch row is the claim — its
//     unique (order_id, supplier_id) constraint means one caller wins and
//     sends, and every other caller sees the conflict and returns.
//
//   * NEVER BLOCKS FULFILMENT. Everything here is best-effort from the
//     webhook's point of view. A Resend outage, an unmigrated column, a missing
//     supplier row — none of it may throw into the Stripe handler, because a
//     throw there means Stripe retries the whole order and the buyer's payment
//     confirmation, payout and receipt are all replayed. Failures are recorded
//     on the row (status 'failed') and logged, where the reconcile job and the
//     admin UI can see them.
// ─────────────────────────────────────────────────────────────────────────────

// Postgres unique-violation. On the dispatch row's (order_id, supplier_id)
// constraint this is the expected, benign outcome of a duplicate webhook
// delivery — not an error worth logging loudly.
const PG_UNIQUE_VIOLATION = '23505';

// Postgres / PostgREST "this column or table isn't there". CLAUDE.md documents
// the window: Vercel deploys on push while `supabase db push` runs on merge, so
// the backend can briefly run ahead of its own migrations. Treated as "feature
// not live yet" and skipped quietly rather than logging an error on every order.
//
// Covers both shapes, because both occur here: a missing COLUMN
// (shop_products.supplier_id, 42703 / PGRST204) and a missing TABLE (suppliers,
// 42P01 — or PGRST205, which PostgREST reports as a schema-cache miss with a
// quite different message).
function isSchemaNotReady(error) {
  const code = error?.code;
  if (code === '42703' || code === 'PGRST204' || code === '42P01' || code === 'PGRST205') return true;
  return /column .* does not exist|relation .* does not exist|could not find the table/i.test(error?.message || '');
}

// Mirrors the admin UI's reference format (pages/admin/OrderManagementPage.jsx),
// so the reference a supplier quotes back is searchable in Order Management.
// order_number is not guaranteed to exist on this schema, hence the fallback.
export function orderReference(order) {
  if (order?.order_number) return String(order.order_number);
  return order?.id ? String(order.id).slice(0, 8).toUpperCase() : 'UNKNOWN';
}

/**
 * Turn the paid shop lines of an order into per-supplier dispatch emails.
 *
 * @param {object} params
 * @param {object} params.order  The order row — needs `id` and the shipping_*
 *   columns. Passed in rather than re-read so this uses exactly the row the
 *   webhook already confirmed.
 * @param {Array}  params.lines  The shop lines that ACTUALLY FULFILLED. Oversold
 *   lines must not be here: their stock decrement failed, so there is nothing
 *   for the supplier to pick and the order is heading for a refund.
 * @returns {Promise<{dispatched: number, skipped: number, failed: number}>}
 *   Never throws.
 */
export async function dispatchSupplierOrders({ order, lines }) {
  const result = { dispatched: 0, skipped: 0, failed: 0 };
  if (!order?.id) return result;

  const shopLines = (lines || []).filter(l => l?.type === 'shop' && l?.id);
  if (shopLines.length === 0) return result;

  try {
    // ── Which of these products have a supplier? ──
    const productIds = [...new Set(shopLines.map(l => l.id))];
    const { data: products, error: productErr } = await supabase
      .from('shop_products')
      .select('id, title, sku, supplier_id')
      .in('id', productIds);

    if (productErr) {
      if (isSchemaNotReady(productErr)) {
        logger.info('[SUPPLIER] supplier_id not present yet — skipping dispatch until migrations land');
        return result;
      }
      throw productErr;
    }

    const byProductId = new Map((products || []).map(p => [p.id, p]));

    // Group the order's lines by supplier. A product with no supplier_id is
    // CardPop's own stock, packed in-house — not an error, just not a dispatch.
    const linesBySupplier = new Map();
    for (const line of shopLines) {
      const product = byProductId.get(line.id);
      if (!product?.supplier_id) continue;
      if (!linesBySupplier.has(product.supplier_id)) linesBySupplier.set(product.supplier_id, []);
      linesBySupplier.get(product.supplier_id).push({
        // Prefer the catalogue's current title/SKU over the order line's
        // snapshot: the supplier has to match this against their own catalogue,
        // and shop_products is the row that shares their vocabulary.
        sku: product.sku || null,
        title: product.title || line.title || 'Item',
        quantity: Number(line.quantity) || 1,
        product_id: line.id,
      });
    }

    if (linesBySupplier.size === 0) return result;

    const { data: suppliers, error: supplierErr } = await supabase
      .from('suppliers')
      .select('id, name, fulfilment_email, cc_emails, blind_shipping, blind_shipping_note, active')
      .in('id', [...linesBySupplier.keys()]);

    if (supplierErr) {
      if (isSchemaNotReady(supplierErr)) {
        logger.info('[SUPPLIER] suppliers table not present yet — skipping dispatch until migrations land');
        return result;
      }
      throw supplierErr;
    }

    const shipTo = {
      name: order.shipping_name || null,
      address: order.shipping_address || null,
      suburb: order.shipping_suburb || null,
      state: order.shipping_state || null,
      postcode: order.shipping_postcode || null,
    };
    const orderRef = orderReference(order);

    // Every shipping_* column on `orders` is nullable (see the cart insert in
    // src/routes/stripe.js), so an order CAN reach here with nothing to post to.
    // A dispatch without a usable address is worse than none: the supplier picks
    // stock against an instruction it cannot fulfil. Recorded per supplier as
    // 'failed' — a data problem needing a human, not a config state — so it
    // surfaces in the same unresolved-dispatch query as everything else.
    const addressBlocker = (!order.shipping_address || !order.shipping_postcode)
      ? 'Order has no usable shipping address (missing street and/or postcode)'
      : null;
    if (addressBlocker) {
      logger.error(`[SUPPLIER] order ${order.id} has drop-ship lines but ${addressBlocker.toLowerCase()} — nothing dispatched`);
    }

    // Where a supplier's "here's the tracking number" reply should land. The
    // From address is noreply@, so without a reply-to their response vanishes.
    const replyTo = await getAdminNotificationEmail();

    for (const supplier of suppliers || []) {
      const dispatchLines = linesBySupplier.get(supplier.id) || [];
      if (dispatchLines.length === 0) continue;

      const outcome = await dispatchToSupplier({
        order, orderRef, supplier, dispatchLines, shipTo, replyTo, addressBlocker,
      });
      if (outcome === 'sent') result.dispatched += 1;
      else if (outcome === 'failed') result.failed += 1;
      else result.skipped += 1;
    }

    return result;
  } catch (e) {
    // Deliberately terminal: a dispatch problem must never fail the order.
    logger.error(`[SUPPLIER] dispatch failed for order ${order.id}: ${e.message}`);
    return result;
  }
}

/**
 * Claim and send one supplier's dispatch.
 *
 * @returns {Promise<'sent'|'failed'|'skipped'|'duplicate'>}
 */
async function dispatchToSupplier({ order, orderRef, supplier, dispatchLines, shipTo, replyTo, addressBlocker }) {
  const recipients = supplier.active && supplier.fulfilment_email
    ? [supplier.fulfilment_email, ...(supplier.cc_emails || [])].filter(Boolean)
    : [];

  // Two distinct reasons not to send, recorded with different statuses because
  // they need different responses:
  //   * no usable delivery address → 'failed', a data problem for a human
  //   * supplier inactive or unconfigured → 'skipped', the expected state until
  //     an admin completes the supplier row (see docs/supplier-fulfilment.md)
  const blocker = addressBlocker
    || (recipients.length === 0
      ? `Supplier ${supplier.active ? 'has no fulfilment_email' : 'is inactive'}`
      : null);
  const claimStatus = blocker ? (addressBlocker ? 'failed' : 'skipped') : 'pending';
  const sendable = !blocker;

  const payload = {
    lines: dispatchLines,
    ship_to: shipTo,
    blind_shipping: supplier.blind_shipping !== false,
    blind_shipping_note: supplier.blind_shipping_note || null,
    order_ref: orderRef,
  };

  // The claim. A duplicate webhook delivery loses here and sends nothing.
  const { error: claimErr } = await supabase
    .from('supplier_dispatches')
    .insert({
      order_id: order.id,
      supplier_id: supplier.id,
      status: claimStatus,
      payload,
      recipient_email: recipients[0] || null,
      attempts: 0,
      last_error: blocker,
    });

  if (claimErr) {
    if (claimErr.code === PG_UNIQUE_VIOLATION) {
      logger.info(`[SUPPLIER] order ${order.id} already dispatched to ${supplier.name} — skipping duplicate`);
      return 'duplicate';
    }
    // Could not record the claim, so sending would be unguarded against a
    // retry. Refuse to send rather than risk a double shipment.
    logger.error(`[SUPPLIER] could not claim dispatch for order ${order.id} → ${supplier.name}: ${claimErr.message}`);
    return 'failed';
  }

  if (!sendable) {
    logger.warn(`[SUPPLIER] order ${order.id} has ${dispatchLines.length} line(s) for ${supplier.name} but was not dispatched: ${blocker}`);
    return claimStatus === 'failed' ? 'failed' : 'skipped';
  }

  const sent = await sendSupplierOrder({
    to: recipients,
    replyTo,
    supplierName: supplier.name,
    orderRef,
    orderId: order.id,
    lines: dispatchLines,
    shipTo,
    blindShipping: supplier.blind_shipping !== false,
    blindShippingNote: supplier.blind_shipping_note,
    orderedAt: order.created_at ? new Date(order.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
  }).catch(e => {
    logger.error(`[SUPPLIER] send threw for order ${order.id} → ${supplier.name}: ${e.message}`);
    return false;
  });

  await supabase
    .from('supplier_dispatches')
    .update({
      status: sent ? 'sent' : 'failed',
      attempts: 1,
      sent_at: sent ? new Date().toISOString() : null,
      last_error: sent ? null : 'Resend did not accept the message',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', order.id)
    .eq('supplier_id', supplier.id)
    .then(({ error }) => {
      if (error) logger.error(`[SUPPLIER] could not record dispatch outcome for order ${order.id}: ${error.message}`);
    });

  if (sent) logger.info(`[SUPPLIER] dispatched order ${orderRef} to ${supplier.name} (${dispatchLines.length} line(s))`);
  return sent ? 'sent' : 'failed';
}
