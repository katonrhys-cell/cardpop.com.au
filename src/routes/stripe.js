import 'dotenv/config';
import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';
import { handleDisputeCreated, handleDisputeClosed } from '../services/disputeService.js';
import { calculateBreakdown } from '../services/commissionService.js';
import { handleCheckoutSessionCompleted, handlePaymentFailed, getPlatformSetting } from '../services/stripeWebhookService.js';
import { validateRequestBody, validateRequestQuery } from '../middleware/validateRequest.js';
import { createCheckoutSchema, calculateBreakdownSchema, processRefundSchema } from '../schemas/stripeSchemas.js';
import { createSingleItemCheckout } from '../services/checkoutService.js';
import { priceCart } from '../services/cartService.js';
import { validateWelcomeDiscount, welcomeDiscountCents, buildWelcomeDiscount } from '../services/welcomeOfferService.js';
import { processRefund } from '../services/refundService.js';
import { connectOnboard, getConnectStatus, getDashboardLink, handleConnectAccountUpdated } from '../services/connectService.js';
import { applyStripeSubscription } from '../services/subscriptionService.js';

const router = express.Router();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ─── GET /calculate ──────────────────────────────────────────────────────────

router.get('/calculate', authMiddleware, validateRequestQuery(calculateBreakdownSchema), async (req, res) => {
  try {
    const { listingId, transactionType = 'fixed' } = req.query;

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

router.post('/create-checkout', authMiddleware, validateRequestBody(createCheckoutSchema), createSingleItemCheckout);

// ─── POST /create-cart-checkout ──────────────────────────────────────────────
// Multi-item cart checkout. Each item is priced server-side from its source of
// truth — never trust client prices/totals. Admin "shop" products (shop_products)
// are platform-owned: GST only, no commission. Marketplace "listing" items use
// the normal commission + GST breakdown. A single Stripe session collects the
// payment; a 'pending' order row is written as the snapshot the webhook confirms.

// Preview the authoritative cart total (so the UI never shows a number that
// differs from what Stripe will charge).
router.post('/calculate-cart', authMiddleware, async (req, res) => {
  try {
    const { items, promoCode } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items is required' });
    const priced = await priceCart(items, req.user.id);

    // Preview the welcome-offer discount without creating any Stripe objects.
    // An invalid code doesn't fail the whole calculation — the UI shows
    // `promoError` inline and the undiscounted totals stay correct.
    let discountCents = 0;
    let promoError = null;
    if (typeof promoCode === 'string' && promoCode.trim()) {
      try {
        const offer = await validateWelcomeDiscount(req.user.id, promoCode);
        discountCents = welcomeDiscountCents(offer, priced.itemsCents);
      } catch (promoErr) {
        if (!promoErr.statusCode) throw promoErr;
        promoError = promoErr.message;
      }
    }

    res.json({
      items:       priced.orderLines,
      subtotalAud: priced.itemsCents / 100,
      commissionAud: priced.commissionCents / 100,
      gstAud:      priced.gstCents / 100,
      discountAud: discountCents / 100,
      promoError,
      totalAud:    (priced.grandCents - discountCents) / 100,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] /calculate-cart error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

router.post('/create-cart-checkout', authMiddleware, async (req, res) => {
  try {
    const { items, successUrl, cancelUrl, shippingAddress, promoCode } = req.body;

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

    // Welcome-offer promo code: platform-funded amount-off coupon covering 10%
    // of the item subtotal only (never the fee/GST lines, never seller
    // proceeds). The webhook marks it redeemed after payment completes.
    let discounts;
    let discountCents = 0;
    let welcomeOfferId = null;
    if (typeof promoCode === 'string' && promoCode.trim()) {
      const offer = await validateWelcomeDiscount(userId, promoCode);
      const built = await buildWelcomeDiscount(stripe, offer, itemsCents);
      if (built) {
        discounts = [{ coupon: built.couponId }];
        discountCents = built.discountCents;
        welcomeOfferId = offer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items:           lineItems,
      mode:                 'payment',
      success_url:          successUrl,
      cancel_url:           cancelUrl,
      customer_email:       email,
      metadata:             { userId, cartCheckout: 'true', ...(welcomeOfferId ? { welcomeOfferId } : {}) },
      ...(discounts ? { discounts } : {}),
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
      discount_aud:      discountCents / 100,
      total_aud:         (grandCents - discountCents) / 100,
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
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, stripe);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

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

      // Membership subscription lifecycle (free trial → active → canceled).
      // Mirrors the subscription state onto the seller's profile so the
      // selling gate (can_sell) reflects it.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
        await applyStripeSubscription(event.data.object);
        break;

      // Connected-account identity/KYC updates: Stripe verifies seller identity
      // during Connect onboarding, so mirror its decision onto the profile's
      // Verified badge (Connect is the sole identity-verification path).
      case 'account.updated':
        await handleConnectAccountUpdated(event.data.object);
        break;

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

router.post('/refund', authMiddleware, validateRequestBody(processRefundSchema), processRefund);

// ─── POST /connect/onboard ───────────────────────────────────────────────────

router.post('/connect/onboard', authMiddleware, connectOnboard);

// ─── GET /connect/status ─────────────────────────────────────────────────────

router.get('/connect/status', authMiddleware, getConnectStatus);

// ─── POST /connect/dashboard-link ────────────────────────────────────────────

router.post('/connect/dashboard-link', authMiddleware, getDashboardLink);

export default router;


