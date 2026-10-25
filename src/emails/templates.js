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

// The brand logo at the top of every email. A trimmed copy of the official
// lockup (card icon · CardPop™ · AUSTRALIA on its near-black ground) served
// from the site at 2× so it stays crisp on retina inboxes. /images/ is cached
// immutable for a year, so a new artwork needs a new -vN filename, never an
// overwrite. The band behind it matches the artwork's own background so the
// PNG's edges are invisible; the alt text (styled white) is what a client that
// blocks remote images shows instead, so the header never reads as empty.
export const EMAIL_LOGO_URL = 'https://cardpop.com.au/images/email/cardpop-logo-v1.png';
const EMAIL_LOGO_BG = '#0A0A0A';
const EMAIL_LOGO_WIDTH = 220; // 440px source ÷ 2

export function cpEmail(preheader, titleBand, greeting, bodyHtml, ctaUrl, ctaText, footerNote) {
  const cta = ctaUrl
    ? `<div style="text-align:center;margin:32px 0 0"><a href="${ctaUrl}" style="background:#E63946;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;letter-spacing:-0.3px">${ctaText}</a></div>`
    : '';
  // The title band sits directly under the near-black logo header, so it is
  // brand red (as the header used to be) rather than charcoal-on-black.
  const titleRow = titleBand
    ? `<tr><td style="background:#E63946;padding:20px 40px;"><p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;line-height:1.3;">${titleBand}</p></td></tr>`
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
<tr><td style="background:${EMAIL_LOGO_BG};border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">
<a href="https://cardpop.com.au" style="text-decoration:none;display:inline-block;"><img src="${EMAIL_LOGO_URL}" width="${EMAIL_LOGO_WIDTH}" alt="CardPop Australia" style="display:block;width:${EMAIL_LOGO_WIDTH}px;max-width:100%;height:auto;border:0;outline:none;margin:0 auto;font-size:26px;font-weight:900;color:#FFFFFF;letter-spacing:-1px;text-align:center;"></a>
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

// ─── Hero badge + stat tiles (every customer-facing email) ───────────────────
//
// Styled like a Google Search Console digest: a centred headline, one big
// circular icon badge, a row of stat tiles (coloured circle · big figure ·
// small caption), then the detail and the button. Built from tables,
// border-radius and unicode glyphs only — Gmail strips <svg> and blocks remote
// images by default, so there is nothing to block and nothing to break.
// Colours are the brand palette (red / charcoal / greys) plus one green for
// good-news tiles — no blue.

const linkStyle = 'color:#E63946;text-decoration:none;';
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const TILE = { red: '#E63946', green: '#16A34A', charcoal: '#1C1C1E', grey: '#6B7280' };

/** The big centred icon badge under the headline (a glyph in a coloured ring). */
function heroBadge(glyph, colour = TILE.red) {
  return `<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px;"><tr>
<td align="center" valign="middle" style="width:96px;height:96px;border-radius:48px;background:${colour}20;">
<table cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" valign="middle" style="width:64px;height:64px;border-radius:32px;background:${colour};color:#FFFFFF;font-size:30px;font-weight:900;line-height:64px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${glyph}</td>
</tr></table></td></tr></table>`;
}

/** Centred headline + optional sub-line (the product / card / search name). */
function heroHeading(title, subtitle) {
  return `<h1 style="margin:0 0 6px;font-size:28px;line-height:1.25;font-weight:400;color:#1C1C1E;text-align:center;letter-spacing:-0.3px;">${title}</h1>
${subtitle ? `<p style="margin:0 0 28px;font-size:16px;color:#4B5563;text-align:center;">${subtitle}</p>` : '<div style="height:20px;"></div>'}`;
}

/** One stat tile: coloured circle with a glyph, a big figure, a small caption. */
function statTile({ glyph, colour = TILE.red, value, caption, small = false }) {
  return `<td align="center" valign="top" style="padding:8px 6px;">
<table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td align="center" valign="middle" style="width:56px;height:56px;border-radius:28px;background:${colour};color:#FFFFFF;font-size:24px;font-weight:900;line-height:56px;">${glyph}</td>
</tr></table>
<p style="margin:12px 0 2px;font-size:${small ? '20px' : '30px'};font-weight:400;color:#1C1C1E;line-height:1.2;letter-spacing:-0.5px;word-break:break-word;">${value}</p>
<p style="margin:0;font-size:13px;color:#6B7280;line-height:1.4;">${caption}</p>
</td>`;
}

/** A row of 1–3 tiles, in a bordered card like the Search Console summary. */
function statRow(tiles) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:12px;margin:0 0 28px;">
<tr><td style="padding:20px 10px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tiles.map(statTile).join('')}</tr></table></td></tr>
</table>`;
}

/** A list of items (cart lines, matches) in the same bordered-card style. */
function itemCard(rows) {
  const html = rows.map(([left, right]) =>
    `<tr><td style="padding:10px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;">${left}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:700;color:#1C1C1E;border-bottom:1px solid #F3F4F6;white-space:nowrap;">${right}</td></tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:12px;margin:0 0 24px;"><tr><td style="padding:8px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${html}</table></td></tr></table>`;
}

const centred = (text) => `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;text-align:center;">${text}</p>`;
const plural = (n, one, many) => (n === 1 ? one : many);

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
  const codeBlock = `<div style="background:#F9FAFB;border:2px dashed #E63946;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
<p style="margin:0 0 8px;font-size:11px;color:#9CA3AF;letter-spacing:2.5px;text-transform:uppercase;">Your welcome code</p>
<p style="margin:0;font-size:28px;font-weight:900;letter-spacing:3px;color:#111827;">${esc(code)}</p>
</div>`;

  const body = `${heroBadge('🎁')}
${heroHeading('Your welcome gift', `Welcome aboard, ${esc(name)} — a one-time thank-you for joining CardPop.`)}
${statRow([
  { glyph: '%', colour: TILE.red, value: `${Number(discountPct)}%`, caption: 'Off your first order' },
  { glyph: '★', colour: TILE.green, value: String(Number(trialDays)), caption: 'Days of selling, free' },
  { glyph: '⏱', colour: TILE.charcoal, value: esc(expiryStr), caption: 'Code expires', small: true },
])}
${codeBlock}
<p style="margin:0 0 8px;"><strong>Your code unlocks both of these:</strong></p>
<ul style="margin:0 0 20px;padding-left:20px;">
<li style="margin-bottom:8px;"><strong>${Number(trialDays)} days of selling, free.</strong> Redeem your code on the Membership page, add a card or PayPal to activate, and pay nothing until the trial ends — cancel anytime.</li>
<li><strong>${Number(discountPct)}% off your first order.</strong> It’s applied automatically at checkout when you’re signed in.</li>
</ul>
${centred(`Your code expires on <strong>${esc(expiryStr)}</strong>, so don’t sit on it like a sealed booster box.`)}`;

  return cpEmail(
    `Your CardPop welcome gift: ${Number(trialDays)} days of selling free + ${Number(discountPct)}% off your first order.`,
    '',
    '',
    body,
    'https://cardpop.com.au/account/membership',
    'Redeem My Code',
    'This one-time offer was generated for your new CardPop account and can’t be transferred.',
  );
}

// ─── Order confirmed (buyer) ──────────────────────────────────────────────────


// Itemised invoice block. GST is already included in the total (Australian
// prices are GST-inclusive), so it's shown as an "includes GST" line rather
// than added on top.
function invoiceBlock(invoice, orderId) {
  const rows = (invoice.items || [])
    .map(it => `<tr>
<td style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #F3F4F6;">${esc(it.name)}${it.quantity > 1 ? ` <span style="color:#9CA3AF;">× ${Number(it.quantity)}</span>` : ''}${it.preorderEta ? `<br><span style="font-size:12px;font-weight:700;color:#CE1126;">Pre-order &middot; ${esc(it.preorderEta)}</span>` : ''}</td>
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

// Shown when any invoice line is a pre-order: paid now, dispatched later.
function preorderNote(invoice) {
  if (!(invoice?.items || []).some((it) => it.preorderEta)) return '';
  return `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin:0 0 20px;font-size:14px;color:#374151;">
<strong style="color:#111827;">Your order includes pre-order items.</strong> They're paid for and reserved for you, and we'll dispatch them as soon as stock arrives (estimates above). You'll get a tracking email when they ship. If a pre-order can't be supplied, it's refunded in full.
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
  const paidWithLine = walletLabel ? `<p style="margin:0 0 20px;font-size:13px;color:#6B7280;text-align:center;">Paid with <strong style="color:#111827;">${esc(walletLabel)}</strong>.</p>` : '';
  const ref = `#${String(orderId).slice(0, 8).toUpperCase()}`;
  const hasInvoice = Boolean(invoice?.items?.length);
  const orderDate = hasInvoice && invoice.orderDate
    ? new Date(invoice.orderDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })
    : null;
  const itemCount = hasInvoice ? invoice.items.reduce((n, i) => n + (Number(i.quantity) || 1), 0) : 1;
  const paid = hasInvoice ? Number(invoice.total ?? total) : Number(total);

  const hero = `${heroBadge('✓', TILE.green)}
${heroHeading(isTaxInvoice ? 'Tax invoice' : 'Purchase confirmed', `You did it, ${esc(buyerName)}! Order <strong>${esc(ref)}</strong>${orderDate ? ` · ${esc(orderDate)}` : ''}`)}
${statRow([
  { glyph: '$', colour: TILE.red, value: money(paid), caption: 'Total paid (AUD)' },
  { glyph: '#', colour: TILE.charcoal, value: String(itemCount), caption: itemCount === 1 ? 'Item' : 'Items' },
  { glyph: '✓', colour: TILE.green, value: 'Full', caption: 'Buyer Protection' },
])}
${paidWithLine}`;

  // Rich itemised invoice when the checkout captured full pricing; otherwise
  // fall back to the original single-line summary (single-item purchases).
  let body;
  if (hasInvoice) {
    body = `${hero}
<p style="margin:0 0 12px;">Here's your ${isTaxInvoice ? 'tax invoice' : 'receipt'}:</p>
${businessBlock(invoice)}
${invoiceBlock(invoice, orderId)}
${preorderNote(invoice)}
${isTaxInvoice ? (() => { const gstTotal = Number(invoice.gst || 0) + Number(invoice.gstIncluded || 0); return `<p style="font-size:13px;color:#6B7280;">This is a tax invoice.${gstTotal > 0 ? ` Total includes GST of ${money(gstTotal)} AUD.` : ''} Issued to ABN ${esc(invoice.abn)}.</p>`; })() : ''}
${centred('We’ll email you the tracking number as soon as it’s posted. Enjoy the new addition to your collection!')}`;
  } else {
    body = `${hero}
${summaryTable([
  ['Item', esc(cardName)],
  ['Item price', `$${Number(itemPrice).toFixed(2)} AUD`],
  ['Total charged', `$${Number(total).toFixed(2)} AUD`, true],
])}
${centred('We’ll email you the tracking number as soon as it’s posted. Enjoy the new addition to your collection!')}`;
  }

  return cpEmail(
    isTaxInvoice ? 'Your CardPop tax invoice — check the details inside.' : 'Your CardPop purchase is confirmed — check the details inside.',
    '',
    '',
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
export function orderAdminNoticeEmail({ orderId, buyerName, buyerEmail, total, itemsSummary, sellerName, preorderSummary }) {
  const rows = [
    ['Order', `#${String(orderId || '').slice(0, 8).toUpperCase() || '—'}`],
    ['Items', esc(itemsSummary) || '—'],
    // Pre-order lines can't ship yet — flagged so they aren't packed early.
    ...(preorderSummary ? [['Pre-order', esc(preorderSummary)]] : []),
    ['Buyer', [buyerName, buyerEmail].filter(Boolean).map(esc).join(' · ') || '—'],
  ];
  if (sellerName) rows.push(['Seller', esc(sellerName)]);
  rows.push(['Total', `$${Number(total || 0).toFixed(2)} AUD`, true]);

  const body = `<p>A new order was just placed and paid on CardPop.</p>
${summaryTable(rows)}
<p>Open Order Management to view the full details, buyer address, and fulfilment status.</p>`;

  return cpEmail(
    `New ${preorderSummary ? 'pre-order' : 'order'} received — $${Number(total || 0).toFixed(2)} AUD`,
    preorderSummary ? 'New Pre-order' : 'New Order',
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

  const body = `${heroBadge('$', TILE.green)}
${heroHeading('You made a sale!', `Well done, ${esc(sellerName)} — <strong>${esc(cardName)}</strong> has sold.`)}
${statRow([
  { glyph: '$', colour: TILE.red, value: money(itemPrice), caption: 'Sale price' },
  { glyph: '✓', colour: TILE.green, value: money(sellerProceeds), caption: 'Your net proceeds' },
  { glyph: '→', colour: TILE.charcoal, value: '7', caption: 'Days to post it (tracked)' },
])}
${summaryTable(rows)}
${Number(gstAud) > 0 ? '<p style="font-size:13px;color:#6b7280;">Your listing price included GST. CardPop withholds the GST on your sale and postage and remits it to the ATO on your behalf.</p>' : ''}
<p><strong>Next step:</strong> post the card within 7 days using a tracked service, then open <a href="https://cardpop.com.au/account/sales" style="color:#E63946;text-decoration:none;">Account → Sales</a> to see the buyer's delivery address and mark it as shipped with the tracking number — the buyer is emailed the tracking link and your Buyer Protection cover begins.</p>`;

  return cpEmail(
    'You made a sale on CardPop — great work!',
    '',
    '',
    body,
    'https://cardpop.com.au/account/sales',
    'Ship This Order',
    'This receipt was sent to confirm your sale on CardPop. Keep it for your records.',
  );
}

// ─── Refund processed (buyer) ─────────────────────────────────────────────────

export function refundProcessedEmail({ buyerName, refundAmount, orderId }) {
  const body = `${heroBadge('↩')}
${heroHeading('Refund processed', `Hi ${esc(buyerName)} — your money is on its way back.`)}
${statRow([
  { glyph: '$', colour: TILE.red, value: money(refundAmount), caption: 'Refunded (AUD)' },
  { glyph: '⏱', colour: TILE.charcoal, value: '5–10', caption: 'Business days to appear' },
])}
${centred('The refund goes back to your original payment method. Banks and card issuers can take 5–10 business days to show it.')}`;

  return cpEmail(
    `Your CardPop refund of $${Number(refundAmount).toFixed(2)} AUD is on its way.`,
    '',
    '',
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

// ─── Sole trader mode changed (admin) ─────────────────────────────────────────

// Internal heads-up when a member switches Sole Trader mode on or off in
// Account → Sole Trader, so admins know a dealer store page appeared or went.
export function soleTraderChangedEmail({ userId, userName, userEmail, enabled, businessName, abn, storeSlug }) {
  const state = enabled ? 'switched ON' : 'switched OFF';
  const body = `<p>A member has ${state} Sole Trader mode on their account.</p>
${summaryTable([
  ['Member', esc(userName) || '—'],
  ['Email', esc(userEmail) || '—'],
  ['Status', enabled ? 'Sole trader (store page live)' : 'Not a sole trader (store page hidden)'],
  ['Business name', esc(businessName) || '—'],
  ['ABN', esc(abn) || '—'],
  ['Store URL', storeSlug ? `https://cardpop.com.au/dealer/${esc(storeSlug)}` : '—'],
])}
<p>Open the member's admin page to review or verify the business.</p>`;

  return cpEmail(
    `Sole trader mode ${enabled ? 'enabled' : 'disabled'}: ${esc(userName) || 'A member'}`,
    'Sole Trader Change',
    `Sole trader mode ${enabled ? 'enabled' : 'disabled'}`,
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
  const body = `${heroBadge('↩', TILE.charcoal)}
${heroHeading('Refund issued on your sale', `Hi ${esc(sellerName)} — a refund was issued to the buyer on one of your orders.`)}
${statRow([
  { glyph: '$', colour: TILE.red, value: money(refundAmount), caption: 'Refunded to buyer' },
  { glyph: '%', colour: TILE.charcoal, value: money(retainedFee), caption: 'Platform fee retained' },
])}
${centred('If you have any questions about this refund, reply to this email or contact our support team.')}`;

  return cpEmail(
    'A refund was issued on one of your CardPop sales.',
    '',
    '',
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
<p>Head to your offers page to accept, decline or counter. The buyer is bound by this offer until they withdraw it — if you accept, they have agreed to buy at this price. It expires automatically 48 hours after it was made if you don't respond.</p>`;

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

// ─── Offer placed (buyer confirmation) ───────────────────────────────────────

/**
 * Sent to the buyer the moment their offer lands. The point is the binding
 * terms, in writing: if the seller accepts inside the 48-hour window the buyer
 * has committed to buy at that price, and the only way out before then is to
 * withdraw it from My Offers.
 */
export function offerPlacedEmail({ buyerName, cardName, amountAud, askingPriceAud, expiresAt, listingUrl }) {
  const rows = [
    ['Card', esc(cardName || 'A CardPop listing')],
    ['Your offer', `${money(amountAud)} AUD`, true],
  ];
  if (Number(askingPriceAud) > 0) rows.push(['Asking price', `${money(askingPriceAud)} AUD`]);
  if (expiresAt) rows.push(['Binding until', esc(expiresAt)]);

  const body = `<p>Your offer has been sent to the seller.</p>
${summaryTable(rows)}
<p><strong>This offer is binding.</strong> If the seller accepts it within 48 hours, you have agreed to buy the card at this price and will be asked to complete payment. You can withdraw it any time <em>before</em> the seller accepts from My Offers. If the seller doesn't respond, it expires automatically after 48 hours and you are no longer bound by it.</p>
${listingUrl ? `<p style="font-size:13px;color:#6B7280;">Listing: <a href="${esc(listingUrl)}" style="color:#E63946;">${esc(listingUrl)}</a></p>` : ''}`;

  return cpEmail(
    `Your ${money(amountAud)} offer on ${esc(cardName || 'a listing')} is binding for 48 hours unless you withdraw it.`,
    'Offer Sent',
    `Hi ${esc(buyerName || 'there')},`,
    body,
    'https://cardpop.com.au/account/offers',
    'View or Withdraw Offer',
    'You are receiving this because you made an offer on CardPop.',
  );
}

// ─── Offer responses (accept / decline / counter / withdraw) ─────────────────

/**
 * Every response to an offer, emailed to the party who didn't act. `kind`:
 *   accepted          → buyer: the seller accepted, pay by the deadline
 *   counter_accepted  → buyer (their own accept of the counter): pay by the
 *                       deadline; and seller: the buyer accepted, awaiting payment
 *   countered         → buyer: the seller countered, respond by the deadline
 *   declined          → buyer: the seller declined
 *   counter_declined  → seller: the buyer declined the counter
 *   withdrawn         → seller: the buyer withdrew
 * `audience` is 'buyer' or 'seller' (only counter_accepted goes to both).
 */
export function offerUpdateEmail({ kind, audience, recipientName, cardName, amountAud, counterAmountAud, counterMessage, deadline, listingUrl }) {
  const card = esc(cardName || 'the card');
  const agreed = counterAmountAud != null ? counterAmountAud : amountAud;
  const rows = [['Card', card]];
  let preheader;
  let title;
  let body;
  let cta = ['https://cardpop.com.au/account/offers', 'View Offer'];

  if ((kind === 'accepted' || kind === 'counter_accepted') && audience === 'buyer') {
    rows.push(['Agreed price', `${money(agreed)} AUD`, true]);
    if (deadline) rows.push(['Pay by', esc(deadline)]);
    title = 'Offer Accepted — Time to Pay';
    preheader = `Your ${money(agreed)} deal on ${card} is agreed. Pay by ${esc(deadline || 'the deadline')}.`;
    body = `<p>${kind === 'accepted'
      ? 'Good news — the seller accepted your offer.'
      : 'You accepted the seller\'s counter offer.'}</p>
${summaryTable(rows)}
<p><strong>You're committed to buy at this price.</strong> Please complete payment within 48 hours${deadline ? ` (by ${esc(deadline)})` : ''}. If you don't pay in time the deal lapses, the seller is free to sell to someone else, and it's recorded against your account.</p>`;
    cta = ['https://cardpop.com.au/account/offers', 'Pay Now'];
  } else if (kind === 'counter_accepted') {
    rows.push(['Agreed price', `${money(agreed)} AUD`, true]);
    if (deadline) rows.push(['Buyer must pay by', esc(deadline)]);
    title = 'Counter Offer Accepted';
    preheader = `The buyer accepted your ${money(agreed)} counter on ${card}.`;
    body = `<p>The buyer accepted your counter offer. You've agreed to sell at this price.</p>
${summaryTable(rows)}
<p>They have 48 hours to pay. We'll email you when it sells so you can ship it. If they don't pay in time, the deal lapses and your listing is free to sell again.</p>`;
  } else if (kind === 'countered') {
    rows.push(['Your offer', `${money(amountAud)} AUD`]);
    rows.push(['Seller\'s counter', `${money(counterAmountAud)} AUD`, true]);
    if (deadline) rows.push(['Respond by', esc(deadline)]);
    title = 'Counter Offer Received';
    preheader = `The seller countered with ${money(counterAmountAud)} on ${card}.`;
    const quoted = counterMessage
      ? `<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">Their message</p>
<div style="background:#F9FAFB;border-left:3px solid #E63946;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${esc(counterMessage)}</div>`
      : '';
    body = `<p>The seller has made you a counter offer.</p>
${summaryTable(rows)}
${quoted}
<p>You have 48 hours to accept or decline it. If you accept, you're committed to buy at the counter price and will have 48 hours to pay. If you don't respond, it expires.</p>`;
    cta = ['https://cardpop.com.au/account/offers', 'Respond to Counter'];
  } else if (kind === 'declined') {
    rows.push(['Your offer', `${money(amountAud)} AUD`]);
    title = 'Offer Declined';
    preheader = `Your offer on ${card} wasn't accepted.`;
    body = `<p>The seller declined your offer, so you're no longer bound by it.</p>
${summaryTable(rows)}
<p>You're welcome to make a new offer or buy it now if it's still listed.</p>`;
    if (listingUrl) cta = [esc(listingUrl), 'View Listing'];
  } else if (kind === 'counter_declined') {
    rows.push(['Your counter', `${money(counterAmountAud)} AUD`]);
    title = 'Counter Offer Declined';
    preheader = `The buyer declined your counter on ${card}.`;
    body = `<p>The buyer declined your counter offer. Your listing is still live for other buyers.</p>
${summaryTable(rows)}`;
  } else if (kind === 'withdrawn') {
    rows.push(['Their offer', `${money(amountAud)} AUD`]);
    title = 'Offer Withdrawn';
    preheader = `The buyer withdrew their offer on ${card}.`;
    body = `<p>The buyer withdrew their offer before you responded. No action is needed.</p>
${summaryTable(rows)}`;
  } else {
    throw new Error(`Unknown offer email kind: ${kind}`);
  }

  return cpEmail(
    preheader,
    title,
    `Hi ${esc(recipientName || 'there')},`,
    body,
    cta[0],
    cta[1],
    'You are receiving this because of an offer on CardPop.',
  );
}

// ─── Offer made (admin alert) ────────────────────────────────────────────────

/** Admin heads-up for every offer made on the marketplace. */
export function offerAdminNoticeEmail({ offerId, cardName, amountAud, askingPriceAud, buyerName, buyerEmail, sellerName, sellerEmail, message, expiresAt, listingUrl }) {
  const rows = [
    ['Offer', `#${esc(String(offerId || '').slice(0, 8).toUpperCase() || '—')}`],
    ['Card', esc(cardName || '—')],
    ['Amount', `${money(amountAud)} AUD`, true],
  ];
  if (Number(askingPriceAud) > 0) rows.push(['Asking price', `${money(askingPriceAud)} AUD`]);
  rows.push(['Buyer', [buyerName, buyerEmail].filter(Boolean).map(esc).join(' · ') || '—']);
  rows.push(['Seller', [sellerName, sellerEmail].filter(Boolean).map(esc).join(' · ') || '—']);
  if (expiresAt) rows.push(['Expires', esc(expiresAt)]);

  const quoted = message
    ? `<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">Buyer's message</p>
<div style="background:#F9FAFB;border-left:3px solid #E63946;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${esc(message)}</div>`
    : '';

  return cpEmail(
    `Offer of ${money(amountAud)} on ${esc(cardName || 'a listing')}`,
    'New Marketplace Offer',
    'An offer was just made on CardPop',
    `${summaryTable(rows)}\n${quoted}<p>The seller has 48 hours to accept, decline or counter. The buyer is bound by the offer until they withdraw it or it expires.</p>`,
    listingUrl || 'https://cardpop.com.au/admin/all-listings',
    'View Listing',
    'You received this because you are a CardPop admin.',
  );
}

// ─── Order shipped (buyer) ────────────────────────────────────────────────────

/**
 * Sent to the buyer when an admin marks their order shipped with a tracking
 * reference. The button goes straight to the carrier's tracking page (guest
 * buyers have no account to log into); with no carrier link it falls back to
 * the order list. Item titles are seller-supplied, so they go through `esc`.
 */
export function orderShippedEmail({ buyerName, orderRef, items = [], carrier, trackingNumber, invitesReview = false }) {
  const url = trackingUrl(carrier, trackingNumber);
  const number = normalizeTrackingNumber(trackingNumber);
  const trackingCell = url
    ? `<a href="${esc(url)}" style="color:#E63946;text-decoration:none;font-family:monospace;">${esc(number)}</a>`
    : `<span style="font-family:monospace;">${esc(number)}</span>`;

  const body = `${heroBadge('→')}
${heroHeading('Your order has shipped', `Hi ${esc(buyerName || 'there')} — order <strong>${esc(orderRef)}</strong> is on its way.`)}
${statRow([
  { glyph: '→', colour: TILE.red, value: esc(carrierLabel(carrier)), caption: 'Carrier', small: true },
  { glyph: '#', colour: TILE.charcoal, value: trackingCell, caption: 'Tracking number', small: true },
])}
${items.length ? itemCard(items.map((i) => [esc(i), ''])) : ''}
${centred(url
    ? `Tracking can take up to 24 hours to show the first scan. Follow your parcel any time with the button below${carrier === 'auspost' ? ' or in the Australia Post app' : ''}.`
    : `Use the tracking number above on ${esc(carrierLabel(carrier))}'s website to follow your parcel.`)}${invitesReview
    ? `
<p style="text-align:center;">Once it arrives, we'd love to hear what you think. You can review the products from your order in <a href="https://cardpop.com.au/account/orders" style="color:#E63946;text-decoration:none;">Account → Orders</a> — it helps other collectors choose.</p>`
    : ''}`;

  return cpEmail(
    `Your CardPop order has shipped — tracking ${esc(number)}.`,
    '',
    '',
    body,
    url ? esc(url) : 'https://cardpop.com.au/account/orders',
    url ? 'Track Your Parcel' : 'View Your Orders',
    'You are receiving this because you placed an order on CardPop.',
  );
}

// ─── Order delivered (buyer) ──────────────────────────────────────────────────

/**
 * The parcel arrived (a carrier scan, the buyer's own confirmation, or the
 * 10-day auto rule). Starts the Buyer Protection clock in writing and asks
 * for the review that sellers earn.
 */
export function orderDeliveredEmail({ buyerName, orderRef, items = [], source = 'carrier', sellerName = null, marketplace = true, claimDays = 7 }) {
  const how = source === 'carrier'
    ? 'The carrier has recorded your parcel as delivered.'
    : source === 'buyer'
      ? 'Thanks for confirming your parcel arrived.'
      : 'Your parcel was posted over a week ago, so we’ve recorded it as delivered.';
  const tiles = marketplace
    ? [
      { glyph: '⏱', colour: TILE.red, value: String(Number(claimDays)), caption: 'Days to report a problem' },
      { glyph: '✓', colour: TILE.green, value: 'Full', caption: 'Refund if it’s not as described' },
      { glyph: '★', colour: TILE.charcoal, value: 'Rate', caption: sellerName ? esc(sellerName) : 'Your seller' },
    ]
    : [
      { glyph: '⏱', colour: TILE.red, value: '14', caption: 'Days to return, any reason' },
      { glyph: '★', colour: TILE.charcoal, value: 'Review', caption: 'Help other collectors choose' },
    ];
  const body = `${heroBadge('✓', TILE.green)}
${heroHeading('Your order was delivered', `Hi ${esc(buyerName || 'there')} — ${how} Order <strong>${esc(orderRef)}</strong>${sellerName ? ` from ${esc(sellerName)}` : ''}.`)}
${statRow(tiles)}
${items.length ? itemCard(items.map((i) => [esc(i), ''])) : ''}
${marketplace
    ? `<p><strong>Check the card today.</strong> If it isn’t as described, arrived damaged or hasn’t actually turned up, report it from <a href="https://cardpop.com.au/account/orders" style="color:#E63946;text-decoration:none;">Account → Orders</a> within <strong>${Number(claimDays)} days</strong> — CardPop Buyer Protection refunds you in full, fees included.</p>
${centred(`All good? A quick rating helps ${sellerName ? esc(sellerName) : 'your seller'} and tells other collectors who to trust.`)}`
    : centred('We hope you love it. If anything isn’t right you have 14 days from delivery to return it for any reason, and a product review from your order page helps other collectors choose.')}`;

  return cpEmail(
    marketplace ? `Your CardPop order ${esc(orderRef)} was delivered — check it within ${Number(claimDays)} days.` : `Your CardPop order ${esc(orderRef)} was delivered.`,
    '',
    '',
    body,
    'https://cardpop.com.au/account/orders',
    marketplace ? 'Rate Your Seller' : 'Review Your Order',
    'You are receiving this because you placed an order on CardPop.',
  );
}

// ─── Retention emails (src/services/retentionSweepService.js) ─────────────────

/** The one reminder after an unfinished checkout, with a cart-restore link. */
export function abandonedCheckoutEmail({ name, items = [], restoreUrl }) {
  const count = items.reduce((n, i) => n + (Number(i.quantity) || 1), 0);
  const total = items.reduce((n, i) => n + Number(i.price || 0) * (Number(i.quantity) || 1), 0);
  const rows = items.slice(0, 6).map((i) => [
    `<a href="${esc(i.url)}" style="${linkStyle}">${esc(i.title)}</a>${i.quantity > 1 ? ` × ${Number(i.quantity)}` : ''}`,
    money(i.price * (i.quantity || 1)),
  ]);
  const body = `${heroBadge('🛒')}
${heroHeading('Your cart is waiting', `Hi ${esc(name || 'there')} — you left ${plural(count, 'something', 'a few things')} behind.`)}
${statRow([
  { glyph: '#', colour: TILE.red, value: String(count), caption: plural(count, 'Item saved', 'Items saved') },
  { glyph: '$', colour: TILE.charcoal, value: money(total), caption: 'Cart total' },
  { glyph: '✓', colour: TILE.green, value: 'Full', caption: 'Buyer Protection' },
])}
${itemCard(rows)}
${centred('Cards on CardPop are one of a kind — once another collector buys one it’s gone. Every fee is shown before you pay.')}`;
  return cpEmail(
    'Your CardPop cart is waiting.',
    '',
    '',
    body,
    esc(restoreUrl),
    'Return to Checkout',
    'You’re receiving this because you started a checkout on CardPop and agreed to hear from us. One reminder only.',
  );
}

export function watchlistPriceDropEmail({ name, cardName, setName, from, to, pct, url }) {
  const body = `${heroBadge('↓', TILE.green)}
${heroHeading('Price drop on your watchlist', `<a href="${esc(url)}" style="${linkStyle}font-weight:700;">${esc(cardName)}</a>${setName ? ` · ${esc(setName)}` : ''}`)}
${statRow([
  { glyph: '↓', colour: TILE.green, value: `${Number(pct)}%`, caption: 'Price drop' },
  { glyph: '$', colour: TILE.red, value: money(to), caption: 'Now' },
  { glyph: '$', colour: TILE.grey, value: `<s style="color:#9CA3AF;">${money(from)}</s>`, caption: 'When you saved it' },
])}
${centred(`Hi ${esc(name || 'there')} — marketplace cards are one of a kind. If you want it at this price, now’s the moment.`)}`;
  return cpEmail(
    `${esc(cardName)} is now ${money(to)} — ${Number(pct)}% below when you saved it.`,
    '',
    '',
    body,
    esc(url),
    'View the Card',
    'Watchlist alerts can be switched off in Account → Notification settings.',
  );
}

export function watchlistSoldEmail({ name, cardName, setName, searchUrl }) {
  const body = `${heroBadge('✕', TILE.charcoal)}
${heroHeading('One got away', `<strong>${esc(cardName)}</strong>${setName ? ` · ${esc(setName)}` : ''} has sold to another collector.`)}
${centred(`Hi ${esc(name || 'there')} — similar cards are listed every day. Here’s a live search for it, and you can save the search to be emailed the moment a new one appears.`)}`;
  return cpEmail(
    `${esc(cardName)} on your watchlist has sold.`,
    '',
    '',
    body,
    esc(searchUrl),
    'Find Another',
    'Watchlist alerts can be switched off in Account → Notification settings.',
  );
}

export function savedSearchMatchesEmail({ name, searchName, searchUrl, matches = [] }) {
  const n = matches.length;
  const prices = matches.map((m) => Number(m.price) || 0).filter((p) => p > 0);
  const low = prices.length ? Math.min(...prices) : 0;
  const rows = matches.slice(0, 5).map((m) => [
    `<a href="${esc(m.url)}" style="${linkStyle}">${esc(m.title)}</a>${m.set ? ` <span style="color:#6b7280;">· ${esc(m.set)}</span>` : ''}`,
    money(m.price),
  ]);
  const body = `${heroBadge('★')}
${heroHeading(`${n} new ${plural(n, 'card matches', 'cards match')} your search`, `“${esc(searchName)}”`)}
${statRow([
  { glyph: '+', colour: TILE.red, value: String(n), caption: plural(n, 'New listing', 'New listings') },
  { glyph: '$', colour: TILE.green, value: money(low), caption: 'From' },
])}
${itemCard(rows)}
${centred(`Hi ${esc(name || 'there')} — saved-search alerts go out once a day with whatever’s new since the last one.`)}`;
  return cpEmail(
    `New on CardPop for “${esc(searchName)}”.`,
    '',
    '',
    body,
    esc(searchUrl),
    'See All Matches',
    'Manage saved searches in Account → Watchlist.',
  );
}

export function backInStockEmail({ productTitle, priceAud, url }) {
  const body = `${heroBadge('✓', TILE.green)}
${heroHeading('It’s back in stock', `<a href="${esc(url)}" style="${linkStyle}font-weight:700;">${esc(productTitle)}</a>`)}
${statRow([
  { glyph: '$', colour: TILE.red, value: money(priceAud), caption: 'Price' },
  { glyph: '✓', colour: TILE.green, value: '14 days', caption: 'Returns' },
  { glyph: '→', colour: TILE.charcoal, value: 'Tracked', caption: 'Shipping' },
])}
${centred('You asked us to let you know — stock on popular lines doesn’t last, so grab it while it’s here.')}`;
  return cpEmail(
    `${esc(productTitle)} is back in stock.`,
    '',
    'Hi there,',
    body,
    esc(url),
    'Buy It Now',
    'You asked us to email you when this product came back. This is that one email.',
  );
}

export function welcomeOfferReminderEmail({ name, code, discountPct, expiresAt }) {
  const expiry = new Date(expiresAt);
  const expiryStr = expiry.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
  const daysLeft = Math.max(1, Math.ceil((expiry.getTime() - Date.now()) / 86400000));
  const body = `${heroBadge('%')}
${heroHeading('Your welcome code expires soon', `Hi ${esc(name || 'there')} — it’s still unused.`)}
${statRow([
  { glyph: '%', colour: TILE.red, value: `${Number(discountPct)}%`, caption: 'Off the cards in your first order' },
  { glyph: '⏱', colour: TILE.charcoal, value: String(daysLeft), caption: `${plural(daysLeft, 'Day', 'Days')} left · ${esc(expiryStr)}` },
])}
<div style="background:#F9FAFB;border:2px dashed #E63946;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
<p style="margin:0 0 6px;font-size:11px;color:#9CA3AF;letter-spacing:2.5px;text-transform:uppercase;">Your welcome code</p>
<p style="margin:0;font-size:26px;font-weight:900;letter-spacing:3px;color:#111827;">${esc(code)}</p>
</div>
${centred('It’s applied automatically at checkout when you’re signed in.')}`;
  return cpEmail(
    `Your ${Number(discountPct)}% welcome code expires ${esc(expiryStr)}.`,
    '',
    '',
    body,
    'https://cardpop.com.au/marketplace',
    'Find Your First Card',
    'This one-time offer was generated for your CardPop account and can’t be transferred.',
  );
}

// Sent on Stripe's `customer.subscription.trial_will_end` (3 days before the
// first charge) so a member who forgot about the trial can cancel before it
// bills — and knows exactly where to do it.
export function membershipTrialEndingEmail({ name, planName, amountAud, chargeDate }) {
  const when = new Date(chargeDate);
  const whenStr = when.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
  const daysLeft = Math.max(1, Math.ceil((when.getTime() - Date.now()) / 86400000));
  const price = amountAud != null ? `${money(amountAud)}/month` : 'the monthly price';
  const body = `${heroBadge('⏱', TILE.charcoal)}
${heroHeading('Your free trial ends soon', `Hi ${esc(name || 'there')} — here’s what happens next.`)}
${statRow([
  { glyph: '★', colour: TILE.red, value: esc(planName), caption: 'Your trial plan', small: true },
  { glyph: '⏱', colour: TILE.charcoal, value: String(daysLeft), caption: `${plural(daysLeft, 'Day', 'Days')} left · ${esc(whenStr)}` },
])}
${centred(`On ${esc(whenStr)} your card will be charged ${esc(price)} to keep CardPop ${esc(planName)}.`)}
${centred('Don’t want it? Cancel any time before then from Account → Membership and you won’t be charged. Your account stays on the free Hobby plan — buying and selling still work.')}`;
  return cpEmail(
    `Your CardPop ${esc(planName)} trial ends ${esc(whenStr)}.`,
    '',
    '',
    body,
    'https://cardpop.com.au/account/membership',
    'Manage Membership',
    'You’re receiving this because you started a free trial of a CardPop membership.',
  );
}
