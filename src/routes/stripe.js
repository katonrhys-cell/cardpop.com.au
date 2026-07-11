import 'dotenv/config';
import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';
import { handleDisputeCreated, handleDisputeClosed } from '../services/disputeService.js';
import { calculateBreakdown } from '../services/commissionService.js';
import { handleCheckoutSessionCompleted, handlePaymentFailed, handleCheckoutSessionExpired, getPlatformSetting } from '../services/stripeWebhookService.js';
import { validateRequestBody, validateRequestQuery } from '../middleware/validateRequest.js';
import { createCheckoutSchema, calculateBreakdownSchema, processRefundSchema } from '../schemas/stripeSchemas.js';
import { createSingleItemCheckout } from '../services/checkoutService.js';
import { priceCart } from '../services/cartService.js';
import { validateWelcomeDiscount, welcomeDiscountCents, buildWelcomeDiscount } from '../services/welcomeOfferService.js';
import {
  isWelcomeCodeFormat,
  validatePartnerCode,
  partnerDiscountCents,
  buildPartnerDiscount,
} from '../services/partnerService.js';
import { processRefund } from '../services/refundService.js';
import { connectOnboard, getConnectStatus, getDashboardLink } from '../services/connectService.js';
import { createIdentitySession, getIdentityStatus, applyIdentitySession } from '../services/identityService.js';
import { applyStripeSubscription } from '../services/subscriptionService.js';
import { ensureWalletCustomer, getWalletBalanceCents, handleWalletTopup } from '../services/walletService.js';
import { validateShippingAddress } from '../utils/addressValidation.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { isValidAbn, normalizeAbn } from '../../utils/abn.js';

const router = express.Router();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Email-verification gate that only applies to signed-in buyers. Guest checkout
// runs behind optionalAuthMiddleware (no req.user), and a guest has no account
// to verify — so the gate is skipped for them and only enforced for logged-in
// users when the platform flag is on.
const requireEmailVerifiedIfAuthed = (req, res, next) =>
  (req.user ? requireEmailVerified(req, res, next) : next());

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

router.post('/create-checkout', authMiddleware, requireEmailVerified, validateRequestBody(createCheckoutSchema), createSingleItemCheckout);

// ─── POST /create-cart-checkout ──────────────────────────────────────────────
// Multi-item cart checkout. Each item is priced server-side from its source of
// truth — never trust client prices/totals. Admin "shop" products (shop_products)
// are platform-owned: GST only, no commission. Marketplace "listing" items use
// the normal commission + GST breakdown. A single Stripe session collects the
// payment; a 'pending' order row is written as the snapshot the webhook confirms.

// Preview the authoritative cart total (so the UI never shows a number that
// differs from what Stripe will charge).
router.post('/calculate-cart', optionalAuthMiddleware, async (req, res) => {
  try {
    const { items, promoCode, useWalletBalance } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items is required' });
    if (promoCode && useWalletBalance) {
      return res.status(400).json({ error: 'Apply either a promo code or your wallet balance, not both.' });
    }
    // Guests check out without an account. userId is null for them, which
    // priceCart tolerates (they can't be the seller of any listing), and promo
    // codes / wallet balance are account-only perks that are simply ignored.
    const userId = req.user?.id ?? null;
    const priced = await priceCart(items, userId);

    // Preview the promo discount without creating any Stripe objects. Codes in
    // the POP-XXXX-XXXX shape are personal welcome offers; anything else is a
    // partner referral code (discounts shop items only). An invalid code
    // doesn't fail the whole calculation — the UI shows `promoError` inline
    // and the undiscounted totals stay correct.
    let discountCents = 0;
    let promoError = null;
    let walletBalanceCents = 0;
    let walletAppliedCents = 0;
    if (!userId) {
      // Guest: no welcome offer / partner attribution / wallet — leave totals
      // undiscounted and don't surface an error for a harmlessly-ignored code.
    } else if (typeof promoCode === 'string' && promoCode.trim()) {
      try {
        if (isWelcomeCodeFormat(promoCode)) {
          const offer = await validateWelcomeDiscount(userId, promoCode);
          discountCents = welcomeDiscountCents(offer, priced.itemsCents);
        } else {
          const partner = await validatePartnerCode(userId, promoCode);
          discountCents = partnerDiscountCents(partner, priced.orderLines);
          if (discountCents <= 0) promoError = 'This code applies to CardPop Shop items only.';
        }
      } catch (promoErr) {
        if (!promoErr.statusCode) throw promoErr;
        promoError = promoErr.message;
      }
    } else if (useWalletBalance) {
      // Live read from Stripe — CardPop keeps no local wallet ledger for buyers.
      walletBalanceCents = await getWalletBalanceCents(stripe, userId);
      walletAppliedCents = Math.min(walletBalanceCents, priced.grandCents);
    }

    res.json({
      items:       priced.orderLines,
      subtotalAud: priced.itemsCents / 100,
      commissionAud: priced.commissionCents / 100,
      gstAud:      priced.gstCents / 100,
      shippingAud: priced.shippingCents / 100,
      discountAud: (discountCents + walletAppliedCents) / 100,
      walletBalanceAud: walletBalanceCents / 100,
      walletAppliedAud: walletAppliedCents / 100,
      promoError,
      totalAud:    (priced.grandCents - discountCents - walletAppliedCents) / 100,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] /calculate-cart error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

router.post('/create-cart-checkout', optionalAuthMiddleware, requireEmailVerifiedIfAuthed, async (req, res) => {
  try {
    const { items, successUrl, cancelUrl, returnUrl, uiMode, shippingAddress, promoCode, useWalletBalance, billingDetails, email: guestEmailInput, subscribeNewsletter } = req.body;

    // Guest checkout: no account required. A guest has no user id — promo codes,
    // wallet balance and partner attribution are account-only and are skipped
    // for them. The email they typed at checkout is the receipt address (and,
    // if they opted in, the newsletter address).
    const userId = req.user?.id || null;
    const email  = (req.user?.email || (typeof guestEmailInput === 'string' ? guestEmailInput.trim() : '')) || null;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required to place an order.' });
    }
    const wantsNewsletter = subscribeNewsletter === true || subscribeNewsletter === 'true';

    // Business / ABN buyers get a proper tax invoice. Re-validate the ABN
    // server-side — never trust the client's checksum. Anything invalid is
    // simply dropped so a bad value can't block an otherwise-fine order.
    const business = billingDetails && isValidAbn(billingDetails.abn)
      ? { abn: normalizeAbn(billingDetails.abn), name: String(billingDetails.businessName || '').trim().slice(0, 120) }
      : null;

    // 'embedded' renders Stripe's payment form inline on our own page (no
    // redirect away); 'hosted' redirects to Stripe's own checkout page. Both
    // create an identical Checkout Session — only how the buyer sees it differs.
    const embedded = uiMode === 'embedded';

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }
    if (embedded) {
      if (!returnUrl) return res.status(400).json({ error: 'returnUrl is required' });
    } else if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }
    if (promoCode && useWalletBalance) {
      return res.status(400).json({ error: 'Apply either a promo code or your wallet balance, not both.' });
    }

    // Authoritative "real, deliverable address" gate. The client autocompletes
    // via Amazon Location Service, but a bypassed frontend can't slip a fake
    // address past this server-side check (fails open only when no key is set).
    const addressCheck = await validateShippingAddress(shippingAddress || {});
    if (!addressCheck.valid) {
      const message = addressCheck.reason === 'request-failed'
        ? 'We could not verify that shipping address right now. Please try again.'
        : 'That shipping address could not be verified. Please select a valid address from the suggestions.';
      logger.warn(`[STRIPE] cart checkout blocked — address ${addressCheck.reason || 'invalid'}`);
      return res.status(400).json({ error: message, code: 'address_unverified' });
    }

    const { lineItems, orderLines, itemsCents, commissionCents, gstCents, shippingCents, grandCents } = await priceCart(items, userId);

    // Fraud control: cap order size / frequency for brand-new, unverified buyers.
    const velocity = await checkPurchaseVelocity({ userId, orderValueAud: grandCents / 100 });
    if (!velocity.allowed) {
      logger.warn(`[VELOCITY] Blocked cart checkout for ${userId} (${velocity.reason})`);
      return res.status(429).json({ error: velocity.message, code: 'velocity_limit' });
    }

    // Promo code: platform-funded amount-off coupon. POP-XXXX-XXXX codes are
    // personal welcome offers (10% of the whole item subtotal); anything else
    // is a partner referral code (partner's % off the SHOP-item subtotal, and
    // the webhook books the partner's commission after payment completes).
    let discounts;
    let discountCents = 0;
    let welcomeOfferId = null;
    let partnerMeta = {};
    let walletCents = 0;
    let walletCustomerId = null;
    if (!userId) {
      // Guest checkout — promo codes, wallet balance and partner attribution are
      // all account-scoped, so any supplied code is harmlessly ignored.
    } else if (typeof promoCode === 'string' && promoCode.trim()) {
      if (isWelcomeCodeFormat(promoCode)) {
        const offer = await validateWelcomeDiscount(userId, promoCode);
        const built = await buildWelcomeDiscount(stripe, offer, itemsCents);
        if (built) {
          discounts = [{ coupon: built.couponId }];
          discountCents = built.discountCents;
          welcomeOfferId = offer.id;
        }
      } else {
        const partner = await validatePartnerCode(userId, promoCode);
        const built = await buildPartnerDiscount(stripe, partner, partnerDiscountCents(partner, orderLines));
        if (built) {
          discounts = [{ coupon: built.couponId }];
          discountCents = built.discountCents;
        }
        // Attribute the order even when the discount rounds to zero — the
        // partner's commission doesn't depend on the customer's discount.
        partnerMeta = {
          partnerId: partner.id,
          partnerCode: partner.code,
          partnerDiscountCents: String(discountCents),
        };
      }
    } else if (useWalletBalance) {
      // Wallet balance lives on the Stripe Customer, not our DB — spend it as a
      // one-off coupon on this session, then debit it in the webhook only once
      // payment actually completes (never pre-emptively, in case checkout is
      // abandoned).
      walletCustomerId = await ensureWalletCustomer(stripe, userId, { email });
      const availableCents = await getWalletBalanceCents(stripe, userId);
      walletCents = Math.min(availableCents, grandCents);
      if (walletCents > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: walletCents,
          currency: 'aud',
          duration: 'once',
          name: 'CardPop wallet balance',
        });
        discounts = [{ coupon: coupon.id }];
        discountCents = walletCents;
      }
    }

    // For business buyers, attach the ABN to a Stripe Customer as an `au_abn`
    // tax id and generate an invoice, so the buyer receives a valid Australian
    // tax invoice. Reuses the wallet customer if one was already resolved. Any
    // failure here is logged but never blocks the payment.
    let billingCustomerId = walletCustomerId;
    if (business) {
      try {
        // Registered buyers reuse their wallet Customer (keyed on user id); a
        // guest has none, so create a one-off Customer just for the invoice.
        billingCustomerId = billingCustomerId
          || (userId
            ? await ensureWalletCustomer(stripe, userId, { email, displayName: business.name })
            : (await stripe.customers.create({ email, name: business.name || undefined })).id);
        if (business.name) {
          await stripe.customers.update(billingCustomerId, { name: business.name });
        }
        const existing = await stripe.customers.listTaxIds(billingCustomerId, { limit: 100 });
        const alreadyAttached = existing.data.some(t => t.type === 'au_abn' && t.value === business.abn);
        if (!alreadyAttached) {
          await stripe.customers.createTaxId(billingCustomerId, { type: 'au_abn', value: business.abn });
        }
      } catch (taxErr) {
        logger.warn(`[STRIPE] Could not attach ABN for user ${userId}: ${taxErr.message}`);
      }
    }

    const session = await stripe.checkout.sessions.create({
      // Let Stripe present every method enabled on the account (Card, Link /
      // Apple Pay / Google Pay, PayPal, Afterpay/Clearpay) and show each only
      // when the order is eligible — enable the individual methods in the
      // Stripe Dashboard → Settings → Payment methods.
      automatic_payment_methods: { enabled: true },
      billing_address_collection: 'auto',
      line_items:           lineItems,
      mode:                 'payment',
      // Embedded checkout keeps the buyer on our page and returns to return_url
      // once payment completes; hosted checkout redirects out and back.
      ...(embedded
        ? { ui_mode: 'embedded', return_url: returnUrl }
        : { success_url: successUrl, cancel_url: cancelUrl }),
      ...(billingCustomerId ? { customer: billingCustomerId } : { customer_email: email }),
      // Business buyers get an itemised tax invoice carrying their ABN.
      ...(business ? { invoice_creation: { enabled: true } } : {}),
      metadata:             {
        userId: userId || '', cartCheckout: 'true',
        // Guest orders have no buyer_id — carry the email so the webhook can
        // still send the receipt and (if opted in) the newsletter subscription.
        ...(userId ? {} : { guestCheckout: 'true', guestEmail: email }),
        ...(wantsNewsletter ? { subscribeNewsletter: 'true' } : {}),
        ...(welcomeOfferId ? { welcomeOfferId } : {}),
        ...partnerMeta,
        ...(walletCents > 0 ? { walletCents: String(walletCents) } : {}),
        ...(business ? { billingAbn: business.abn, billingBusinessName: business.name } : {}),
      },
      ...(discounts ? { discounts } : {}),
    });

    if (embedded ? !session?.client_secret : !session?.url) {
      throw new Error('Stripe returned an incomplete checkout session');
    }

    const s = shippingAddress || {};
    const streetLine = s.address2 ? `${s.address2}, ${s.address || ''}`.trim() : (s.address || '');
    const { error: orderErr } = await supabase.from('orders').insert({
      buyer_id:          userId,
      // Only guests carry buyer_email (a registered buyer's email comes from
      // their profile). Keeping it off the registered-buyer insert leaves that
      // common path byte-identical to before, so it can't break in the window
      // before the buyer_email migration lands.
      ...(userId ? {} : { buyer_email: email }),
      seller_id:         null,
      listing_id:        null,
      stripe_session_id: session.id,
      item_price_aud:    itemsCents / 100,
      shipping_aud:      shippingCents / 100,
      platform_fee_aud:  (commissionCents + gstCents) / 100,
      gst_aud:           gstCents / 100,
      discount_aud:      discountCents / 100,
      total_aud:         (grandCents - discountCents) / 100,
      transaction_type:  'cart',
      status:            'pending',
      buyer_protection:  true,
      order_items:       orderLines,
      shipping_name:     s.name     ? String(s.name).slice(0, 100)     : null,
      shipping_address:  streetLine ? String(streetLine).slice(0, 200)  : null,
      shipping_suburb:   s.suburb   ? String(s.suburb).slice(0, 100)   : null,
      shipping_state:    s.state    ? String(s.state).slice(0, 50)     : null,
      shipping_postcode: s.postcode ? String(s.postcode).slice(0, 10)  : null,
      // Only present for business purchases — keeps the common checkout insert
      // byte-identical to before, so it can't break in the window before the
      // billing_* migration lands. The ABN is also on the session metadata as a
      // fallback record either way.
      ...(business ? { billing_business_name: business.name || null, billing_abn: business.abn } : {}),
    });

    if (orderErr) {
      logger.error(`[STRIPE] pending cart order insert failed: ${orderErr.message}`);
      throw new Error('Could not record the order');
    }

    logger.info(`[STRIPE] Cart session created: ${session.id} (${orderLines.length} items, $${grandCents / 100}, ${embedded ? 'embedded' : 'hosted'})`);
    res.json({
      ...(embedded ? { clientSecret: session.client_secret } : { url: session.url }),
      sessionId: session.id,
      total: grandCents / 100,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] create-cart-checkout error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

// ─── GET /session/:sessionId ─────────────────────────────────────────────────

router.get('/session/:sessionId', optionalAuthMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) return res.status(400).json({ error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (!session) return res.status(404).json({ error: 'Checkout session not found' });

    // A registered buyer's receipt is private to them (guard on the session's
    // userId metadata). A guest order has no userId — the unguessable Stripe
    // session id in the return URL is the capability that lets the buyer view
    // their own confirmation, so no auth is required for it.
    const sessionUserId = session.metadata?.userId;
    if (sessionUserId && sessionUserId !== req.user?.id) {
      logger.warn(`[STRIPE] Unauthorised session access by ${req.user?.id || 'guest'} for ${sessionId}`);
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

  // Event-level idempotency: skip an event we've already fully processed, so a
  // Stripe redelivery doesn't re-run handlers. Fail-open — if the dedup table is
  // unreachable (or not yet migrated), fall through and let the per-handler
  // guards (unique stripe_session_id, compare-and-swap on status) do their job.
  try {
    const { data: seen } = await supabase
      .from('stripe_webhook_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (seen) {
      logger.info(`[STRIPE] Event ${event.id} (${event.type}) already processed, skipping`);
      return res.json({ received: true, deduped: true });
    }
  } catch { /* dedup unavailable — process anyway */ }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata?.walletTopup === 'true') {
          await handleWalletTopup(session, stripe);
        } else {
          await handleCheckoutSessionCompleted(session, stripe);
        }
        break;
      }

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object);
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

      // Stripe Identity document checks (signup ID verification): mirror the
      // outcome onto profiles.is_verified / verification_status.
      case 'identity.verification_session.verified':
      case 'identity.verification_session.processing':
      case 'identity.verification_session.requires_input':
        await applyIdentitySession(event.data.object);
        break;

      // Membership subscription lifecycle (free trial → active → canceled).
      // Mirrors the subscription state onto the seller's profile so the
      // selling gate (can_sell) reflects it.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
        await applyStripeSubscription(event.data.object);
        break;

      default:
        logger.debug(`[STRIPE] Unhandled event type: ${event.type}`);
    }

    // Record the event as processed only after the handler succeeded, so a
    // handler that throws (→ 500) isn't marked done and Stripe's retry will
    // reprocess it. Best-effort: a dedup-table write failure must not fail an
    // otherwise-successful webhook (Stripe would retry and reprocess, which the
    // per-handler guards already tolerate).
    await supabase
      .from('stripe_webhook_events')
      .insert({ event_id: event.id, type: event.type })
      .then(({ error }) => { if (error && error.code !== '23505') logger.warn(`[STRIPE] dedup record failed for ${event.id}: ${error.message}`); })
      .catch(() => {});

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

// ─── Identity verification (Stripe Identity, embedded in signup) ─────────────

router.post('/identity/session', authMiddleware, createIdentitySession);
router.get('/identity/status', authMiddleware, getIdentityStatus);

// ─── POST /connect/onboard ───────────────────────────────────────────────────

router.post('/connect/onboard', authMiddleware, connectOnboard);

// ─── GET /connect/status ─────────────────────────────────────────────────────

router.get('/connect/status', authMiddleware, getConnectStatus);

// ─── POST /connect/dashboard-link ────────────────────────────────────────────

router.post('/connect/dashboard-link', authMiddleware, getDashboardLink);

export default router;


