import 'dotenv/config';
import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { gtinsForSession } from '../utils/orderGtins.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireAal2 } from '../middleware/requireAal2.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';
import { handleDisputeCreated, handleDisputeClosed } from '../services/disputeService.js';
import { calculateBreakdown, calculateProcessingFee, calculateGst } from '../services/commissionService.js';
import { handleCheckoutSessionCompleted, handlePaymentFailed, handleCheckoutSessionExpired, getPlatformSetting } from '../services/stripeWebhookService.js';
import { validateRequestBody, validateRequestQuery } from '../middleware/validateRequest.js';
import { createCheckoutSchema, calculateBreakdownSchema, processRefundSchema } from '../schemas/stripeSchemas.js';
import { createSingleItemCheckout, resolveOfferPrice } from '../services/checkoutService.js';
import { priceCart } from '../services/cartService.js';
import { validateWelcomeDiscount, welcomeDiscountCents, buildWelcomeDiscount, reserveWelcomeDiscount } from '../services/welcomeOfferService.js';
import {
  isWelcomeCodeFormat,
  validatePartnerCode,
  partnerDiscountCents,
  buildPartnerDiscount,
} from '../services/partnerService.js';
import {
  findPromoCode,
  validatePromoCode,
  promoDiscountCents,
  buildPromoDiscount,
  reservePromoCode,
  attachPromoSession,
  releasePromoRedemption,
} from '../services/promoCodeService.js';
import { processRefund } from '../services/refundService.js';
import { connectOnboard, getConnectStatus, getDashboardLink, withdrawHeldBalance } from '../services/connectService.js';
import { createIdentitySession, getIdentityStatus, applyIdentitySession } from '../services/identityService.js';
import { reconcilePendingOrders } from '../services/pendingOrderAlertService.js';
import { applyStripeSubscription } from '../services/subscriptionService.js';
import { ensureWalletCustomer, getWalletBalanceCents, handleWalletTopup, assertNoOpenWalletCheckout, reserveWalletCheckout, releaseWalletCheckout } from '../services/walletService.js';
import { validateShippingAddress, checkAustralianAddress, AU_ONLY_MESSAGE } from '../utils/addressValidation.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { invalidReturnUrl } from '../utils/returnUrl.js';
import { requireIdentityForMarketplacePurchase } from '../middleware/requireIdentityForPurchase.js';
import { isValidAbn, normalizeAbn } from '../../utils/abn.js';
import { checkoutPaymentMethodTypes } from '../utils/checkoutPaymentMethods.js';
import { insertWithOptionalColumns } from '../utils/insertWithOptionalColumns.js';

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
    const { listingId, offerId } = req.query;
    let { transactionType = 'fixed' } = req.query;

    let { data: listing, error } = await supabase
      .from('listings')
      .select('id, price_aud, shipping_cost_aud, seller_id, seller:profiles!seller_id(seller_tier)')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    // Redeploy-before-migration window: price the breakdown without postage
    // rather than failing it (mirrors the fallback in the checkout services).
    if (error && /shipping_cost_aud/.test(error.message || '')) {
      ({ data: listing, error } = await supabase
        .from('listings')
        .select('id, price_aud, seller_id, seller:profiles!seller_id(seller_tier)')
        .eq('id', listingId)
        .eq('status', 'active')
        .maybeSingle());
    }

    if (error || !listing) return res.status(404).json({ error: 'Listing not found or not active' });

    // Offer-based preview: price the breakdown from the agreed offer amount
    // (same resolution + consent rules as checkout), not the listing price, so
    // the modal shows exactly what /create-checkout will charge. The type is
    // forced to 'offer' for the same reason checkout derives it server-side.
    let priceSource = listing;
    if (offerId) {
      const resolved = await resolveOfferPrice({ offerId, listingId, userId: req.user.id, listingSellerId: listing.seller_id });
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      priceSource = { ...listing, price_aud: resolved.itemPrice };
      transactionType = 'offer';
    }

    const breakdown = await calculateBreakdown(priceSource, transactionType);
    // Seller postage rides on top of the commission breakdown: charged to the
    // buyer, passed through to the seller, no commission or GST touches it.
    const shippingAud = Math.max(0, Number(listing.shipping_cost_aud) || 0);
    // Priced exactly as checkout prices it, so the modal's total is the total.
    const processingAud = await calculateProcessingFee(
      breakdown.itemPrice + breakdown.commissionAud + shippingAud,
    );
    const gst = await calculateGst({
      sellerAmountAud: breakdown.itemPrice + shippingAud,
      platformAmountAud: breakdown.commissionAud * 2 + processingAud,
    });

    res.json({
      listingId,
      transactionType,
      itemPrice:     breakdown.itemPrice,
      commissionPct: breakdown.commissionPct,
      commissionAud: breakdown.commissionAud,
      // Nothing is added on top any more — prices are GST-inclusive, so the
      // buyer sees an "includes GST" note rather than a GST charge.
      gstAud:        0,
      gstIncludedAud: gst.gstIncludedAud,
      sellerGstAud:  gst.sellerGstAud,
      shippingAud,
      processingAud,
      total:         Math.round((breakdown.total + shippingAud + processingAud) * 100) / 100,
    });
  } catch (err) {
    logger.error(`[STRIPE] /calculate error: ${err.message}`);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /create-checkout ───────────────────────────────────────────────────

router.post('/create-checkout', authMiddleware, requireEmailVerified, requireIdentityForMarketplacePurchase, validateRequestBody(createCheckoutSchema), createSingleItemCheckout);

// ─── POST /create-cart-checkout ──────────────────────────────────────────────
// Multi-item cart checkout. Each item is priced server-side from its source of
// truth — never trust client prices/totals. Admin "shop" products (shop_products)
// are platform-owned: GST only, no commission. Marketplace "listing" items use
// the normal commission + GST breakdown. A single Stripe session collects the
// payment; a 'pending' order row is written as the snapshot the webhook confirms.

// Bound cart input before it reaches priceCart, which does one DB lookup per
// item. Without this an unbounded `items[]` (or a non-string id fed into a
// Supabase .eq() filter) is a cheap resource-exhaustion vector on these
// guest-callable endpoints. Returns an error string, or null when valid.
const MAX_CART_ITEMS = 50;
function validateCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'items is required';
  if (items.length > MAX_CART_ITEMS) return `Too many items in the cart (max ${MAX_CART_ITEMS}).`;
  for (const it of items) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return 'Invalid cart item.';
    if (it.type !== 'shop' && it.type !== 'listing') return 'Each cart item needs a valid type ("shop" or "listing").';
    if (typeof it.id !== 'string' || it.id.length === 0 || it.id.length > 100) return 'Each cart item needs a valid id.';
    if (it.variantId != null && (typeof it.variantId !== 'string' || it.variantId.length === 0 || it.variantId.length > 100)) return 'Each cart item variantId must be a valid id.';
  }
  return null;
}

// Preview the authoritative cart total (so the UI never shows a number that
// differs from what Stripe will charge).
router.post('/calculate-cart', optionalAuthMiddleware, async (req, res) => {
  try {
    const { items, promoCode, useWalletBalance } = req.body;
    const itemsError = validateCartItems(items);
    if (itemsError) return res.status(400).json({ error: itemsError });
    if (typeof promoCode === 'string' && promoCode.length > 64) return res.status(400).json({ error: 'Invalid promo code.' });
    if (promoCode && useWalletBalance) {
      return res.status(400).json({ error: 'Apply either a promo code or your wallet balance, not both.' });
    }
    // Guests check out without an account. userId is null for them, which
    // priceCart tolerates (they can't be the seller of any listing), and promo
    // codes / wallet balance are account-only perks that are simply ignored.
    const userId = req.user?.id ?? null;
    const code = typeof promoCode === 'string' ? promoCode.trim() : '';

    // Resolve a partner referral code. No code waives shipping — priceCart
    // charges the platform's shop fee below the free-shipping threshold
    // whatever code is applied — so a partner code only ever discounts shop
    // items (see partnerDiscountCents below). An invalid code doesn't fail the
    // whole calculation: the UI shows `promoError` inline and the undiscounted
    // totals stay correct.
    // Admin-issued promo codes (Admin → Promo Codes) are checked before
    // partner codes; the two share a namespace, so at most one matches.
    let partner = null;
    let promo = null;
    let promoError = null;
    if (userId && code && !isWelcomeCodeFormat(code)) {
      try {
        const found = await findPromoCode(code);
        if (found) promo = await validatePromoCode(found, { userId, email: req.user?.email });
        else partner = await validatePartnerCode(userId, code);
      } catch (promoErr) {
        if (!promoErr.statusCode) throw promoErr;
        promoError = promoErr.message;
      }
    }

    const priced = await priceCart(items, userId);

    // Preview the promo discount without creating any Stripe objects. Codes in
    // the POP-XXXX-XXXX shape are personal welcome offers; anything else is an
    // admin promo code or a partner referral code (discounts shop items only).
    let discountCents = 0;
    let walletBalanceCents = 0;
    let walletAppliedCents = 0;
    if (!userId) {
      // Guest: no welcome offer / partner attribution / wallet — leave totals
      // undiscounted and don't surface an error for a harmlessly-ignored code.
    } else if (code) {
      if (isWelcomeCodeFormat(code)) {
        try {
          const offer = await validateWelcomeDiscount(userId, code);
          discountCents = welcomeDiscountCents(offer, priced.itemsCents);
        } catch (promoErr) {
          if (!promoErr.statusCode) throw promoErr;
          promoError = promoErr.message;
        }
      } else if (promo) {
        try {
          discountCents = promoDiscountCents(promo, priced);
        } catch (promoErr) {
          if (!promoErr.statusCode) throw promoErr;
          promoError = promoErr.message;
        }
      } else if (partner) {
        discountCents = partnerDiscountCents(partner, priced.orderLines);
        if (discountCents <= 0) {
          promoError = 'This code applies to CardPop Shop items only.';
        }
      }
      // else: the code failed validation above and promoError is already set.
    } else if (useWalletBalance) {
      // Live read from Stripe — CardPop keeps no local wallet ledger for buyers.
      walletBalanceCents = await getWalletBalanceCents(stripe, userId);
      // Same cap as /create-cart-checkout: leave Stripe's 50¢ AUD minimum on
      // the card, or the preview promises more credit than checkout applies.
      walletAppliedCents = Math.min(walletBalanceCents, Math.max(0, priced.grandCents - 50));
    }

    res.json({
      items:       priced.orderLines,
      // Any pre-order line in the cart: checkout shows the dispatch notice.
      hasPreorder: priced.hasPreorder === true,
      subtotalAud: priced.itemsCents / 100,
      commissionAud: priced.commissionCents / 100,
      // gstAud is GST added on top (marketplace listings); includedGstAud is the
      // GST already baked into the GST-inclusive shop prices + shipping.
      gstAud:      priced.gstCents / 100,
      includedGstAud: priced.includedGstCents / 100,
      sellerGstAud: priced.sellerGstCents / 100,
      shippingAud: priced.shippingCents / 100,
      processingAud: priced.processingCents / 100,
      discountAud: (discountCents + walletAppliedCents) / 100,
      walletBalanceAud: walletBalanceCents / 100,
      walletAppliedAud: walletAppliedCents / 100,
      promoError,
      totalAud:    (priced.grandCents - discountCents - walletAppliedCents) / 100,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] /calculate-cart error: ${err.message}`);
    res.status(code).json({
      error: code === 500 ? 'Something went wrong. Please try again.' : err.message,
      ...(code !== 500 && err.listingId ? { listingId: err.listingId } : {}),
    });
  }
});

router.post('/create-cart-checkout', optionalAuthMiddleware, requireEmailVerifiedIfAuthed, requireIdentityForMarketplacePurchase, async (req, res) => {
  // Declared before the try so the catch block can see them (block-scoped `let`
  // inside try is not visible in catch). A guest has no user id.
  const userId = req.user?.id || null;
  let walletSlotHeldForCleanup = false;
  // A promo-code reservation we still own (released on any failure before the
  // session exists; after that the completion/expiry webhook owns it).
  let promoRedemptionHeld = null;
  try {
    const { items, successUrl, cancelUrl, returnUrl, uiMode, shippingAddress, promoCode, useWalletBalance, billingDetails, email: guestEmailInput, subscribeNewsletter, saveShippingAddress } = req.body;

    // Guest checkout: no account required. A guest has no user id — promo codes,
    // wallet balance and partner attribution are account-only and are skipped
    // for them. The email they typed at checkout is the receipt address (and,
    // if they opted in, the newsletter address).
    // Normalize to lowercase: the guest purchase-velocity window queries
    // buyer_email lowercased, so storing a mixed-case address would silently
    // never match — disabling the guest order/spend caps. Email delivery is
    // case-insensitive in practice, so lowercasing the receipt address is safe.
    const email  = ((req.user?.email || (typeof guestEmailInput === 'string' ? guestEmailInput.trim() : '')) || '').toLowerCase() || null;
    if (!email || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ error: 'A valid email address is required to place an order.' });
    }
    const wantsNewsletter = subscribeNewsletter === true || subscribeNewsletter === 'true';
    // Only a signed-in buyer has an account to save an address book entry to.
    const wantsAddressSaved = (saveShippingAddress === true || saveShippingAddress === 'true') && !!userId;

    const itemsError = validateCartItems(items);
    if (itemsError) return res.status(400).json({ error: itemsError });
    if (typeof promoCode === 'string' && promoCode.length > 64) {
      return res.status(400).json({ error: 'Invalid promo code.' });
    }

    // Business / ABN buyers get a proper tax invoice. Re-validate the ABN
    // server-side — never trust the client's checksum. Anything invalid is
    // simply dropped so a bad value can't block an otherwise-fine order.
    const business = billingDetails && isValidAbn(billingDetails.abn)
      ? { abn: normalizeAbn(billingDetails.abn), name: String(billingDetails.businessName || '').trim().slice(0, 120) }
      : null;

    // 'embedded' renders Stripe's payment form inline on our own page (no
    // redirect away); 'elements' does the same but with Stripe Elements we lay
    // out ourselves (an inline Google Pay button above the card form — see
    // components/checkout/StripeElementsPayment.jsx); 'hosted' redirects to
    // Stripe's own checkout page. All three create an identical Checkout
    // Session — only how the buyer sees it differs — so pricing, the pending
    // order and checkout.session.completed fulfilment are shared.
    const elementsUi = uiMode === 'elements';
    const embedded = uiMode === 'embedded' || elementsUi;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }
    if (embedded) {
      if (!returnUrl) return res.status(400).json({ error: 'returnUrl is required' });
    } else if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
    }
    // Stripe sends the buyer to these after paying — they must be ours.
    const badReturnUrl = invalidReturnUrl({ successUrl, cancelUrl, returnUrl });
    if (badReturnUrl) return res.status(400).json({ error: badReturnUrl });
    if (promoCode && useWalletBalance) {
      return res.status(400).json({ error: 'Apply either a promo code or your wallet balance, not both.' });
    }

    // Australia-only gate, checked BEFORE the geocode below: that one fails open
    // when AWS_LOCATION_API_KEY isn't set, so on its own it would wave an
    // overseas address straight through. This one never fails open.
    const auCheck = checkAustralianAddress(shippingAddress || {});
    if (!auCheck.valid) {
      logger.warn(`[STRIPE] cart checkout blocked — non-Australian address (${auCheck.reason})`);
      return res.status(400).json({ error: AU_ONLY_MESSAGE, code: 'au_only' });
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

    // Resolve an admin promo code or partner referral code up front (promo
    // codes first — the two share a namespace). An invalid code throws here.
    const promoCodeText = typeof promoCode === 'string' ? promoCode.trim() : '';
    const sharedCode = userId && promoCodeText && !isWelcomeCodeFormat(promoCodeText);
    const promoFound = sharedCode ? await findPromoCode(promoCodeText) : null;
    const promo = promoFound ? await validatePromoCode(promoFound, { userId, email }) : null;
    const partner = sharedCode && !promo
      ? await validatePartnerCode(userId, promoCodeText)
      : null;

    const { lineItems, orderLines, itemsCents, commissionCents, gstCents, includedGstCents, sellerGstCents, platformGstCents, shippingCents, processingCents, grandCents } =
      await priceCart(items, userId);

    // Fraud control: cap order size / frequency for brand-new, unverified buyers.
    const velocity = await checkPurchaseVelocity({ userId, guestEmail: userId ? null : email, orderValueAud: grandCents / 100 });
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
    let promoMeta = {};
    let walletCents = 0;
    let walletCustomerId = null;
    // walletSlotHeldForCleanup is declared at the top of the handler (so the
    // catch can see it): true while WE own releasing the wallet reservation —
    // between claiming it and either handing it to the completion/expiry webhook
    // once the session is created, or releasing it on an early exit/failure.
    if (!userId) {
      // Guest checkout — promo codes, wallet balance and partner attribution are
      // all account-scoped, so any supplied code is harmlessly ignored.
    } else if (promoCodeText) {
      if (isWelcomeCodeFormat(promoCodeText)) {
        const offer = await validateWelcomeDiscount(userId, promoCodeText);
        const built = await buildWelcomeDiscount(stripe, offer, itemsCents);
        if (built) {
          // Claim the one-time offer for this checkout so concurrent sessions
          // can't each apply it (409 if another live checkout already holds it).
          await reserveWelcomeDiscount(offer.id);
          discounts = [{ coupon: built.couponId }];
          discountCents = built.discountCents;
          welcomeOfferId = offer.id;
        }
      } else if (promo) {
        // Claim one use of the code first (row-locked in the DB, so a
        // single-use or capped code can't be spent by two checkouts at once),
        // then mint the session's coupon.
        const cents = promoDiscountCents(promo, { itemsCents, orderLines, grandCents });
        promoRedemptionHeld = await reservePromoCode(promo, { userId, email, discountCents: cents });
        const built = await buildPromoDiscount(stripe, promo, cents);
        if (built) {
          discounts = [{ coupon: built.couponId }];
          discountCents = built.discountCents;
          promoMeta = { promoRedemptionId: promoRedemptionHeld, promoCode: promo.code };
        } else {
          await releasePromoRedemption(promoRedemptionHeld);
          promoRedemptionHeld = null;
        }
      } else {
        // `partner` was resolved (and validated) above — an invalid code threw
        // there — so it is non-null on this branch.
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
      // Atomically claim this user's single wallet-checkout slot BEFORE reading
      // the balance, so two concurrent checkouts can't each size a full-balance
      // coupon (the sub-second race assertNoOpenWalletCheckout can't see).
      await reserveWalletCheckout(userId);
      walletSlotHeldForCleanup = true;
      // Also refuse a new wallet checkout while one is still open in Stripe
      // (covers a lingering session beyond the reservation TTL).
      await assertNoOpenWalletCheckout(stripe, walletCustomerId);
      const availableCents = await getWalletBalanceCents(stripe, userId);
      // Leave at least Stripe's AUD minimum charge (50¢) on the card — a
      // payment-mode session discounted to $0 is rejected by Stripe.
      walletCents = Math.min(availableCents, Math.max(0, grandCents - 50));
      if (walletCents > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: walletCents,
          currency: 'aud',
          duration: 'once',
          name: 'CardPop wallet balance',
        });
        discounts = [{ coupon: coupon.id }];
        discountCents = walletCents;
      } else {
        // No credit is actually applied — free the slot now rather than holding
        // it until the TTL.
        await releaseWalletCheckout(userId);
        walletSlotHeldForCleanup = false;
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

    // Pinned rather than left to the Dashboard's dynamic selection — the cart's
    // processing-fee line is sized for card-rate pricing, so a BNPL method at
    // ~6% would sell at a loss. See src/utils/checkoutPaymentMethods.js.
    const paymentMethodTypes = checkoutPaymentMethodTypes();

    const session = await stripe.checkout.sessions.create({
      ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),
      billing_address_collection: 'auto',
      line_items:           lineItems,
      mode:                 'payment',
      // Embedded checkout keeps the buyer on our page and returns to return_url
      // once payment completes; hosted checkout redirects out and back.
      // Stripe renamed the ui_mode enum on 2026-03-25 — the full-page embedded
      // mode is now 'embedded_page' ('embedded' is rejected by current API
      // versions). @stripe/react-stripe-js v6 / stripe-js v9 consume the same
      // client_secret this returns via createEmbeddedCheckoutPage().
      // 'elements' (formerly 'custom') is the Checkout Elements SDK mode that
      // lets the page mount the Express Checkout Element (Google Pay) and the
      // Payment Element itself against this same session.
      ...(embedded
        ? { ui_mode: elementsUi ? 'elements' : 'embedded_page', return_url: returnUrl }
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
        ...(wantsAddressSaved ? { saveShippingAddress: 'true' } : {}),
        ...(welcomeOfferId ? { welcomeOfferId } : {}),
        ...partnerMeta,
        ...promoMeta,
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
    const orderRow = {
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
      // Kept out of platform_fee_aud: it is a cost recovery, not commission, and
      // the refund path has to be able to retain it separately (Stripe does not
      // return its fee on a refund).
      processing_fee_aud: processingCents / 100,
      gst_aud:           gstCents / 100,
      // The GST deducted from sellers' payouts on this order and remitted by
      // CardPop on their behalf. Part of gst_included_aud, not on top of it.
      seller_gst_aud:    sellerGstCents / 100,
      // The GST inside CardPop's own supplies on this order (commission, both
      // sides, and the processing fee) — the platform's share of
      // gst_included_aud, which the single-item path records too.
      platform_gst_aud:  platformGstCents / 100,
      // GST already inside every price on the order (cards, shop stock,
      // postage, commission, processing). Kept separate from gst_aud — which
      // is GST *added* on top, and is now always 0 — so the receipt can show it
      // as an "includes GST" line without double-counting.
      gst_included_aud:  includedGstCents / 100,
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
    };

    // These columns land in the same merge as their migration, but Vercel can
    // redeploy before `supabase db push` runs. Drop whichever isn't there yet
    // and retry, so a shop checkout never fails during that window — the
    // amounts stay recoverable from the per-line order_items.
    const { error: orderErr } = await insertWithOptionalColumns(
      orderRow,
      ['gst_included_aud', 'processing_fee_aud', 'seller_gst_aud', 'platform_gst_aud'],
      row => supabase.from('orders').insert(row),
      col => logger.warn(`[STRIPE] ${col} column not present yet — inserting order without it`),
    );

    if (orderErr) {
      logger.error(`[STRIPE] pending cart order insert failed: ${orderErr.message}`);
      throw new Error('Could not record the order');
    }

    // Session is live and its pending order recorded — the completion / expiry
    // webhook now owns releasing the wallet reservation, so the failure path
    // below must not release it.
    walletSlotHeldForCleanup = false;
    if (promoRedemptionHeld) {
      await attachPromoSession(promoRedemptionHeld, session.id);
      promoRedemptionHeld = null;
    }

    logger.info(`[STRIPE] Cart session created: ${session.id} (${orderLines.length} items, $${grandCents / 100}, ${elementsUi ? 'elements' : embedded ? 'embedded' : 'hosted'})`);
    res.json({
      ...(embedded ? { clientSecret: session.client_secret } : { url: session.url }),
      sessionId: session.id,
      total: grandCents / 100,
    });
  } catch (err) {
    // We claimed the wallet slot but never handed it to a live session — free it
    // now so a failed attempt doesn't lock the buyer out until the TTL.
    if (walletSlotHeldForCleanup) await releaseWalletCheckout(userId);
    if (promoRedemptionHeld) await releasePromoRedemption(promoRedemptionHeld);
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] create-cart-checkout error: ${err.message}`);
    res.status(code).json({
      error: code === 500 ? 'Something went wrong. Please try again.' : err.message,
      ...(code !== 500 && err.listingId ? { listingId: err.listingId } : {}),
    });
  }
});

// ─── GET /session/:sessionId ─────────────────────────────────────────────────

router.get('/session/:sessionId', optionalAuthMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) return res.status(400).json({ error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      // payment_intent.payment_method lets us tell the buyer which wallet
      // they paid with (Google Pay / Apple Pay / Link) — Stripe has no
      // separate 'google_pay' payment method type, it's
      // payment_method.card.wallet.type on an otherwise-ordinary card method.
      expand: ['line_items', 'payment_intent.payment_method'],
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

    // Webhook fallback: the buyer landing on the success page proves payment
    // completed, so fulfil the order here too. Fulfilment is idempotent (unique
    // stripe_session_id insert, compare-and-swap status/sold claims), so when
    // the webhook already handled this session — or handles it moments later —
    // the second pass is a no-op. Without this, a broken or misconfigured
    // webhook endpoint leaves a paid-for listing 'active' and buyable by
    // everyone else. Wallet top-ups and subscriptions keep their own webhook
    // handlers; the session data is retrieved from Stripe above, so the client
    // contributes nothing but the session id.
    const isSubscription = session.mode === 'subscription' || session.metadata?.kind === 'subscription';
    const isWalletTopup = session.metadata?.walletTopup === 'true';
    if (session.payment_status === 'paid' && !isSubscription && !isWalletTopup) {
      try {
        await handleCheckoutSessionCompleted(session, stripe);
      } catch (fulfilErr) {
        // The receipt must still render — Stripe will retry the webhook for
        // anything this pass couldn't finish.
        logger.error(`[STRIPE] Success-page fulfilment fallback failed for ${sessionId}: ${fulfilErr.message}`);
      }
    }

    const items = (session.line_items?.data || []).map((item) => ({
      name:       item.description || item.price?.product?.name || 'Unknown',
      quantity:   item.quantity,
      unitAmount: item.price?.unit_amount || 0,
      currency:   item.price?.currency || 'aud',
    }));

    const paymentMethod = session.payment_intent && typeof session.payment_intent === 'object'
      ? session.payment_intent.payment_method
      : null;
    const walletType = paymentMethod && typeof paymentMethod === 'object'
      ? (paymentMethod.type === 'card' ? paymentMethod.card?.wallet?.type ?? null : (paymentMethod.type === 'link' ? 'link' : null))
      : null;

    // Google Customer Reviews opt-in on the success page: where the parcel is
    // going, and whether any line is a pre-order (cartService names those
    // "… (Pre-order — <eta>)") — a pre-order arrives weeks later, so the page
    // skips the survey rather than have Google ask before it's delivered.
    const shippingAddress = session.collected_information?.shipping_details?.address
      || session.shipping_details?.address
      || session.customer_details?.address
      || null;
    const hasPreorder = items.some((item) => /\(Pre-order — /.test(item.name));
    // Barcodes of the shop products bought — lets Google attach product
    // reviews to them. Empty for marketplace cards (no GTIN) or any failure.
    const gtins = session.payment_status === 'paid' ? await gtinsForSession(supabase, sessionId) : [];

    // The order's own status, so the success page can tell "paid and being
    // fulfilled" from "paid but refused and refunded" (an overseas card, a
    // double sale, an amount mismatch). Stripe's payment_status is 'paid' in
    // both cases. Best-effort: a read failure just leaves it null.
    let orderStatus = null;
    let orderId = null;
    try {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('id, status')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();
      orderStatus = orderRow?.status ?? null;
      orderId = orderRow?.id ?? null;
    } catch (orderErr) {
      logger.warn(`[STRIPE] order status read failed for ${sessionId}: ${orderErr.message}`);
    }

    res.json({
      id:            session.id,
      orderId,
      orderStatus,
      status:        session.payment_status,
      amountTotal:   session.amount_total,
      customerEmail: session.customer_details?.email,
      customerName:  session.customer_details?.name || null,
      walletType,
      items,
      deliveryCountry: shippingAddress?.country || null,
      hasPreorder,
      gtins,
    });
  } catch (err) {
    // Stripe throws StripeInvalidRequestError for unknown/malformed ids —
    // that's the caller's 404, not our 500.
    if (err?.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Checkout session not found' });
    }
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
      // async_payment_succeeded fires when a delayed method (e.g. some
      // bank-debit / BNPL flows) settles after checkout completed. It carries an
      // identical session object with payment_status 'paid', so it shares the
      // same fulfilment path; the completed event for those methods arrives
      // 'unpaid' and is deferred inside handleCheckoutSessionCompleted.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.mode === 'setup' || session.metadata?.saveCard === 'true') {
          // "Save a card" flow (users putting a method on file). Stripe attaches
          // the payment method to the Customer automatically — there's no order
          // or charge. Mirror the fact that they now have a card on file onto
          // the profile so the selling/trading gate (can_sell) opens.
          const sessionCustomerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id;
          let savedUserId = session.metadata?.userId;
          if (!savedUserId && sessionCustomerId) {
            // A setup session minted outside /wallet/save-card may lack metadata;
            // the Customer created by ensureWalletCustomer carries its owner.
            const customer = await stripe.customers.retrieve(sessionCustomerId).catch(() => null);
            if (customer && !customer.deleted) savedUserId = customer.metadata?.userId || null;
          }
          if (!savedUserId) {
            logger.error(`[STRIPE] Card-setup session ${session.id} completed but no userId is resolvable — has_saved_card not mirrored`);
          } else {
            // Also repoint the profile at the Customer the card was attached to:
            // if the stored id has drifted (Stripe account switch, racing
            // customer creates), the /wallet/payment-methods self-heal would
            // read the wrong Customer, find no cards, and flip the flag back off.
            const payload = { has_saved_card: true };
            if (sessionCustomerId) payload.stripe_customer_id = sessionCustomerId;
            const { data: mirrored, error: mirrorErr } = await supabase
              .from('profiles')
              .update(payload)
              .eq('id', savedUserId)
              .select('id')
              .maybeSingle();
            if (mirrorErr) {
              // A 500 leaves the event unrecorded so Stripe redelivers, instead
              // of the seller being silently locked out of listing.
              throw new Error(`has_saved_card mirror failed for user ${savedUserId}: ${mirrorErr.message}`);
            }
            if (!mirrored) {
              logger.error(`[STRIPE] Card-setup session ${session.id}: profile ${savedUserId} not found — has_saved_card not mirrored`);
            } else {
              logger.info(`[STRIPE] Card-setup session ${session.id} completed — payment method saved (user ${savedUserId})`);
            }
          }
        } else if (session.metadata?.walletTopup === 'true') {
          await handleWalletTopup(session, stripe);
        } else if (session.mode === 'subscription' || session.metadata?.kind === 'subscription') {
          // Membership signups are mirrored onto the profile by the
          // customer.subscription.* events below. Falling through to the order
          // handler used to insert a phantom $0 "payment_confirmed" order (all
          // metadata amounts parse to 0, so the mismatch guard passed) and
          // email the buyer a $0.00 receipt on every trial signup.
          logger.info(`[STRIPE] Subscription checkout ${session.id} completed — no order to record`);
        } else {
          await handleCheckoutSessionCompleted(session, stripe);
        }
        break;
      }

      // A delayed/async payment failed to settle after checkout completed.
      // Release the pending order the same way an expiry does, so it isn't left
      // hanging as 'pending'.
      case 'checkout.session.async_payment_failed':
        await handleCheckoutSessionExpired(event.data.object);
        break;

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

router.post('/refund', authMiddleware, requireAdmin, validateRequestBody(processRefundSchema), processRefund);

// ─── Identity verification (Stripe Identity, embedded in signup) ─────────────

router.post('/identity/session', authMiddleware, createIdentitySession);
router.get('/identity/status', authMiddleware, getIdentityStatus);

// ─── POST /connect/onboard ───────────────────────────────────────────────────

// Connect routes move (or redirect to where a seller can redirect) real money,
// so an MFA-enrolled seller must present an AAL2 token — a phished password
// alone can mint an AAL1 token straight from GoTrue and, without this, open the
// Express dashboard (change payout bank) and drain the held wallet balance.
// requireAal2 only bites users who enrolled MFA, so nobody is locked out.
router.post('/connect/onboard', authMiddleware, requireAal2, connectOnboard);

// ─── GET /connect/status ─────────────────────────────────────────────────────

router.get('/connect/status', authMiddleware, getConnectStatus);

// ─── POST /connect/dashboard-link ────────────────────────────────────────────

router.post('/connect/dashboard-link', authMiddleware, requireAal2, getDashboardLink);

// ─── POST /connect/withdraw ──────────────────────────────────────────────────
// Pays a held wallet balance out to the seller's connected Stripe account.

router.post('/connect/withdraw', authMiddleware, requireAal2, withdrawHeldBalance);

// ─── GET /reconcile-pending ──────────────────────────────────────────────────
// Vercel Cron: flags orders Stripe reports as paid that are still 'pending'
// because checkout.session.completed never fulfilled them. Guarded by
// CRON_SECRET (fail-closed) inside the handler — reports only, never fulfils.

router.get('/reconcile-pending', reconcilePendingOrders(stripe));

export default router;


