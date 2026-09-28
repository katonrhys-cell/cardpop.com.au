// Offer ("enquiry") creation — the one place a buyer's offer is written.
//
// The modal used to insert straight into `offers` from the browser. That works
// (RLS allows it, and the on_offer_created trigger writes the seller's in-app
// notification), but it leaves no server-side moment to send the seller an
// email — so an offer could sit unseen until the seller happened to open the
// site. This endpoint keeps the exact same database write and adds the email.
//
// The insert uses a client scoped to the CALLER'S token, not the service role,
// so RLS stays the single enforcement point: the buyer_id = auth.uid() check,
// the offers_prevent_price_tamper trigger and the notification trigger all
// apply exactly as they did for the direct client-side write.
//
// Email is best-effort and never fails the offer: the offer is already
// committed and visible in the seller's bell by the time we try to send, so a
// Resend outage must not tell the buyer their offer failed.
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import createUserScopedClient from '../utils/userScopedSupabase.js';
import { supabase } from '../utils/supabaseClient.js';
import { sendOfferReceived } from '../utils/emailService.js';
import logger from './../utils/logger.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Matches the modal's own cap. A message longer than this is a mistake or an
// abuse attempt, not an offer note.
const MAX_MESSAGE_LENGTH = 1000;

const displayName = (profile) =>
  profile?.display_name || profile?.username || null;

/**
 * Everything the seller's email needs, read with the service-role client.
 *
 * Deliberately separate from the insert: the buyer's own token cannot read the
 * seller's email address, and it should not be able to. Returns null for any
 * part that isn't available rather than throwing — a missing display name must
 * not cost the seller their notification.
 */
async function loadOfferContext(offer) {
  const [{ data: listing }, { data: profiles }] = await Promise.all([
    supabase
      .from('listings')
      .select('listing_type, vault_item:vault_items(card_name)')
      .eq('id', offer.listing_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, email, display_name, username')
      .in('id', [offer.seller_id, offer.buyer_id]),
  ]);

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return {
    sellerEmail: byId[offer.seller_id]?.email ?? null,
    sellerName: displayName(byId[offer.seller_id]),
    buyerName: displayName(byId[offer.buyer_id]),
    cardName: listing?.vault_item?.card_name ?? null,
    listingType: listing?.listing_type ?? null,
  };
}

// POST /offers — make an offer on a listing.
// Body: { listingId, amountAud, message?, sellerId? }
//
// The seller is ALWAYS derived from the listing row on the server. The body's
// sellerId used to be written verbatim, and nothing (here or in RLS) tied it
// to the listing's real owner — so an attacker could file an offer on any
// active listing naming an accomplice account as the "seller", have the
// accomplice accept it, and then check out the victim's card at a self-chosen
// price (resolveOfferPrice only demanded an accepted offer). It also let
// anyone push a forged "offer received" notification + email to any user.
// A supplied sellerId is now only accepted when it matches the listing.
router.post('/', authMiddleware, async (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  const buyerId = req.user.id;
  const { listingId, sellerId, amountAud, message } = req.body || {};

  if (!UUID_RE.test(String(listingId ?? ''))) {
    return res.status(400).json({ error: 'A valid listingId is required' });
  }
  if (sellerId != null && !UUID_RE.test(String(sellerId))) {
    return res.status(400).json({ error: 'A valid sellerId is required' });
  }
  const amount = Number(amountAud);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'A valid offer amount is required' });
  }
  const note = typeof message === 'string' ? message.trim() : '';
  if (note.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message is too long' });
  }

  // Resolve the seller from the listing itself (service role: the listing is
  // public data, and this read must not depend on what the caller can see).
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, seller_id, status, listing_type, accepts_offers')
    .eq('id', listingId)
    .maybeSingle();
  if (listingError) {
    logger.error(`[OFFERS] listing lookup failed for ${listingId}: ${listingError.message}`);
    return res.status(500).json({ error: 'Failed to submit offer' });
  }
  if (!listing || listing.status !== 'active' || !listing.seller_id) {
    return res.status(404).json({ error: 'Listing not found or no longer active' });
  }
  // Offers are open on buy-now listings unless the seller switched Accept
  // Offers off, and always on Expression of Interest (it's offers-only).
  // Trade-only and auction listings don't take cash offers.
  const offersOpen = listing.listing_type === 'expression_of_interest'
    || ((listing.listing_type ?? 'fixed') === 'fixed' && listing.accepts_offers !== false);
  if (!offersOpen) {
    return res.status(400).json({ error: "This listing isn't accepting offers" });
  }
  const resolvedSellerId = listing.seller_id;
  if (sellerId != null && sellerId !== resolvedSellerId) {
    return res.status(400).json({ error: 'sellerId does not match the listing' });
  }
  if (resolvedSellerId === buyerId) {
    return res.status(400).json({ error: "You can't make an offer on your own listing" });
  }

  // The write itself, as the caller. RLS rejects a buyer_id that isn't them.
  const userClient = createUserScopedClient(token);
  const { data: offer, error } = await userClient
    .from('offers')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: resolvedSellerId,
      amount_aud: amount,
      message: note || null,
    })
    .select('id, listing_id, buyer_id, seller_id, amount_aud, message, status, expires_at, created_at')
    .single();

  if (error) {
    logger.error(`[OFFERS] insert failed for buyer ${buyerId}: ${error.message}`);
    return res.status(400).json({ error: error.message || 'Failed to submit offer' });
  }

  // Committed. From here nothing may turn a successful offer into a failure —
  // the in-app notification is already written by the trigger.
  let emailed = false;
  try {
    const ctx = await loadOfferContext(offer);
    if (ctx.sellerEmail) {
      emailed = await sendOfferReceived({
        sellerEmail: ctx.sellerEmail,
        sellerName: ctx.sellerName,
        buyerName: ctx.buyerName,
        cardName: ctx.cardName,
        listingType: ctx.listingType,
        amountAud: offer.amount_aud,
        message: offer.message,
        expiresAt: offer.expires_at
          ? new Date(offer.expires_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' })
          : null,
      });
    } else {
      logger.warn(`[OFFERS] no email on file for seller ${offer.seller_id} — offer ${offer.id} notified in-app only`);
    }
  } catch (err) {
    logger.error(`[OFFERS] seller email failed for offer ${offer.id}: ${err.message}`);
  }

  // `emailed` is reported so the admin diagnostics endpoint and the tests can
  // assert on it; the buyer's UI only cares that the offer landed.
  return res.status(201).json({ offer, emailed });
});

export default router;
