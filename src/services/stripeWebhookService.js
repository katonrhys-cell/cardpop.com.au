import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendOrderConfirmed, sendItemSold, sendOrderAdminNotice } from '../utils/emailService.js';
import { getAdminNotificationEmail } from '../utils/adminNotificationRecipient.js';
import { payoutSeller } from './payoutService.js';
import { markWelcomeDiscountRedeemed, releaseWelcomeDiscount } from './welcomeOfferService.js';
import { recordShopOrderReferral } from './partnerService.js';
import { debitWalletForOrder, releaseWalletCheckout } from './walletService.js';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { namesMatch } from './identityService.js';

/**
 * Informational cross-check: does the name the buyer typed at Stripe Checkout
 * differ from their account name? Stripe does NOT verify customer_details.name,
 * and paying with a partner's or work card is perfectly normal — so this is
 * stored on the order for the admin order detail view and never gates anything.
 * Returns null (unknown) for guests, missing names, or lookup failures.
 */
export async function computePayerNameMismatch(buyerId, payerName) {
  if (!buyerId || !payerName?.trim()) return null;
  try {
    const { data: buyer } = await supabase
      .from('profiles')
      .select('display_name, legal_name')
      .eq('id', buyerId)
      .maybeSingle();
    const accountName = buyer?.legal_name || buyer?.display_name;
    if (!accountName) return null;
    return !namesMatch(accountName, payerName);
  } catch {
    return null;
  }
}

async function getPlatformSetting(key, defaultValue) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value !== undefined ? data.value : defaultValue;
}

// Email the admin notification inbox about a confirmed order. Best-effort — a
// mail failure must never re-throw and turn a fulfilled order into a webhook 500
// (which Stripe would retry). Recipient is resolved from the admin Settings page
// (dedicated Notification Email, then Contact Email, then a default inbox).
async function notifyAdminOfOrder({ orderId, buyerName, buyerEmail, total, itemsSummary, sellerName }) {
  try {
    const to = await getAdminNotificationEmail();
    await sendOrderAdminNotice({ to, orderId, buyerName, buyerEmail, total, itemsSummary, sellerName });
  } catch (e) {
    logger.warn(`[STRIPE] admin order notice failed for order ${orderId || 'n/a'}: ${e.message}`);
  }
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
    }))).then(() => {}, () => {});
  }

  if (buyerId) {
    await supabase.from('notifications').insert({
      user_id: buyerId,
      type: 'order_refund_pending',
      title: 'Refund on the way',
      body: 'The item you purchased had already sold to another buyer. Your payment will be refunded in full — no action needed.',
    }).then(() => {}, () => {});
  }
}

/**
 * The amount Stripe actually charged doesn't match the order total we computed.
 * checkout.session.completed means the money was already captured, so refund it
 * and alert admins (and the buyer). Amounts are server-derived, so this should
 * never fire for a legitimate order — a hit is a genuine anomaly, and the old
 * behaviour (mark failed / silently return) left the buyer charged with no
 * refund and no alert.
 */
async function flagAmountMismatch({ stripe, session, orderId, buyerId, amountCents, expectedCents }) {
  logger.error(`[STRIPE] Amount mismatch on session ${session.id}: charged ${amountCents}¢ vs expected ${expectedCents}¢ (order ${orderId || 'n/a'}) — refunding`);

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
  if (paymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch (e) {
      logger.error(`[STRIPE] Auto-refund failed for mismatched session ${session.id}: ${e.message} — needs manual refund`);
    }
  }

  // Best-effort notifications — never let a notify failure re-throw and turn a
  // handled mismatch into a webhook 500 (which Stripe would retry).
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (admins?.length) {
      await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'order_amount_mismatch',
        title: 'Payment amount mismatch — auto-refunded',
        body: `Session ${session.id} charged $${(amountCents / 100).toFixed(2)} but expected $${(expectedCents / 100).toFixed(2)} (order ${orderId || 'n/a'}). An automatic refund was attempted — verify it settled.`,
      })));
    }
    if (buyerId) {
      await supabase.from('notifications').insert({
        user_id: buyerId,
        type: 'order_refund_pending',
        title: 'Refund on the way',
        body: 'We hit a problem confirming your order total, so your payment is being refunded in full — no action needed.',
      });
    }
  } catch (e) {
    logger.warn(`[STRIPE] mismatch notification failed for session ${session.id}: ${e.message}`);
  }
}

/**
 * Save the buyer's shipping address to their address book so their next
 * checkout is prefilled. Only runs when the buyer opted in at checkout
 * (metadata.saveShippingAddress) and for a signed-in buyer (guests have no
 * account). Best-effort and idempotent: a duplicate of an address they already
 * have is skipped, and any failure is swallowed — persisting an address must
 * never turn a fulfilled order into a webhook 500.
 */
async function saveBuyerShippingAddress(order) {
  try {
    const userId = order?.buyer_id;
    const line1 = order?.shipping_address?.trim();
    if (!userId || !line1) return;

    const { data: existing } = await supabase
      .from('shipping_addresses')
      .select('id, address_line1, postcode')
      .eq('user_id', userId);

    const rows = Array.isArray(existing) ? existing : [];
    const norm = (s) => String(s || '').trim().toLowerCase();
    const dup = rows.some(r => norm(r.address_line1) === norm(line1) && norm(r.postcode) === norm(order.shipping_postcode));
    if (dup) return;

    await supabase.from('shipping_addresses').insert({
      user_id:       userId,
      label:         'Home',
      full_name:     order.shipping_name ? String(order.shipping_name).slice(0, 100) : null,
      address_line1: String(line1).slice(0, 200),
      suburb:        order.shipping_suburb ? String(order.shipping_suburb).slice(0, 100) : null,
      state:         order.shipping_state ? String(order.shipping_state).slice(0, 50) : null,
      postcode:      order.shipping_postcode ? String(order.shipping_postcode).slice(0, 10) : null,
      country:       'AU',
      // First saved address becomes the default that prefills next time.
      is_default:    rows.length === 0,
    });
  } catch (e) {
    logger.warn(`[STRIPE] Could not save shipping address for buyer ${order?.buyer_id || 'n/a'}: ${e.message}`);
  }
}

/**
 * Handle checkout.session.completed event
 * Processes both cart orders (pre-created 'pending') and single-item orders
 */
async function handleCheckoutSessionCompleted(session, stripe) {
  logger.info(`[STRIPE] checkout.session.completed: ${session.id} (payment_status=${session.payment_status ?? 'n/a'})`);

  // Delayed/asynchronous payment methods fire checkout.session.completed while
  // the payment is still 'unpaid'/'processing'; it settles later via
  // checkout.session.async_payment_succeeded (which routes back here). Only
  // fulfil once actually paid, so we never claim the listing, decrement stock,
  // pay the seller or email a receipt for money that was never captured.
  // (payment_status is absent in older API versions / unit tests → treat as paid
  // to preserve existing behaviour.)
  if (session.payment_status && session.payment_status !== 'paid') {
    logger.info(`[STRIPE] Session ${session.id} not paid yet (payment_status=${session.payment_status}) — deferring fulfilment`);
    return;
  }

  const baseCols = 'id, status, total_aud, order_items, buyer_id, buyer_email, item_price_aud, gst_aud, platform_fee_aud, discount_aud, shipping_aud, created_at, shipping_name, shipping_address, shipping_suburb, shipping_state, shipping_postcode';
  let { data: existing, error: existingErr } = await supabase
    .from('orders')
    .select(`${baseCols}, gst_included_aud`)
    .eq('stripe_session_id', session.id)
    .maybeSingle();

  // gst_included_aud lands with its migration, but a redeploy can briefly race
  // ahead of `supabase db push`. If the column isn't there yet, fall back to the
  // base columns so fulfilment (and the receipt) keep working during the window.
  if (existingErr?.code === '42703') {
    ({ data: existing, error: existingErr } = await supabase
      .from('orders')
      .select(baseCols)
      .eq('stripe_session_id', session.id)
      .maybeSingle());
  }

  // A transient DB error must NOT be mistaken for "no order found" — that would
  // route a cart session into the single-item path (and reject it). Throw so the
  // webhook returns 500 and Stripe retries rather than silently 200-ing.
  if (existingErr) throw new Error(`Order lookup failed for session ${session.id}: ${existingErr.message}`);

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
    await flagAmountMismatch({ stripe, session, orderId: existing.id, buyerId: existing.buyer_id, amountCents, expectedCents });
    return;
  }

  const cartPaymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

  const payerNameMismatch = await computePayerNameMismatch(existing.buyer_id, session.customer_details?.name);

  const { data: claimed, error: claimErr } = await supabase.from('orders')
    .update({ status: 'payment_confirmed', stripe_payment_intent_id: cartPaymentIntentId, payer_name_mismatch: payerNameMismatch })
    .eq('id', existing.id)
    .eq('status', 'pending')
    .select('id');

  // Throw on a real error so Stripe retries; only treat a genuine empty result
  // (no error, zero rows) as "already confirmed by a concurrent delivery".
  if (claimErr) throw new Error(`Cart confirm CAS failed for session ${session.id}: ${claimErr.message}`);

  if (!claimed || claimed.length === 0) {
    logger.info(`[STRIPE] Cart order ${existing.id} already confirmed concurrently for session ${session.id}, skipping`);
    return;
  }

  // Buyer opted to save this address to their account — persist it now that the
  // order is confirmed (best-effort; never blocks fulfilment).
  if (session.metadata?.saveShippingAddress === 'true') {
    await saveBuyerShippingAddress(existing);
  }

  // (The welcome-offer discount is consumed AFTER the lines are processed —
  // see below — so a cart that turns out to be entirely a double-sale, and is
  // fully refunded, doesn't burn the buyer's one-time code. Mirrors the
  // single-item path.)

  // Payment completed — spend the wallet balance the buyer applied at checkout.
  // Only debited now (not when the session was created) so an abandoned
  // checkout never touches the balance.
  if (session.metadata?.walletCents) {
    const walletCents = parseInt(session.metadata.walletCents, 10) || 0;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (walletCents > 0 && customerId) {
      await debitWalletForOrder(stripe, customerId, walletCents, `Applied to order ${existing.id}`, `wallet-debit-${session.id}`)
        .catch(e => logger.error(`[WALLET] debit failed for order ${existing.id}: ${e.message}`));
      // Free the buyer's wallet-checkout slot now the session is done.
      await releaseWalletCheckout(session.metadata?.userId);
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
  let payoutsRecorded = false;
  let fulfilledLines = 0;

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
      fulfilledLines += 1;
      if (line.seller_id) {
        sellerIds.add(line.seller_id);
        const proceeds = Number(line.line_total_aud || 0) - Number(line.commission_aud || 0);
        if (proceeds > 0) {
          // Record the payout on the line itself (a cart can span multiple
          // sellers, so the order-level payout columns can't hold it) —
          // without this, refunds/chargebacks on cart orders had nothing to
          // reverse and the seller kept the proceeds while the buyer was
          // repaid from platform funds.
          const payout = await payoutSeller(stripe, { sellerId: line.seller_id, sellerProceeds: proceeds, listingId: line.id })
            .catch(e => {
              logger.error(`[STRIPE] cart payout failed for seller ${line.seller_id}: ${e.message}`);
              return { status: 'failed' };
            });
          line.payout = { status: payout.status, transferId: payout.transferId || null, proceeds };
          payoutsRecorded = true;
        }
      }
    } else if (line.type === 'shop' && line.id) {
      // An RPC *error* must not count as fulfilled: data is null on error, so
      // checking only `ok === false` would silently skip the stock decrement
      // and the oversold alert while the buyer is charged. Treat errors like
      // an oversell — flagged for manual resolution.
      const { data: ok, error: stockErr } = await supabase.rpc('decrement_shop_stock', { p_id: line.id, p_qty: line.quantity || 1 });
      if (stockErr || ok === false) {
        oversoldShopItems.push(line);
        logger.error(`[STRIPE] ${stockErr ? `Stock decrement failed (${stockErr.message})` : 'Oversell'} on shop product ${line.id} (qty ${line.quantity || 1}) for order ${existing.id} — needs manual resolution`);
      } else {
        fulfilledLines += 1;
      }
    }
  }

  // Consume the welcome-offer discount only now that at least one line
  // actually sold — a cart that was entirely a double-sale gets fully
  // refunded, so its one-time code stays usable (mirrors the single-item path).
  if (session.metadata?.welcomeOfferId && fulfilledLines > 0) {
    await markWelcomeDiscountRedeemed(session.metadata.welcomeOfferId, existing.id);
  }

  // Persist the per-line payout records so refunds/disputes can reverse them.
  if (payoutsRecorded) {
    const { error: linesErr } = await supabase.from('orders')
      .update({ order_items: lines })
      .eq('id', existing.id);
    if (linesErr) {
      logger.error(`[STRIPE] Failed to persist payout records on cart order ${existing.id}: ${linesErr.message}`);
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
      }))).then(() => {}, () => {});
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
        // gst is GST added on top (listings); gstIncluded is GST already inside
        // the GST-inclusive shop prices + shipping (shown as an "includes GST"
        // note rather than an added row).
        gst: Number(existing.gst_aud ?? 0),
        gstIncluded: Number(existing.gst_included_aud ?? 0),
        shipping: Number(existing.shipping_aud ?? 0),
        discount: Number(existing.discount_aud ?? 0),
        total: amountCents2 / 100,
        // Read from the session metadata (set at checkout) so the invoice
        // doesn't depend on the billing_* columns having been migrated yet.
        businessName: session.metadata?.billingBusinessName || null,
        abn: session.metadata?.billingAbn || null,
        orderDate: existing.created_at || null,
        // Named shippingAddress: a second `shipping` key here silently
        // overwrote the shipping *amount* above, dropping the Shipping row
        // from the emailed tax invoice so its lines didn't sum to the total.
        shippingAddress: {
          name: existing.shipping_name || null,
          address: existing.shipping_address || null,
          suburb: existing.shipping_suburb || null,
          state: existing.shipping_state || null,
          postcode: existing.shipping_postcode || null,
        },
      },
    }).catch(e => logger.warn(`[STRIPE] cart confirm email failed: ${e.message}`));
  }

  // Admin heads-up for the confirmed order (every order, buyer email or not).
  {
    const itemCount = lines.reduce((n, l) => n + (l.quantity || 1), 0);
    const names = lines.map(l => l.title || l.name || l.card_name).filter(Boolean);
    const itemsSummary = names.length
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} — ${names.slice(0, 5).join(', ')}${names.length > 5 ? ', …' : ''}`
      : `${itemCount} item${itemCount === 1 ? '' : 's'}`;
    await notifyAdminOfOrder({
      orderId: existing.id,
      buyerName: receiptName,
      buyerEmail: receiptEmail,
      total: amountCents2 / 100,
      itemsSummary,
    });
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
    await flagAmountMismatch({ stripe, session, orderId: null, buyerId: userId, amountCents, expectedCents: expectedTotalCents });
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

  const payerNameMismatch = await computePayerNameMismatch(userId, session.customer_details?.name);

  const { error: insertError } = await supabase
    .from('orders')
    .insert({
      buyer_id: userId,
      payer_name_mismatch: payerNameMismatch,
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
      await debitWalletForOrder(stripe, customerId, walletCents, `Applied to order for session ${session.id}`, `wallet-debit-${session.id}`)
        .catch(e => logger.error(`[WALLET] debit failed for session ${session.id}: ${e.message}`));
      // Free the buyer's wallet-checkout slot now the session is done.
      await releaseWalletCheckout(meta.userId);
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

  // Admin heads-up for the confirmed order (independent of buyer/seller emails).
  await notifyAdminOfOrder({
    orderId,
    buyerName: buyerProfile?.display_name || 'Collector',
    buyerEmail: buyerProfile?.email || null,
    total: amountCents / 100,
    itemsSummary: cardName || 'Trading Card',
    sellerName: sellerProfile?.display_name || null,
  });

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
  // Free the one-time welcome discount this abandoned checkout had reserved, so
  // the buyer can use it on a later order.
  if (session.metadata?.welcomeOfferId) {
    await releaseWelcomeDiscount(session.metadata.welcomeOfferId);
  }
  // Likewise free the wallet-checkout slot so an abandoned wallet checkout
  // doesn't block the buyer until the reservation TTL lapses.
  if (Number(session.metadata?.walletCents) > 0) {
    await releaseWalletCheckout(session.metadata.userId);
  }
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
