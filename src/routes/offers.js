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
import { sendOfferReceived, sendOfferPlaced, sendOfferAdminNotice, sendOfferUpdate } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import logger from './../utils/logger.js';
import { listingTakesOffers, offerWindowState, OFFER_WINDOW_HOURS } from '../../utils/offerEligibility.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Matches the modal's own cap. A message longer than this is a mistake or an
// abuse attempt, not an offer note.
const MAX_MESSAGE_LENGTH = 1000;

// Every offer is copied to this inbox on top of the admin accounts and the
// configured alerts inbox (getAdminNotificationEmails), so it can never be
// dropped by a settings change.
export const OFFER_ADMIN_EMAIL = 'admin@cardpop.com.au';


const LISTING_URL = (id) => `https://cardpop.com.au/product/marketplace/${id}`;

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
      .select('listing_type, price_aud, vault_item:vault_items(card_name)')
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
    buyerEmail: byId[offer.buyer_id]?.email ?? null,
    buyerName: displayName(byId[offer.buyer_id]),
    askingPriceAud: listing?.price_aud ?? null,
    cardName: listing?.vault_item?.card_name ?? null,
    listingType: listing?.listing_type ?? null,
  };
}

// POST /offers — make an offer on a listing.
// Body: { listingId, amountAud, acknowledgedBinding: true, message?, sellerId? }
//
// An offer is BINDING: if the seller accepts inside the 48-hour window the
// buyer has agreed to buy at that price. The buyer must confirm that
// (acknowledgedBinding) and it is recorded on the row as
// binding_acknowledged_at, which the insert trigger requires.
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
  const { listingId, sellerId, amountAud, message, acknowledgedBinding } = req.body || {};

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
  if (acknowledgedBinding !== true) {
    return res.status(400).json({ error: `Please confirm you understand this offer is binding for ${OFFER_WINDOW_HOURS} hours unless you withdraw it` });
  }
  const note = typeof message === 'string' ? message.trim() : '';
  if (note.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message is too long' });
  }

  // Resolve the seller from the listing itself (service role: the listing is
  // public data, and this read must not depend on what the caller can see).
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, seller_id, status, listing_type, accepts_offers, offers_open_at, offers_close_at')
    .eq('id', listingId)
    .maybeSingle();
  if (listingError) {
    logger.error(`[OFFERS] listing lookup failed for ${listingId}: ${listingError.message}`);
    return res.status(500).json({ error: 'Failed to submit offer' });
  }
  if (!listing || listing.status !== 'active' || !listing.seller_id) {
    return res.status(404).json({ error: 'Listing not found or no longer active' });
  }
  if (!listingTakesOffers(listing)) {
    const offerWindow = listing.listing_type === 'expression_of_interest' ? offerWindowState(listing) : 'open';
    if (offerWindow === 'upcoming') return res.status(400).json({ error: 'This listing is not taking offers yet' });
    if (offerWindow === 'closed') return res.status(400).json({ error: 'Offers on this listing have closed' });
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
  const row = {
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: resolvedSellerId,
    amount_aud: amount,
    message: note || null,
    binding_acknowledged_at: new Date().toISOString(),
  };
  const insertOffer = (payload) => userClient
    .from('offers')
    .insert(payload)
    .select('id, listing_id, buyer_id, seller_id, amount_aud, message, status, expires_at, created_at')
    .single();
  let { data: offer, error } = await insertOffer(row);
  // Vercel can deploy before `supabase db push` adds the column — the old
  // schema doesn't require it, so save the offer without it rather than fail.
  if (error && /binding_acknowledged_at/.test(error.message || '') && /column/i.test(error.message || '')) {
    const { binding_acknowledged_at: _dropped, ...withoutAck } = row;
    ({ data: offer, error } = await insertOffer(withoutAck));
  }

  if (error) {
    logger.error(`[OFFERS] insert failed for buyer ${buyerId}: ${error.message}`);
    return res.status(400).json({ error: error.message || 'Failed to submit offer' });
  }

  // Committed. From here nothing may turn a successful offer into a failure —
  // the in-app notifications (seller + every admin) are already written by the
  // on_offer_created trigger.
  const result = await notifyOfferMade(offer);
  // The flags are reported so the tests can assert on them; the buyer's UI
  // only cares that the offer landed.
  return res.status(201).json({ offer, ...result });
});

const formatExpiry = (ts) => (ts
  ? new Date(ts).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' })
  : null);

/**
 * The three emails for a new offer — seller, buyer confirmation, admins — each
 * best-effort and independent, so one bounce never costs the others.
 */
async function notifyOfferMade(offer) {
  let ctx;
  try {
    ctx = await loadOfferContext(offer);
  } catch (err) {
    logger.error(`[OFFERS] context lookup failed for offer ${offer.id}: ${err.message}`);
    ctx = {};
  }
  const expiresAt = formatExpiry(offer.expires_at);
  const listingUrl = LISTING_URL(offer.listing_id);

  const seller = async () => {
    if (!ctx.sellerEmail) {
      logger.warn(`[OFFERS] no email on file for seller ${offer.seller_id} — offer ${offer.id} notified in-app only`);
      return false;
    }
    return sendOfferReceived({
      sellerEmail: ctx.sellerEmail,
      sellerName: ctx.sellerName,
      buyerName: ctx.buyerName,
      cardName: ctx.cardName,
      listingType: ctx.listingType,
      amountAud: offer.amount_aud,
      message: offer.message,
      expiresAt,
    });
  };
  const buyer = async () => {
    if (!ctx.buyerEmail) return false;
    return sendOfferPlaced({
      buyerEmail: ctx.buyerEmail,
      buyerName: ctx.buyerName,
      cardName: ctx.cardName,
      amountAud: offer.amount_aud,
      askingPriceAud: ctx.askingPriceAud,
      expiresAt,
      listingUrl,
    });
  };
  const admin = async () => {
    const configured = await getAdminNotificationEmails().catch(() => []);
    const seen = new Set();
    const to = [OFFER_ADMIN_EMAIL, ...configured].filter((addr) => {
      const key = String(addr || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return sendOfferAdminNotice({
      to,
      offerId: offer.id,
      cardName: ctx.cardName,
      amountAud: offer.amount_aud,
      askingPriceAud: ctx.askingPriceAud,
      buyerName: ctx.buyerName,
      buyerEmail: ctx.buyerEmail,
      sellerName: ctx.sellerName,
      sellerEmail: ctx.sellerEmail,
      message: offer.message,
      expiresAt,
      listingUrl,
    });
  };

  const [emailed, buyerEmailed, adminEmailed] = await Promise.all(
    [['seller', seller], ['buyer', buyer], ['admin', admin]].map(([who, fn]) =>
      fn().then(Boolean).catch((err) => {
        logger.error(`[OFFERS] ${who} email failed for offer ${offer.id}: ${err.message}`);
        return false;
      })),
  );
  return { emailed, buyerEmailed, adminEmailed };
}

// ─── Responding to an offer ──────────────────────────────────────────────────

// Each response is one status move, made by one side. RLS
// (offers_update_access) and the offers_enforce_lifecycle trigger are still
// the enforcement point — this table only picks the move, words the errors and
// decides who gets emailed.
export const OFFER_ACTIONS = {
  accept: { role: 'seller', from: 'pending', to: 'accepted', email: [['buyer', 'accepted']] },
  decline: { role: 'seller', from: 'pending', to: 'declined', email: [['buyer', 'declined']] },
  counter: { role: 'seller', from: 'pending', to: 'countered', email: [['buyer', 'countered']] },
  accept_counter: { role: 'buyer', from: 'countered', to: 'accepted', email: [['seller', 'counter_accepted'], ['buyer', 'counter_accepted']] },
  decline_counter: { role: 'buyer', from: 'countered', to: 'declined', email: [['seller', 'counter_declined']] },
  withdraw: { role: 'buyer', from: 'pending', to: 'withdrawn', email: [['seller', 'withdrawn']] },
};

// Moves that commit the card to the buyer — refused unless the listing is live.
export const LIVE_LISTING_ACTIONS = new Set(['accept', 'counter', 'accept_counter']);

const OFFER_FIELDS = 'id, listing_id, buyer_id, seller_id, amount_aud, counter_amount_aud, counter_message, message, status, expires_at, payment_due_at, paid_at, created_at';

// PATCH /offers/:id — { action, counterAmountAud?, counterMessage? }
router.patch('/:id', authMiddleware, async (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  const userId = req.user.id;
  const offerId = req.params.id;
  const { action, counterAmountAud, counterMessage } = req.body || {};
  const move = Object.hasOwn(OFFER_ACTIONS, action) ? OFFER_ACTIONS[action] : null;

  if (!UUID_RE.test(String(offerId))) {
    return res.status(400).json({ error: 'A valid offer id is required' });
  }
  if (!move) {
    return res.status(400).json({ error: `action must be one of: ${Object.keys(OFFER_ACTIONS).join(', ')}` });
  }

  const payload = { status: move.to };
  if (action === 'counter') {
    const counter = Number(counterAmountAud);
    if (!Number.isFinite(counter) || counter <= 0) {
      return res.status(400).json({ error: 'A valid counter amount is required' });
    }
    const note = typeof counterMessage === 'string' ? counterMessage.trim() : '';
    if (note.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message is too long' });
    }
    payload.counter_amount_aud = Math.round(counter * 100) / 100;
    payload.counter_message = note || null;
  }

  const { data: current, error: readError } = await supabase
    .from('offers')
    .select(OFFER_FIELDS)
    .eq('id', offerId)
    .maybeSingle();
  if (readError) {
    logger.error(`[OFFERS] lookup failed for offer ${offerId}: ${readError.message}`);
    return res.status(500).json({ error: 'Failed to update offer' });
  }
  const ownerColumn = move.role === 'seller' ? 'seller_id' : 'buyer_id';
  // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
  if (!current || current[ownerColumn] !== userId) {
    return res.status(404).json({ error: 'Offer not found' });
  }
  if (current.status !== move.from) {
    return res.status(409).json({ error: `This offer is ${current.status} and can no longer be changed that way` });
  }

  // Accepting or countering commits the card to this buyer, so the listing
  // must still be live. Declines and withdrawals always go through so a
  // dead offer can still be closed out.
  if (LIVE_LISTING_ACTIONS.has(action)) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('status')
      .eq('id', current.listing_id)
      .maybeSingle();
    if (listingError) {
      logger.error(`[OFFERS] listing lookup failed for offer ${offerId}: ${listingError.message}`);
      return res.status(500).json({ error: 'Failed to update offer' });
    }
    if (listing?.status !== 'active') {
      return res.status(409).json({
        error: 'This listing is no longer available (it has sold or been taken down), so the offer can only be declined or withdrawn',
      });
    }
  }

  const userClient = createUserScopedClient(token);
  const { data: offer, error } = await userClient
    .from('offers')
    .update(payload)
    .eq('id', offerId)
    .eq(ownerColumn, userId)
    .eq('status', move.from)
    .select(OFFER_FIELDS)
    .maybeSingle();

  if (error) {
    if (/expired/i.test(error.message || '')) {
      return res.status(409).json({ error: 'This offer has expired' });
    }
    logger.error(`[OFFERS] ${action} failed for offer ${offerId}: ${error.message}`);
    return res.status(400).json({ error: error.message || 'Failed to update offer' });
  }
  if (!offer) {
    // Lost a race (the other side acted first, or the sweep expired it).
    return res.status(409).json({ error: 'This offer changed before your response was saved — refresh and try again' });
  }

  const emailed = await notifyOfferResponse(offer, move);
  return res.json({ offer, emailed });
});

/**
 * Emails for a response, best-effort: the move is committed and the other
 * side's bell notification is already written by notify_on_offer_updated.
 * Returns { buyer?: boolean, seller?: boolean }.
 */
async function notifyOfferResponse(offer, move) {
  let ctx;
  try {
    ctx = await loadOfferContext(offer);
  } catch (err) {
    logger.error(`[OFFERS] context lookup failed for offer ${offer.id}: ${err.message}`);
    ctx = {};
  }
  const deadlineFor = (kind) => formatExpiry(kind === 'countered' ? offer.expires_at : offer.payment_due_at);

  const results = await Promise.all(move.email.map(async ([audience, kind]) => {
    const to = audience === 'buyer' ? ctx.buyerEmail : ctx.sellerEmail;
    if (!to) {
      logger.warn(`[OFFERS] no email on file for the ${audience} of offer ${offer.id} — notified in-app only`);
      return [audience, false];
    }
    try {
      const sent = await sendOfferUpdate({
        to,
        kind,
        audience,
        recipientName: audience === 'buyer' ? ctx.buyerName : ctx.sellerName,
        cardName: ctx.cardName,
        amountAud: offer.amount_aud,
        counterAmountAud: offer.counter_amount_aud,
        counterMessage: offer.counter_message,
        deadline: deadlineFor(kind),
        listingUrl: LISTING_URL(offer.listing_id),
      });
      return [audience, Boolean(sent)];
    } catch (err) {
      logger.error(`[OFFERS] ${kind} email to the ${audience} failed for offer ${offer.id}: ${err.message}`);
      return [audience, false];
    }
  }));
  return Object.fromEntries(results);
}

export default router;
