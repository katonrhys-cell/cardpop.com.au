import 'dotenv/config';
import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  getOrCreateStripeCustomer,
  applyPaypalSubscription,
  mapPaypalStatus,
  getSubscriptionStatus,
} from '../services/subscriptionService.js';
import {
  isPaypalConfigured,
  createPaypalSubscription,
  getPaypalSubscription,
  verifyPaypalWebhook,
} from '../utils/paypalClient.js';
import { TRIAL_DAYS, ENV, normalizePaidTier } from '../../config/subscription.js';
import { validatePartnerCode } from '../services/partnerService.js';

const router = express.Router();

// ─── GET /status ─────────────────────────────────────────────────────────────
// Current entitlement snapshot for the authenticated user.
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = await getSubscriptionStatus(req.user.id);
    res.json(status || { subscription_status: 'none', trial_ends_at: null });
  } catch (err) {
    logger.error(`[SUB] /status error: ${err.message}`);
    res.status(500).json({ error: 'Failed to load subscription status' });
  }
});

// ─── POST /stripe/checkout ───────────────────────────────────────────────────
// Start the trial via Stripe Checkout in subscription mode. The card is captured
// but NOT charged until the trial ends (trial_period_days). Returns a hosted URL.
// `tier` picks which paid plan is bought ('pro' | 'premium' | 'elite' |
// 'ultimate', default 'pro'); each tier bills against its own Stripe price.
router.post('/stripe/checkout', authMiddleware, async (req, res) => {
  try {
    const tier = normalizePaidTier(req.body?.tier);
    const priceId = process.env[ENV.stripePriceIds[tier]];
    if (!priceId) {
      logger.error(`[SUB] ${ENV.stripePriceIds[tier]} not configured`);
      return res.status(503).json({ error: `The ${tier} plan is not available yet.` });
    }

    const { successUrl, cancelUrl, refCode } = req.body;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }

    const userId = req.user.id;
    const customerId = await getOrCreateStripeCustomer(userId, req.user.email);

    // Partner referral: the partner's % comes off the first invoice (a 'once'
    // coupon — with a trial that's the trial-end invoice), and the commission
    // is booked when the subscription first turns active. The expected first
    // payment is stamped into the subscription metadata now so the webhook
    // doesn't have to re-derive pricing. An invalid ref code never blocks the
    // trial — it's silently dropped.
    let discounts;
    // `tier` in the metadata is what the webhook mirrors onto
    // profiles.subscription_tier when the subscription is entitled.
    const subMetadata = { userId, tier };
    if (typeof refCode === 'string' && refCode.trim()) {
      try {
        const partner = await validatePartnerCode(userId, refCode);
        const price = await stripe.prices.retrieve(priceId);
        const unitAmount = price?.unit_amount || 0;
        const firstPaymentCents = Math.round(unitAmount * (1 - Number(partner.discount_pct) / 100));
        if (Number(partner.discount_pct) > 0) {
          const coupon = await stripe.coupons.create({
            percent_off: Number(partner.discount_pct),
            duration: 'once',
            name: `Partner ${partner.code} ${Number(partner.discount_pct)}% off`,
          });
          discounts = [{ coupon: coupon.id }];
        }
        subMetadata.partnerId = partner.id;
        subMetadata.partnerCode = partner.code;
        subMetadata.partnerFirstPaymentCents = String(firstPaymentCents);
        logger.info(`[SUB] Referral ${partner.code} attached to checkout for ${userId}`);
      } catch (refErr) {
        if (!refErr.statusCode) throw refErr;
        logger.info(`[SUB] Ignoring invalid ref code for ${userId}: ${refErr.message}`);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: subMetadata,
      },
      payment_method_collection: 'always', // require a card even during the trial
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, kind: 'subscription' },
      ...(discounts ? { discounts } : {}),
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');
    logger.info(`[SUB] Stripe subscription checkout created for ${userId}: ${session.id}`);
    res.json({ url: session.url });
  } catch (err) {
    logger.error(`[SUB] /stripe/checkout error: ${err.message}`);
    res.status(500).json({ error: 'Could not start Stripe checkout' });
  }
});

// ─── POST /paypal/create ─────────────────────────────────────────────────────
// Create a PayPal subscription against the trial plan; returns the approval URL.
router.post('/paypal/create', authMiddleware, async (req, res) => {
  try {
    if (!isPaypalConfigured()) {
      return res.status(503).json({ error: 'PayPal is not configured yet.' });
    }
    const { returnUrl, cancelUrl } = req.body;
    if (!returnUrl || !cancelUrl) {
      return res.status(400).json({ error: 'returnUrl and cancelUrl are required' });
    }

    const tier = normalizePaidTier(req.body?.tier);
    const { id, approveUrl } = await createPaypalSubscription({
      userId: req.user.id,
      email: req.user.email,
      returnUrl,
      cancelUrl,
      tier,
    });
    if (!approveUrl) throw new Error('PayPal did not return an approval link');

    // Persist the pending subscription id so the return handler / webhook can
    // resolve the user even before the webhook arrives.
    await applyPaypalSubscription({
      userId: req.user.id,
      paypalSubscriptionId: id,
      status: 'none', // not entitled until approved/active
    });

    logger.info(`[SUB] PayPal subscription created for ${req.user.id}: ${id}`);
    res.json({ id, approveUrl });
  } catch (err) {
    logger.error(`[SUB] /paypal/create error: ${err.message}`);
    res.status(500).json({ error: 'Could not start PayPal checkout' });
  }
});

// ─── POST /paypal/activate ───────────────────────────────────────────────────
// Called when the buyer returns from PayPal approval. Confirms the live state
// with PayPal and mirrors it onto the profile (webhook remains source of truth).
router.post('/paypal/activate', authMiddleware, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId is required' });

    const sub = await getPaypalSubscription(subscriptionId);
    // Guard: the subscription must belong to this user. custom_id is set to the
    // owner's user id at creation (paypalClient.createPaypalSubscription), so a
    // missing/empty custom_id is treated as a hard failure rather than skipping
    // the check — otherwise a user could claim a custom_id-less subscription's
    // entitlement onto their own account.
    if (sub.custom_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const status = mapPaypalStatus(sub.status);
    const trialEndsAt = sub.billing_info?.next_billing_time || null;
    await applyPaypalSubscription({
      userId: req.user.id,
      paypalSubscriptionId: subscriptionId,
      status,
      trialEndsAt,
      planId: sub.plan_id || null,
    });

    res.json({ subscription_status: status });
  } catch (err) {
    logger.error(`[SUB] /paypal/activate error: ${err.message}`);
    res.status(500).json({ error: 'Could not confirm PayPal subscription' });
  }
});

// ─── POST /paypal/webhook ────────────────────────────────────────────────────
// PayPal billing events. Verified via the verify-webhook-signature API.
router.post('/paypal/webhook', async (req, res) => {
  try {
    const verified = await verifyPaypalWebhook({ headers: req.headers, body: req.body });
    if (!verified) {
      logger.warn('[SUB] PayPal webhook failed verification');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;
    const resource = event.resource || {};
    const subscriptionId = resource.id;
    const userId = resource.custom_id || null;

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await applyPaypalSubscription({
          userId,
          paypalSubscriptionId: subscriptionId,
          status: mapPaypalStatus(resource.status),
          trialEndsAt: resource.billing_info?.next_billing_time || null,
          planId: resource.plan_id || null,
        });
        break;
      default:
        logger.debug(`[SUB] Unhandled PayPal event: ${event.event_type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error(`[SUB] PayPal webhook error: ${err.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
