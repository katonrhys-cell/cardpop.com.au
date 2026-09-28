import { trackingUrl, carrierLabel, normalizeTrackingNumber } from '../../utils/shipmentTracking.js';

/**
 * Shared HTML email template builder matching CardPop brand.
 *
 * @param {string} preheader    - Hidden preview text shown in inbox list
 * @param {string} titleBand    - Dark band below the red header (e.g. "Order Confirmed!")
 * @param {string} greeting     - Bold greeting line (e.g. "You did it, Alex!")
 * @param {string} bodyHtml     - Main content HTML
 * @param {string|null} ctaUrl  - Button URL, or null to omit
 * @param {string|null} ctaText - Button label
 * @param {string|null} footerNote - Small note below the divider
 * @returns {string} Full HTML email string
 */
// Escape user-controlled text before it goes into email HTML. Listing titles,
// event fields, names and ABNs are user/seller-supplied; without this a listing
// titled `<a href="https://evil…">Click…</a>` renders as a live link in the
// buyer's receipt and admin notices sent from noreply@cardpop.com.au.
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cpEmail(preheader, titleBand, greeting, bodyHtml, ctaUrl, ctaText, footerNote) {
  const cta = ctaUrl
    ? `<div style="text-align:center;margin:32px 0 0"><a href="${ctaUrl}" style="background:#E63946;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;letter-spacing:-0.3px">${ctaText}</a></div>`
    : '';
  const titleRow = titleBand
    ? `<tr><td style="background:#1C1C1E;padding:20px 40px;"><p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;line-height:1.3;">${titleBand}</p></td></tr>`
    : '';
  const greetingRow = greeting
    ? `<p style="margin:0 0 20px;font-size:17px;font-weight:600;color:#111827;">${greeting}</p>`
    : '';
  const footerNoteRow = footerNote
    ? `<p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CardPop</title></head>
<body style="margin:0;padding:0;background:#F0F0F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F0F5;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:#E63946;border-radius:12px 12px 0 0;padding:28px 40px 24px;text-align:center;">
<p style="margin:0;font-size:30px;font-weight:900;color:#FFFFFF;letter-spacing:-1px;">CardPop</p>
<p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:2.5px;text-transform:uppercase;">Australia's Card Marketplace</p>
</td></tr>
${titleRow}
<tr><td style="background:#FFFFFF;padding:40px;">
${greetingRow}
<div style="font-size:15px;line-height:1.7;color:#374151;">${bodyHtml}</div>
${cta}
<div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E7EB;">
<p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">Questions? Reach us at <a href="mailto:support@cardpop.com.au" style="color:#E63946;text-decoration:none;">support@cardpop.com.au</a></p>
${footerNoteRow}
</div>
</td></tr>
<tr><td style="background:#1C1C1E;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#FFFFFF;">CardPop</p>
<p style="margin:0 0 12px;font-size:12px;color:#9CA3AF;">Australia's Premium Trading Card Marketplace</p>
<p style="margin:0;font-size:12px;"><a href="https://cardpop.com.au" style="color:#E63946;text-decoration:none;">cardpop.com.au</a> &nbsp;&middot;&nbsp; <a href="https://cardpop.com.au/account" style="color:#9CA3AF;text-decoration:none;">My Account</a> &nbsp;&middot;&nbsp; <a href="mailto:support@cardpop.com.au" style="color:#9CA3AF;text-decoration:none;">Support</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function summaryTable(rows) {
  const rowsHtml = rows
    .map(([label, value, bold]) =>
      `<tr><td style="padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;${bold ? 'font-weight:700;font-size:15px;color:#111827;' : ''}"><strong>${label}:</strong> ${value}</td></tr>`)
    .join('');
  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">${rowsHtml}</table>
</div>`;
}

// ─── Pre-launch welcome (landing-page early-access registration) ──────────────

export function launchWelcomeEmail({ name, hasGuide = false } = {}) {
  const greeting = name ? `You're on the list, ${esc(name)}!` : "You're on the list!";
  // Only promise the attached guide when one is actually attached (a committed
  // PDF or LAUNCH_WELCOME_PDF_URL); otherwise close without referencing it.
  const closing = hasGuide
    ? `<p>We've attached a short early-access guide with everything that's coming. Keep an eye on your inbox — the best is on its way.</p>`
    : `<p>Keep an eye on your inbox — we'll be in touch as soon as there's something new to explore. The best is on its way.</p>`;
  const body = `<p>Thanks for registering your interest in <strong>CardPop</strong> — Australia's home for buying, selling and trading collectible cards. We're still building, with a full launch planned for <strong>late 2026</strong>.</p>
<p style="margin:0 0 8px;"><strong>As an early registrant, here's what you've locked in:</strong></p>
<ul style="margin:0 0 20px;padding-left:20px;">
<li style="margin-bottom:8px;"><strong>Reserved Pro-level early access.</strong> When we start opening the platform up, you'll be among the first invited in — at the Pro tier, on us, for a limited time.</li>
<li style="margin-bottom:8px;"><strong>Front-row seat to the launch.</strong> We'll email you the moment new features go live, including peer-to-peer (P2P) trading, the collection vault and live Australian market pricing.</li>
<li><strong>Founding-member perks.</strong> Early registrants get first dibs on launch offers and community events.</li>
</ul>
<p>Just so you know what to expect: the marketplace and its features — including P2P trading — aren't live yet. This is your ticket to explore them first as they roll out.</p>
${closing}`;

  return cpEmail(
    "You're in — CardPop early access reserved. Here's what's coming.",
    'Early Access Reserved 🎴',
    greeting,
    body,
    'https://cardpop.com.au/launch',
    'Explore CardPop',
    "You're receiving this because you registered your interest at cardpop.com.au. We'll only email you about the launch.",
  );
}

// ─── Welcome offer (new registration) ─────────────────────────────────────────

export function welcomeOfferEmail({ name, code, trialDays, discountPct, expiresAt }) {
  const expiryStr = new Date(expiresAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney',
  });
  const codeBlock = `<div style="background:#F9FAFB;border:2px dashed #E63946;border-radius:12px;padding:24px;text-align:center;margin:28px 0;">
<p style="margin:0 0 8px;font-size:11px;color:#9CA3AF;letter-spacing:2.5px;text-transform:uppercase;">Your welcome code</p>
<p style="margin:0;font-size:28px;font-weight:900;letter-spacing:3px;color:#111827;">${code}</p>
</div>`;

  const body = `<p>Welcome to CardPop — Australia's trading card marketplace. As a thank-you for joining, here's a one-time welcome gift just for you:</p>
${codeBlock}
<p style="margin:0 0 8px;"><strong>Your code unlocks both of these:</strong></p>
<ul style="margin:0 0 20px;padding-left:20px;">
<li style="margin-bottom:8px;"><strong>${trialDays} days of selling, free.</strong> Redeem your code on the Membership page, add a card or PayPal to activate, and pay nothing until the trial ends — cancel anytime.</li>
<li><strong>${discountPct}% off your first order.</strong> Enter the same code at checkout and we'll take ${discountPct}% off the cards in your first purchase.</li>
</ul>
<p>Your code expires on <strong>${expiryStr}</strong>, so don't sit on it like a sealed booster box.</p>`;

  return cpEmail(
    `Your CardPop welcome gift: ${trialDays} days of selling free + ${discountPct}% off your first order.`,
    'Your Welcome Gift Inside 🎁',
    `Welcome aboard, ${esc(name)}!`,
    body,
    'https://cardpop.com.au/account/membership',
    'Redeem My Code',
    'This one-time offer was generated for your new CardPop account and can’t be transferred.',
  );
}

// ─── Order confirmed (buyer) ──────────────────────────────────────────────────

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Itemised invoice block. GST is already included in the total (Australian
// prices are GST-inclusive), so it's shown as an "includes GST" line rather
// than added on top.
function invoiceBlock(invoice, orderId) {
  const rows = (invoice.items || [])
    .map(it => `<tr>
<td style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;">${esc(it.name)}${it.quantity > 1 ? ` <span style="color:#9CA3AF;">× ${Number(it.quantity)}</span>` : ''}</td>
<td style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;text-align:right;white-space:nowrap;">${money(it.total)} AUD</td>
</tr>`)
    .join('');

  const totalsRow = (label, value, bold) => `<tr>
<td style="padding:6px 0;font-size:${bold ? '15px' : '14px'};color:${bold ? '#111827' : '#6B7280'};${bold ? 'font-weight:700;border-top:2px solid #E5E7EB;padding-top:12px;' : ''}">${label}</td>
<td style="padding:6px 0;font-size:${bold ? '15px' : '14px'};color:${bold ? '#111827' : '#6B7280'};text-align:right;white-space:nowrap;${bold ? 'font-weight:700;border-top:2px solid #E5E7EB;padding-top:12px;' : ''}">${value}</td>
</tr>`;

  // Mirrors the on-page checkout summary: Subtotal → Discount → Service fee → GST → Shipping → Total.
  // invoice.gst is GST *added* on top (marketplace listings); invoice.gstIncluded
  // is GST already *inside* GST-inclusive prices (CardPop Shop items + shipping),
  // shown as a note under the total rather than an added row so the lines still
  // sum to the amount charged.
  const discountRow = invoice.discount > 0 ? totalsRow('Discount', `−${money(invoice.discount)} AUD`) : '';
  const serviceFeeRow = invoice.serviceFee > 0 ? totalsRow('Service fee', `${money(invoice.serviceFee)} AUD`) : '';
  const gstRow = invoice.gst > 0 ? totalsRow('GST (10%)', `${money(invoice.gst)} AUD`) : '';
  const shippingRow = invoice.shipping > 0 ? totalsRow('Shipping', `${money(invoice.shipping)} AUD`) : '';
  const includedGstRow = invoice.gstIncluded > 0
    ? `<tr><td colspan="2" style="padding:6px 0 0;font-size:12px;color:#9CA3AF;text-align:right;">Includes GST of ${money(invoice.gstIncluded)} AUD</td></tr>`
    : '';

  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
${rows}
${totalsRow('Subtotal', `${money(invoice.subtotal)} AUD`)}
${discountRow}
${serviceFeeRow}
${gstRow}
${shippingRow}
${totalsRow('Total (AUD)', `${money(invoice.total)} AUD`, true)}
${includedGstRow}
</table>
</div>`;
}

function businessBlock(invoice) {
  if (!invoice?.abn) return '';
  return `<div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
<p style="margin:0 0 6px;font-size:11px;color:#9CA3AF;letter-spacing:1.5px;text-transform:uppercase;">Billed to</p>
${invoice.businessName ? `<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#111827;">${esc(invoice.businessName)}</p>` : ''}
<p style="margin:0;font-size:14px;color:#374151;">ABN: ${esc(invoice.abn)}</p>
</div>`;
}

// Google's brand guidelines only cover their own wallet by name; other
// values resolveWalletType() can return (e.g. 'link') get no special label.
const WALLET_LABELS = { google_pay: 'Google Pay', apple_pay: 'Apple Pay' };

export function orderConfirmedEmail({ buyerName, cardName, itemPrice, total, orderId, invoice, paymentWalletType }) {
  const isTaxInvoice = Boolean(invoice?.abn);
  // Per Google Pay brand guidelines ("Put it all together"), receipts should
  // indicate when the buyer paid with Google Pay specifically. Plain text —
  // most mail clients block remote/inline images by default, so a logo here
  // would often just be a broken box.
  const walletLabel = WALLET_LABELS[paymentWalletType];
  const paidWithLine = walletLabel ? `<p style="margin:0 0 20px;font-size:13px;color:#6B7280;">Paid with <strong style="color:#111827;">${esc(walletLabel)}</strong>.</p>` : '';

  // Rich itemised invoice when the checkout captured full pricing; otherwise
  // fall back to the original single-line summary (single-item purchases).
  let body;
  if (invoice?.items?.length) {
    const orderDate = invoice.orderDate
      ? new Date(invoice.orderDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })
      : null;
    const meta = `<p style="margin:0 0 20px;font-size:13px;color:#6B7280;">Invoice <strong style="color:#111827;">#${String(orderId).slice(0, 8).toUpperCase()}</strong>${orderDate ? ` &middot; ${orderDate}` : ''}</p>`;
    body = `<p>Your purchase has been confirmed. Here's your ${isTaxInvoice ? 'tax invoice' : 'receipt'}:</p>
${meta}
${paidWithLine}
${businessBlock(invoice)}
${invoiceBlock(invoice, orderId)}
${isTaxInvoice ? (() => { const gstTotal = Number(invoice.gst || 0) + Number(invoice.gstIncluded || 0); return `<p style="font-size:13px;color:#6B7280;">This is a tax invoice.${gstTotal > 0 ? ` Total includes GST of ${money(gstTotal)} AUD.` : ''} Issued to ABN ${esc(invoice.abn)}.</p>`; })() : ''}
<p>Check your order details to coordinate delivery with the seller. Enjoy the new addition to your collection!</p>`;
  } else {
    body = `<p>Your purchase has been confirmed. Here's a summary of what you've secured:</p>
${paidWithLine}
${summaryTable([
  ['Item', esc(cardName)],
  ['Item price', `$${Number(itemPrice).toFixed(2)} AUD`],
  ['Total charged', `$${Number(total).toFixed(2)} AUD`, true],
])}
<p>Check your order details to coordinate delivery with the seller. Enjoy the new addition to your collection!</p>`;
  }

  return cpEmail(
    isTaxInvoice ? 'Your CardPop tax invoice — check the details inside.' : 'Your CardPop purchase is confirmed — check the details inside.',
    isTaxInvoice ? 'Tax Invoice' : 'Purchase Confirmed!',
    `You did it, ${esc(buyerName)}!`,
    body,
    `https://cardpop.com.au/orders/${orderId}`,
    'View Order',
    'This receipt was sent to confirm your purchase on CardPop. Keep it for your records.',
  );
}

// ─── New order (admin notification) ──────────────────────────────────────────

// Internal heads-up sent to the admin contact for every confirmed order, so
// sales are visible without watching the dashboard. Links to Order Management,
// not a customer-facing page.
export function orderAdminNoticeEmail({ orderId, buyerName, buyerEmail, total, itemsSummary, sellerName }) {
  const rows = [
    ['Order', `#${String(orderId || '').slice(0, 8).toUpperCase() || '—'}`],
    ['Items', esc(itemsSummary) || '—'],
    ['Buyer', [buyerName, buyerEmail].filter(Boolean).map(esc).join(' · ') || '—'],
  ];
  if (sellerName) rows.push(['Seller', esc(sellerName)]);
  rows.push(['Total', `$${Number(total || 0).toFixed(2)} AUD`, true]);

  const body = `<p>A new order was just placed and paid on CardPop.</p>
${summaryTable(rows)}
<p>Open Order Management to view the full details, buyer address, and fulfilment status.</p>`;

  return cpEmail(
    `New order received — $${Number(total || 0).toFixed(2)} AUD`,
    'New Order',
    'A new order has come in',
    body,
    'https://cardpop.com.au/admin/orders',
    'View in Admin',
    'You received this because you are the CardPop admin contact. Change the recipient under Admin → Platform Settings → Notification Email.',
  );
}

// ─── Item sold (seller) ───────────────────────────────────────────────────────

export function itemSoldEmail({ sellerName, cardName, itemPrice, commissionAud, gstAud, shippingAud = 0, sellerProceeds, orderId }) {
  // Every row is signed the way it hits the seller's payout, so the figures
  // visibly add up to the net. GST and the platform fee are deductions; postage
  // the buyer paid is passed through, so it is an addition.
  const rows = [
    ['Item', esc(cardName)],
    ['Sale price (incl. GST)', `$${Number(itemPrice).toFixed(2)} AUD`],
  ];
  if (Number(shippingAud) > 0) rows.push(['Postage paid by buyer', `+$${Number(shippingAud).toFixed(2)} AUD`]);
  rows.push(['Platform fee', `−$${Number(commissionAud).toFixed(2)} AUD`]);
  if (Number(gstAud) > 0) rows.push(['GST remitted for you', `−$${Number(gstAud).toFixed(2)} AUD`]);
  rows.push(['Net proceeds', `$${Number(sellerProceeds).toFixed(2)} AUD`, true]);

  const body = `<p>Congratulations — your listing sold on CardPop! Here's a breakdown of your sale:</p>
${summaryTable(rows)}
${Number(gstAud) > 0 ? '<p style="font-size:13px;color:#6b7280;">Your listing price included GST. CardPop withholds the GST on your sale and postage and remits it to the ATO on your behalf.</p>' : ''}
<p>Head to your order details to arrange delivery with the buyer and finalise the sale.</p>`;

  return cpEmail(
    'You made a sale on CardPop — great work!',
    'You Made a Sale!',
    `Well done, ${esc(sellerName)}!`,
    body,
    `https://cardpop.com.au/orders/${orderId}`,
    'View Order',
    'This receipt was sent to confirm your sale on CardPop. Keep it for your records.',
  );
}

// ─── Refund processed (buyer) ─────────────────────────────────────────────────

export function refundProcessedEmail({ buyerName, refundAmount, orderId }) {
  const body = `<p>Your refund has been processed. Here's a summary:</p>
${summaryTable([
  ['Refund amount', `$${Number(refundAmount).toFixed(2)} AUD`, true],
])}
<p>Please allow 5–10 business days for the funds to appear on your original payment method.</p>`;

  return cpEmail(
    `Your CardPop refund of $${Number(refundAmount).toFixed(2)} AUD is on its way.`,
    'Refund Processed',
    `Hi ${esc(buyerName)},`,
    body,
    `https://cardpop.com.au/orders/${orderId}`,
    'View Order',
    null,
  );
}

// ─── Event submitted (admin notification) ────────────────────────────────────

// Sent to the admin notification recipient when a user submits an event to the
// community calendar. It's an internal heads-up, not a customer email, so it
// links straight to the moderation queue rather than a public page.
export function eventSubmittedEmail({ event }) {
  const EVENT_TYPE_LABELS = {
    card_show: 'Card Show',
    trade_event: 'Trade Event',
    community_event: 'Community Event',
    lgs_event: 'LGS Event',
  };
  const location = [event.suburb, event.state].filter(Boolean).map(esc).join(', ') || '—';
  const startDate = event.start_date
    ? new Date(event.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })
    : '—';
  const submittedBy = event.organizer_name
    ? `${esc(event.organizer_name)}${event.organizer_email ? ` (${esc(event.organizer_email)})` : ''}`
    : (esc(event.organizer_email) || '—');

  const body = `<p>A community member has submitted a new event for review. It won't appear on the public calendar until you approve it.</p>
${summaryTable([
  ['Event', esc(event.title) || 'Untitled'],
  ['Type', EVENT_TYPE_LABELS[event.event_type] || esc(event.event_type) || '—'],
  ['Location', location],
  ['Start date', startDate],
  ['Submitted by', submittedBy],
])}
<p>Review it in the Events moderation queue to approve, edit, or reject the submission.</p>`;

  return cpEmail(
    `New event pending review: ${esc(event.title) || 'Untitled'}`,
    'New Event Submission',
    'A new event needs your review',
    body,
    'https://cardpop.com.au/admin/events',
    'Review in Admin',
    'You received this because you are the CardPop admin contact. Change the recipient under Admin → Platform Settings → Notification Email.',
  );
}

// ─── Identity verification needs manual review (admin notification) ──────────

// Sent to admin accounts when a user's Stripe Identity document name doesn't
// match their profile name and the verification is routed to manual review
// (see identityService.js applyIdentitySession). It's an internal heads-up,
// not a customer email, so it links straight to the user's admin detail page.
export function identityReviewNeededEmail({ userId, userName, userEmail }) {
  const body = `<p>A user's identity verification needs manual review — the name on their submitted ID didn't automatically match their account name.</p>
${summaryTable([
  ['User', esc(userName) || '—'],
  ['Email', esc(userEmail) || '—'],
])}
<p>Review it on the user's admin detail page to approve or reject the verification.</p>`;

  return cpEmail(
    `Identity verification needs review: ${esc(userName) || 'A user'}`,
    'Identity Review Needed',
    'A verification needs your review',
    body,
    `https://cardpop.com.au/admin/users/${userId}`,
    'Review in Admin',
    'You received this because you are a CardPop admin.',
  );
}

// ─── Contact form message (admin/support) ─────────────────────────────────────

export function contactMessageEmail({ name, email, subject, message }) {
  const body = `<p>A visitor sent a message through the CardPop contact form.</p>
${summaryTable([
  ['From', `${esc(name)} (${esc(email)})`],
  ['Subject', esc(subject)],
])}
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;white-space:pre-wrap;font-size:15px;line-height:1.7;color:#374151;">${esc(message)}</div>
<p style="font-size:13px;color:#9CA3AF;">Reply directly to this email to respond to ${esc(name)}.</p>`;

  return cpEmail(
    `New contact message: ${esc(subject)}`,
    'New Contact Message',
    'Someone wants to get in touch',
    body,
    null,
    null,
    'You received this because you are the CardPop support contact.',
  );
}

// ─── Shop stock enquiry (admin) ──────────────────────────────────────────────

// A shopper hit "Enquire" on a sold-out shop product. Delivered to the admin
// inbox with reply_to set to the shopper so a restock reply is one click.
export function shopEnquiryEmail({ productTitle, productSku, productId, productUrl, reason = 'sold_out', name, email, message }) {
  const comingSoon = reason === 'coming_soon';
  const body = `<p>A shopper ${comingSoon ? 'registered interest in a <strong>coming-soon</strong> product' : 'asked about a <strong>sold-out</strong> product'} in the CardPop shop.</p>
${summaryTable([
  ['Product', esc(productTitle)],
  ...(productSku ? [['SKU', esc(productSku)]] : []),
  ['Product ID', esc(productId)],
  ['From', `${esc(name)} (${esc(email)})`],
])}
${message
    ? `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;white-space:pre-wrap;font-size:15px;line-height:1.7;color:#374151;">${esc(message)}</div>`
    : `<p style="color:#6B7280;">No message was included — they just want to know when it is ${comingSoon ? 'available' : 'back in stock'}.</p>`}
<p style="font-size:13px;color:#9CA3AF;">Reply directly to this email to respond to ${esc(name)}.</p>`;

  return cpEmail(
    `${comingSoon ? 'Coming-soon' : 'Stock'} enquiry: ${esc(productTitle)}`,
    comingSoon ? 'Coming-Soon Product Enquiry' : 'Sold-Out Product Enquiry',
    comingSoon ? 'A shopper wants a coming-soon item' : 'A shopper wants a sold-out item',
    body,
    productUrl || null,
    productUrl ? 'View Product' : null,
    'You received this because you are the CardPop shop admin.',
  );
}

// ─── Refund issued (seller) ───────────────────────────────────────────────────

export function refundIssuedEmail({ sellerName, refundAmount, retainedFee, orderId }) {
  const body = `<p>A refund was issued to the buyer on one of your sales.</p>
${summaryTable([
  ['Refund to buyer', `$${Number(refundAmount).toFixed(2)} AUD`],
  ['Platform fee retained', `$${Number(retainedFee).toFixed(2)} AUD`, true],
])}
<p>If you have any questions about this refund, please contact our support team.</p>`;

  return cpEmail(
    'A refund was issued on one of your CardPop sales.',
    'Refund Issued on Your Sale',
    `Hi ${esc(sellerName)},`,
    body,
    `https://cardpop.com.au/orders/${orderId}`,
    'View Order',
    null,
  );
}

// ─── Offer / enquiry received (seller) ────────────────────────────────────────

/**
 * Sent to the seller the moment a buyer makes an offer on one of their
 * listings — the email half of the `offer_received` notification the
 * on_offer_created trigger already writes to the notification bell.
 *
 * The buyer's message is seller-supplied free text, so it goes through `esc`
 * like every other user-controlled value in these templates.
 */
export function offerReceivedEmail({ sellerName, buyerName, cardName, amountAud, message, listingType, expiresAt }) {
  // The route passes the raw listings.listing_type enum; accept the UI label too.
  const isEOI = listingType === 'expression_of_interest' || listingType === 'Expression of Interest';
  const rows = [
    ['Card', esc(cardName || 'Your listing')],
    ['Offer', `${money(amountAud)} AUD`, true],
    ['From', esc(buyerName || 'A CardPop buyer')],
  ];
  if (expiresAt) rows.push(['Expires', esc(expiresAt)]);

  const quoted = message
    ? `<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">Their message</p>
<div style="background:#F9FAFB;border-left:3px solid #E63946;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${esc(message)}</div>`
    : '';

  const body = `<p>${isEOI
    ? 'Someone has expressed interest in a card you have listed for offers.'
    : 'You have a new offer on one of your listings.'}</p>
${summaryTable(rows)}
${quoted}
<p>Head to your offers page to accept, decline or counter. Offers expire automatically if you don't respond in time.</p>`;

  return cpEmail(
    `New offer of ${money(amountAud)} on ${esc(cardName || 'your listing')}`,
    'New Offer Received',
    `You have an offer, ${esc(sellerName || 'there')}!`,
    body,
    'https://cardpop.com.au/account/offers',
    'View Offer',
    'You are receiving this because someone made an offer on your CardPop listing.',
  );
}

// ─── Order shipped (buyer) ────────────────────────────────────────────────────

/**
 * Sent to the buyer when an admin marks their order shipped with a tracking
 * reference. The button goes straight to the carrier's tracking page (guest
 * buyers have no account to log into); with no carrier link it falls back to
 * the order list. Item titles are seller-supplied, so they go through `esc`.
 */
export function orderShippedEmail({ buyerName, orderRef, items = [], carrier, trackingNumber }) {
  const url = trackingUrl(carrier, trackingNumber);
  const number = normalizeTrackingNumber(trackingNumber);
  const rows = [['Order', esc(orderRef)]];
  if (items.length) rows.push(['Items', items.map(esc).join(', ')]);
  rows.push(['Carrier', esc(carrierLabel(carrier))]);
  rows.push([
    'Tracking number',
    url ? `<a href="${esc(url)}" style="color:#E63946;text-decoration:none;font-family:monospace;">${esc(number)}</a>` : `<span style="font-family:monospace;">${esc(number)}</span>`,
    true,
  ]);

  const body = `<p>Good news — your order is on its way.</p>
${summaryTable(rows)}
<p>${url
    ? `Tracking can take up to 24 hours to show the first scan. You can follow your parcel any time with the button below${carrier === 'auspost' ? ' or in the Australia Post app' : ''}.`
    : `Use the tracking number above on ${esc(carrierLabel(carrier))}'s website to follow your parcel.`}</p>`;

  return cpEmail(
    `Your CardPop order has shipped — tracking ${esc(number)}.`,
    'Your Order Has Shipped',
    `Hi ${esc(buyerName || 'there')},`,
    body,
    url ? esc(url) : 'https://cardpop.com.au/account/orders',
    url ? 'Track Your Parcel' : 'View Your Orders',
    'You are receiving this because you placed an order on CardPop.',
  );
}
