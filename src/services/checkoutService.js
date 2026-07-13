import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { calculateBreakdown } from './commissionService.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';
import { validateWelcomeDiscount, buildWelcomeDiscount } from './welcomeOfferService.js';
import { ensureWalletCustomer, getWalletBalanceCents } from './walletService.js';

export async function createSingleItemCheckout(req, res) {
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

    const userId = req.user.id;
    const email = req.user.email;

    const { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('id, price_aud, vault_item_id, seller_id, title, seller:profiles!seller_id(seller_tier, display_name), vault_item:vault_items!inner(card_name)')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found or no longer active' });
    }

    if (listing.seller_id === userId) {
      return res.status(403).json({ error: 'You cannot purchase your own listing' });
    }

    let itemPrice = Number(listing.price_aud);
    if (offerId) {
      const { data: offer } = await supabase
        .from('offers')
        .select('amount_aud, counter_amount_aud, status, buyer_id, listing_id')
        .eq('id', offerId)
        .maybeSingle();

      if (!offer || offer.listing_id !== listingId || offer.buyer_id !== userId) {
        return res.status(400).json({ error: 'Invalid offer' });
      }
      if (!['pending', 'countered'].includes(offer.status)) {
        return res.status(400).json({ error: 'Offer is no longer valid' });
      }
      // A 'countered' offer means the seller proposed a different price —
      // checking out on it is how the buyer accepts that counter, so the
      // counter amount (not the buyer's original, pre-counter amount) is what
      // must be charged.
      itemPrice = Number(
        offer.status === 'countered' && offer.counter_amount_aud != null
          ? offer.counter_amount_aud
          : offer.amount_aud
      );
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

    const metadata = {
      userId,
      listingId,
      sellerId: listing.seller_id,
      vaultItemId: listing.vault_item_id || '',
      transactionType,
      itemPrice: String(breakdown.itemPrice),
      commissionPct: String(breakdown.commissionPct),
      commissionAud: String(breakdown.commissionAud),
      gstAud: String(breakdown.gstAud),
      sellerProceedsAud: String(Math.round((breakdown.itemPrice - breakdown.commissionAud) * 100) / 100),
      configId: breakdown.configId || '',
    };
    if (offerId) metadata.offerId = offerId;
    if (bidId) metadata.bidId = bidId;

    const buyerTotal = breakdown.itemPrice + (breakdown.commissionAud || 0) + (breakdown.gstAud || 0);
    const velocity = await checkPurchaseVelocity({ userId, orderValueAud: buyerTotal });
    if (!velocity.allowed) {
      logger.warn(`[VELOCITY] Blocked checkout for ${userId} (${velocity.reason})`);
      return res.status(429).json({ error: velocity.message, code: 'velocity_limit' });
    }

    if (shippingAddress) {
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
    if (promoCode) {
      const offer = await validateWelcomeDiscount(userId, promoCode);
      const built = await buildWelcomeDiscount(stripe, offer, Math.round(breakdown.itemPrice * 100));
      if (built) {
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
      }
    }

    const session = await stripe.checkout.sessions.create({
      // Let Stripe present every method enabled on the account (Card, Link /
      // Apple Pay / Google Pay, PayPal, Afterpay/Clearpay) and show each only
      // when the order is eligible — enable the individual methods in the
      // Stripe Dashboard → Settings → Payment methods.
      automatic_payment_methods: { enabled: true },
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

    logger.info(`[STRIPE] Session created: ${session.id} for listing ${listingId}`);
    res.json({ url: session.url, sessionId: session.id, breakdown });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[STRIPE] create-checkout error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
}
