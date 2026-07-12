import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendOrderConfirmed, sendItemSold } from '../utils/emailService.js';
import { payoutSeller } from './payoutService.js';
import { markWelcomeDiscountRedeemed } from './welcomeOfferService.js';
import { recordShopOrderReferral } from './partnerService.js';
import { debitWallet } from './walletService.js';
import { subscribeToNewsletter } from '../utils/newsletter.js';

async function getPlatformSetting(key, defaultValue) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value !== undefined ? data.value : defaultValue;
}

/**
 * Atomically claim a listing as sold.
 *
 * A listing is validated as 'active' when a checkout session is created, but two
 * buyers can create sessions for the same listing and both pay before either
 * webhook fires. Marking it sold with a plain `.eq('id', ...)` update lets both
 * orders confirm and both sellers get paid — the item is sold to two people.
 *
 * This flips the row active → sold in a single guarded statement and returns
 * whether THIS call won the race, so the caller can pay the seller / mark other
 * winners' orders for refund. A manual "mark as sold" from the vault also moves
 * the row to 'sold', so a later payment for it correctly loses the claim here.
 */
async function claimListingSold(listingId) {
  if (!listingId) return false;
  const { data, error } = await supabase
    .from('listings')
    .update({ status: 'sold', sold_at: new Date().toISOString() })
    .eq('id', listingId)
    .eq('status', 'active')
    .select('id');
  if (error) {
    logger.error(`[STRIPE] Failed to claim listing ${listingId} as sold: ${error.message}`);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * A buyer paid for a listing that was already sold to someone else. Their money
 * was captured, so alert admins to refund and let the buyer know it's coming.
 */
async function flagDoubleSale({ listingId, orderId, buyerId }) {
  logger.error(`[STRIPE] Double-sale detected on listing ${listingId} (order ${orderId || 'n/a'}) — buyer needs a refund`);

  const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
  if (admins?.length) {
    await supabase.from('notifications').insert(admins.map(a => ({
      user_id: a.id,
      type: 'order_double_sale',
      title: 'Double-sale needs a refund',
      body: `Listing ${listingId} sold twice (order ${orderId || 'n/a'}). The item was already claimed by an earlier buyer — refund this order.`,
    }))).catch(() => {});
  }

  if (buyerId) {
    await supabase.from('notifications').insert({
      user_id: buyerId,
      type: 'order_refund_pending',
      title: 'Refund on the way',
      body: 'The item you purchased had already sold to another buyer. Your payment will be refunded in full — no action needed.',
    }).catch(() => {});
  }
}

/**
 * Handle checkout.session.completed event
 * Processes both cart orders (pre-created 'pending') and single-item orders
 */
async function handleCheckoutSessionCompleted(session, stripe) {
  logger.info(`[STRIPE] checkout.session.completed: ${session.id}`);

  const { data: existing } = await supabase
    .from('orders')
    .select('id, status, total_aud, order_items, buyer_id, buyer_email, item_price_aud, gst_aud, platform_fee_aud, discount_aud, shipping_aud, created_at, shipping_name, shipping_address, shipping_suburb, shipping_state, shipping_postcode')
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

  // Payment completed — consume the welcome-offer discount, if one was applied.
  if (session.metadata?.welcomeOfferId) {
    await markWelcomeDiscountRedeemed(session.metadata.welcomeOfferId, existing.id);
  }

  // Payment completed — spend the wallet balance the buyer applied at checkout.
  // Only debited now (not when the session was created) so an abandoned
  // checkout never touches the balance.
  if (session.metadata?.walletCents) {
    const walletCents = parseInt(session.metadata.walletCents, 10) || 0;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (walletCents > 0 && customerId) {
      await debitWallet(stripe, customerId, walletCents, `Applied to order ${existing.id}`, `wallet-debit-${session.id}`)
        .catch(e => logger.error(`[WALLET] debit failed for order ${existing.id}: ${e.message}`));
    }
  }

  // Referred order: book the partner's commission (idempotent, best-effort).
  if (session.metadata?.partnerId) {
    await recordShopOrderReferral({
      partnerId: session.metadata.partnerId,
      orderId: existing.id,
      referredUserId: existing.buyer_id,
      orderLines: Array.isArray(existing.order_items) ? existing.order_items : [],
      discountCents: parseInt(session.metadata.partnerDiscountCents || '0', 10) || 0,
    });
  }

  const lines = Array.isArray(existing.order_items) ? existing.order_items : [];
  const sellerIds = new Set();
  const oversoldShopItems = [];

  for (const line of lines) {
    if (line.type === 'listing' && line.id) {
      // Only pay the seller if THIS order won the race to sell the item. If the
      // listing was already sold (another buyer or a manual vault mark), skip the
      // payout and flag it so the buyer gets refunded — never sell it twice.
      const claimed = await claimListingSold(line.id);
      if (!claimed) {
        await flagDoubleSale({ listingId: line.id, orderId: existing.id, buyerId: existing.buyer_id });
        continue;
      }
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

  // Buyer receipt. Registered buyers resolve their address from their profile;
  // guests have no profile, so we use the email captured at checkout (persisted
  // on the order, with the Stripe session details as a fallback).
  let receiptEmail = null;
  let receiptName = 'Collector';
  if (existing.buyer_id) {
    const { data: buyerProfile } = await supabase.from('profiles')
      .select('email, display_name').eq('id', existing.buyer_id).maybeSingle();
    receiptEmail = buyerProfile?.email || null;
    receiptName = buyerProfile?.display_name || 'Collector';
  } else {
    receiptEmail = existing.buyer_email || session.customer_details?.email || session.metadata?.guestEmail || null;
    receiptName = existing.shipping_name || session.customer_details?.name || 'Collector';
  }

  if (receiptEmail) {
    const itemCount = lines.reduce((n, l) => n + (l.quantity || 1), 0);
    // Build an itemised tax invoice from the persisted order so the emailed
    // receipt carries every figure the buyer saw at checkout — line items,
    // GST, discount, total — plus their business name and ABN when supplied.
    const invoiceItems = lines.map(l => ({
      name: l.title || l.name || l.card_name || 'Item',
      quantity: l.quantity || 1,
      total: Number(l.line_total_aud ?? l.price_aud ?? l.price ?? 0),
    }));
    await sendOrderConfirmed({
      buyerEmail: receiptEmail,
      buyerName: receiptName,
      cardName: `${itemCount} item${itemCount === 1 ? '' : 's'}`,
      itemPrice: Number(existing.item_price_aud ?? amountCents2 / 100),
      total: amountCents2 / 100,
      orderId: existing.id,
      invoice: {
        items: invoiceItems,
        subtotal: Number(existing.item_price_aud ?? 0),
        // platform_fee_aud bundles commission + GST; the service fee is the
        // commission portion, shown separately from GST to mirror checkout.
        serviceFee: Math.max(0, Number(existing.platform_fee_aud ?? 0) - Number(existing.gst_aud ?? 0)),
        gst: Number(existing.gst_aud ?? 0),
        shipping: Number(existing.shipping_aud ?? 0),
        discount: Number(existing.discount_aud ?? 0),
        total: amountCents2 / 100,
        // Read from the session metadata (set at checkout) so the invoice
        // doesn't depend on the billing_* columns having been migrated yet.
        businessName: session.metadata?.billingBusinessName || null,
        abn: session.metadata?.billingAbn || null,
        orderDate: existing.created_at || null,
        shipping: {
          name: existing.shipping_name || null,
          address: existing.shipping_address || null,
          suburb: existing.shipping_suburb || null,
          state: existing.shipping_state || null,
          postcode: existing.shipping_postcode || null,
        },
      },
    }).catch(e => logger.warn(`[STRIPE] cart confirm email failed: ${e.message}`));
  }

  // Newsletter opt-in taken at checkout (guest or registered). Fired only now
  // that payment completed. Best-effort: a Kit failure never affects the order.
  if (session.metadata?.subscribeNewsletter === 'true') {
    const subEmail = existing.buyer_email || session.customer_details?.email || session.metadata?.guestEmail || receiptEmail;
    if (subEmail) {
      const firstName = (existing.shipping_name || session.customer_details?.name || '').trim().split(/\s+/)[0] || undefined;
      await subscribeToNewsletter(subEmail, firstName)
        .catch(e => logger.warn(`[STRIPE] newsletter opt-in failed for order ${existing.id}: ${e.message}`));
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
  const discountAud = parseFloat(meta.discountAud || '0');
  const amountCents = session.amount_total || 0;

  if (![itemPrice, commissionAud, gstAud, discountAud].every(Number.isFinite)) {
    logger.error(`[STRIPE] Non-finite amount in metadata for session ${session.id} — order rejected`);
    return;
  }

  const expectedTotalCents = Math.round((itemPrice + commissionAud + gstAud - discountAud) * 100);
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
      discount_aud: discountAud,
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

  // Claim the listing atomically. If it was already sold (another buyer won the
  // race, or the seller manually marked it sold), don't sell it again: flag the
  // order for a refund and stop before paying the seller or emailing anyone.
  if (listingId) {
    const claimed = await claimListingSold(listingId);
    if (!claimed) {
      const { data: dupOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();
      await flagDoubleSale({ listingId, orderId: dupOrder?.id, buyerId: userId });
      return;
    }
  }

  // Payment completed — spend the wallet balance the buyer applied at checkout.
  // Only debited now (not when the session was created) so an abandoned
  // checkout never touches the balance.
  if (meta.walletCents) {
    const walletCents = parseInt(meta.walletCents, 10) || 0;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (walletCents > 0 && customerId) {
      await debitWallet(stripe, customerId, walletCents, `Applied to order for session ${session.id}`, `wallet-debit-${session.id}`)
        .catch(e => logger.error(`[WALLET] debit failed for session ${session.id}: ${e.message}`));
    }
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

  // Consume the welcome-offer discount only now that payment completed and the
  // sale is real (the double-sale refund path above leaves the code usable).
  if (meta.welcomeOfferId) {
    await markWelcomeDiscountRedeemed(meta.welcomeOfferId, orderId || null);
  }

  if (buyerProfile?.email) {
    await sendOrderConfirmed({
      buyerEmail: buyerProfile.email,
      buyerName: buyerProfile.display_name || 'Collector',
      cardName,
      itemPrice,
      total: amountCents / 100,
      orderId,
      // Itemised breakdown so the receipt shows the same service-fee + GST
      // commission structure the buyer saw at checkout.
      invoice: {
        items: [{ name: cardName || 'Trading Card', quantity: 1, total: itemPrice }],
        subtotal: itemPrice,
        serviceFee: commissionAud,
        gst: gstAud,
        discount: discountAud,
        total: amountCents / 100,
        businessName: null,
        abn: null,
        orderDate: null,
      },
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

/**
 * Handle checkout.session.expired.
 *
 * Cart checkouts pre-create a 'pending' order row keyed on stripe_session_id
 * (the snapshot the completed webhook confirms). If the buyer abandons the
 * hosted Checkout page, Stripe expires the session (~24h) but nothing ever
 * cleared that pending row — so abandoned carts accumulated as stale 'pending'
 * orders forever. (payment_intent.payment_failed can't clean these up: the
 * pending row has no payment_intent_id until the payment succeeds, so its
 * update matched zero rows.) This transitions pending → cancelled, guarded so
 * it can never touch an already-confirmed/shipped order. Single-item orders
 * don't exist until completion, so there's nothing to expire for them.
 */
async function handleCheckoutSessionExpired(session) {
  logger.info(`[STRIPE] checkout.session.expired: ${session.id}`);
  const { data: cancelled } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('stripe_session_id', session.id)
    .eq('status', 'pending')
    .select('id');
  if (cancelled?.length) {
    logger.info(`[STRIPE] Cancelled ${cancelled.length} stale pending order(s) for expired session ${session.id}`);
  }
}

export {
  handleCheckoutSessionCompleted,
  handlePaymentFailed,
  handleCheckoutSessionExpired,
  getPlatformSetting,
};
