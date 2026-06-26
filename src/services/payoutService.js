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
