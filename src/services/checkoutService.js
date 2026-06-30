import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { calculateBreakdown } from './commissionService.js';
import { checkPurchaseVelocity } from '../utils/purchaseVelocity.js';

export async function createSingleItemCheckout(req, res) {
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata,
    });

    if (!session?.url) throw new Error('Stripe returned a session without a URL');

    logger.info(`[STRIPE] Session created: ${session.id} for listing ${listingId}`);
    res.json({ url: session.url, sessionId: session.id, breakdown });
  } catch (err) {
    logger.error(`[STRIPE] create-checkout error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}
