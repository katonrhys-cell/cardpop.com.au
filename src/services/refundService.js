import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendRefundProcessed, sendRefundIssued } from '../utils/emailService.js';
import { reverseSellerPayout } from './payoutService.js';
import { creditWallet } from './walletService.js';
import { getPlatformSetting } from './stripeWebhookService.js';
import { isAdminUser } from '../middleware/auth.js';

export async function processRefund(req, res) {
  try {
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { refundId } = req.body;

    const { data: refund, error: rErr } = await supabase
      .from('refunds')
      .select('*, order:orders!order_id(id, stripe_payment_intent_id, stripe_session_id, total_aud, platform_fee_aud, gst_aud, status, refund_status, seller_id, stripe_transfer_id, payout_status, seller_proceeds_aud, order_items)')
      .eq('id', refundId)
      .maybeSingle();

    if (rErr || !refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status !== 'approved') return res.status(400).json({ error: 'Refund must be in approved state before processing' });
    if (refund.order?.status === 'refunded') return res.status(400).json({ error: 'Order already refunded' });

    // Don't double-act on an order whose payout was already frozen/reversed by a
    // chargeback (handleDisputeCreated) — that path already reversed the seller
    // payout and may have compensated the buyer.
    if (['frozen', 'reversed'].includes(refund.order?.payout_status)) {
      return res.status(409).json({ error: 'Order payout is frozen or reversed (open dispute) — resolve the dispute instead of issuing a manual refund' });
    }

    const paymentIntentId = refund.order?.stripe_payment_intent_id;
    if (!paymentIntentId) return res.status(400).json({ error: 'No Stripe payment intent on this order' });

    // Compute from the server-authoritative ORDER row (written by the Stripe
    // webhook), NOT the buyer-created refunds row, so the fee retention can't be
    // bypassed by zeroing commission_aud/gst_aud or inflating total_paid_aud.
    const retentionPct = Number(await getPlatformSetting('refund_fee_retention_pct', 50));
    const orderTotal = Number(refund.order?.total_aud);
    const totalCommission = Number(refund.order?.platform_fee_aud) || 0; // commission + GST
    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      return res.status(400).json({ error: 'Order total is missing or invalid' });
    }
    const retainedFee = Math.round(totalCommission * (retentionPct / 100) * 100) / 100;
    const refundAmount = Math.round((orderTotal - retainedFee) * 100) / 100;

    if (refundAmount <= 0) return res.status(400).json({ error: 'Calculated refund amount is zero or negative' });
    if (refundAmount > orderTotal) return res.status(400).json({ error: 'Refund exceeds order total' });

    const { data: claimed, error: claimErr } = await supabase
      .from('refunds')
      .update({ status: 'processing' })
      .eq('id', refundId)
      .eq('status', 'approved')
      .select('id');

    if (claimErr) return res.status(500).json({ error: 'Failed to claim refund' });
    if (!claimed || claimed.length === 0) {
      return res.status(409).json({ error: 'Refund is already being processed' });
    }

    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: { refundId, orderId: refund.order_id, retainedFee: String(retainedFee), retentionPct: String(retentionPct) },
        // Key idempotency on the ORDER, not the refund row. If two refund rows
        // ever exist for one order (a request-side TOCTOU) and both reach here
        // concurrently, an order-scoped key makes Stripe return the SAME refund
        // instead of issuing a second one — the buyer can't be refunded twice.
        // Refunds here are always full-order, so one refund per order is correct.
      }, { idempotencyKey: `refund_order_${refund.order_id}` });
    } catch (stripeErr) {
      await supabase.from('refunds').update({ status: 'approved' }).eq('id', refundId);
      throw stripeErr;
    }

    const now = new Date().toISOString();

    await supabase.from('refunds').update({
      status: 'processed',
      stripe_refund_id: stripeRefund.id,
      retained_fee_aud: retainedFee,
      refund_amount_aud: refundAmount,
      processed_at: now,
    }).eq('id', refundId);

    await supabase.from('orders').update({
      status: 'refunded',
      refund_status: 'processed',
    }).eq('id', refund.order_id);

    const reversal = await reverseSellerPayout(stripe, refund.order);
    if (reversal.action === 'transfer_reversed' || reversal.action === 'wallet_clawback') {
      await supabase.from('orders').update({ payout_status: 'reversed' }).eq('id', refund.order_id);
    }

    // Restore any wallet credit the buyer applied at checkout. It was debited
    // by the webhook on payment and is NOT part of the Stripe card refund above
    // (total_aud is the post-wallet-discount card charge), so without this the
    // buyer permanently lost that credit despite returning the goods.
    try {
      const sessionId = refund.order?.stripe_session_id;
      if (sessionId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const walletCents = parseInt(session.metadata?.walletCents || '0', 10) || 0;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (walletCents > 0 && customerId) {
          await creditWallet(stripe, customerId, walletCents, `Refund for order ${refund.order_id}`, `wallet-refund-${refundId}`);
          logger.info(`[STRIPE] Restored $${(walletCents / 100).toFixed(2)} wallet credit to customer ${customerId} for refunded order ${refund.order_id}`);
          if (refund.buyer_id) {
            await supabase.from('notifications').insert({
              user_id: refund.buyer_id,
              type: 'wallet_refund',
              title: 'Wallet Credit Restored',
              body: `$${(walletCents / 100).toFixed(2)} AUD you paid from your wallet has been returned to your wallet balance.`,
            });
          }
        }
      }
    } catch (walletErr) {
      logger.error(`[STRIPE] Failed to restore wallet credit for refund ${refundId}: ${walletErr.message} — restore manually`);
    }

    if (refund.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: refund.buyer_id,
        type: 'refund_processed',
        title: 'Refund Processed',
        body: `Your refund of $${refundAmount.toFixed(2)} AUD has been issued. Please allow 5-10 business days for it to appear on your statement.`,
      });
    }

    if (refund.seller_id) {
      await supabase.from('notifications').insert({
        user_id: refund.seller_id,
        type: 'refund_issued',
        title: 'Refund Issued on Your Sale',
        body: `A refund of $${refundAmount.toFixed(2)} AUD was issued to the buyer. The platform retained $${retainedFee.toFixed(2)} AUD in processing fees.`,
      });
    }

    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      refund.buyer_id ? supabase.from('profiles').select('email, display_name').eq('id', refund.buyer_id).maybeSingle() : { data: null },
      refund.seller_id ? supabase.from('profiles').select('email, display_name').eq('id', refund.seller_id).maybeSingle() : { data: null },
    ]);

    if (buyerProfile?.email) {
      await sendRefundProcessed({
        buyerEmail: buyerProfile.email,
        buyerName: buyerProfile.display_name || 'Collector',
        refundAmount,
        orderId: refund.order_id,
      });
    }

    if (sellerProfile?.email) {
      await sendRefundIssued({
        sellerEmail: sellerProfile.email,
        sellerName: sellerProfile.display_name || 'Collector',
        refundAmount,
        retainedFee,
        orderId: refund.order_id,
      });
    }

    logger.info(`[STRIPE] Refund processed: ${stripeRefund.id} — $${refundAmount} (retained $${retainedFee})`);
    res.json({ success: true, stripeRefundId: stripeRefund.id, refundAmount, retainedFee });
  } catch (err) {
    logger.error(`[STRIPE] /refund error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}
