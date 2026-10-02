import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendOrderConfirmed, sendItemSold, sendOrderAdminNotice } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import { payoutSeller } from './payoutService.js';
import { markWelcomeDiscountRedeemed, releaseWelcomeDiscount } from './welcomeOfferService.js';
import { recordShopOrderReferral } from './partnerService.js';
import { debitWalletForOrder, releaseWalletCheckout } from './walletService.js';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { namesMatch } from './identityService.js';
import { insertWithOptionalColumns } from '../utils/insertWithOptionalColumns.js';
import { isCardCountryAllowed, allowedCardCountries } from '../utils/cardCountryPolicy.js';

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

/**
 * Which wallet actually paid (Google Pay / Apple Pay / Stripe Link), if any.
 * Stripe has no distinct 'google_pay' payment_method type — wallet payments
 * come back as type 'card' with card.wallet.type set. Surfaced so the
 * confirmation page and receipt email can say "Paid with Google Pay" per
 * Google's brand guidelines, instead of just "payment successful". Best-
 * effort: a lookup failure must never block order fulfilment.
 */
async function resolvePaymentMethod(stripe, paymentIntentId) {
  if (!paymentIntentId) return { walletType: null, cardCountry: null };
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['payment_method'] });
    const pm = pi.payment_method;
    if (!pm || typeof pm === 'string') return { walletType: null, cardCountry: null };

    let walletType = null;
    if (pm.type === 'card' && pm.card?.wallet?.type) walletType = pm.card.wallet.type;
    else if (pm.type === 'link') walletType = 'link';

    // Where the method was issued, used to enforce the Australia-only policy
    // (cardCountryPolicy.js). `pm.card.country` covers cards and card wallets;
    // the `pm[pm.type]` fallback picks up any other method that reports one.
    // Methods that report none (often PayPal) come back null, which the policy
    // treats as allowed rather than refunding a good domestic payment.
    const cardCountry = pm.card?.country ?? pm[pm.type]?.country ?? null;

    return { walletType, cardCountry };
  } catch (e) {
    logger.warn(`[STRIPE] Could not resolve payment method for payment intent ${paymentIntentId}: ${e.message}`);
    return { walletType: null, cardCountry: null };
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

// Email every admin account about a confirmed order, and drop an in-app
// notification in each admin's bell so a new order shows up without anyone
// having to check email or refresh Admin -> Orders. Best-effort — a failure
// here must never re-throw and turn a fulfilled order into a webhook 500
// (which Stripe would retry).
export async function notifyAdminOfOrder({ orderId, buyerName, buyerEmail, total, itemsSummary, sellerName, preorderSummary }) {
  try {
    const to = await getAdminNotificationEmails();
    await sendOrderAdminNotice({ to, orderId, buyerName, buyerEmail, total, itemsSummary, sellerName, preorderSummary });
  } catch (e) {
    logger.warn(`[STRIPE] admin order notice email failed for order ${orderId || 'n/a'}: ${e.message}`);
  }

  try {
    const { data: admins, error: adminsErr } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (adminsErr) throw adminsErr;
    if (admins?.length) {
      const amount = typeof total === 'number' ? `$${total.toFixed(2)}` : 'an order';
      // supabase-js resolves failed inserts with { error } instead of throwing,
      // so the error must be checked explicitly or the notification vanishes
      // silently (which is exactly how the previous `entity_id` column mismatch
      // went unnoticed — the table's column is `related_id`).
      const { error: insertErr } = await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'order_placed',
        title: preorderSummary ? 'New pre-order placed' : 'New order placed',
        body: `${buyerName || 'A buyer'} placed ${amount} order for ${itemsSummary || 'an item'}${sellerName ? ` from ${sellerName}` : ''}.${preorderSummary ? ` Pre-order: ${preorderSummary}.` : ''}`,
        link: '/admin/orders',
        related_id: orderId,
      })));
      if (insertErr) throw insertErr;
    }
  } catch (e) {
    logger.warn(`[STRIPE] admin order notice in-app notification failed for order ${orderId || 'n/a'}: ${e.message}`);
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
  // A DB error is NOT a lost race. Returning false here used to route a
  // transient blip into the double-sale path — buyer refunded, seller never
  // paid, card still listed. Throw instead so the webhook 500s and Stripe
  // redelivers; only "no error, zero rows" means someone else already sold it.
  if (error) {
    logger.error(`[STRIPE] Failed to claim listing ${listingId} as sold: ${error.message}`);
    throw new Error(`Listing claim failed for ${listingId}: ${error.message}`);
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * The payment came from a card issued outside the countries CardPop sells to.
 * Checkout captures on completion, so the money is already taken — refuse to
 * fulfil and hand all of it back rather than shipping to an overseas buyer.
 *
 * Stripe does NOT return its processing fee on a refund, so each of these costs
 * the platform that fee. A Radar rule (`:card_country: != 'AU'`) declines before
 * capture and costs nothing — this is the backstop for when one isn't in place.
 */
async function flagForeignCard({ stripe, session, orderId, buyerId, cardCountry }) {
  logger.error(`[STRIPE] Foreign card (${cardCountry}) on session ${session.id} — not fulfilling, refunding in full`);

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
  if (paymentIntentId) {
    try {
      // Order-scoped idempotency: a redelivered webhook must not issue a second
      // refund for the same payment.
      await stripe.refunds.create(
        { payment_intent: paymentIntentId, reason: 'requested_by_customer' },
        { idempotencyKey: `foreign-card-refund-${session.id}` },
      );
    } catch (e) {
      logger.error(`[STRIPE] Auto-refund failed for foreign-card session ${session.id}: ${e.message} — needs manual refund`);
    }
  }

  // Best-effort notifications — a notify failure must never re-throw and turn a
  // handled block into a webhook 500 that Stripe retries.
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (admins?.length) {
      await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'order_foreign_card',
        title: 'Overseas card blocked — auto-refunded',
        body: `Session ${session.id} was paid with a ${cardCountry} card (order ${orderId || 'n/a'}). CardPop sells to ${allowedCardCountries().join(', ')} only, so the payment was refunded in full. Verify it settled — Stripe keeps its processing fee on refunds.`,
      })));
    }
    if (buyerId) {
      await supabase.from('notifications').insert({
        user_id: buyerId,
        type: 'order_refund_pending',
        title: 'Refund on the way',
        body: 'CardPop currently sells to buyers in Australia only, so your payment is being refunded in full — no action needed.',
      });
    }
  } catch (e) {
    logger.warn(`[STRIPE] foreign-card notification failed for session ${session.id}: ${e.message}`);
  }
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
  const { walletType, cardCountry } = await resolvePaymentMethod(stripe, cartPaymentIntentId);

  // Australia only. The shipping address was gated at checkout, but the card's
  // country is only knowable now — and Checkout already captured the money, so
  // the block is a refusal to fulfil plus a full refund.
  if (!isCardCountryAllowed(cardCountry)) {
    await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', existing.id);
    await flagForeignCard({ stripe, session, orderId: existing.id, buyerId: existing.buyer_id, cardCountry });
    return;
  }

  let { data: claimed, error: claimErr } = await supabase.from('orders')
    .update({ status: 'payment_confirmed', stripe_payment_intent_id: cartPaymentIntentId, payer_name_mismatch: payerNameMismatch, payment_wallet_type: walletType })
    .eq('id', existing.id)
    .eq('status', 'pending')
    .select('id');

  // payment_wallet_type lands with its migration, but a redeploy can briefly
  // race ahead of `supabase db push` — same window handled for
  // gst_included_aud below. Drop it and retry rather than failing the confirm.
  const missingWalletColumn =
    claimErr?.code === 'PGRST204' || claimErr?.code === '42703' || /payment_wallet_type/.test(claimErr?.message || '');
  if (missingWalletColumn) {
    ({ data: claimed, error: claimErr } = await supabase.from('orders')
      .update({ status: 'payment_confirmed', stripe_payment_intent_id: cartPaymentIntentId, payer_name_mismatch: payerNameMismatch })
      .eq('id', existing.id)
      .eq('status', 'pending')
      .select('id'));
  }

  // Throw on a real error so Stripe retries; only treat a genuine empty result
  // (no error, zero rows) as "already confirmed by a concurrent delivery".
  if (claimErr) throw new Error(`Cart confirm CAS failed for session ${session.id}: ${claimErr.message}`);

  if (!claimed || claimed.length === 0) {
    logger.info(`[STRIPE] Cart order ${existing.id} already confirmed concurrently for session ${session.id}, skipping`);
    return;
  }

  const lines = Array.isArray(existing.order_items) ? existing.order_items : [];

  // Claim every listing line FIRST, before any other side effect (wallet debit,
  // stock decrements, payouts), because a claim can throw on a DB error and the
  // retry has to be able to redo the whole order. The confirm CAS above already
  // moved the order off 'pending', so a bare throw would leave Stripe's retry
  // looking at a 'payment_confirmed' order and skipping it — half-fulfilled.
  // So on an error: remember which listings THIS order already won (sold_claimed
  // on the line, so the retry doesn't lose the race to itself), put the order
  // back to 'pending', and rethrow. The retry then re-runs from the top; every
  // step after this point is either not yet run or idempotent.
  const claimedListingLines = [];
  const lostListingLines = [];
  for (const line of lines) {
    if (line.type !== 'listing' || !line.id) continue;
    if (line.sold_claimed === true) {
      claimedListingLines.push(line);
      continue;
    }
    let won;
    try {
      won = await claimListingSold(line.id);
    } catch (claimError) {
      const { data: reverted, error: revertErr } = await supabase.from('orders')
        .update({ status: 'pending', order_items: lines })
        .eq('id', existing.id)
        .eq('status', 'payment_confirmed')
        .select('id');
      if (revertErr || !reverted?.length) {
        logger.error(`[STRIPE] Could not return cart order ${existing.id} to pending after a listing-claim error (${revertErr?.message || 'no row'}) — the retry will skip it; needs manual fulfilment`);
      }
      throw claimError;
    }
    if (won) {
      line.sold_claimed = true;
      claimedListingLines.push(line);
    } else {
      lostListingLines.push(line);
    }
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

  const sellerIds = new Set();
  const oversoldShopItems = [];
  let payoutsRecorded = false;

  // Listing lines settle in two passes: every listing was claimed above (the
  // sold race decides which lines this order actually fulfils), sellers are
  // paid below. The split exists for seller postage — shipping_aud sits on one
  // line per seller (the parcel-defining line), and if THAT line loses the race
  // while a sibling line from the same seller wins, the postage the buyer paid
  // must follow the parcel that still ships rather than vanish from the payout.
  // A lost line was already sold (another buyer or a manual vault mark): skip
  // its payout and flag it so the buyer gets refunded — never sell it twice.
  for (const line of lostListingLines) {
    await flagDoubleSale({ listingId: line.id, orderId: existing.id, buyerId: existing.buyer_id });
  }
  let fulfilledLines = claimedListingLines.length;

  for (const line of lines) {
    if (line.type === 'shop' && line.id && line.preorder) {
      // Pre-orders are unlimited and sold ahead of stock, so they never touch
      // stock_quantity (an at-zero decrement would also read as an oversell).
      // Admin sets real stock when the product goes back to active.
      fulfilledLines += 1;
    } else if (line.type === 'shop' && line.id) {
      // An RPC *error* must not count as fulfilled: data is null on error, so
      // checking only `ok === false` would silently skip the stock decrement
      // and the oversold alert while the buyer is charged. Treat errors like
      // an oversell — flagged for manual resolution.
      // A line that names a colour variant decrements that variant's stock
      // (the parent's stock is the sum of its variants, kept by a trigger).
      const { data: ok, error: stockErr } = line.variant_id
        ? await supabase.rpc('decrement_shop_variant_stock', { p_variant_id: line.variant_id, p_qty: line.quantity || 1 })
        : await supabase.rpc('decrement_shop_stock', { p_id: line.id, p_qty: line.quantity || 1 });
      if (stockErr || ok === false) {
        oversoldShopItems.push(line);
        logger.error(`[STRIPE] ${stockErr ? `Stock decrement failed (${stockErr.message})` : 'Oversell'} on shop product ${line.id}${line.variant_id ? ` variant ${line.variant_id}` : ''} (qty ${line.quantity || 1}) for order ${existing.id} — needs manual resolution`);
      } else {
        fulfilledLines += 1;
      }
    }
  }

  // Re-home orphaned postage: shipping_aud whose carrying line lost the sold
  // race moves to a claimed line of the same seller (the parcel still ships).
  // If the seller has no surviving line, the postage stays on the lost line,
  // where the double-sale refund path returns it to the buyer with the rest.
  const claimedIds = new Set(claimedListingLines.map(l => l.id));
  for (const line of lines) {
    if (line.type !== 'listing' || claimedIds.has(line.id)) continue;
    const shipping = Number(line.shipping_aud || 0);
    if (shipping <= 0) continue;
    const heir = claimedListingLines.find(l => l.seller_id === line.seller_id);
    if (heir) {
      heir.shipping_aud = Number(heir.shipping_aud || 0) + shipping;
      delete line.shipping_aud;
      payoutsRecorded = true; // lines changed — persist them below
    }
  }

  for (const line of claimedListingLines) {
    if (!line.seller_id) continue;
    sellerIds.add(line.seller_id);
    // Seller postage (shipping_aud) passes through in full — commission only
    // ever comes off the item price. The GST inside this seller's supply (the
    // card and their postage) IS deducted: CardPop remits it on their behalf,
    // so paying it out as well would leave the platform funding the tax.
    const proceeds = Math.round((
      Number(line.line_total_aud || 0)
      - Number(line.commission_aud || 0)
      - Number(line.seller_gst_aud || 0)
      + Number(line.shipping_aud || 0)
    ) * 100) / 100;
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

  // The buyer's "Purchase confirmed" notification comes from the on_order_paid
  // DB trigger, which fires on the pending -> payment_confirmed update above —
  // so it is emitted exactly once, only after payment actually clears.
  //
  // Sellers on a cart order can't come from that trigger: a cart order has no
  // single seller_id, and the individual lines are only known here.
  for (const sid of sellerIds) {
    await supabase.from('notifications').insert({
      user_id: sid, type: 'listing_sold', title: 'Your card sold! 🎉',
      body: 'One of your listings sold through a cart checkout.',
      link: '/transactions', related_id: existing.id,
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
      // The dispatch estimate the buyer bought with (snapshotted by cartService).
      ...(l.preorder ? { preorderEta: l.preorder_eta || 'Ships when stock arrives' } : {}),
    }));
    await sendOrderConfirmed({
      buyerEmail: receiptEmail,
      buyerName: receiptName,
      cardName: `${itemCount} item${itemCount === 1 ? '' : 's'}`,
      itemPrice: Number(existing.item_price_aud ?? amountCents2 / 100),
      total: amountCents2 / 100,
      orderId: existing.id,
      paymentWalletType: walletType,
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

    // Name the marketplace sellers. Without this a cart carrying someone's card
    // reached the admin inbox looking exactly like a sale of CardPop's own shop
    // stock — same subject, same body, no seller — so marketplace sales were
    // invisible in the one place they get watched.
    let sellerName = null;
    if (sellerIds.size > 0) {
      const { data: sellerProfiles } = await supabase
        .from('profiles')
        .select('display_name')
        .in('id', [...sellerIds]);
      const sellerNames = (sellerProfiles || []).map(p => p.display_name).filter(Boolean);
      sellerName = sellerNames.length
        ? sellerNames.slice(0, 3).join(', ') + (sellerNames.length > 3 ? ', …' : '')
        : `${sellerIds.size} marketplace seller${sellerIds.size === 1 ? '' : 's'}`;
    }

    // Pre-order lines are paid for but can't ship yet — say so up front so
    // they aren't packed with the in-stock part of the order by mistake.
    const preorderLines = lines.filter(l => l.preorder);
    const preorderSummary = preorderLines.length
      ? preorderLines.map(l => `${l.title || 'Item'}${(l.quantity || 1) > 1 ? ` ×${l.quantity}` : ''} (${l.preorder_eta || 'ships when stock arrives'})`).join('; ')
      : null;

    await notifyAdminOfOrder({
      orderId: existing.id,
      buyerName: receiptName,
      buyerEmail: receiptEmail,
      total: amountCents2 / 100,
      itemsSummary,
      sellerName,
      preorderSummary,
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
  // Seller postage: charged to the buyer as its own line and passed through to
  // the seller in full (sellerProceedsAud already includes it at session
  // creation; the fallback below mirrors that formula for legacy sessions).
  const shippingAud = parseFloat(meta.shippingAud || '0');
  // Buyer-paid reimbursement of Stripe's cut. Platform money, never the
  // seller's — it is deliberately absent from sellerProceedsAud below, and from
  // platform_fee_aud (the commission figure the admin reports and the refund
  // retention are computed from).
  const processingFeeAud = parseFloat(meta.processingFeeAud || '0');
  // GST is inside every price, never added to the buyer's bill. The seller's
  // share (the card + their postage) is deducted from their payout and remitted
  // by CardPop; the platform's share is inside fees it already holds.
  const sellerGstAud = parseFloat(meta.sellerGstAud || '0');
  const platformGstAud = parseFloat(meta.platformGstAud || '0');
  const gstIncludedAud = parseFloat(meta.gstIncludedAud || String(sellerGstAud + platformGstAud));
  const sellerProceeds = parseFloat(
    meta.sellerProceedsAud || String(itemPrice - commissionAud - sellerGstAud + shippingAud),
  );
  const configId = meta.configId || null;
  const discountAud = parseFloat(meta.discountAud || '0');
  const amountCents = session.amount_total || 0;

  if (![itemPrice, commissionAud, gstAud, shippingAud, processingFeeAud, sellerGstAud, discountAud].every(Number.isFinite)) {
    logger.error(`[STRIPE] Non-finite amount in metadata for session ${session.id} — order rejected`);
    return;
  }

  const expectedTotalCents = Math.round((itemPrice + commissionAud + gstAud + shippingAud + processingFeeAud - discountAud) * 100);
  if (Math.abs(amountCents - expectedTotalCents) > 2) {
    logger.error(`[STRIPE] Amount mismatch for session ${session.id}: Stripe=${amountCents}¢ expected=${expectedTotalCents}¢ — order rejected`);
    await flagAmountMismatch({ stripe, session, orderId: null, buyerId: userId, amountCents, expectedCents: expectedTotalCents });
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

  const payerNameMismatch = await computePayerNameMismatch(userId, session.customer_details?.name);
  const { walletType, cardCountry } = await resolvePaymentMethod(stripe, paymentIntentId);

  // Australia only — checked before the order row is written, so a blocked
  // payment leaves no order, never claims the listing and never pays a seller.
  if (!isCardCountryAllowed(cardCountry)) {
    await flagForeignCard({ stripe, session, orderId: null, buyerId: userId, cardCountry });
    return;
  }

  // The address Stripe collected (shipping_address_collection). Current API
  // versions (2025-03-31+, which this SDK pins) moved it under
  // collected_information; older sessions / API versions carry it at the top
  // level. Without the new path every Buy Now order landed with no address.
  const collectedShipping = session.collected_information?.shipping_details ?? session.shipping_details ?? null;

  const orderInsert = {
    buyer_id: userId,
    payer_name_mismatch: payerNameMismatch,
    payment_wallet_type: walletType,
    seller_id: sellerId,
    listing_id: listingId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    total_aud: amountCents / 100,
    item_price_aud: itemPrice,
    shipping_aud: shippingAud,
    discount_aud: discountAud,
    platform_fee_aud: commissionAud + gstAud,
    processing_fee_aud: processingFeeAud,
    commission_pct: commissionPct,
    // gst_aud is GST ADDED on top, which is now always 0 — prices are
    // GST-inclusive. gst_included_aud is the GST inside them, of which
    // seller_gst_aud is the part deducted from the seller and remitted for them.
    gst_aud: gstAud,
    gst_included_aud: gstIncludedAud,
    seller_gst_aud: sellerGstAud,
    platform_gst_aud: platformGstAud,
    seller_proceeds_aud: sellerProceeds,
    transaction_type: transactionType,
    commission_config_id: configId || null,
    status: 'payment_confirmed',
    buyer_protection: true,
    shipping_name: meta.shippingName || collectedShipping?.name || session.customer_details?.name || null,
    shipping_address: meta.shippingAddress || collectedShipping?.address?.line1 || null,
    shipping_suburb: meta.shippingSuburb || collectedShipping?.address?.city || null,
    shipping_state: meta.shippingState || collectedShipping?.address?.state || null,
    shipping_postcode: meta.shippingPostcode || collectedShipping?.address?.postal_code || null,
  };

  // These columns land with their migrations, but a redeploy can briefly race
  // ahead of `supabase db push` — same window handled in the cart checkout
  // path. Drop the missing one and retry rather than rejecting an otherwise-good
  // order: the buyer has already paid.
  const { error: insertError } = await insertWithOptionalColumns(
    orderInsert,
    ['payment_wallet_type', 'processing_fee_aud', 'gst_included_aud', 'seller_gst_aud', 'platform_gst_aud'],
    row => supabase.from('orders').insert(row),
    col => logger.warn(`[STRIPE] ${col} column not present yet — inserting order without it`),
  );

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
    let claimed;
    try {
      claimed = await claimListingSold(listingId);
    } catch (claimError) {
      // The order row above was inserted already 'payment_confirmed', so a
      // Stripe retry would find it and skip — leaving the listing unclaimed and
      // the seller unpaid. Remove it so the retry starts clean, then rethrow
      // (→ 500 → redelivery). The paid-order notifications are deduped per
      // order id, so a retry can at worst repeat them once under the new row.
      const { error: undoErr } = await supabase
        .from('orders')
        .delete()
        .eq('stripe_session_id', session.id)
        .eq('status', 'payment_confirmed');
      if (undoErr) {
        logger.error(`[STRIPE] Could not remove order for session ${session.id} after a listing-claim error (${undoErr.message}) — the retry will skip it; needs manual fulfilment`);
      }
      throw claimError;
    }
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
    // paid_at closes the offer's payment window: the expire_stale_offers()
    // sweep skips paid offers, and resolveOfferPrice refuses a second checkout.
    await supabase
      .from('offers')
      .update({ status: 'accepted', paid_at: new Date().toISOString() })
      .eq('id', meta.offerId);
  }

  // Buyer and seller notifications come from the on_order_paid DB trigger. This
  // path inserts the order already `payment_confirmed`, so the trigger fires on
  // that insert — after payment, once, with the card name and a link to
  // /transactions.

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
    // Best-effort, like the cart path: a Resend outage must not throw out of the
    // handler. Everything that matters happens BELOW this point — the admin
    // notice and, more importantly, the seller's payout — so an unhandled
    // rejection here used to cost the seller their money over a failed email.
    await sendOrderConfirmed({
      buyerEmail: buyerProfile.email,
      buyerName: buyerProfile.display_name || 'Collector',
      cardName,
      itemPrice,
      total: amountCents / 100,
      orderId,
      paymentWalletType: walletType,
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
    }).catch(e => logger.warn(`[STRIPE] buyer confirm email failed for order ${orderId || 'n/a'}: ${e.message}`));
  }

  if (sellerProfile?.email) {
    await sendItemSold({
      sellerEmail: sellerProfile.email,
      sellerName: sellerProfile.display_name || 'Collector',
      cardName,
      itemPrice,
      commissionAud,
      // What actually came out of this sale, so the payout figure in the email
      // reconciles: GST is now a deduction from the seller, not a buyer charge.
      gstAud: sellerGstAud,
      shippingAud,
      sellerProceeds,
      orderId,
    }).catch(e => logger.warn(`[STRIPE] seller sold email failed for order ${orderId || 'n/a'}: ${e.message}`));
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
