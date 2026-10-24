import { Resend } from 'resend';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import logger from './logger.js';
import {
  orderConfirmedEmail,
  itemSoldEmail,
  refundProcessedEmail,
  refundIssuedEmail,
  welcomeOfferEmail,
  launchWelcomeEmail,
  eventSubmittedEmail,
  identityReviewNeededEmail,
  soleTraderChangedEmail,
  orderAdminNoticeEmail,
  contactMessageEmail,
  offerReceivedEmail,
  offerPlacedEmail,
  offerAdminNoticeEmail,
  offerUpdateEmail,
  shopEnquiryEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  abandonedCheckoutEmail,
  watchlistPriceDropEmail,
  watchlistSoldEmail,
  savedSearchMatchesEmail,
  backInStockEmail,
  welcomeOfferReminderEmail,
} from '../emails/templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FROM = 'CardPop <noreply@cardpop.com.au>';

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.RESEND_API_KEY) {
      logger.warn('[EMAIL] RESEND_API_KEY not set — emails will not be sent');
      return null;
    }
    _client = new Resend(process.env.RESEND_API_KEY);
  }
  return _client;
}

async function send({ to, subject, html, attachments, replyTo }) {
  const client = getClient();
  if (!client) return false;
  try {
    const payload = { from: FROM, to, subject, html };
    if (attachments?.length) payload.attachments = attachments;
    // Let support reply straight to the person who wrote in (contact form).
    if (replyTo) payload.reply_to = replyTo;
    const { error } = await client.emails.send(payload);
    if (error) {
      logger.error(`[EMAIL] Send failed to ${to}: ${error.message}`);
      return false;
    }
    logger.info(`[EMAIL] Sent "${subject}" → ${to}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL] Unexpected error sending to ${to}: ${err.message}`);
    return false;
  }
}

// Filename the recipient sees for the early-access PDF.
const LAUNCH_PDF_FILENAME = 'CardPop-Early-Access.pdf';
// Committed fallback location — drop the real PDF here (or set
// LAUNCH_WELCOME_PDF_URL to a hosted file) and it's attached automatically.
const LAUNCH_PDF_PATH = join(__dirname, '..', 'emails', 'assets', 'launch-welcome.pdf');

/**
 * Build the attachments array for the pre-launch welcome email.
 *
 * Resolution order (first hit wins):
 *   1. LAUNCH_WELCOME_PDF_URL env var → Resend fetches it by URL.
 *   2. A committed PDF at src/emails/assets/launch-welcome.pdf → attached inline.
 *   3. Neither present → no attachment (the email still sends). This is the
 *      expected state until a real PDF is supplied, so it's a debug log only.
 *
 * @returns {Promise<Array<object>>}
 */
async function launchWelcomeAttachments() {
  const url = process.env.LAUNCH_WELCOME_PDF_URL?.trim();
  if (url) return [{ filename: LAUNCH_PDF_FILENAME, path: url }];

  try {
    const buf = await readFile(LAUNCH_PDF_PATH);
    return [{ filename: LAUNCH_PDF_FILENAME, content: buf.toString('base64') }];
  } catch {
    logger.debug?.('[EMAIL] No launch welcome PDF found (set LAUNCH_WELCOME_PDF_URL or add src/emails/assets/launch-welcome.pdf)');
    return [];
  }
}

/**
 * Pre-launch welcome email: sent when someone registers on the "coming soon"
 * landing modal. Confirms their spot, explains the reserved Pro-level early
 * access, and attaches the early-access PDF when one is configured.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendLaunchWelcome({ to, name }) {
  const attachments = await launchWelcomeAttachments();
  return send({
    to,
    subject: "You're in — CardPop early access reserved 🎴",
    html: launchWelcomeEmail({ name, hasGuide: attachments.length > 0 }),
    attachments,
  });
}

export async function sendWelcomeOffer({ to, name, code, trialDays, discountPct, expiresAt }) {
  return send({
    to,
    subject: `Your CardPop welcome gift: ${trialDays} days free + ${discountPct}% off`,
    html: welcomeOfferEmail({ name, code, trialDays, discountPct, expiresAt }),
  });
}

export async function sendOrderConfirmed({ buyerEmail, buyerName, cardName, itemPrice, total, orderId, invoice, paymentWalletType }) {
  const isTaxInvoice = Boolean(invoice?.abn);
  await send({
    to: buyerEmail,
    subject: isTaxInvoice ? 'Your CardPop tax invoice & order confirmation' : 'Your CardPop purchase is confirmed!',
    html: orderConfirmedEmail({ buyerName, cardName, itemPrice, total, orderId, invoice, paymentWalletType }),
  });
}

// Admin heads-up for every confirmed order. Sent to the configurable admin
// contact address, not to the buyer or seller.
export async function sendOrderAdminNotice({ to, orderId, buyerName, buyerEmail, total, itemsSummary, sellerName, preorderSummary }) {
  return send({
    to,
    subject: `New ${preorderSummary ? 'pre-order' : 'order'} received — $${Number(total || 0).toFixed(2)} AUD`,
    html: orderAdminNoticeEmail({ orderId, buyerName, buyerEmail, total, itemsSummary, sellerName, preorderSummary }),
  });
}

export async function sendItemSold({ sellerEmail, sellerName, cardName, itemPrice, commissionAud, gstAud, sellerProceeds, orderId }) {
  await send({
    to: sellerEmail,
    subject: 'You made a sale on CardPop!',
    html: itemSoldEmail({ sellerName, cardName, itemPrice, commissionAud, gstAud, sellerProceeds, orderId }),
  });
}

export async function sendRefundProcessed({ buyerEmail, buyerName, refundAmount, orderId }) {
  await send({
    to: buyerEmail,
    subject: 'Your CardPop refund has been processed',
    html: refundProcessedEmail({ buyerName, refundAmount, orderId }),
  });
}

/**
 * Tells the buyer their order has shipped, with the carrier tracking link.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendOrderShipped({ buyerEmail, buyerName, orderRef, items, carrier, trackingNumber, invitesReview = false }) {
  return send({
    to: buyerEmail,
    subject: `Your CardPop order ${orderRef} has shipped`,
    html: orderShippedEmail({ buyerName, orderRef, items, carrier, trackingNumber, invitesReview }),
  });
}

/**
 * Tells a seller that a buyer has made an offer (an "enquiry") on one of their
 * listings. Pairs with the in-app `offer_received` notification the
 * on_offer_created database trigger writes — the trigger covers the bell, this
 * covers the inbox.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendOfferReceived({ sellerEmail, sellerName, buyerName, cardName, amountAud, message, listingType, expiresAt }) {
  return send({
    to: sellerEmail,
    subject: `New offer on ${cardName || 'your listing'} — $${Number(amountAud || 0).toFixed(2)} AUD`,
    html: offerReceivedEmail({ sellerName, buyerName, cardName, amountAud, message, listingType, expiresAt }),
  });
}

/**
 * Buyer confirmation that their offer landed, spelling out that it is binding
 * for 48 hours unless withdrawn.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendOfferPlaced({ buyerEmail, buyerName, cardName, amountAud, askingPriceAud, expiresAt, listingUrl }) {
  return send({
    to: buyerEmail,
    subject: `Your $${Number(amountAud || 0).toFixed(2)} offer on ${cardName || 'a listing'} has been sent`,
    html: offerPlacedEmail({ buyerName, cardName, amountAud, askingPriceAud, expiresAt, listingUrl }),
  });
}

/**
 * Admin heads-up for every marketplace offer. `to` may be an array.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendOfferAdminNotice({ to, ...details }) {
  return send({
    to,
    subject: `New offer — $${Number(details.amountAud || 0).toFixed(2)} AUD on ${details.cardName || 'a listing'}`,
    html: offerAdminNoticeEmail(details),
  });
}

const OFFER_UPDATE_SUBJECTS = {
  accepted: (d) => `Your offer on ${d.cardName || 'a card'} was accepted — please pay by ${d.deadline || 'the deadline'}`,
  counter_accepted: (d) => (d.audience === 'buyer'
    ? `Counter accepted — please pay for ${d.cardName || 'your card'} by ${d.deadline || 'the deadline'}`
    : `The buyer accepted your counter on ${d.cardName || 'your listing'}`),
  countered: (d) => `Counter offer on ${d.cardName || 'a card'}: $${Number(d.counterAmountAud || 0).toFixed(2)} AUD`,
  declined: (d) => `Your offer on ${d.cardName || 'a card'} was declined`,
  counter_declined: (d) => `The buyer declined your counter on ${d.cardName || 'your listing'}`,
  withdrawn: (d) => `An offer on ${d.cardName || 'your listing'} was withdrawn`,
};

/**
 * A response to an offer (accept / decline / counter / withdraw), emailed to
 * the other party. Pairs with the notify_on_offer_updated bell notification.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendOfferUpdate({ to, ...details }) {
  const subject = OFFER_UPDATE_SUBJECTS[details.kind];
  if (!subject) throw new Error(`Unknown offer email kind: ${details.kind}`);
  return send({ to, subject: subject(details), html: offerUpdateEmail(details) });
}

export async function sendRefundIssued({ sellerEmail, sellerName, refundAmount, retainedFee, orderId }) {
  await send({
    to: sellerEmail,
    subject: 'A refund was issued on your CardPop sale',
    html: refundIssuedEmail({ sellerName, refundAmount, retainedFee, orderId }),
  });
}

// Contact-form message from a site visitor, delivered to the support/contact
// inbox. reply_to is set to the sender so support can respond in one click.
export async function sendContactMessage({ to, name, email, subject, message }) {
  return send({
    to,
    subject: `New contact message: ${subject}`,
    html: contactMessageEmail({ name, email, subject, message }),
    replyTo: email,
  });
}

// Shopper enquiry about a sold-out shop product, delivered to the admin inbox.
// reply_to is the shopper so admin can answer (restock date etc.) in one click.
export async function sendShopEnquiry({ to, productTitle, productSku, productId, productUrl, reason = 'sold_out', name, email, message }) {
  return send({
    to,
    subject: `${reason === 'coming_soon' ? 'Coming-soon' : 'Stock'} enquiry: ${productTitle}`,
    html: shopEnquiryEmail({ productTitle, productSku, productId, productUrl, reason, name, email, message }),
    replyTo: email,
  });
}

// Admin heads-up when a user submits an event to the community calendar. Sent to
// admin accounts (and the configurable admin contact address), not to a customer.
// `to` may be a single address or an array of addresses.
export async function sendEventSubmitted({ to, event }) {
  return send({
    to,
    subject: `New event pending review: ${event?.title || 'Untitled'}`,
    html: eventSubmittedEmail({ event }),
  });
}

// Admin heads-up when a user's Stripe Identity check needs manual review
// (document name doesn't match their profile). `to` may be a single address
// or an array of addresses.
export async function sendIdentityReviewNeeded({ to, userId, userName, userEmail }) {
  return send({
    to,
    subject: `Identity verification needs review: ${userName || 'A user'}`,
    html: identityReviewNeededEmail({ userId, userName, userEmail }),
  });
}

// Admin heads-up when a member switches Sole Trader mode on or off. `to` may be
// a single address or an array.
export async function sendSoleTraderChanged({ to, enabled, userName, ...details }) {
  return send({
    to,
    subject: `Sole trader mode ${enabled ? 'enabled' : 'disabled'}: ${userName || 'A member'}`,
    html: soleTraderChangedEmail({ enabled, userName, ...details }),
  });
}

/**
 * Tells the buyer their parcel arrived, starts the Buyer Protection clock in
 * writing and asks for a seller rating.
 *
 * @returns {Promise<boolean>} whether the email was actually sent
 */
export async function sendOrderDelivered({ buyerEmail, buyerName, orderRef, items, source, sellerName, marketplace = true, claimDays }) {
  return send({
    to: buyerEmail,
    subject: `Your CardPop order ${orderRef} was delivered`,
    html: orderDeliveredEmail({ buyerName, orderRef, items, source, sellerName, marketplace, claimDays }),
  });
}

// ─── Retention (src/services/retentionSweepService.js) ───────────────────────
// Each returns whether the provider accepted the message.

export async function sendAbandonedCheckout({ to, name, items, restoreUrl }) {
  return send({ to, subject: 'Your CardPop cart is waiting', html: abandonedCheckoutEmail({ name, items, restoreUrl }) });
}

export async function sendWatchlistPriceDrop({ to, name, cardName, setName, from, to: toPrice, pct, url }) {
  return send({ to, subject: `Price drop: ${cardName} is now $${Number(toPrice).toFixed(2)}`, html: watchlistPriceDropEmail({ name, cardName, setName, from, to: toPrice, pct, url }) });
}

export async function sendWatchlistSold({ to, name, cardName, setName, searchUrl }) {
  return send({ to, subject: `${cardName} on your watchlist has sold`, html: watchlistSoldEmail({ name, cardName, setName, searchUrl }) });
}

export async function sendSavedSearchMatches({ to, name, searchName, searchUrl, matches }) {
  return send({ to, subject: `New cards match “${searchName}”`, html: savedSearchMatchesEmail({ name, searchName, searchUrl, matches }) });
}

export async function sendBackInStock({ to, productTitle, priceAud, url }) {
  return send({ to, subject: `${productTitle} is back in stock`, html: backInStockEmail({ productTitle, priceAud, url }) });
}

export async function sendWelcomeOfferReminder({ to, name, code, discountPct, expiresAt }) {
  return send({ to, subject: `Your ${Number(discountPct)}% welcome code expires soon`, html: welcomeOfferReminderEmail({ name, code, discountPct, expiresAt }) });
}
