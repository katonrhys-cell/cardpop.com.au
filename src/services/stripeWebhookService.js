import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendOrderConfirmed, sendItemSold } from '../utils/emailService.js';
import { payoutSeller } from './payoutService.js';

async function getPlatformSetting(key, defaultValue) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value !== undefined ? data.value : defaultValue;
}

/**
 * Handle checkout.session.completed event
 * Processes both cart orders (pre-created 'pending') and single-item orders
 */
async function handleCheckoutSessionCompleted(session, stripe) {
  logger.info(`[STRIPE] checkout.session.completed: ${session.id}`);

  const { data: existing } = await supabase
    .from('orders')
    .select('id, status, total_aud, order_items, buyer_id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();

  if (existing && existing.status !== 'pending') {
    logger.info(`[STRIPE] Order already processed for session ${session.id}, skipping`);
    return;
  }

  if (existing && existing.status === 'pending') {
    await handleCartOrder(existing, session, stripe);
    return;
  }

  await handleSingleItemOrder(session, stripe);
}

async function handleCartOrder(existing, session, stripe) {
  const amountCents = session.amount_total || 0;
  const expectedCents = Math.round(Number(existing.total_aud) * 100);
  if (Math.abs(amountCents - expectedCents) > 2) {
    logger.error(`[STRIPE] Cart amount mismatch for ${session.id}: Stripe=${amountCents}¢ expected=${expectedCents}¢ — marking failed`);
    await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', existing.id);
    return;
  }

  const cartPaymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

  const { data: claimed } = await supabase.from('orders')
    .update({ status: 'payment_confirmed', stripe_payment_intent_id: cartPaymentIntentId })
    .eq('id', existing.id)
    .eq('status', 'pending')
    .select('id');

  if (!claimed || claimed.length === 0) {
    logger.info(`[STRIPE] Cart order ${existing.id} already confirmed concurrently for session ${session.id}, skipping`);
    return;
  }

  const lines = Array.isArray(existing.order_items) ? existing.order_items : [];
  const sellerIds = new Set();
  const oversoldShopItems = [];

  for (const line of lines) {
    if (line.type === 'listing' && line.id) {
      await supabase.from('listings')
        .update({ status: 'sold', sold_at: new Date().toISOString() })
        .eq('id', line.id);
      if (line.seller_id) {
        sellerIds.add(line.seller_id);
        const proceeds = Number(line.line_total_aud || 0) - Number(line.commission_aud || 0);
        if (proceeds > 0) {
          await payoutSeller(stripe, { sellerId: line.seller_id, sellerProceeds: proceeds, listingId: line.id })
            .catch(e => logger.error(`[STRIPE] cart payout failed for seller ${line.seller_id}: ${e.message}`));
        }
      }
    } else if (line.type === 'shop' && line.id) {
      const { data: ok } = await supabase.rpc('decrement_shop_stock', { p_id: line.id, p_qty: line.quantity || 1 });
      if (ok === false) {
        oversoldShopItems.push(line);
        logger.error(`[STRIPE] Oversell on shop product ${line.id} (qty ${line.quantity || 1}) for order ${existing.id} — needs manual resolution`);
      }
    }
  }

  if (oversoldShopItems.length > 0) {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (admins?.length) {
      await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'order_oversold',
        title: 'Oversold order needs attention',
        body: `Order ${existing.id} has ${oversoldShopItems.length} shop item(s) that exceeded available stock. Refund or restock.`,
      }))).catch(() => {});
    }
  }

  const amountCents2 = session.amount_total || 0;
  if (existing.buyer_id) {
    await supabase.from('notifications').insert({
      user_id: existing.buyer_id,
      type: 'order_confirmed',
      title: 'Order Confirmed',
      body: `Your payment of $${(amountCents2 / 100).toFixed(2)} AUD was successful.`,
    });
  }
  for (const sid of sellerIds) {
    await supabase.from('notifications').insert({
      user_id: sid, type: 'item_sold', title: 'Item Sold!',
      body: 'One of your listings sold through a cart checkout.',
    });
  }

  if (existing.buyer_id) {
    const { data: buyerProfile } = await supabase.from('profiles')
      .select('email, display_name').eq('id', existing.buyer_id).maybeSingle();
    if (buyerProfile?.email) {
      const itemCount = lines.reduce((n, l) => n + (l.quantity || 1), 0);
      await sendOrderConfirmed({
        buyerEmail: buyerProfile.email,
        buyerName: buyerProfile.display_name || 'Collector',
        cardName: `${itemCount} item${itemCount === 1 ? '' : 's'}`,
        itemPrice: amountCents2 / 100,
        total: amountCents2 / 100,
        orderId: existing.id,
      }).catch(e => logger.warn(`[STRIPE] cart confirm email failed: ${e.message}`));
    }
  }

  logger.info(`[STRIPE] Cart order ${existing.id} confirmed for session ${session.id}`);
}

async function handleSingleItemOrder(session, stripe) {
  const meta = session.metadata || {};
  const userId = meta.userId || null;
  const listingId = meta.listingId || null;
  const sellerId = meta.sellerId || null;
  const transactionType = meta.transactionType || 'fixed';
  const itemPrice = parseFloat(meta.itemPrice || '0');
  const commissionPct = parseFloat(meta.commissionPct || '0');
  const commissionAud = parseFloat(meta.commissionAud || '0');
  const gstAud = parseFloat(meta.gstAud || '0');
  const sellerProceeds = parseFloat(meta.sellerProceedsAud || String(itemPrice - commissionAud));
  const configId = meta.configId || null;
  const amountCents = session.amount_total || 0;

  if (![itemPrice, commissionAud, gstAud].every(Number.isFinite)) {
    logger.error(`[STRIPE] Non-finite amount in metadata for session ${session.id} — order rejected`);
    return;
  }

  const expectedTotalCents = Math.round((itemPrice + commissionAud + gstAud) * 100);
  if (Math.abs(amountCents - expectedTotalCents) > 2) {
    logger.error(`[STRIPE] Amount mismatch for session ${session.id}: Stripe=${amountCents}¢ expected=${expectedTotalCents}¢ — order rejected`);
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

  const { error: insertError } = await supabase
    .from('orders')
    .insert({
      buyer_id: userId,
      seller_id: sellerId,
      listing_id: listingId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      total_aud: amountCents / 100,
      item_price_aud: itemPrice,
      shipping_aud: 0,
      platform_fee_aud: commissionAud + gstAud,
      commission_pct: commissionPct,
      gst_aud: gstAud,
      seller_proceeds_aud: sellerProceeds,
      transaction_type: transactionType,
      commission_config_id: configId || null,
      status: 'payment_confirmed',
      buyer_protection: true,
      shipping_name: meta.shippingName || session.customer_details?.name || null,
      shipping_address: meta.shippingAddress || session.shipping_details?.address?.line1 || null,
      shipping_suburb: meta.shippingSuburb || session.shipping_details?.address?.city || null,
      shipping_state: meta.shippingState || session.shipping_details?.address?.state || null,
      shipping_postcode: meta.shippingPostcode || session.shipping_details?.address?.postal_code || null,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      logger.info(`[STRIPE] Order for session ${session.id} already inserted concurrently, skipping`);
      return;
    }
    logger.error(`[STRIPE] Order insert failed: ${insertError.message}`);
    throw insertError;
  }

  if (listingId) {
    await supabase
      .from('listings')
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .eq('id', listingId);
  }

  if (meta.offerId) {
    await supabase
      .from('offers')
      .update({ status: 'accepted' })
      .eq('id', meta.offerId);
  }

  if (userId) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'order_confirmed',
      title: 'Order Confirmed',
      body: `Your payment of $${(amountCents / 100).toFixed(2)} AUD was successful.`,
    });
  }

  if (sellerId) {
    await supabase.from('notifications').insert({
      user_id: sellerId,
      type: 'item_sold',
      title: 'Item Sold!',
      body: `Your listing sold for $${itemPrice.toFixed(2)} AUD. You'll receive $${sellerProceeds.toFixed(2)} after fees.`,
    });
  }

  const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
    userId ? supabase.from('profiles').select('email, display_name').eq('id', userId).maybeSingle() : { data: null },
    sellerId ? supabase.from('profiles').select('email, display_name').eq('id', sellerId).maybeSingle() : { data: null },
  ]);

  let cardName = meta.cardName || '';
  if (!cardName && listingId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('title, vault_item:vault_items!vault_item_id(card_name)')
      .eq('id', listingId)
      .maybeSingle();
    cardName = listing?.vault_item?.card_name || listing?.title || 'Trading Card';
  }

  const { data: newOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  const orderId = newOrder?.id;

  if (buyerProfile?.email) {
    await sendOrderConfirmed({
      buyerEmail: buyerProfile.email,
      buyerName: buyerProfile.display_name || 'Collector',
      cardName,
      itemPrice,
      total: amountCents / 100,
      orderId,
    });
  }

  if (sellerProfile?.email) {
    await sendItemSold({
      sellerEmail: sellerProfile.email,
      sellerName: sellerProfile.display_name || 'Collector',
      cardName,
      itemPrice,
      commissionAud,
      gstAud,
      sellerProceeds,
      orderId,
    });
  }

  if (sellerId && sellerProceeds > 0) {
    await payoutSeller(stripe, {
      sellerId,
      sellerProceeds,
      orderId: newOrder?.id || null,
      listingId,
    });
  }

  logger.info(`[STRIPE] Order recorded for session ${session.id} — commission: $${commissionAud} (${commissionPct}%)`);
}

async function handlePaymentFailed(paymentIntent) {
  logger.warn(`[STRIPE] Payment failed: ${paymentIntent.id}`);
  await supabase
    .from('orders')
    .update({ status: 'payment_failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

export {
  handleCheckoutSessionCompleted,
  handlePaymentFailed,
  getPlatformSetting,
};
