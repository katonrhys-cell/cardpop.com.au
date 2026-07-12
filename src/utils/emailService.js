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

async function send({ to, subject, html, attachments }) {
  const client = getClient();
  if (!client) return false;
  try {
    const payload = { from: FROM, to, subject, html };
    if (attachments?.length) payload.attachments = attachments;
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
    html: launchWelcomeEmail({ name }),
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

export async function sendOrderConfirmed({ buyerEmail, buyerName, cardName, itemPrice, total, orderId, invoice }) {
  const isTaxInvoice = Boolean(invoice?.abn);
  await send({
    to: buyerEmail,
    subject: isTaxInvoice ? 'Your CardPop tax invoice & order confirmation' : 'Your CardPop purchase is confirmed!',
    html: orderConfirmedEmail({ buyerName, cardName, itemPrice, total, orderId, invoice }),
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

export async function sendRefundIssued({ sellerEmail, sellerName, refundAmount, retainedFee, orderId }) {
  await send({
    to: sellerEmail,
    subject: 'A refund was issued on your CardPop sale',
    html: refundIssuedEmail({ sellerName, refundAmount, retainedFee, orderId }),
  });
}
