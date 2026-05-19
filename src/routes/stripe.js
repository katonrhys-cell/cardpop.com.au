import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import logger from '../utils/logger.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/create-checkout', async (req, res) => {
  const { items, subtotal, tax, discount, total, customerEmail, successUrl, cancelUrl } = req.body;

  // Validate required fields
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required and must not be empty' });
  }

  if (!successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
  }

  if (total === undefined || total === null) {
    return res.status(400).json({ error: 'total is required' });
  }

  logger.info(`[STRIPE] Creating checkout session for customer: ${customerEmail || 'guest'}`);
  logger.debug(`[STRIPE] Items: ${items.length}, Total: $${total}`);

  // Build line items for Stripe
  const lineItems = items.map((item) => {
    if (!item.name || item.price === undefined || item.quantity === undefined) {
      throw new Error('Each item must have name, price, and quantity');
    }

    const unitAmount = Math.round(item.price * 100); // Convert to cents

    return {
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
        },
        unit_amount: unitAmount,
      },
      quantity: item.quantity,
    };
  });

  logger.debug(`[STRIPE] Line items prepared: ${lineItems.length} items`);

  // Create Stripe Checkout Session
  logger.debug(`[STRIPE] Calling stripe.checkout.sessions.create()`);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
  });

  if (!session || !session.url) {
    logger.error('[STRIPE] Checkout session created but no URL returned');
    throw new Error('Failed to create checkout session: no URL returned');
  }

  logger.info(`[STRIPE] Checkout session created successfully: ${session.id}`);
  logger.debug(`[STRIPE] Session URL: ${session.url}`);

  res.json({
    url: session.url,
  });
});

router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || sessionId.trim() === '') {
    return res.status(400).json({ error: 'sessionId parameter is required' });
  }

  logger.info(`[STRIPE] Retrieving checkout session: ${sessionId}`);

  // Retrieve session from Stripe
  logger.debug(`[STRIPE] Calling stripe.checkout.sessions.retrieve()`);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items'],
  });

  if (!session) {
    logger.error(`[STRIPE] Session not found: ${sessionId}`);
    throw new Error(`Checkout session not found: ${sessionId}`);
  }

  logger.info(`[STRIPE] Session retrieved successfully: ${session.id}`);
  logger.debug(`[STRIPE] Payment status: ${session.payment_status}`);

  // Format line items
  const items = (session.line_items?.data || []).map((item) => ({
    name: item.description || item.price?.product?.name || 'Unknown',
    quantity: item.quantity,
    unitAmount: item.price?.unit_amount || 0,
    currency: item.price?.currency || 'usd',
  }));

  res.json({
    id: session.id,
    status: session.payment_status,
    amountTotal: session.amount_total,
    customerEmail: session.customer_details?.email,
    items,
  });
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    logger.warn('[STRIPE] Webhook received without signature');
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
    logger.warn(`[STRIPE] Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle webhook events
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        logger.info(`[STRIPE] Checkout session completed: ${event.data.object.id}`);
        // Handle successful payment
        break;
      case 'payment_intent.succeeded':
        logger.info(`[STRIPE] Payment intent succeeded: ${event.data.object.id}`);
        // Handle successful payment
        break;
      case 'payment_intent.payment_failed':
        logger.warn(`[STRIPE] Payment intent failed: ${event.data.object.id}`);
        // Handle failed payment
        break;
      default:
        logger.debug(`[STRIPE] Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error(`[STRIPE] Error processing webhook: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;