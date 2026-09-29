import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { calculateBreakdown, calculateProcessingFee, calculateGst } from './commissionService.js';
import { checkoutPaymentMethodTypes } from '../utils/checkoutPaymentMethods.js';
import { checkAustralianAddress, AU_ONLY_MESSAGE } from '../utils/addressValidation.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';
import { validateWelcomeDiscount, buildWelcomeDiscount, reserveWelcomeDiscount } from './welcomeOfferService.js';
import { ensureWalletCustomer, getWalletBalanceCents, assertNoOpenWalletCheckout, reserveWalletCheckout, releaseWalletCheckout } from './walletService.js';
import { invalidReturnUrl } from '../utils/returnUrl.js';

/**
 * Resolve the price the buyer owes on an offer-based purchase, enforcing that
 * the offer is theirs, matches the listing, and carries seller consent.
 * Shared by the checkout itself and the /stripe/calculate preview so the
 * number the buyer is shown is the number they are charged.
 *
 * Returns { itemPrice } on success or { error } for the caller to 400 on.
 */
export async function resolveOfferPrice({ offerId, listingId, userId, listingSellerId }) {
  const { data: offer } = await supabase
    .from('offers')
    .select('amount_aud, counter_amount_aud, status, buyer_id, seller_id, listing_id, expires_at, payment_due_at, paid_at')
    .eq('id', offerId)
    .maybeSingle();

  if (!offer || offer.listing_id !== listingId || offer.buyer_id !== userId) {
    return { error: 'Invalid offer' };
  }
  // The consent below is only meaningful if the party who "accepted" is the
  // listing's real owner. offers.seller_id was once client-supplied, so an
  // offer whose seller_id is anyone else (an accomplice account that accepted
  // a $1 offer on a stranger's card) must never price a checkout. Callers
  // pass the seller from the listing row they already loaded; a missing value
  // fails closed.
  if (!listingSellerId || offer.seller_id !== listingSellerId) {
    return { error: 'Invalid offer' };
  }
  // Only offers the SELLER has consented to may be paid. A 'pending' offer
  // is the buyer's own un-accepted proposal whose amount_aud the buyer sets
  // freely (there is no server-side floor, and the tamper trigger only
  // freezes the amount *after* insert) — allowing it let a buyer purchase
  // any active listing at a self-chosen price ($1 for a $1000 card) with no
  // seller consent. The consent-bearing states are 'accepted' (seller
  // accepted the buyer's amount) and 'countered' (seller proposed a price).
  if (!['accepted', 'countered'].includes(offer.status)) {
    return { error: 'Offer is no longer valid' };
  }
  // A counter is the seller's proposal with its own 48-hour window (reset by
  // the offers_enforce_lifecycle trigger when the seller counters). Paying is
  // how the buyer accepts it, so a lapsed counter can't be paid — the sweep
  // may not have flipped it to 'expired' yet. An 'accepted' offer has no
  // deadline of its own: accepting it starts the payment window below.
  if (offer.status === 'countered' && offer.expires_at && new Date(offer.expires_at) <= new Date()) {
    return { error: 'This counter offer has expired' };
  }
  // An accepted offer must be paid within its 48-hour payment window
  // (payment_due_at, set by offers_enforce_lifecycle on acceptance). Past it
  // the deal has lapsed — the expire_stale_offers() sweep may not have flipped
  // the row yet — and the seller is free to sell elsewhere.
  if (offer.paid_at) {
    return { error: 'This offer has already been paid for' };
  }
  if (offer.status === 'accepted' && offer.payment_due_at && new Date(offer.payment_due_at) <= new Date()) {
    return { error: 'The payment window for this offer has closed' };
  }
  // counter_amount_aud is only ever written by the seller on the single
  // pending -> countered transition (enforced by offers_prevent_price_tamper),
  // so when it is set it IS the agreed price — both while the offer sits at
  // 'countered' (checking out is how the buyer accepts the counter) and after
  // the buyer pressed "Accept Counter" (status 'accepted', counter still set).
  // Keying off status === 'countered' alone charged an accepted counter at the
  // buyer's original, pre-counter amount.
  return {
    itemPrice: Number(offer.counter_amount_aud != null ? offer.counter_amount_aud : offer.amount_aud),
  };
}

export async function createSingleItemCheckout(req, res) {
  // Declared before the try so the catch block can see them (block-scoped `let`
  // inside try is not visible in catch).
  const userId = req.user?.id;
  let walletSlotHeldForCleanup = false;
  try {
    const {
      listingId,
      offerId,
      bidId,
      successUrl,
      cancelUrl,
      shippingAddress,
      promoCode,
      useWalletBalance,
    } = req.body;

    const email = req.user.email;

    // The schema only checks these parse as URLs; they must also be ours (see
    // utils/returnUrl.js — an attacker-chosen success_url is a phishing hop).
    const badReturnUrl = invalidReturnUrl({ successUrl, cancelUrl });
    if (badReturnUrl) return res.status(400).json({ error: badReturnUrl });

    let { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('id, price_aud, shipping_cost_aud, vault_item_id, seller_id, title, seller:profiles!seller_id(seller_tier, display_name), vault_item:vault_items!inner(card_name)')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    // Vercel can redeploy before `supabase db push` lands the shipping_cost_aud
    // migration — retry without the column (postage prices as free, exactly as
    // before) rather than failing every single-item checkout for the window.
    if (listingErr && /shipping_cost_aud/.test(listingErr.message || '')) {
      ({ data: listing, error: listingErr } = await supabase
        .from('listings')
        .select('id, price_aud, vault_item_id, seller_id, title, seller:profiles!seller_id(seller_tier, display_name), vault_item:vault_items!inner(card_name)')
        .eq('id', listingId)
        .eq('status', 'active')
        .maybeSingle());
    }

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found or no longer active' });
    }

    if (listing.seller_id === userId) {
      return res.status(403).json({ error: 'You cannot purchase your own listing' });
    }

    let itemPrice = Number(listing.price_aud);
    if (offerId) {
      const resolved = await resolveOfferPrice({ offerId, listingId, userId, listingSellerId: listing.seller_id });
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }
      itemPrice = resolved.itemPrice;
    }

    // Derive the commission tier from server-side context, NEVER the request
    // body. Trusting a client transactionType let a buyer pass 'trade' (often a
    // 0% tier) on a normal fixed-price purchase to avoid the platform fee.
    // bidId is intentionally never trusted for this either: there is no
    // bids table/auction feature backing it, so it can't be validated the way
    // offerId is above — treating its mere presence as proof of an auction let
    // a buyer force the (often lower) auction commission tier onto any
    // ordinary fixed-price listing.
    const transactionType = offerId ? 'offer' : 'fixed';

    const cardName = listing.vault_item?.card_name || listing.title || 'Trading Card';
    const breakdown = await calculateBreakdown({ ...listing, price_aud: itemPrice }, transactionType);

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

    // The seller's postage price, charged to the buyer and passed through to
    // the seller's payout in full — no commission comes off it and no GST is
    // added on top (it is the seller's own consumer-quoted price, not
    // platform revenue). 0 means the seller ships free.
    const shippingAud = Math.max(0, Number(listing.shipping_cost_aud) || 0);
    if (shippingAud > 0) {
      lineItems.push({
        price_data: {
          currency: 'aud',
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(shippingAud * 100),
        },
        quantity: 1,
      });
    }

    // Payment processing, charged last because it is a percentage of everything
    // above it. It reimburses the platform for Stripe's cut (CardPop is the
    // merchant of record) and never touches the seller's payout — proceeds
    // below are still item - commission + postage.
    const processingAud = await calculateProcessingFee(
      breakdown.itemPrice + breakdown.commissionAud + shippingAud,
    );
    if (processingAud > 0) {
      lineItems.push({
        price_data: {
          currency: 'aud',
          product_data: { name: 'Payment processing' },
          unit_amount: Math.round(processingAud * 100),
        },
        quantity: 1,
      });
    }

    // GST is INSIDE the prices above, never added to them. The seller supplies
    // the card and the postage, so the GST on those comes out of their payout
    // and CardPop remits it; the commission and processing fee are CardPop's own
    // supplies, so their GST is inside money the platform already holds.
    // Commission counts twice because it is charged twice — once as a line to
    // the buyer and once as a deduction from the seller.
    const gst = await calculateGst({
      sellerAmountAud: breakdown.itemPrice + shippingAud,
      platformAmountAud: breakdown.commissionAud * 2 + processingAud,
    });

    const sellerProceedsAud = Math.round(
      (breakdown.itemPrice - breakdown.commissionAud - gst.sellerGstAud + shippingAud) * 100,
    ) / 100;

    const metadata = {
      userId,
      listingId,
      sellerId: listing.seller_id,
      vaultItemId: listing.vault_item_id || '',
      transactionType,
      itemPrice: String(breakdown.itemPrice),
      commissionPct: String(breakdown.commissionPct),
      commissionAud: String(breakdown.commissionAud),
      // Nothing is added on top of the buyer's bill any more, so the only GST
      // figures worth carrying are the included ones.
      sellerGstAud: String(gst.sellerGstAud),
      platformGstAud: String(gst.platformGstAud),
      gstIncludedAud: String(gst.gstIncludedAud),
      shippingAud: String(shippingAud),
      processingFeeAud: String(processingAud),
      sellerProceedsAud: String(sellerProceedsAud),
      configId: breakdown.configId || '',
    };
    if (offerId) metadata.offerId = offerId;
    if (bidId) metadata.bidId = bidId;

    const buyerTotal = breakdown.itemPrice + (breakdown.commissionAud || 0) + shippingAud + processingAud;
    const velocity = await checkPurchaseVelocity({ userId, orderValueAud: buyerTotal });
    if (!velocity.allowed) {
      logger.warn(`[VELOCITY] Blocked checkout for ${userId} (${velocity.reason})`);
      return res.status(429).json({ error: velocity.message, code: 'velocity_limit' });
    }

    if (shippingAddress) {
      // Australia only. The Buy Now modal doesn't collect an address at all —
      // for that case Stripe collects one, restricted to AU by
      // shipping_address_collection on the session below — but an address that
      // IS supplied has to clear the same bar.
      const auCheck = checkAustralianAddress(shippingAddress);
      if (!auCheck.valid) {
        logger.warn(`[STRIPE] checkout blocked — non-Australian address (${auCheck.reason})`);
        return res.status(400).json({ error: AU_ONLY_MESSAGE, code: 'au_only' });
      }
      const s = shippingAddress;
      if (s.name) metadata.shippingName = String(s.name).slice(0, 100);
      if (s.address) metadata.shippingAddress = String(s.address).slice(0, 200);
      if (s.suburb) metadata.shippingSuburb = String(s.suburb).slice(0, 100);
      if (s.state) metadata.shippingState = String(s.state).slice(0, 50);
      if (s.postcode) metadata.shippingPostcode = String(s.postcode).slice(0, 10);
    }

    // Welcome-offer promo code: platform-funded amount-off coupon covering 10%
    // of the item price only (never the fee/GST lines, never seller proceeds).
    // The webhook marks it redeemed after payment completes.
    let discounts;
    let walletCustomerId = null;
    // walletSlotHeldForCleanup is declared at the top of the function (so the
    // catch can see it): true while WE own releasing the wallet reservation —
    // between claiming it and either handing ownership to the completion/expiry
    // webhook once the session is created, or releasing it on an early exit.
    if (promoCode) {
      const offer = await validateWelcomeDiscount(userId, promoCode);
      const built = await buildWelcomeDiscount(stripe, offer, Math.round(breakdown.itemPrice * 100));
      if (built) {
        // Claim the one-time offer for this checkout so concurrent sessions
        // can't each apply it (409 if another live checkout already holds it).
        await reserveWelcomeDiscount(offer.id);
        discounts = [{ coupon: built.couponId }];
        metadata.welcomeOfferId = offer.id;
        metadata.discountAud = String(built.discountCents / 100);
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
      const buyerTotalCents = Math.round(buyerTotal * 100);
      const availableCents = await getWalletBalanceCents(stripe, userId);
      // Leave at least Stripe's AUD minimum charge (50¢) on the card — a
      // payment-mode session discounted to $0 is rejected by Stripe, which
      // surfaced as an opaque checkout failure for buyers whose balance
      // covered the whole order.
      const walletCents = Math.min(availableCents, Math.max(0, buyerTotalCents - 50));
      if (walletCents > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: walletCents,
          currency: 'aud',
          duration: 'once',
          name: 'CardPop wallet balance',
        });
        discounts = [{ coupon: coupon.id }];
        metadata.walletCents = String(walletCents);
        metadata.discountAud = String(walletCents / 100);
      } else {
        // No credit is actually applied (balance too low), so nothing needs
        // protecting — free the slot now rather than holding it until the TTL.
        await releaseWalletCheckout(userId);
        walletSlotHeldForCleanup = false;
      }
    }

    // Pinned rather than left to the Dashboard's dynamic selection: the
    // processing-fee line above is sized for card-rate pricing, so a BNPL
    // method at ~6% would sell at a loss. See checkoutPaymentMethods.js.
    const paymentMethodTypes = checkoutPaymentMethodTypes();

    const session = await stripe.checkout.sessions.create({
      ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),
      // Australia only, enforced by Stripe's own address picker: this path is
      // reached from the Buy Now modal, which collects no address, so without
      // this an overseas buyer has nothing to fail. The country list is the
      // gate; the address it captures also lands on the order, since the
      // webhook already falls back to session.shipping_details.
      shipping_address_collection: { allowed_countries: ['AU'] },
      billing_address_collection: 'auto',
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(walletCustomerId ? { customer: walletCustomerId } : { customer_email: email }),
      metadata,
      ...(discounts ? { discounts } : {}),
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');

    // Session is live — the completion / expiry webhook now owns releasing the
    // wallet reservation, so the failure path below must not release it.
    walletSlotHeldForCleanup = false;

    logger.info(`[STRIPE] Session created: ${session.id} for listing ${listingId}`);
    // The returned breakdown drives the CheckoutModal's price rows — fold the
    // shipping line in so the modal's total matches what Stripe will charge.
    res.json({
      url: session.url,
      sessionId: session.id,
      breakdown: {
        ...breakdown,
        shippingAud,
        processingAud,
        // gstIncludedAud is shown as an "includes GST" note, not a charge —
        // it is already inside the total below.
        gstIncludedAud: gst.gstIncludedAud,
        sellerGstAud: gst.sellerGstAud,
        total: Math.round((breakdown.total + shippingAud + processingAud) * 100) / 100,
      },
    });
  } catch (err) {
    // We claimed the wallet slot but never handed it to a live session — free it
    // now so a failed attempt doesn't lock the buyer out until the TTL.
    if (walletSlotHeldForCleanup) await releaseWalletCheckout(userId);
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] create-checkout error: ${err.message}`);
    res.status(code).json({ error: code === 500 ? 'Something went wrong. Please try again.' : err.message });
  }
}
