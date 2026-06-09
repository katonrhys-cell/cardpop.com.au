import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOrderConfirmed, sendItemSold, sendRefundProcessed, sendRefundIssued } from '../utils/emailService.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
    // Fall back to 'none' tier
    const { data: fallback } = await supabase
      .from('fee_config')
      .select('id, fee_pct')
      .eq('seller_tier', 'none')
      .eq('is_active', true)
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

        // Idempotency — skip if we already recorded this session
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (existing) {
          logger.info(`[STRIPE] Order already exists for session ${session.id}, skipping`);
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
    // Admin check — use JWT app_metadata (server-controlled), never trust user_metadata or profile rows
    if (req.user.app_metadata?.is_admin !== true) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { refundId } = req.body;
    if (!refundId) return res.status(400).json({ error: 'refundId is required' });

    // Load refund + its order
    const { data: refund, error: rErr } = await supabase
      .from('refunds')
      .select('*, order:orders!order_id(stripe_payment_intent_id, total_aud, status, refund_status)')
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

    // Issue partial refund via Stripe
    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(refundAmount * 100), // cents
      reason: 'requested_by_customer',
      metadata: { refundId, retainedFee: String(retainedFee), retentionPct: String(retentionPct) },
    });

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

export default router;

