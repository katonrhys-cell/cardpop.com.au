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
  const greeting = name ? `You're on the list, ${name}!` : "You're on the list!";
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
    `Welcome aboard, ${name}!`,
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
<td style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;">${it.name}${it.quantity > 1 ? ` <span style="color:#9CA3AF;">× ${it.quantity}</span>` : ''}</td>
<td style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;text-align:right;white-space:nowrap;">${money(it.total)} AUD</td>
</tr>`)
    .join('');

  const totalsRow = (label, value, bold) => `<tr>
<td style="padding:6px 0;font-size:${bold ? '15px' : '14px'};color:${bold ? '#111827' : '#6B7280'};${bold ? 'font-weight:700;border-top:2px solid #E5E7EB;padding-top:12px;' : ''}">${label}</td>
<td style="padding:6px 0;font-size:${bold ? '15px' : '14px'};color:${bold ? '#111827' : '#6B7280'};text-align:right;white-space:nowrap;${bold ? 'font-weight:700;border-top:2px solid #E5E7EB;padding-top:12px;' : ''}">${value}</td>
</tr>`;

  // Mirrors the on-page checkout summary: Subtotal → Discount → Service fee → GST → Shipping → Total.
  const discountRow = invoice.discount > 0 ? totalsRow('Discount', `−${money(invoice.discount)} AUD`) : '';
  const serviceFeeRow = invoice.serviceFee > 0 ? totalsRow('Service fee', `${money(invoice.serviceFee)} AUD`) : '';
  const gstRow = invoice.gst > 0 ? totalsRow('GST (10%)', `${money(invoice.gst)} AUD`) : '';
  const shippingRow = invoice.shipping > 0 ? totalsRow('Shipping', `${money(invoice.shipping)} AUD`) : '';

  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin:24px 0;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
${rows}
${totalsRow('Subtotal', `${money(invoice.subtotal)} AUD`)}
${discountRow}
${serviceFeeRow}
${gstRow}
${shippingRow}
${totalsRow('Total (AUD)', `${money(invoice.total)} AUD`, true)}
</table>
</div>`;
}

function businessBlock(invoice) {
  if (!invoice?.abn) return '';
  return `<div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
<p style="margin:0 0 6px;font-size:11px;color:#9CA3AF;letter-spacing:1.5px;text-transform:uppercase;">Billed to</p>
${invoice.businessName ? `<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#111827;">${invoice.businessName}</p>` : ''}
<p style="margin:0;font-size:14px;color:#374151;">ABN: ${invoice.abn}</p>
</div>`;
}

export function orderConfirmedEmail({ buyerName, cardName, itemPrice, total, orderId, invoice }) {
  const isTaxInvoice = Boolean(invoice?.abn);

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
${businessBlock(invoice)}
${invoiceBlock(invoice, orderId)}
${isTaxInvoice ? `<p style="font-size:13px;color:#6B7280;">This is a tax invoice.${invoice.gst > 0 ? ` Total includes GST of ${money(invoice.gst)} AUD.` : ''} Issued to ABN ${invoice.abn}.</p>` : ''}
<p>Check your order details to coordinate delivery with the seller. Enjoy the new addition to your collection!</p>`;
  } else {
    body = `<p>Your purchase has been confirmed. Here's a summary of what you've secured:</p>
${summaryTable([
  ['Item', cardName],
  ['Item price', `$${Number(itemPrice).toFixed(2)} AUD`],
  ['Total charged', `$${Number(total).toFixed(2)} AUD`, true],
])}
<p>Check your order details to coordinate delivery with the seller. Enjoy the new addition to your collection!</p>`;
  }

  return cpEmail(
    isTaxInvoice ? 'Your CardPop tax invoice — check the details inside.' : 'Your CardPop purchase is confirmed — check the details inside.',
    isTaxInvoice ? 'Tax Invoice' : 'Purchase Confirmed!',
    `You did it, ${buyerName}!`,
    body,
    `https://cardpop.com.au/orders/${orderId}`,
    'View Order',
    'This receipt was sent to confirm your purchase on CardPop. Keep it for your records.',
  );
}

// ─── Item sold (seller) ───────────────────────────────────────────────────────

export function itemSoldEmail({ sellerName, cardName, itemPrice, commissionAud, gstAud, sellerProceeds, orderId }) {
  const body = `<p>Congratulations — your listing sold on CardPop! Here's a breakdown of your sale:</p>
${summaryTable([
  ['Item', cardName],
  ['Sale value', `$${Number(itemPrice).toFixed(2)} AUD`],
  ['Platform fee', `$${Number(commissionAud).toFixed(2)} AUD`],
  ['GST', `$${Number(gstAud).toFixed(2)} AUD`],
  ['Net proceeds', `$${Number(sellerProceeds).toFixed(2)} AUD`, true],
])}
<p>Head to your order details to arrange delivery with the buyer and finalise the sale.</p>`;

  return cpEmail(
    'You made a sale on CardPop — great work!',
    'You Made a Sale!',
    `Well done, ${sellerName}!`,
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
    `Hi ${buyerName},`,
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
  const location = [event.suburb, event.state].filter(Boolean).join(', ') || '—';
  const startDate = event.start_date
    ? new Date(event.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })
    : '—';
  const submittedBy = event.organizer_name
    ? `${event.organizer_name}${event.organizer_email ? ` (${event.organizer_email})` : ''}`
    : (event.organizer_email || '—');

  const body = `<p>A community member has submitted a new event for review. It won't appear on the public calendar until you approve it.</p>
${summaryTable([
  ['Event', event.title || 'Untitled'],
  ['Type', EVENT_TYPE_LABELS[event.event_type] || event.event_type || '—'],
  ['Location', location],
  ['Start date', startDate],
  ['Submitted by', submittedBy],
])}
<p>Review it in the Events moderation queue to approve, edit, or reject the submission.</p>`;

  return cpEmail(
    `New event pending review: ${event.title || 'Untitled'}`,
    'New Event Submission',
    'A new event needs your review',
    body,
    'https://cardpop.com.au/admin/events',
    'Review in Admin',
    'You received this because you are the CardPop admin contact. Change the recipient under Admin → Platform Settings → Contact Email.',
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
    `Hi ${sellerName},`,
    body,
    `https://cardpop.com.au/orders/${orderId}`,
    'View Order',
    null,
  );
}
