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
<p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">Questions? Reach us at <a href="mailto:support@cardpop.online" style="color:#E63946;text-decoration:none;">support@cardpop.online</a></p>
${footerNoteRow}
</div>
</td></tr>
<tr><td style="background:#1C1C1E;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#FFFFFF;">CardPop</p>
<p style="margin:0 0 12px;font-size:12px;color:#9CA3AF;">Australia's Premium Trading Card Marketplace</p>
<p style="margin:0;font-size:12px;"><a href="https://cardpop.online" style="color:#E63946;text-decoration:none;">cardpop.online</a> &nbsp;&middot;&nbsp; <a href="https://cardpop.online/account" style="color:#9CA3AF;text-decoration:none;">My Account</a> &nbsp;&middot;&nbsp; <a href="mailto:support@cardpop.online" style="color:#9CA3AF;text-decoration:none;">Support</a></p>
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

// ─── Order confirmed (buyer) ──────────────────────────────────────────────────

export function orderConfirmedEmail({ buyerName, cardName, itemPrice, total, orderId }) {
  const body = `<p>Your purchase has been confirmed. Here's a summary of what you've secured:</p>
${summaryTable([
  ['Item', cardName],
  ['Item price', `$${Number(itemPrice).toFixed(2)} AUD`],
  ['Total charged', `$${Number(total).toFixed(2)} AUD`, true],
])}
<p>Check your order details to coordinate delivery with the seller. Enjoy the new addition to your collection!</p>`;

  return cpEmail(
    'Your CardPop purchase is confirmed — check the details inside.',
    'Purchase Confirmed!',
    `You did it, ${buyerName}!`,
    body,
    `https://cardpop.online/orders/${orderId}`,
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
    `https://cardpop.online/orders/${orderId}`,
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
    `https://cardpop.online/orders/${orderId}`,
    'View Order',
    null,
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
    `https://cardpop.online/orders/${orderId}`,
    'View Order',
    null,
  );
}
