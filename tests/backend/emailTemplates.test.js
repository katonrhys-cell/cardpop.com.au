import { describe, it, expect } from 'vitest';
import {
  esc,
  orderConfirmedEmail,
  itemSoldEmail,
  eventSubmittedEmail,
  orderAdminNoticeEmail,
  offerReceivedEmail,
  supplierOrderEmail,
} from '../../src/emails/templates.js';

// Regression guard: transactional emails are sent from noreply@cardpop.com.au
// and include user/seller-controlled strings (listing titles, event fields,
// names). Those must be HTML-escaped so a value like an anchor/script tag can't
// render as live markup in a recipient's inbox.
const XSS = '<a href="https://evil.example">click</a>';

describe('email template escaping', () => {
  it('esc() neutralises HTML metacharacters', () => {
    expect(esc(XSS)).toBe('&lt;a href=&quot;https://evil.example&quot;&gt;click&lt;/a&gt;');
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('escapes the seller-controlled item name in an order confirmation', () => {
    const html = orderConfirmedEmail({
      buyerName: XSS,
      invoice: { items: [{ name: XSS, total: 10, quantity: 1 }], subtotal: 10, total: 10 },
      orderId: 'abc12345',
    });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
    expect(html).toContain('&lt;a href=');
  });

  it('escapes the card name and seller name in an item-sold email', () => {
    const html = itemSoldEmail({ sellerName: XSS, cardName: XSS, itemPrice: 5, commissionAud: 1, gstAud: 0, sellerProceeds: 4, orderId: 'x' });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
  });

  it('escapes user-submitted event fields in the admin notice', () => {
    const html = eventSubmittedEmail({ event: { title: XSS, organizer_name: XSS, suburb: XSS, state: 'VIC' } });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
  });

  it('escapes buyer/seller/items in the order admin notice', () => {
    const html = orderAdminNoticeEmail({ orderId: 'o', buyerName: XSS, buyerEmail: 'a@b.co', total: 9, itemsSummary: XSS, sellerName: XSS });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
  });

  // The offer note is free text typed by a stranger — the most directly
  // attacker-controlled string in any of these emails.
  it('escapes the buyer name, card name and offer message in an offer email', () => {
    const html = offerReceivedEmail({ sellerName: XSS, buyerName: XSS, cardName: XSS, amountAud: 600, message: XSS });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
    expect(html).toContain('&lt;a href=');
  });
});

describe('offerReceivedEmail', () => {
  it('carries the amount, card, buyer and message, and links to the offers page', () => {
    const html = offerReceivedEmail({
      sellerName: 'Kat', buyerName: 'Ash', cardName: 'Nikola Jokic',
      amountAud: 600, message: 'Would you take $600?', expiresAt: '8 Sep 2026',
    });
    expect(html).toContain('$600.00');
    expect(html).toContain('Nikola Jokic');
    expect(html).toContain('Ash');
    expect(html).toContain('Would you take $600?');
    expect(html).toContain('8 Sep 2026');
    expect(html).toContain('https://cardpop.com.au/account/offers');
  });

  it('omits the message block when the buyer left no note', () => {
    const html = offerReceivedEmail({ sellerName: 'Kat', cardName: 'A card', amountAud: 10 });
    expect(html).not.toContain('Their message');
  });
});

describe('supplierOrderEmail', () => {
  const base = {
    supplierName: 'Palms Off Gaming',
    orderRef: 'A1B2C3D4',
    orderId: 'a1b2c3d4-0000-0000-0000-000000000000',
    lines: [{ sku: 'BODS-JPN-BLK', title: 'Japanese Binder', quantity: 2 }],
    shipTo: { name: 'Jo Smith', address: '12 Example St', suburb: 'Bondi', state: 'nsw', postcode: '2026' },
    blindShipping: true,
    blindShippingNote: 'BLIND SHIP: CardPop as sender, no inserts.',
  };

  it('carries the SKU, quantity and order reference a picker needs', () => {
    const html = supplierOrderEmail(base);
    expect(html).toContain('BODS-JPN-BLK');
    expect(html).toContain('×2');
    expect(html).toContain('A1B2C3D4');
    expect(html).toContain('Japanese Binder');
  });

  it('formats the address to Australian postal convention', () => {
    const html = supplierOrderEmail(base);
    expect(html).toContain('Jo Smith');
    expect(html).toContain('12 Example St');
    expect(html).toContain('BONDI NSW 2026');
    expect(html).toContain('AUSTRALIA');
  });

  it('reproduces the blind-shipping instruction verbatim', () => {
    const html = supplierOrderEmail(base);
    expect(html).toContain('Blind shipping required');
    expect(html).toContain('BLIND SHIP: CardPop as sender, no inserts.');
  });

  it('falls back to a default instruction when blind shipping has no note', () => {
    const html = supplierOrderEmail({ ...base, blindShippingNote: null });
    expect(html).toContain('Blind shipping required');
    expect(html).toContain('Do not include your own branding');
  });

  it('omits the blind-shipping callout when the supplier ships under its own name', () => {
    const html = supplierOrderEmail({ ...base, blindShipping: false });
    expect(html).not.toContain('Blind shipping required');
  });

  // The supplier invoices CardPop at wholesale; the retail figure the customer
  // paid is irrelevant to picking, and leaking it is commercially awkward.
  it('never shows what the customer paid', () => {
    const html = supplierOrderEmail({
      ...base,
      lines: [{ sku: 'X', title: 'Thing', quantity: 1, line_total_aud: 149.95, unit_price_aud: 149.95 }],
    });
    expect(html).not.toContain('149.95');
    expect(html).not.toContain('$');
  });

  it('flags a line with no SKU instead of rendering an empty cell', () => {
    const html = supplierOrderEmail({ ...base, lines: [{ sku: null, title: 'Mystery', quantity: 1 }] });
    expect(html).toContain('NO SKU');
  });

  it('escapes admin- and buyer-controlled values', () => {
    const html = supplierOrderEmail({
      ...base,
      lines: [{ sku: XSS, title: XSS, quantity: 1 }],
      shipTo: { name: XSS, address: XSS, suburb: 'Bondi', state: 'NSW', postcode: '2026' },
      blindShippingNote: XSS,
    });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('counts total units across lines in the subject preheader', () => {
    const html = supplierOrderEmail({
      ...base,
      lines: [{ sku: 'A', title: 'A', quantity: 2 }, { sku: 'B', title: 'B', quantity: 3 }],
    });
    expect(html).toContain('5 units');
  });
});
