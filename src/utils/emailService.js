import { Resend } from 'resend';
import logger from './logger.js';
import {
  orderConfirmedEmail,
  itemSoldEmail,
  refundProcessedEmail,
  refundIssuedEmail,
  welcomeOfferEmail,
} from '../emails/templates.js';

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

async function send({ to, subject, html }) {
  const client = getClient();
  if (!client) return false;
  try {
    const { error } = await client.emails.send({ from: FROM, to, subject, html });
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
