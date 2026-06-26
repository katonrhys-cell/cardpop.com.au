import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Handles Stripe chargeback (dispute) webhooks. When a buyer disputes a charge
// with their bank, the platform can be left covering the loss if the seller was
// already paid. So on dispute open we FREEZE the order payout and, if the seller
// already received the money, reverse the Stripe transfer or claw back the wallet
// credit — then alert admins + the seller. Everything is best-effort and never
// throws, so a webhook is always ack'd (Stripe retries are for our 5xx, which we
// avoid here).

function paymentIntentId(dispute) {
  return typeof dispute.payment_intent === 'string'
    ? dispute.payment_intent
    : (dispute.payment_intent?.id ?? null);
}

async function notifyAdmins(title, body, extraUserIds = []) {
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    const ids = [...new Set([...(admins || []).map((a) => a.id), ...extraUserIds].filter(Boolean))];
    if (!ids.length) return;
    await supabase
      .from('notifications')
      .insert(ids.map((user_id) => ({ user_id, type: 'payment_dispute', title, body })))
      .catch(() => {});
  } catch (e) {
    logger.error(`[STRIPE DISPUTE] notify failed: ${e.message}`);
  }
}

export async function handleDisputeCreated(stripe, dispute) {
  try {
    const piId = paymentIntentId(dispute);
    const amountAud = (dispute.amount ?? 0) / 100;

    let order = null;
    if (piId) {
      const { data } = await supabase
        .from('orders')
        .select('id, seller_id, buyer_id, stripe_transfer_id, payout_status, seller_proceeds_aud')
        .eq('stripe_payment_intent_id', piId)
        .maybeSingle();
      order = data;
    }

    // No matching order — still record the dispute so it's visible to admins.
    if (!order) {
      logger.warn(`[STRIPE DISPUTE] No order found for dispute ${dispute.id} (pi=${piId})`);
      await supabase.from('payment_disputes').insert({
        stripe_dispute_id: dispute.id,
        stripe_payment_intent_id: piId,
        amount_aud: amountAud,
        reason: dispute.reason,
        status: dispute.status,
        payout_action: 'none',
      }).catch(() => {});
      await notifyAdmins('Chargeback opened (no matching order)',
        `A $${amountAud.toFixed(2)} AUD chargeback (dispute ${dispute.id}) has no matching order — investigate.`);
      return;
    }

    // Reverse / claw back the seller payout if it already went out.
    let payoutAction = 'none';
    try {
      if (order.payout_status === 'transferred' && order.stripe_transfer_id) {
        await stripe.transfers.createReversal(order.stripe_transfer_id);
        payoutAction = 'transfer_reversed';
        logger.warn(`[STRIPE DISPUTE] Reversed transfer ${order.stripe_transfer_id} for order ${order.id}`);
      } else if (order.payout_status === 'wallet_credited' && order.seller_id) {
        // Atomic clawback (negative delta, floored at 0 inside the RPC) — a
        // read-modify-write would race with a concurrent payout credit.
        await supabase.rpc('increment_wallet_balance', {
          p_user: order.seller_id,
          p_delta: -(Number(order.seller_proceeds_aud) || 0),
        });
        payoutAction = 'wallet_clawback';
        logger.warn(`[STRIPE DISPUTE] Clawed back $${order.seller_proceeds_aud} from seller ${order.seller_id}`);
      }
    } catch (e) {
      logger.error(`[STRIPE DISPUTE] Payout reversal failed for order ${order.id}: ${e.message}`);
    }

    // Freeze the order payout (existing column — keep the schema footprint small).
    await supabase.from('orders').update({ payout_status: 'frozen' }).eq('id', order.id);

    await supabase.from('payment_disputes').insert({
      order_id: order.id,
      stripe_dispute_id: dispute.id,
      stripe_payment_intent_id: piId,
      seller_id: order.seller_id,
      buyer_id: order.buyer_id,
      amount_aud: amountAud,
      reason: dispute.reason,
      status: dispute.status,
      payout_action: payoutAction,
    }).catch(() => {});

    await notifyAdmins(
      'Chargeback opened',
      `A $${amountAud.toFixed(2)} AUD chargeback was opened (dispute ${dispute.id}). Payout frozen pending review.`,
      order.seller_id ? [order.seller_id] : [],
    );
  } catch (err) {
    logger.error(`[STRIPE DISPUTE] handleDisputeCreated error: ${err.message}`);
  }
}

export async function handleDisputeClosed(_stripe, dispute) {
  try {
    await supabase
      .from('payment_disputes')
      .update({ status: dispute.status, updated_at: new Date().toISOString() })
      .eq('stripe_dispute_id', dispute.id);

    const outcome =
      dispute.status === 'won' ? 'won — funds returned to the platform'
      : dispute.status === 'lost' ? 'lost — funds withdrawn by the bank'
      : dispute.status;
    await notifyAdmins(
      `Chargeback ${dispute.status}`,
      `Dispute ${dispute.id} closed: ${outcome}. Review the order's frozen payout to release or keep it held.`,
    );
  } catch (err) {
    logger.error(`[STRIPE DISPUTE] handleDisputeClosed error: ${err.message}`);
  }
}
