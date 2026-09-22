import { describe, it, expect } from 'vitest';
import {
  esc,
  orderConfirmedEmail,
  itemSoldEmail,
  eventSubmittedEmail,
  orderAdminNoticeEmail,
  offerReceivedEmail,
  shopEnquiryEmail,
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

describe('shopEnquiryEmail', () => {
  it('escapes shopper-controlled name, email and message', () => {
    const html = shopEnquiryEmail({
      productTitle: XSS,
      productId: '11111111-2222-4333-8444-555555555555',
      productUrl: 'https://cardpop.com.au/product/shop/1',
      name: XSS,
      email: 'a@b.co',
      message: XSS,
    });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;click&lt;/a&gt;');
    expect(html).toContain('Sold-Out Product Enquiry');
    expect(html).toContain('View Product');
  });

  it('switches copy for a coming-soon enquiry', () => {
    const html = shopEnquiryEmail({ productTitle: 'Binder', productId: 'x', reason: 'coming_soon', name: 'Ash', email: 'a@b.co', message: '' });
    expect(html).toContain('Coming-Soon Product Enquiry');
    expect(html).toContain('coming-soon');
    expect(html).not.toContain('sold-out');
  });

  it('notes when no message was included', () => {
    const html = shopEnquiryEmail({ productTitle: 'Binder', productId: 'x', name: 'Ash', email: 'a@b.co', message: '' });
    expect(html).toContain('No message was included');
  });
});
