import 'dotenv/config';
import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { sendOrderConfirmed, sendItemSold, sendRefundProcessed, sendRefundIssued } from '../utils/emailService.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';
import { handleDisputeCreated, handleDisputeClosed } from '../services/disputeService.js';
import { payoutSeller, reverseSellerPayout } from '../services/payoutService.js';

const router = express.Router();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ─── Commission Helpers ──────────────────────────────────────────────────────

async function getPlatformSetting(key, defaultValue) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value !== undefined ? data.value : defaultValue;
}

/**
 * Looks up the fee_config row for a given seller_tier and transaction_type.
 * Falls back to the 'none' tier if no match.
 */
async function getFeeConfig(sellerTier, transactionType) {
  // Try exact tier match
  let { data } = await supabase
    .from('fee_config')
    .select('id, fee_pct')
    .eq('seller_tier', sellerTier || 'none')
    .eq('is_active', true)
    .contains('applies_to', [transactionType])
    .maybeSingle();

  if (!data) {
    // Fall back to the 'none' tier — but still scoped to this transaction type,
    // matching the primary query, so we never apply a fee config that doesn't
    // cover the transaction type being charged.
    const { data: fallback } = await supabase
      .from('fee_config')
      .select('id, fee_pct')
      .eq('seller_tier', 'none')
      .eq('is_active', true)
      .contains('applies_to', [transactionType])
      .maybeSingle();
    data = fallback;
  }

  return data || { id: null, fee_pct: 3 };
}

/**
 * Calculate the full cost breakdown for a listing purchase.
 * Returns { itemPrice, commissionPct, commissionAud, gstAud, total, configId }
 */
async function calculateBreakdown(listing, transactionType = 'fixed') {
  const commEnabled = await getPlatformSetting('commissions_enabled', true);
  const gstEnabled  = await getPlatformSetting('gst_enabled', true);
  const gstRate     = Number(await getPlatformSetting('gst_rate_pct', 10));
  const gstOnCommOnly = await getPlatformSetting('gst_on_commission_only', true);

  const itemPrice = Number(listing.price_aud) || 0;
  let commissionPct = 0;
  let configId = null;

  if (commEnabled) {
    const ttKey = {
      fixed:   'commission_on_offers',   // reused key name; we handle per-type below
      auction: 'commission_on_auctions',
      trade:   'commission_on_trades',
      offer:   'commission_on_offers',
    };
    const typeEnabled = await getPlatformSetting(ttKey[transactionType] || 'commissions_enabled', true);

    if (typeEnabled) {
      const sellerTier = listing.seller?.seller_tier || 'none';
      const cfg = await getFeeConfig(sellerTier, transactionType);
      commissionPct = Number(cfg.fee_pct);
      configId = cfg.id;
    }
  }

  const commissionAud = Math.round(itemPrice * (commissionPct / 100) * 100) / 100;

  let gstAud = 0;
  if (gstEnabled) {
    const gstBase = gstOnCommOnly ? commissionAud : itemPrice + commissionAud;
    gstAud = Math.round(gstBase * (gstRate / 100) * 100) / 100;
  }

  const total = Math.round((itemPrice + commissionAud + gstAud) * 100) / 100;

  return { itemPrice, commissionPct, commissionAud, gstAud, total, configId };
}

// ─── GET /calculate ──────────────────────────────────────────────────────────

router.get('/calculate', authMiddleware, async (req, res) => {
  try {
    const { listingId, transactionType = 'fixed' } = req.query;
    if (!listingId) return res.status(400).json({ error: 'listingId is required' });

    const { data: listing, error } = await supabase
      .from('listings')
      .select('id, price_aud, seller_id, seller:profiles!seller_id(seller_tier)')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !listing) return res.status(404).json({ error: 'Listing not found or not active' });

    const breakdown = await calculateBreakdown(listing, transactionType);

    res.json({
      listingId,
      transactionType,
      itemPrice:     breakdown.itemPrice,
      commissionPct: breakdown.commissionPct,
      commissionAud: breakdown.commissionAud,
      gstAud:        breakdown.gstAud,
      total:         breakdown.total,
    });
  } catch (err) {
    logger.error(`[STRIPE] /calculate error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /create-checkout ───────────────────────────────────────────────────

router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    const {
      listingId,
      offerId,
      bidId,
      transactionType = 'fixed',
      successUrl,
      cancelUrl,
      shippingAddress,
    } = req.body;

    if (!listingId)              return res.status(400).json({ error: 'listingId is required' });
    if (!successUrl || !cancelUrl) return res.status(400).json({ error: 'successUrl and cancelUrl are required' });

    const userId = req.user.id;
    const email  = req.user.email;

    // Fetch listing server-side — never trust client-supplied totals
    const { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('id, price_aud, vault_item_id, seller_id, title, seller:profiles!seller_id(seller_tier, display_name), vault_item:vault_items!inner(card_name)')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found or no longer active' });
    }

    // Prevent seller from buying their own item
    if (listing.seller_id === userId) {
      return res.status(403).json({ error: 'You cannot purchase your own listing' });
    }

    // If offer-based purchase, validate and use the offered price
    let itemPrice = Number(listing.price_aud);
    if (offerId) {
      const { data: offer } = await supabase
        .from('offers')
        .select('amount_aud, status, buyer_id, listing_id')
        .eq('id', offerId)
        .maybeSingle();

      if (!offer || offer.listing_id !== listingId || offer.buyer_id !== userId) {
        return res.status(400).json({ error: 'Invalid offer' });
      }
      if (!['pending', 'countered'].includes(offer.status)) {
        return res.status(400).json({ error: 'Offer is no longer valid' });
      }
      itemPrice = Number(offer.amount_aud);
    }

    const cardName = listing.vault_item?.card_name || listing.title || 'Trading Card';

    // Server-side commission calculation
    const breakdown = await calculateBreakdown({ ...listing, price_aud: itemPrice }, transactionType);

    // Build Stripe line items
    const lineItems = [
      {
        price_data: {
          currency: 'aud',
          product_data: { name: cardName },
          unit_amount: Math.round(breakdown.itemPrice * 100),
        },
        quantity: 1,
      },
    ];

    if (breakdown.commissionAud > 0) {
      lineItems.push({
        price_data: {
          currency: 'aud',
          product_data: { name: `Platform Fee (${breakdown.commissionPct}%)` },
          unit_amount: Math.round(breakdown.commissionAud * 100),
        },
        quantity: 1,
      });
    }

    if (breakdown.gstAud > 0) {
      lineItems.push({
        price_data: {
          currency: 'aud',
          product_data: { name: 'GST' },
          unit_amount: Math.round(breakdown.gstAud * 100),
        },
        quantity: 1,
      });
    }

    // Metadata (all commission fields stored for webhook reconstruction)
    const metadata = {
      userId,
      listingId,
      sellerId:          listing.seller_id,
      vaultItemId:       listing.vault_item_id || '',
      transactionType,
      itemPrice:         String(breakdown.itemPrice),
      commissionPct:     String(breakdown.commissionPct),
      commissionAud:     String(breakdown.commissionAud),
      gstAud:            String(breakdown.gstAud),
      sellerProceedsAud: String(Math.round((breakdown.itemPrice - breakdown.commissionAud) * 100) / 100),
      configId:          breakdown.configId || '',
    };
    if (offerId) metadata.offerId = offerId;
    if (bidId)   metadata.bidId   = bidId;

    // Fraud control: cap order size / frequency for brand-new, unverified buyers.
    const buyerTotal = breakdown.itemPrice + (breakdown.commissionAud || 0) + (breakdown.gstAud || 0);
    const velocity = await checkPurchaseVelocity({ userId, orderValueAud: buyerTotal });
    if (!velocity.allowed) {
      logger.warn(`[VELOCITY] Blocked checkout for ${userId} (${velocity.reason})`);
      return res.status(429).json({ error: velocity.message, code: 'velocity_limit' });
    }

    if (shippingAddress) {
      const s = shippingAddress;
      if (s.name)     metadata.shippingName     = String(s.name).slice(0, 100);
      if (s.address)  metadata.shippingAddress  = String(s.address).slice(0, 200);
      if (s.suburb)   metadata.shippingSuburb   = String(s.suburb).slice(0, 100);
      if (s.state)    metadata.shippingState    = String(s.state).slice(0, 50);
      if (s.postcode) metadata.shippingPostcode = String(s.postcode).slice(0, 10);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items:           lineItems,
      mode:                 'payment',
      success_url:          successUrl,
      cancel_url:           cancelUrl,
      customer_email:       email,
      metadata,
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');

    logger.info(`[STRIPE] Session created: ${session.id} for listing ${listingId}`);
    res.json({ url: session.url, sessionId: session.id, breakdown });
  } catch (err) {
    logger.error(`[STRIPE] create-checkout error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /create-cart-checkout ──────────────────────────────────────────────
// Multi-item cart checkout. Each item is priced server-side from its source of
// truth — never trust client prices/totals. Admin "shop" products (shop_products)
// are platform-owned: GST only, no commission. Marketplace "listing" items use
// the normal commission + GST breakdown. A single Stripe session collects the
// payment; a 'pending' order row is written as the snapshot the webhook confirms.

// Prices a cart entirely server-side. Returns Stripe line items, the snapshot
// order lines, and cent-accurate totals. Throws errors with a `.statusCode` for
// the route to surface. Shared by create-cart-checkout and calculate-cart so the
// displayed total always matches the amount charged.
async function priceCart(items, userId) {
  const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

  const gstEnabled = await getPlatformSetting('gst_enabled', true);
  const gstRate    = Number(await getPlatformSetting('gst_rate_pct', 10));

  const lineItems = [];
  const orderLines = [];
  let itemsCents = 0;
  let commissionCents = 0;
  let gstCents = 0;

  for (const raw of items) {
    const type = raw?.type;
    const id = raw?.id;
    const quantity = Math.max(1, parseInt(raw?.quantity, 10) || 1);

    if (type === 'shop') {
      const { data: product, error } = await supabase
        .from('shop_products')
        .select('id, title, price_aud, stock_quantity, status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!product || product.status !== 'active') throw httpError(404, 'A shop product in your cart is unavailable');
      if (product.stock_quantity < quantity) throw httpError(409, `Not enough stock for ${product.title}`);

      const unitCents = Math.round(Number(product.price_aud) * 100);
      const lineCents = unitCents * quantity;
      const lineGstCents = gstEnabled ? Math.round(lineCents * (gstRate / 100)) : 0;

      itemsCents += lineCents;
      gstCents += lineGstCents;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name: product.title }, unit_amount: unitCents },
        quantity,
      });
      orderLines.push({
        type: 'shop', id: product.id, seller_id: null, title: product.title,
        quantity, unit_price_aud: unitCents / 100, line_total_aud: lineCents / 100,
        commission_aud: 0, gst_aud: lineGstCents / 100,
      });
    } else if (type === 'listing') {
      const { data: listing, error } = await supabase
        .from('listings')
        .select('id, price_aud, seller_id, listing_type, status, vault_item:vault_items!inner(card_name), seller:profiles!seller_id(seller_tier)')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!listing) throw httpError(404, 'A listing in your cart is no longer available');
      if (listing.seller_id === userId) throw httpError(403, 'You cannot purchase your own listing');

      // Marketplace items are unique — always quantity 1.
      const breakdown = await calculateBreakdown(listing, 'fixed');
      const itemC = Math.round(breakdown.itemPrice * 100);
      const commC = Math.round(breakdown.commissionAud * 100);
      const gstC  = Math.round(breakdown.gstAud * 100);
      const name  = listing.vault_item?.card_name || 'Trading Card';

      itemsCents += itemC;
      commissionCents += commC;
      gstCents += gstC;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name }, unit_amount: itemC },
        quantity: 1,
      });
      orderLines.push({
        type: 'listing', id: listing.id, seller_id: listing.seller_id, title: name,
        quantity: 1, unit_price_aud: itemC / 100, line_total_aud: itemC / 100,
        commission_aud: commC / 100, gst_aud: gstC / 100,
      });
    } else {
      throw httpError(400, `Unknown cart item type: ${type}`);
    }
  }

  if (commissionCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Platform Fee' }, unit_amount: commissionCents }, quantity: 1 });
  }
  if (gstCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'GST' }, unit_amount: gstCents }, quantity: 1 });
  }

  return { lineItems, orderLines, itemsCents, commissionCents, gstCents, grandCents: itemsCents + commissionCents + gstCents };
}

// Preview the authoritative cart total (so the UI never shows a number that
// differs from what Stripe will charge).
router.post('/calculate-cart', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items is required' });
    const priced = await priceCart(items, req.user.id);
    res.json({
      items:       priced.orderLines,
      subtotalAud: priced.itemsCents / 100,
      commissionAud: priced.commissionCents / 100,
      gstAud:      priced.gstCents / 100,
      totalAud:    priced.grandCents / 100,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] /calculate-cart error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

router.post('/create-cart-checkout', authMiddleware, async (req, res) => {
  try {
    const { items, successUrl, cancelUrl, shippingAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }

    const userId = req.user.id;
    const email  = req.user.email;

    const { lineItems, orderLines, itemsCents, commissionCents, gstCents, grandCents } = await priceCart(items, userId);

    // Fraud control: cap order size / frequency for brand-new, unverified buyers.
    const velocity = await checkPurchaseVelocity({ userId, orderValueAud: grandCents / 100 });
    if (!velocity.allowed) {
      logger.warn(`[VELOCITY] Blocked cart checkout for ${userId} (${velocity.reason})`);
      return res.status(429).json({ error: velocity.message, code: 'velocity_limit' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items:           lineItems,
      mode:                 'payment',
      success_url:          successUrl,
      cancel_url:           cancelUrl,
      customer_email:       email,
      metadata:             { userId, cartCheckout: 'true' },
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');

    const s = shippingAddress || {};
    const { error: orderErr } = await supabase.from('orders').insert({
      buyer_id:          userId,
      seller_id:         null,
      listing_id:        null,
      stripe_session_id: session.id,
      item_price_aud:    itemsCents / 100,
      shipping_aud:      0,
      platform_fee_aud:  (commissionCents + gstCents) / 100,
      gst_aud:           gstCents / 100,
      total_aud:         grandCents / 100,
      transaction_type:  'cart',
      status:            'pending',
      buyer_protection:  true,
      order_items:       orderLines,
      shipping_name:     s.name     ? String(s.name).slice(0, 100)     : null,
      shipping_address:  s.address  ? String(s.address).slice(0, 200)  : null,
      shipping_suburb:   s.suburb   ? String(s.suburb).slice(0, 100)   : null,
      shipping_state:    s.state    ? String(s.state).slice(0, 50)     : null,
      shipping_postcode: s.postcode ? String(s.postcode).slice(0, 10)  : null,
    });

    if (orderErr) {
      logger.error(`[STRIPE] pending cart order insert failed: ${orderErr.message}`);
      throw new Error('Could not record the order');
    }

    logger.info(`[STRIPE] Cart session created: ${session.id} (${orderLines.length} items, $${grandCents / 100})`);
    res.json({ url: session.url, sessionId: session.id, total: grandCents / 100 });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] create-cart-checkout error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

// ─── GET /session/:sessionId ─────────────────────────────────────────────────

router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) return res.status(400).json({ error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (!session) return res.status(404).json({ error: 'Checkout session not found' });

    if (session.metadata?.userId && session.metadata.userId !== req.user.id) {
      logger.warn(`[STRIPE] Unauthorised session access by ${req.user.id} for ${sessionId}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const items = (session.line_items?.data || []).map((item) => ({
      name:       item.description || item.price?.product?.name || 'Unknown',
      quantity:   item.quantity,
      unitAmount: item.price?.unit_amount || 0,
      currency:   item.price?.currency || 'aud',
    }));

    res.json({
      id:            session.id,
      status:        session.payment_status,
      amountTotal:   session.amount_total,
      customerEmail: session.customer_details?.email,
      items,
    });
  } catch (err) {
    logger.error(`[STRIPE] get-session error: ${err.message}`);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// ─── POST /webhook ───────────────────────────────────────────────────────────

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    logger.warn('[STRIPE] Webhook missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    logger.error('[STRIPE] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    logger.info(`[STRIPE] Webhook verified: ${event.type}`);
  } catch (err) {
    logger.warn(`[STRIPE] Signature verification failed: ${err.message}`);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        logger.info(`[STRIPE] checkout.session.completed: ${session.id}`);

        // Look up any order we already have for this session.
        const { data: existing } = await supabase
          .from('orders')
          .select('id, status, total_aud, order_items, buyer_id')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        // Already finalised — idempotent skip.
        if (existing && existing.status !== 'pending') {
          logger.info(`[STRIPE] Order already processed for session ${session.id}, skipping`);
          break;
        }

        // Multi-item cart: confirm the pre-created 'pending' snapshot order.
        if (existing && existing.status === 'pending') {
          const amountCents = session.amount_total || 0;
          const expectedCents = Math.round(Number(existing.total_aud) * 100);
          if (Math.abs(amountCents - expectedCents) > 2) {
            logger.error(`[STRIPE] Cart amount mismatch for ${session.id}: Stripe=${amountCents}¢ expected=${expectedCents}¢ — marking failed`);
            await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', existing.id);
            break;
          }

          const cartPaymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

          // Atomic claim: only the delivery that flips pending → payment_confirmed
          // proceeds. A concurrent webhook retry will update 0 rows and bail, so
          // listings/stock/notifications are never processed twice.
          const { data: claimed } = await supabase.from('orders')
            .update({ status: 'payment_confirmed', stripe_payment_intent_id: cartPaymentIntentId })
            .eq('id', existing.id)
            .eq('status', 'pending')
            .select('id');

          if (!claimed || claimed.length === 0) {
            logger.info(`[STRIPE] Cart order ${existing.id} already confirmed concurrently for session ${session.id}, skipping`);
            break;
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
                // Pay each cart seller their proceeds (line total minus commission).
                // No orderId is passed: a multi-seller cart can't map onto the
                // order's single payout_status/transfer_id, so we credit each
                // seller without clobbering those fields. This runs exactly once —
                // the atomic pending → payment_confirmed claim above guards retries.
                const proceeds = Number(line.line_total_aud || 0) - Number(line.commission_aud || 0);
                if (proceeds > 0) {
                  await payoutSeller(stripe, { sellerId: line.seller_id, sellerProceeds: proceeds, listingId: line.id })
                    .catch(e => logger.error(`[STRIPE] cart payout failed for seller ${line.seller_id}: ${e.message}`));
                }
              }
            } else if (line.type === 'shop' && line.id) {
              // Guarded decrement returns false when there wasn't enough stock —
              // i.e. an oversell. The buyer has already paid, so flag it for manual
              // resolution instead of silently confirming an unfulfillable order.
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
                type:    'order_oversold',
                title:   'Oversold order needs attention',
                body:    `Order ${existing.id} has ${oversoldShopItems.length} shop item(s) that exceeded available stock. Refund or restock.`,
              }))).catch(() => {});
            }
          }

          if (existing.buyer_id) {
            await supabase.from('notifications').insert({
              user_id: existing.buyer_id,
              type:    'order_confirmed',
              title:   'Order Confirmed',
              body:    `Your payment of $${(amountCents / 100).toFixed(2)} AUD was successful.`,
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
                buyerName:  buyerProfile.display_name || 'Collector',
                cardName:   `${itemCount} item${itemCount === 1 ? '' : 's'}`,
                itemPrice:  amountCents / 100,
                total:      amountCents / 100,
                orderId:    existing.id,
              }).catch(e => logger.warn(`[STRIPE] cart confirm email failed: ${e.message}`));
            }
          }

          logger.info(`[STRIPE] Cart order ${existing.id} confirmed for session ${session.id}`);
          break;
        }

        const meta = session.metadata || {};
        const userId          = meta.userId          || null;
        const listingId       = meta.listingId        || null;
        const sellerId        = meta.sellerId         || null;
        const transactionType = meta.transactionType  || 'fixed';
        const itemPrice       = parseFloat(meta.itemPrice       || '0');
        const commissionPct   = parseFloat(meta.commissionPct   || '0');
        const commissionAud   = parseFloat(meta.commissionAud   || '0');
        const gstAud          = parseFloat(meta.gstAud          || '0');
        const sellerProceeds  = parseFloat(meta.sellerProceedsAud || String(itemPrice - commissionAud));
        const configId        = meta.configId || null;
        const amountCents     = session.amount_total || 0;

        // Guard against corrupt/missing metadata: a NaN amount would make the
        // reconciliation comparison below always false (NaN > 2 === false),
        // letting an order through with NaN money fields. Reject up front.
        if (![itemPrice, commissionAud, gstAud].every(Number.isFinite)) {
          logger.error(`[STRIPE] Non-finite amount in metadata for session ${session.id} — order rejected`);
          break;
        }

        // Reconcile: Stripe's authoritative amount_total must match what we expected.
        // Mismatch signals metadata corruption or a replay attack — reject the order.
        const expectedTotalCents = Math.round((itemPrice + commissionAud + gstAud) * 100);
        if (Math.abs(amountCents - expectedTotalCents) > 2) {
          logger.error(`[STRIPE] Amount mismatch for session ${session.id}: Stripe=${amountCents}¢ expected=${expectedTotalCents}¢ — order rejected`);
          break;
        }

        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

        const { error: insertError } = await supabase
          .from('orders')
          .insert({
            buyer_id:                 userId,
            seller_id:                sellerId,
            listing_id:               listingId,
            stripe_session_id:        session.id,
            stripe_payment_intent_id: paymentIntentId,
            total_aud:                amountCents / 100,
            item_price_aud:           itemPrice,
            shipping_aud:             0,
            platform_fee_aud:         commissionAud + gstAud,
            commission_pct:           commissionPct,
            gst_aud:                  gstAud,
            seller_proceeds_aud:      sellerProceeds,
            transaction_type:         transactionType,
            commission_config_id:     configId || null,
            status:                   'payment_confirmed',
            buyer_protection:         true,
            shipping_name:     meta.shippingName     || session.customer_details?.name             || null,
            shipping_address:  meta.shippingAddress  || session.shipping_details?.address?.line1   || null,
            shipping_suburb:   meta.shippingSuburb   || session.shipping_details?.address?.city    || null,
            shipping_state:    meta.shippingState    || session.shipping_details?.address?.state   || null,
            shipping_postcode: meta.shippingPostcode || session.shipping_details?.address?.postal_code || null,
          });

        if (insertError) {
          // Unique violation on stripe_session_id → a concurrent webhook delivery
          // already recorded this order. Treat as idempotent success and skip the
          // rest (listing update, offer accept, notifications, and crucially the
          // seller payout) so we never double-pay or double-process.
          if (insertError.code === '23505') {
            logger.info(`[STRIPE] Order for session ${session.id} already inserted concurrently, skipping`);
            break;
          }
          logger.error(`[STRIPE] Order insert failed: ${insertError.message}`);
          throw insertError;
        }

        // Mark listing sold
        if (listingId) {
          await supabase
            .from('listings')
            .update({ status: 'sold', sold_at: new Date().toISOString() })
            .eq('id', listingId);
        }

        // Accept offer if purchase was offer-based
        if (meta.offerId) {
          await supabase
            .from('offers')
            .update({ status: 'accepted' })
            .eq('id', meta.offerId);
        }

        // Notify buyer
        if (userId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type:    'order_confirmed',
            title:   'Order Confirmed',
            body:    `Your payment of $${(amountCents / 100).toFixed(2)} AUD was successful.`,
          });
        }

        // Notify seller
        if (sellerId) {
          await supabase.from('notifications').insert({
            user_id: sellerId,
            type:    'item_sold',
            title:   'Item Sold!',
            body:    `Your listing sold for $${itemPrice.toFixed(2)} AUD. You'll receive $${sellerProceeds.toFixed(2)} after fees.`,
          });
        }

        // Fetch buyer and seller profiles for transactional emails
        const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
          userId   ? supabase.from('profiles').select('email, display_name').eq('id', userId).maybeSingle()   : { data: null },
          sellerId ? supabase.from('profiles').select('email, display_name').eq('id', sellerId).maybeSingle() : { data: null },
        ]);

        // Resolve the card/listing name from metadata or a listing lookup
        let cardName = meta.cardName || '';
        if (!cardName && listingId) {
          const { data: listing } = await supabase
            .from('listings')
            .select('title, vault_item:vault_items!vault_item_id(card_name)')
            .eq('id', listingId)
            .maybeSingle();
          cardName = listing?.vault_item?.card_name || listing?.title || 'Trading Card';
        }

        // Determine the new order id from the insert we just did
        const { data: newOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_session_id', session.id)
          .maybeSingle();
        const orderId = newOrder?.id;

        if (buyerProfile?.email) {
          await sendOrderConfirmed({
            buyerEmail:  buyerProfile.email,
            buyerName:   buyerProfile.display_name || 'Collector',
            cardName,
            itemPrice,
            total:       amountCents / 100,
            orderId,
          });
        }

        if (sellerProfile?.email) {
          await sendItemSold({
            sellerEmail:    sellerProfile.email,
            sellerName:     sellerProfile.display_name || 'Collector',
            cardName,
            itemPrice,
            commissionAud,
            gstAud,
            sellerProceeds,
            orderId,
          });
        }

        // ── Pay the seller their proceeds (Connect transfer, or wallet credit) ──
        if (sellerId && sellerProceeds > 0) {
          await payoutSeller(stripe, {
            sellerId,
            sellerProceeds,
            orderId: newOrder?.id || null,
            listingId,
          });
        }

        logger.info(`[STRIPE] Order recorded for session ${session.id} — commission: $${commissionAud} (${commissionPct}%)`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        logger.warn(`[STRIPE] Payment failed: ${pi.id}`);
        await supabase
          .from('orders')
          .update({ status: 'payment_failed' })
          .eq('stripe_payment_intent_id', pi.id);
        break;
      }

      // Buyer chargebacks: freeze the order payout, reverse/claw back any seller
      // payout, and alert admins so the platform isn't left covering the loss.
      case 'charge.dispute.created': {
        await handleDisputeCreated(stripe, event.data.object);
        break;
      }

      case 'charge.dispute.closed': {
        await handleDisputeClosed(stripe, event.data.object);
        break;
      }

      default:
        logger.debug(`[STRIPE] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error(`[STRIPE] Webhook processing error: ${err.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── POST /refund ────────────────────────────────────────────────────────────
// Admin-only: processes an approved refund request against Stripe.
// Calculates retained fee server-side; never trusts client-supplied amounts.

router.post('/refund', authMiddleware, async (req, res) => {
  try {
    // Admin check via shared helper: accepts the JWT app_metadata claim and
    // falls back to a server-side profiles.is_admin lookup.
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { refundId } = req.body;
    if (!refundId) return res.status(400).json({ error: 'refundId is required' });

    // Load refund + its order
    const { data: refund, error: rErr } = await supabase
      .from('refunds')
      .select('*, order:orders!order_id(id, stripe_payment_intent_id, total_aud, status, refund_status, seller_id, stripe_transfer_id, payout_status, seller_proceeds_aud)')
      .eq('id', refundId)
      .maybeSingle();

    if (rErr || !refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status !== 'approved') return res.status(400).json({ error: 'Refund must be in approved state before processing' });
    if (refund.order?.status === 'refunded') return res.status(400).json({ error: 'Order already refunded' });

    const paymentIntentId = refund.order?.stripe_payment_intent_id;
    if (!paymentIntentId) return res.status(400).json({ error: 'No Stripe payment intent on this order' });

    // Server-side fee retention calculation
    const retentionPct = Number(await getPlatformSetting('refund_fee_retention_pct', 50));
    const totalCommission = Number(refund.commission_aud) + Number(refund.gst_aud);
    const retainedFee = Math.round(totalCommission * (retentionPct / 100) * 100) / 100;
    const refundAmount = Math.round((Number(refund.total_paid_aud) - retainedFee) * 100) / 100;

    if (refundAmount <= 0) return res.status(400).json({ error: 'Calculated refund amount is zero or negative' });

    // Atomically claim the refund (approved → processing) BEFORE calling Stripe.
    // Two concurrent admin clicks would otherwise both pass the status check above
    // and both issue a Stripe refund (double refund). Only the request that flips
    // the row proceeds.
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

    // Issue partial refund via Stripe. The idempotency key is a backstop so a
    // retried request can never create a second refund for this row.
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100), // cents
        reason: 'requested_by_customer',
        metadata: { refundId, retainedFee: String(retainedFee), retentionPct: String(retentionPct) },
      }, { idempotencyKey: `refund_${refundId}` });
    } catch (stripeErr) {
      // Release the claim so the refund can be retried after a Stripe failure.
      await supabase.from('refunds').update({ status: 'approved' }).eq('id', refundId);
      throw stripeErr;
    }

    const now = new Date().toISOString();

    // Update refund record
    await supabase.from('refunds').update({
      status:           'processed',
      stripe_refund_id: stripeRefund.id,
      retained_fee_aud: retainedFee,
      refund_amount_aud: refundAmount,
      processed_at:     now,
    }).eq('id', refundId);

    // Update order status
    await supabase.from('orders').update({
      status:        'refunded',
      refund_status: 'processed',
    }).eq('id', refund.order_id);

    // The seller was paid out at checkout, so refunding only the buyer would
    // leave the platform covering the loss. Claw the seller's proceeds back
    // (reverse the Connect transfer, or debit their wallet) and mark the payout
    // reversed. Best-effort — the buyer refund has already succeeded.
    const reversal = await reverseSellerPayout(stripe, refund.order);
    if (reversal.action === 'transfer_reversed' || reversal.action === 'wallet_clawback') {
      await supabase.from('orders').update({ payout_status: 'reversed' }).eq('id', refund.order_id);
    }

    // Notify buyer
    if (refund.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: refund.buyer_id,
        type:    'refund_processed',
        title:   'Refund Processed',
        body:    `Your refund of $${refundAmount.toFixed(2)} AUD has been issued. Please allow 5-10 business days for it to appear on your statement.`,
      });
    }

    // Notify seller
    if (refund.seller_id) {
      await supabase.from('notifications').insert({
        user_id: refund.seller_id,
        type:    'refund_issued',
        title:   'Refund Issued on Your Sale',
        body:    `A refund of $${refundAmount.toFixed(2)} AUD was issued to the buyer. The platform retained $${retainedFee.toFixed(2)} AUD in processing fees.`,
      });
    }

    // Fetch profiles for transactional emails
    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      refund.buyer_id  ? supabase.from('profiles').select('email, display_name').eq('id', refund.buyer_id).maybeSingle()  : { data: null },
      refund.seller_id ? supabase.from('profiles').select('email, display_name').eq('id', refund.seller_id).maybeSingle() : { data: null },
    ]);

    if (buyerProfile?.email) {
      await sendRefundProcessed({
        buyerEmail:   buyerProfile.email,
        buyerName:    buyerProfile.display_name || 'Collector',
        refundAmount,
        orderId:      refund.order_id,
      });
    }

    if (sellerProfile?.email) {
      await sendRefundIssued({
        sellerEmail:  sellerProfile.email,
        sellerName:   sellerProfile.display_name || 'Collector',
        refundAmount,
        retainedFee,
        orderId:      refund.order_id,
      });
    }

    logger.info(`[STRIPE] Refund processed: ${stripeRefund.id} — $${refundAmount} (retained $${retainedFee})`);
    res.json({ success: true, stripeRefundId: stripeRefund.id, refundAmount, retainedFee });

  } catch (err) {
    logger.error(`[STRIPE] /refund error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /connect/onboard ───────────────────────────────────────────────────

router.post('/connect/onboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { returnUrl, refreshUrl } = req.body;

    if (!returnUrl || !refreshUrl) {
      return res.status(400).json({ error: 'returnUrl and refreshUrl are required' });
    }

    // Fetch seller profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_onboarded, display_name, full_name')
      .eq('id', userId)
      .maybeSingle();

    let accountId = profile?.stripe_connect_account_id;

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { cardpop_user_id: userId },
      });
      accountId = account.id;

      await supabase
        .from('profiles')
        .update({ stripe_connect_account_id: accountId, stripe_connect_onboarded: false })
        .eq('id', userId);
    }

    // Generate hosted onboarding link (expires after ~10 min)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    logger.info(`[STRIPE CONNECT] Onboarding link created for user ${userId}`);
    res.json({ url: accountLink.url, accountId });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/onboard error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /connect/status ─────────────────────────────────────────────────────

router.get('/connect/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_onboarded, wallet_balance_aud')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return res.json({ connected: false, onboarded: false, wallet_balance_aud: profile?.wallet_balance_aud || 0 });
    }

    // Check live status with Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
    const onboarded = account.details_submitted && account.payouts_enabled;

    // Sync onboarded status to our DB if it changed
    if (onboarded !== profile.stripe_connect_onboarded) {
      await supabase
        .from('profiles')
        .update({ stripe_connect_onboarded: onboarded })
        .eq('id', userId);
    }

    res.json({
      connected: true,
      onboarded,
      accountId: profile.stripe_connect_account_id,
      detailsSubmitted: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      wallet_balance_aud: profile?.wallet_balance_aud || 0,
    });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/status error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /connect/dashboard-link ────────────────────────────────────────────

router.post('/connect/dashboard-link', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_onboarded')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return res.status(400).json({ error: 'No Stripe account connected' });
    }

    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id);
    res.json({ url: loginLink.url });
  } catch (err) {
    logger.error(`[STRIPE CONNECT] /connect/dashboard-link error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;


