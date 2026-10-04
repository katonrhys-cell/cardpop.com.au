import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendOrderShipped, sendOrderDelivered } from '../utils/emailService.js';
import { carrierLabel, normalizeTrackingNumber } from '../../utils/shipmentTracking.js';
import { MARKETPLACE_PROTECTION } from '../../utils/buyerProtectionPolicy.js';

// The two state changes of an order after payment, shared by the admin route
// (POST /admin/orders/:id/ship), the seller route (POST /orders/:id/ship), the
// buyer's "I've received it" (POST /orders/:id/received) and the delivery
// sweep. One implementation so the email, the bell and the timestamps are the
// same whoever triggers them.

export const SHIPPABLE_STATUSES = new Set(['payment_confirmed', 'shipped']);
export const DELIVERABLE_STATUSES = new Set(['shipped']);

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/** The seller of a single-item order, or of at least one listing line of a cart order. */
export function sellerOwnsOrder(order, sellerId) {
  if (!order || !sellerId) return false;
  if (order.seller_id === sellerId) return true;
  const lines = Array.isArray(order.order_items) ? order.order_items : [];
  return lines.some((l) => l && (l.type ?? 'listing') === 'listing' && l.seller_id === sellerId);
}

/** True when a cart order has listing lines from more than one seller. */
export function isMultiSellerOrder(order) {
  const lines = Array.isArray(order?.order_items) ? order.order_items : [];
  const sellers = new Set(lines.filter((l) => l && (l.type ?? 'listing') === 'listing' && l.seller_id).map((l) => l.seller_id));
  return sellers.size > 1;
}

async function buyerContact(order) {
  // A guest's email is on the order; a registered buyer's lives in
  // profiles.email (service-role only).
  let buyerEmail = order.buyer_email || null;
  let buyerName = order.shipping_name || null;
  if (order.buyer_id && (!buyerEmail || !buyerName)) {
    const { data: profile } = await supabase
      .from('profiles').select('email, display_name').eq('id', order.buyer_id).maybeSingle();
    buyerEmail = buyerEmail || profile?.email || null;
    buyerName = buyerName || profile?.display_name || null;
  }
  return { buyerEmail, buyerName };
}

const itemTitles = (order) => {
  const lines = Array.isArray(order.order_items) ? order.order_items : [];
  return lines.length
    ? lines.map((l) => l?.title).filter(Boolean)
    : [order.listing?.vault_item?.card_name || order.listing?.title].filter(Boolean);
};

/**
 * Mark an order shipped with carrier + tracking, email the buyer their
 * tracking link (unless notify is off) and ring their bell.
 *
 * @param authorize optional (order) => void; throw an httpError to refuse.
 *   The admin route passes none; the seller route checks ownership.
 * @returns {{ order, emailed, emailError, trackingNumber }}
 */
export async function markOrderShipped({ orderId, carrier, trackingNumber: rawTracking, notify = true, authorize = null }) {
  const trackingNumber = normalizeTrackingNumber(rawTracking);
  const { data: order, error: readErr } = await supabase
    .from('orders')
    .select('id, status, buyer_id, buyer_email, seller_id, shipping_name, order_items, shipped_at, listing:listings!listing_id(title, vault_item:vault_items(card_name))')
    .eq('id', orderId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!order) throw httpError(404, 'Order not found');
  if (authorize) authorize(order);
  if (!SHIPPABLE_STATUSES.has(order.status)) {
    throw httpError(409, `An order that is ${String(order.status).replace(/_/g, ' ')} can't be marked shipped`);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from('orders')
    .update({
      status: 'shipped',
      tracking_carrier: carrier,
      tracking_number: trackingNumber,
      shipped_at: order.shipped_at || now,
    })
    .eq('id', orderId)
    .select('id, status, tracking_carrier, tracking_number, shipped_at, shipping_notified_at')
    .single();
  if (updErr) throw updErr;

  const orderRef = orderId.slice(0, 8).toUpperCase();
  const items = itemTitles(order);
  const lines = Array.isArray(order.order_items) ? order.order_items : [];

  let emailed = false;
  let emailError = null;
  if (notify) {
    const { buyerEmail, buyerName } = await buyerContact(order);
    if (!buyerEmail) {
      emailError = 'No email address on file for this buyer';
    } else {
      // Shop products can be reviewed once shipped — say so in the email.
      const invitesReview = lines.some((l) => l?.type === 'shop');
      emailed = await sendOrderShipped({ buyerEmail, buyerName, orderRef, items, carrier, trackingNumber, invitesReview });
      if (emailed) {
        updated.shipping_notified_at = now;
        await supabase.from('orders').update({ shipping_notified_at: now }).eq('id', orderId)
          .then(() => {}, () => {});
      } else {
        emailError = 'The shipping email could not be sent';
      }
    }

    if (order.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: order.buyer_id, type: 'order_update', title: 'Your order has shipped 📦',
        body: `${carrierLabel(carrier)} tracking: ${trackingNumber}`,
        link: '/account/orders', related_id: orderId,
      }).then(() => {}, () => {});
    }
  }

  return { order: updated, emailed, emailError, trackingNumber, rawOrder: order };
}

/**
 * Record delivery: delivered_at + how we know (carrier scan, buyer tap, the
 * 10-day auto rule, or an admin), move the order to 'completed' (which also
 * fires the points trigger), and tell the buyer the Buyer Protection clock has
 * started with a nudge to rate the seller. Idempotent: an already-delivered
 * order returns { changed: false }.
 *
 * @param authorize optional (order) => void; throw an httpError to refuse.
 */
export async function markOrderDelivered({ orderId, source, deliveredAt = null, authorize = null, notify = true }) {
  const { data: order, error: readErr } = await supabase
    .from('orders')
    .select('id, status, buyer_id, buyer_email, seller_id, shipping_name, order_items, shipped_at, delivered_at, tracking_carrier, listing:listings!listing_id(title, vault_item:vault_items(card_name)), seller:profiles!seller_id(display_name, username)')
    .eq('id', orderId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!order) throw httpError(404, 'Order not found');
  if (authorize) authorize(order);
  if (order.delivered_at) return { changed: false, order };
  if (!DELIVERABLE_STATUSES.has(order.status)) {
    throw httpError(409, `An order that is ${String(order.status).replace(/_/g, ' ')} can't be marked delivered`);
  }

  const when = (deliveredAt instanceof Date ? deliveredAt : (deliveredAt ? new Date(deliveredAt) : new Date())).toISOString();
  const { data: updated, error: updErr } = await supabase
    .from('orders')
    .update({ status: 'completed', delivered_at: when, delivery_source: source })
    .eq('id', orderId)
    .eq('status', 'shipped')
    .select('id, status, delivered_at, delivery_source')
    .maybeSingle();
  if (updErr) throw updErr;
  if (!updated) return { changed: false, order }; // lost a race with another path

  if (notify) {
    const orderRef = orderId.slice(0, 8).toUpperCase();
    const items = itemTitles(order);
    const isShopOnly = Array.isArray(order.order_items) && order.order_items.length > 0 && order.order_items.every((l) => l?.type === 'shop');
    const { buyerEmail, buyerName } = await buyerContact(order);
    if (buyerEmail) {
      const sent = await sendOrderDelivered({
        buyerEmail, buyerName, orderRef, items, source,
        sellerName: order.seller?.display_name || order.seller?.username || null,
        marketplace: !isShopOnly,
        claimDays: MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery,
      }).catch((e) => { logger.warn(`[DELIVERY] delivered email failed for ${orderId}: ${e.message}`); return false; });
      if (sent) {
        await supabase.from('orders').update({ delivery_notified_at: new Date().toISOString() }).eq('id', orderId).then(() => {}, () => {});
      }
    }
    if (order.buyer_id && source !== 'buyer') {
      await supabase.from('notifications').insert({
        user_id: order.buyer_id, type: 'order_update', title: 'Your order was delivered',
        body: isShopOnly
          ? 'Hope you love it — you can review the products from Account → Orders.'
          : `Not as described or damaged? Report it within ${MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days. Otherwise, rate your seller.`,
        link: '/account/orders', related_id: orderId,
      }).then(() => {}, () => {});
    }
    if (order.seller_id && source === 'buyer') {
      await supabase.from('notifications').insert({
        user_id: order.seller_id, type: 'order_update', title: 'Delivered — the buyer confirmed receipt',
        body: `Order ${orderRef} is complete.`,
        link: '/account/sales', related_id: orderId,
      }).then(() => {}, () => {});
    }
  }

  return { changed: true, order: updated };
}
