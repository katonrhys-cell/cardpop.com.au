import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import { shipOrderSchema, shipOrderBodySchema } from '../schemas/adminSchemas.js';
import { markOrderShipped, markOrderDelivered, sellerOwnsOrder, isMultiSellerOrder } from '../services/shipmentService.js';
import { runDeliverySweep } from '../services/deliverySweepService.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { verifyRestoreToken } from '../utils/restoreToken.js';

const router = Router();

// ─── GET /orders/delivery-sweep (cron, CRON_SECRET, fail-closed) ─────────────
const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};
const isAuthorisedCronCall = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) { logger.warn('[DELIVERY] CRON_SECRET is not set — refusing /delivery-sweep (fail-closed).'); return false; }
  return timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`);
};

router.get('/delivery-sweep', async (req, res) => {
  if (!isAuthorisedCronCall(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const summary = await runDeliverySweep();
    res.json(summary);
  } catch (err) {
    logger.error(`[DELIVERY] sweep run failed: ${err.message}`);
    res.status(500).json({ error: 'Delivery sweep failed' });
  }
});

// ─── GET /orders/:id/abandoned-cart?t=… — restore an abandoned cart ──────────
// Linked from the abandoned-checkout email. Public, but the HMAC token
// (src/utils/restoreToken.js) must match; it returns the lines only — type,
// id, title, unit price, quantity, variant — never the address or the email.
router.get('/:id/abandoned-cart', async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyRestoreToken(id, req.query.t)) {
    return res.status(404).json({ error: 'This cart link is not valid.' });
  }
  try {
    const { data: order, error } = await supabase
      .from('orders').select('id, status, order_items').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order || !['pending', 'cancelled'].includes(order.status)) {
      return res.status(410).json({ error: 'This cart has already been checked out.' });
    }
    const items = (Array.isArray(order.order_items) ? order.order_items : []).map((l) => ({
      type: l.type === 'shop' ? 'shop' : 'listing',
      id: l.id,
      title: l.title || 'Item',
      quantity: Math.max(1, Number(l.quantity) || 1),
      unitPriceAud: Number(l.unit_price_aud ?? (Number(l.line_total_aud) / (Number(l.quantity) || 1))) || 0,
      ...(l.variant_id ? { variantId: l.variant_id } : {}),
    })).filter((l) => l.id);
    res.json({ items });
  } catch (err) {
    logger.error(`[ORDERS] abandoned-cart restore failed for ${id}: ${err.message}`);
    res.status(500).json({ error: 'Could not restore this cart.' });
  }
});

// Everything below is the signed-in buyer or seller acting on their own order.
router.use(authMiddleware);

const orderIdSchema = z.object({ id: z.string().uuid('Invalid order ID') });

// ─── POST /orders/:id/ship — the seller posts their sale ─────────────────────
// Mirrors the admin endpoint, with an ownership check: the caller must be the
// order's seller (or the seller of a listing line in a cart order). A cart that
// mixes several sellers can't be marked shipped as a whole from here — each
// parcel is a separate shipment and the order carries one tracking slot — so
// those go through support until per-line shipments exist.
router.post('/:id/ship', validateRequestParams(shipOrderSchema), validateRequestBody(shipOrderBodySchema), async (req, res) => {
  const { id } = req.params;
  const { carrier, notify } = req.body;
  try {
    const result = await markOrderShipped({
      orderId: id, carrier, trackingNumber: req.body.tracking_number, notify,
      authorize: (order) => {
        if (!sellerOwnsOrder(order, req.user.id)) throw Object.assign(new Error('You can only mark your own sales as shipped'), { statusCode: 403 });
        if (isMultiSellerOrder(order)) throw Object.assign(new Error('This order has cards from several sellers — contact support to record your shipment'), { statusCode: 409 });
      },
    });
    logger.info(`[ORDERS] seller ${req.user.id} marked order ${id} shipped (${carrier} ${result.trackingNumber}, emailed=${result.emailed})`);
    res.json({ success: true, order: result.order, emailed: result.emailed, emailError: result.emailError });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[ORDERS] seller ship failed for ${id}: ${err.message}`);
    res.status(code).json({ error: code === 500 ? 'Failed to mark the order shipped' : err.message });
  }
});

// ─── POST /orders/:id/received — the buyer confirms the parcel arrived ───────
router.post('/:id/received', validateRequestParams(orderIdSchema), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await markOrderDelivered({
      orderId: id, source: 'buyer',
      authorize: (order) => {
        if (order.buyer_id !== req.user.id) throw Object.assign(new Error('You can only confirm delivery of your own orders'), { statusCode: 403 });
      },
    });
    res.json({ success: true, changed: result.changed, order: result.order });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[ORDERS] received failed for ${id}: ${err.message}`);
    res.status(code).json({ error: code === 500 ? 'Failed to confirm delivery' : err.message });
  }
});

export default router;
