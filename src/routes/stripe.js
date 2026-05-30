import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// POST /create-checkout — creates a Stripe Checkout Session (auth required)
router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    const {
      items, total, customerEmail,
      successUrl, cancelUrl,
      shippingAddress, vaultItemId,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required and must not be empty' });
    }
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }
    if (total === undefined || total === null) {
      return res.status(400).json({ error: 'total is required' });
    }

    const userId = req.user.id;
    const email = customerEmail || req.user.email;

    logger.info(`[STRIPE] Creating checkout session for user: ${userId}`);

    const lineItems = items.map((item) => {
      if (!item.name || item.price === undefined || item.quantity === undefined) {
        throw new Error('Each item must have name, price, and quantity');
      }
      return {
        price_data: {
          currency: 'aud',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    // Pack metadata — Stripe enforces 500 chars per value, 50 keys, 8 KB total
    const metadata = {
      userId,
      itemCount: String(items.length),
    };
    if (vaultItemId) metadata.vaultItemId = String(vaultItemId);

    // Serialise items for order reconstruction after webhook fires
    const itemsJson = JSON.stringify(
      items.map(i => ({ name: i.name, price: i.price, qty: i.quantity }))
    );
    if (itemsJson.length <= 500) metadata.items = itemsJson;

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
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata,
    });

    if (!session?.url) {
      throw new Error('Stripe returned a session without a URL');
    }

    logger.info(`[STRIPE] Session created: ${session.id}`);
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    logger.error(`[STRIPE] create-checkout error: ${error.message}`);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /session/:sessionId — returns session summary (auth required, owner only)
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    logger.info(`[STRIPE] Retrieving session: ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (!session) {
      return res.status(404).json({ error: 'Checkout session not found' });
    }

    // Only the session owner may view it
    if (session.metadata?.userId && session.metadata.userId !== req.user.id) {
      logger.warn(`[STRIPE] Unauthorised session access by ${req.user.id} for ${sessionId}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const items = (session.line_items?.data || []).map((item) => ({
      name: item.description || item.price?.product?.name || 'Unknown',
      quantity: item.quantity,
      unitAmount: item.price?.unit_amount || 0,
      currency: item.price?.currency || 'aud',
    }));

    res.json({
      id: session.id,
      status: session.payment_status,
      amountTotal: session.amount_total,
      customerEmail: session.customer_details?.email,
      items,
    });
  } catch (error) {
    logger.error(`[STRIPE] get-session error: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// POST /webhook — raw body required; verified by Stripe signature
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
    // req.body is a Buffer because the global JSON middleware was skipped for this path
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
        const userId = meta.userId || null;
        const vaultItemId = meta.vaultItemId || null;

        let parsedItems = [];
        try { parsedItems = JSON.parse(meta.items || '[]'); } catch (_) {}

        const amountCents = session.amount_total || 0;
        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

        // For vault-item purchases, look up the corresponding listing
        let listingId = null;
        let sellerId = null;
        if (vaultItemId) {
          const { data: listing } = await supabase
            .from('listings')
            .select('id, seller_id')
            .eq('vault_item_id', vaultItemId)
            .eq('status', 'active')
            .maybeSingle();
          if (listing) {
            listingId = listing.id;
            sellerId = listing.seller_id;
          }
        }

        const { error: insertError } = await supabase
          .from('orders')
          .insert({
            buyer_id: userId,
            seller_id: sellerId,
            listing_id: listingId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            total_aud: amountCents / 100,
            item_price_aud: amountCents / 100,
            shipping_aud: 0,
            platform_fee_aud: 0,
            status: 'payment_confirmed',
            order_items: parsedItems.length ? parsedItems : null,
            shipping_name:     meta.shippingName     || session.customer_details?.name             || null,
            shipping_address:  meta.shippingAddress  || session.shipping_details?.address?.line1   || null,
            shipping_suburb:   meta.shippingSuburb   || session.shipping_details?.address?.city    || null,
            shipping_state:    meta.shippingState    || session.shipping_details?.address?.state   || null,
            shipping_postcode: meta.shippingPostcode || session.shipping_details?.address?.postal_code || null,
            buyer_protection: true,
          });

        if (insertError) {
          logger.error(`[STRIPE] Order insert failed: ${insertError.message}`);
          throw insertError;
        }

        // Mark the listing as sold
        if (listingId) {
          await supabase
            .from('listings')
            .update({ status: 'sold', sold_at: new Date().toISOString() })
            .eq('id', listingId);
        }

        // Notify the buyer
        if (userId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'order_confirmed',
            title: 'Order Confirmed',
            body: `Your payment of $${(amountCents / 100).toFixed(2)} AUD was successful.`,
          });
        }

        logger.info(`[STRIPE] Order recorded for session ${session.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        logger.warn(`[STRIPE] Payment failed: ${pi.id}`);
        // If an order was already created (edge case), mark it failed
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
  } catch (error) {
    logger.error(`[STRIPE] Webhook processing error: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
