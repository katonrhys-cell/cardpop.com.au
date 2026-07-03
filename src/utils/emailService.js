import { Resend } from 'resend';
import logger from './logger.js';
import {
  orderConfirmedEmail,
  itemSoldEmail,
  refundProcessedEmail,
  refundIssuedEmail,
  orderTaxInvoiceEmail,
  orderShippedEmail,
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
  if (!client) return;
  try {
    const { error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) logger.error(`[EMAIL] Send failed to ${to}: ${error.message}`);
    else logger.info(`[EMAIL] Sent "${subject}" → ${to}`);
  } catch (err) {
    logger.error(`[EMAIL] Unexpected error sending to ${to}: ${err.message}`);
  }
}

export async function sendOrderConfirmed({ buyerEmail, buyerName, cardName, itemPrice, total, orderId }) {
  await send({
    to: buyerEmail,
    subject: 'Your CardPop purchase is confirmed!',
    html: orderConfirmedEmail({ buyerName, cardName, itemPrice, total, orderId }),
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

export async function sendOrderTaxInvoice({ buyerEmail, buyerName, lines, shippingAud, gstAud, totalAud, businessName, abn, orderId }) {
  await send({
    to: buyerEmail,
    subject: 'Your CardPop order is confirmed — tax invoice',
    html: orderTaxInvoiceEmail({ buyerName, lines, shippingAud, gstAud, totalAud, businessName, abn, orderId }),
  });
}

export async function sendOrderShipped({ buyerEmail, buyerName, trackingNumber, trackingCarrier, items, orderId }) {
  await send({
    to: buyerEmail,
    subject: 'Your CardPop order has shipped!',
    html: orderShippedEmail({ buyerName, trackingNumber, trackingCarrier, items, orderId }),
  });
}

// Plain-text supplier order, rendered monospaced so line items stay aligned.
export async function sendSupplierOrder({ to, subject, text }) {
  await send({
    to,
    subject,
    html: `<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap;">${text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
  });
}

export async function sendRefundIssued({ sellerEmail, sellerName, refundAmount, retainedFee, orderId }) {
  await send({
    to: sellerEmail,
    subject: 'A refund was issued on your CardPop sale',
    html: refundIssuedEmail({ sellerName, refundAmount, retainedFee, orderId }),
  });
}
