import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Pay a seller their proceeds for an order. Used both when an order is first
// confirmed (Stripe webhook) and when an admin releases a payout that was frozen
// by a chargeback that ultimately resolved in the seller's favour.
//
// Behaviour (unchanged from the original inline webhook logic):
//   - Connected + onboarded seller → Stripe Connect transfer; on failure, fall
//     back to crediting their CardPop wallet.
//   - Otherwise → credit their CardPop wallet.
// When an orderId is given, the order's payout_status (and transfer id) is
// updated to match.
//
// idempotencyKey (optional) is passed to Stripe on the Connect transfer, so a
// repeated call for the same payout (e.g. an admin releasing a dispute twice)
// returns the original transfer instead of sending the money again. Omitted, the
// transfer is created exactly as before.
//
// @returns {Promise<{ status: 'transferred'|'wallet_credited'|'failed'|'none', transferId?: string, fallback?: boolean }>}
export async function payoutSeller(stripe, { sellerId, sellerProceeds, orderId = null, listingId = null, idempotencyKey = null }) {
  if (!sellerId || !(Number(sellerProceeds) > 0)) {
    return { status: 'none' };
  }

  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded')
    .eq('id', sellerId)
    .maybeSingle();

  const creditWallet = async () => {
    // Atomic increment via RPC — a read-modify-write here would lose updates when
    // two payouts (or a payout and a clawback) run concurrently.
    const { error: rpcErr } = await supabase.rpc('increment_wallet_balance', { p_user: sellerId, p_delta: Number(sellerProceeds) });
    if (rpcErr) {
      // supabase-js doesn't throw — without this check a failed credit was
      // silently swallowed and the order still got stamped wallet_credited,
      // so nothing would ever retry it and the seller's money vanished.
      logger.error(`[PAYOUT] Wallet credit of $${sellerProceeds} to seller ${sellerId} FAILED: ${rpcErr.message} (order ${orderId || 'n/a'}) — needs manual payout`);
      if (orderId) {
        await supabase.from('orders').update({ payout_status: 'failed' }).eq('id', orderId);
      }
      await notifyAdminsPayoutFailure({ sellerId, sellerProceeds, orderId, reason: rpcErr.message });
      return { status: 'failed' };
    }
    if (orderId) {
      await supabase.from('orders').update({ payout_status: 'wallet_credited' }).eq('id', orderId);
    }
    return { status: 'wallet_credited' };
  };

  if (sellerProfile?.stripe_connect_account_id && sellerProfile?.stripe_connect_onboarded) {
    try {
      const transferParams = {
        amount: Math.round(Number(sellerProceeds) * 100), // cents
        currency: 'aud',
        destination: sellerProfile.stripe_connect_account_id,
        metadata: { order_id: orderId || '', listing_id: listingId || '', seller_id: sellerId },
      };
      const transfer = idempotencyKey
        ? await stripe.transfers.create(transferParams, { idempotencyKey })
        : await stripe.transfers.create(transferParams);
      logger.info(`[PAYOUT] Transfer ${transfer.id} → $${sellerProceeds} AUD to ${sellerProfile.stripe_connect_account_id}`);
      if (orderId) {
        await supabase
          .from('orders')
          .update({ stripe_transfer_id: transfer.id, payout_status: 'transferred' })
          .eq('id', orderId);
      }
      return { status: 'transferred', transferId: transfer.id };
    } catch (transferErr) {
      logger.error(`[PAYOUT] Transfer failed: ${transferErr.message} — crediting wallet instead`);
      const credited = await creditWallet();
      return { ...credited, fallback: true };
    }
  }

  const credited = await creditWallet();
  if (credited.status === 'wallet_credited') {
    logger.info(`[PAYOUT] Seller ${sellerId} not connected — credited wallet $${sellerProceeds} AUD`);
  }
  return credited;
}

async function notifyAdminsPayoutFailure({ sellerId, sellerProceeds, orderId, reason }) {
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (!admins?.length) return;
    await supabase.from('notifications').insert(admins.map(a => ({
      user_id: a.id,
      type: 'payout_failed',
      title: 'Seller payout failed',
      body: `Wallet credit of $${Number(sellerProceeds).toFixed(2)} AUD to seller ${sellerId} failed (order ${orderId || 'n/a'}): ${reason}. Pay out manually.`,
    })));
  } catch (e) {
    logger.error(`[PAYOUT] failed to notify admins of payout failure: ${e.message}`);
  }
}

// Reverse a seller payout that already went out — used when a buyer is refunded
// or wins a chargeback, so the platform isn't left covering the loss. Reverses
// the Stripe Connect transfer, or claws the proceeds back from the seller's
// wallet, depending on how they were paid. Best-effort; does NOT change the
// order's payout_status (the caller owns that, since 'refunded' vs 'frozen'
// differs by context).
//
// Single-item orders record their payout on the order row itself
// (payout_status / stripe_transfer_id / seller_proceeds_aud). Cart orders can
// span multiple sellers, so the webhook records each line's payout inside the
// order_items JSON (line.payout) — reversed line by line here.
//
// @param order { id, seller_id, stripe_transfer_id, payout_status, seller_proceeds_aud, order_items? }
// @returns {Promise<{ action: 'transfer_reversed'|'wallet_clawback'|'none'|'failed' }>}
export async function reverseSellerPayout(stripe, order) {
  if (!order) return { action: 'none' };

  // Cart order: reverse every recorded per-line payout.
  const lines = Array.isArray(order.order_items) ? order.order_items : [];
  const paidLines = lines.filter(l => l?.payout && ['transferred', 'wallet_credited'].includes(l.payout.status));
  if (paidLines.length > 0) {
    let reversed = 0;
    let clawedBack = 0;
    let failed = 0;
    for (const line of paidLines) {
      const result = await reverseOnePayout(stripe, {
        orderId: order.id,
        sellerId: line.seller_id,
        payoutStatus: line.payout.status,
        transferId: line.payout.transferId || null,
        proceeds: Number(line.payout.proceeds) || 0,
      });
      if (result === 'transfer_reversed') reversed += 1;
      else if (result === 'wallet_clawback') clawedBack += 1;
      else if (result === 'failed') failed += 1;
    }
    if (failed > 0 && reversed + clawedBack === 0) return { action: 'failed' };
    if (reversed + clawedBack === 0) return { action: 'none' };
    return { action: reversed > 0 ? 'transfer_reversed' : 'wallet_clawback' };
  }

  const result = await reverseOnePayout(stripe, {
    orderId: order.id,
    sellerId: order.seller_id,
    payoutStatus: order.payout_status,
    transferId: order.stripe_transfer_id || null,
    proceeds: Number(order.seller_proceeds_aud) || 0,
  });
  return { action: result };
}

async function reverseOnePayout(stripe, { orderId, sellerId, payoutStatus, transferId, proceeds }) {
  try {
    if (payoutStatus === 'transferred' && transferId) {
      await stripe.transfers.createReversal(transferId);
      logger.warn(`[PAYOUT] Reversed transfer ${transferId} for order ${orderId}`);
      return 'transfer_reversed';
    }
    if (payoutStatus === 'wallet_credited' && sellerId && proceeds > 0) {
      // Atomic clawback (negative delta, floored at 0 inside the RPC) — a
      // read-modify-write would race with a concurrent payout credit.
      const { error: rpcErr } = await supabase.rpc('increment_wallet_balance', {
        p_user: sellerId,
        p_delta: -proceeds,
      });
      if (rpcErr) {
        logger.error(`[PAYOUT] Wallet clawback of $${proceeds} from seller ${sellerId} FAILED: ${rpcErr.message} (order ${orderId})`);
        return 'failed';
      }
      logger.warn(`[PAYOUT] Clawed back $${proceeds} from seller ${sellerId}`);
      return 'wallet_clawback';
    }
    return 'none';
  } catch (e) {
    logger.error(`[PAYOUT] reverseSellerPayout failed for order ${orderId}: ${e.message}`);
    return 'failed';
  }
}
