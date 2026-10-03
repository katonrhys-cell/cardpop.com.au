import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { computeRefundAmounts, getRefundPolicyOptions } from '../services/refundAmounts.js';
import { refundWindow } from '../../utils/buyerProtectionPolicy.js';

const router = Router();
router.use(authMiddleware);

// Reasons the buyer can pick — mirrors REFUND_REASONS in AccountOrders.jsx.
const REFUND_REASONS = new Set([
  'item_not_received', 'item_not_as_described', 'damaged', 'wrong_item', 'seller_cancelled', 'other',
]);
// Order states that represent a paid order eligible for a refund request.
const PAID_STATUSES = new Set(['payment_confirmed', 'shipped', 'completed']);

// Buyer requests a refund on their own order.
//
// This was previously done with three direct client writes (insert refunds,
// update orders.refund_status, insert seller notification). The latter two are
// denied by RLS for a normal user and Supabase returns no error, so the request
// silently never reached admins (orders.refund_status stayed null, so the admin
// "refund requested" filter never showed it) and the buyer's own guard let them
// file unlimited duplicates. Doing it server-side with the service-role client
// fixes all three, validates the requester actually owns the order, and
// recomputes the amounts from the order row rather than trusting the client.
router.post('/request', async (req, res) => {
  const userId = req.user.id;
  const { orderId, reason, notes } = req.body || {};

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'orderId is required' });
  }
  if (!reason || !REFUND_REASONS.has(reason)) {
    return res.status(400).json({ error: 'A valid reason is required' });
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, buyer_id, seller_id, status, refund_status, total_aud, item_price_aud, platform_fee_aud, gst_aud, processing_fee_aud, order_items, created_at, shipped_at')
    .eq('id', orderId)
    .maybeSingle();
  if (orderErr) {
    logger.error(`[REFUND] order load failed: ${orderErr.message}`);
    return res.status(500).json({ error: 'Failed to load order' });
  }
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== userId) {
    return res.status(403).json({ error: 'You can only request a refund on your own order' });
  }
  if (!PAID_STATUSES.has(order.status)) {
    return res.status(409).json({ error: 'This order is not eligible for a refund.' });
  }
  if (order.refund_status) {
    return res.status(409).json({ error: 'A refund request already exists for this order.' });
  }
  // The policy window (utils/buyerProtectionPolicy.js) — the same rule the
  // Request Refund button follows, enforced here so it can't be skipped.
  const window = refundWindow(order);
  if (window.state !== 'open') {
    return res.status(409).json({ error: window.reason, code: window.state === 'closed' ? 'REFUND_WINDOW_CLOSED' : 'REFUND_WINDOW_NOT_OPEN' });
  }

  const notesText = typeof notes === 'string' ? notes.slice(0, 1000).trim() : '';
  // Estimate shown to the buyer/admin — the same arithmetic the approval and
  // processing paths use, so the quoted figure matches what is actually sent.
  const { retentionPct, retainProcessingFee } = await getRefundPolicyOptions();
  const { retainedFee, refundAmount } = computeRefundAmounts(order, retentionPct, { retainProcessingFee });

  const { error: insErr } = await supabase.from('refunds').insert({
    order_id: order.id,
    buyer_id: order.buyer_id,
    seller_id: order.seller_id,
    requested_by: userId,
    reason: reason + (notesText ? ` — ${notesText}` : ''),
    refund_type: 'full',
    item_price_aud: order.item_price_aud || 0,
    commission_aud: order.platform_fee_aud || 0,
    gst_aud: order.gst_aud || 0,
    total_paid_aud: order.total_aud || 0,
    retained_fee_aud: retainedFee,
    refund_amount_aud: refundAmount,
  });
  if (insErr) {
    logger.error(`[REFUND] insert failed for order ${order.id}: ${insErr.message}`);
    return res.status(500).json({ error: 'Failed to submit refund request' });
  }

  const { error: updErr } = await supabase
    .from('orders')
    .update({ refund_status: 'requested', refund_requested_at: new Date().toISOString() })
    .eq('id', order.id);
  if (updErr) logger.warn(`[REFUND] order status update failed for ${order.id}: ${updErr.message}`);

  if (order.seller_id) {
    await supabase.from('notifications').insert({
      user_id: order.seller_id,
      type: 'refund_requested',
      title: 'Refund Request Received',
      body: 'A buyer has requested a refund on one of your sales. Our team will review it.',
    }).then(() => {}, () => {});
  }

  res.json({ success: true });
});

export default router;
