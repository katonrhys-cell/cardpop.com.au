import supabase from '../utils/supabaseClient.js';
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
// @returns {Promise<{ status: 'transferred'|'wallet_credited'|'none', transferId?: string, fallback?: boolean }>}
export async function payoutSeller(stripe, { sellerId, sellerProceeds, orderId = null, listingId = null }) {
  if (!sellerId || !(Number(sellerProceeds) > 0)) {
    return { status: 'none' };
  }

  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded, wallet_balance_aud')
    .eq('id', sellerId)
    .maybeSingle();

  const creditWallet = async () => {
    const currentBalance = Number(sellerProfile?.wallet_balance_aud) || 0;
    await supabase
      .from('profiles')
      .update({ wallet_balance_aud: currentBalance + Number(sellerProceeds) })
      .eq('id', sellerId);
    if (orderId) {
      await supabase.from('orders').update({ payout_status: 'wallet_credited' }).eq('id', orderId);
    }
  };

  if (sellerProfile?.stripe_connect_account_id && sellerProfile?.stripe_connect_onboarded) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(sellerProceeds) * 100), // cents
        currency: 'aud',
        destination: sellerProfile.stripe_connect_account_id,
        metadata: { order_id: orderId || '', listing_id: listingId || '', seller_id: sellerId },
      });
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
      await creditWallet();
      return { status: 'wallet_credited', fallback: true };
    }
  }

  await creditWallet();
  logger.info(`[PAYOUT] Seller ${sellerId} not connected — credited wallet $${sellerProceeds} AUD`);
  return { status: 'wallet_credited' };
}

// Reverse a seller payout that already went out — used when a buyer is refunded
// or wins a chargeback, so the platform isn't left covering the loss. Reverses
// the Stripe Connect transfer, or claws the proceeds back from the seller's
// wallet, depending on how they were paid. Best-effort; does NOT change the
// order's payout_status (the caller owns that, since 'refunded' vs 'frozen'
// differs by context).
//
// @param order { id, seller_id, stripe_transfer_id, payout_status, seller_proceeds_aud }
// @returns {Promise<{ action: 'transfer_reversed'|'wallet_clawback'|'none'|'failed' }>}
export async function reverseSellerPayout(stripe, order) {
  if (!order) return { action: 'none' };
  try {
    if (order.payout_status === 'transferred' && order.stripe_transfer_id) {
      await stripe.transfers.createReversal(order.stripe_transfer_id);
      logger.warn(`[PAYOUT] Reversed transfer ${order.stripe_transfer_id} for order ${order.id}`);
      return { action: 'transfer_reversed' };
    }
    if (order.payout_status === 'wallet_credited' && order.seller_id) {
      const { data: sp } = await supabase
        .from('profiles').select('wallet_balance_aud').eq('id', order.seller_id).maybeSingle();
      const newBalance = Math.max(0, (Number(sp?.wallet_balance_aud) || 0) - (Number(order.seller_proceeds_aud) || 0));
      await supabase.from('profiles').update({ wallet_balance_aud: newBalance }).eq('id', order.seller_id);
      logger.warn(`[PAYOUT] Clawed back $${order.seller_proceeds_aud} from seller ${order.seller_id}`);
      return { action: 'wallet_clawback' };
    }
    return { action: 'none' };
  } catch (e) {
    logger.error(`[PAYOUT] reverseSellerPayout failed for order ${order?.id}: ${e.message}`);
    return { action: 'failed' };
  }
}
