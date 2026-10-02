import { describe, it, expect } from 'vitest';
import {
  esc,
  orderConfirmedEmail,
  itemSoldEmail,
  eventSubmittedEmail,
  orderAdminNoticeEmail,
  offerReceivedEmail,
  offerPlacedEmail,
  offerAdminNoticeEmail,
  offerUpdateEmail,
  shopEnquiryEmail,
  orderShippedEmail,
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

describe('orderShippedEmail', () => {
  it('links the Australia Post tracking page and escapes item titles', () => {
    const html = orderShippedEmail({
      buyerName: 'Sam', orderRef: 'ABCD1234', items: [XSS], carrier: 'auspost', trackingNumber: '33ab 1234',
    });
    expect(html).toContain('https://auspost.com.au/mypost/track/details/33AB1234');
    expect(html).toContain('Track Your Parcel');
    expect(html).not.toContain(XSS);
  });

  it('falls back to the order list for a carrier with no tracking page', () => {
    const html = orderShippedEmail({ buyerName: 'Sam', orderRef: 'ABCD1234', carrier: 'other', trackingNumber: 'ZZ99' });
    expect(html).toContain('https://cardpop.com.au/account/orders');
    expect(html).toContain('ZZ99');
  });
});

describe('offerReceivedEmail — binding terms', () => {
  it('tells the seller the buyer is bound and the offer lapses after 48 hours', () => {
    const html = offerReceivedEmail({ sellerName: 'Kat', cardName: 'A card', amountAud: 10 });
    expect(html).toMatch(/buyer is bound/);
    expect(html).toContain('48 hours');
  });

  it('uses the expression-of-interest wording for the raw enum the route passes', () => {
    const html = offerReceivedEmail({ cardName: 'A card', amountAud: 10, listingType: 'expression_of_interest' });
    expect(html).toContain('expressed interest');
    const fixed = offerReceivedEmail({ cardName: 'A card', amountAud: 10, listingType: 'fixed' });
    expect(fixed).toContain('You have a new offer');
  });
});

describe('offerPlacedEmail (buyer)', () => {
  const base = {
    buyerName: 'Ash', cardName: 'Kevin Durant RC', amountAud: 4500, askingPriceAud: 4999.99,
    expiresAt: '30 Sep 2026, 5:12 pm', listingUrl: 'https://cardpop.com.au/product/marketplace/abc',
  };

  it('spells out that the offer is binding, for 48 hours, and how to withdraw', () => {
    const html = offerPlacedEmail(base);
    expect(html).toContain('This offer is binding');
    expect(html).toContain('48 hours');
    expect(html).toMatch(/withdraw it any time <em>before<\/em> the seller accepts/);
    expect(html).toContain('Binding until');
    expect(html).toContain('30 Sep 2026, 5:12 pm');
    expect(html).toContain('$4500.00');
    expect(html).toContain('$4999.99');
    expect(html).toContain('https://cardpop.com.au/account/offers');
    expect(html).toContain(base.listingUrl);
  });

  it('escapes seller-controlled card names', () => {
    const html = offerPlacedEmail({ ...base, cardName: XSS, buyerName: XSS });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
  });
});

describe('offerAdminNoticeEmail (admin)', () => {
  const base = {
    offerId: '44444444-4444-4444-8444-444444444444', cardName: 'Kevin Durant RC', amountAud: 4500,
    askingPriceAud: 4999.99, buyerName: 'Ash', buyerEmail: 'buyer@example.com', sellerName: 'Kat',
    sellerEmail: 'seller@example.com', message: 'Quick sale?', expiresAt: '30 Sep 2026, 5:12 pm',
    listingUrl: 'https://cardpop.com.au/product/marketplace/abc',
  };

  it('gives the admin everything needed to follow the offer', () => {
    const html = offerAdminNoticeEmail(base);
    for (const bit of ['#44444444', 'Kevin Durant RC', '$4500.00', '$4999.99', 'buyer@example.com', 'seller@example.com', 'Quick sale?', '30 Sep 2026, 5:12 pm', base.listingUrl]) {
      expect(html).toContain(bit);
    }
    expect(html).toMatch(/bound by the offer/);
  });

  it('escapes buyer/seller-controlled strings', () => {
    const html = offerAdminNoticeEmail({ ...base, cardName: XSS, buyerName: XSS, sellerName: XSS, message: XSS });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
  });
});

describe('pre-order emails', () => {
  const invoice = (items) => ({ items, subtotal: 100, total: 100, gst: 0, gstIncluded: 9.09, shipping: 0, discount: 0 });

  it('marks pre-order lines on the receipt and explains dispatch', () => {
    const html = orderConfirmedEmail({
      buyerName: 'Ash', cardName: '2 items', itemPrice: 100, total: 100, orderId: 'abc12345',
      invoice: invoice([{ name: 'Sleeves', quantity: 1, total: 10 }, { name: 'Booster Box', quantity: 1, total: 90, preorderEta: 'Ships in 4–6 weeks' }]),
    });
    expect(html).toContain('Pre-order &middot; Ships in 4–6 weeks');
    expect(html).toContain('Your order includes pre-order items.');
  });

  it('escapes the estimate', () => {
    const html = orderConfirmedEmail({
      buyerName: 'Ash', cardName: 'x', itemPrice: 1, total: 1, orderId: 'o',
      invoice: invoice([{ name: 'Box', quantity: 1, total: 1, preorderEta: XSS }]),
    });
    expect(html).not.toContain(XSS);
  });

  it('leaves a normal receipt alone', () => {
    const html = orderConfirmedEmail({
      buyerName: 'Ash', cardName: 'x', itemPrice: 1, total: 1, orderId: 'o',
      invoice: invoice([{ name: 'Box', quantity: 1, total: 1 }]),
    });
    expect(html).not.toContain('pre-order');
    expect(html).not.toContain('Pre-order');
  });

  it('flags a pre-order to the admin so it is not packed early', () => {
    const html = orderAdminNoticeEmail({ orderId: 'o1', buyerName: 'Ash', buyerEmail: 'a@b.co', total: 90, itemsSummary: '1 item — Box', preorderSummary: 'Box (Ships in 4–6 weeks)' });
    expect(html).toContain('New Pre-order');
    expect(html).toContain('Box (Ships in 4–6 weeks)');
    expect(orderAdminNoticeEmail({ orderId: 'o1', total: 1, itemsSummary: 'x' })).not.toContain('Pre-order');
  });
});

describe('offerUpdateEmail (responses)', () => {
  const base = { recipientName: 'Ash', cardName: 'Kevin Durant RC', amountAud: 4000, deadline: '1 Oct 2026, 9:00 am', listingUrl: 'https://cardpop.com.au/product/marketplace/abc' };

  it('accepted → tells the buyer they are committed and must pay by the deadline', () => {
    const html = offerUpdateEmail({ ...base, kind: 'accepted', audience: 'buyer' });
    expect(html).toContain('the seller accepted your offer');
    expect(html).toContain('$4000.00');
    expect(html).toContain('Pay by');
    expect(html).toContain('1 Oct 2026, 9:00 am');
    expect(html).toMatch(/committed to buy/);
    expect(html).toMatch(/deal lapses/);
    expect(html).toContain('Pay Now');
  });

  it('counter_accepted → buyer pays the counter price; seller is told the buyer has 48 hours', () => {
    const buyer = offerUpdateEmail({ ...base, kind: 'counter_accepted', audience: 'buyer', counterAmountAud: 4500 });
    expect(buyer).toContain('$4500.00');
    expect(buyer).toContain('You accepted the seller');
    expect(buyer).toContain('Pay Now');
    const seller = offerUpdateEmail({ ...base, kind: 'counter_accepted', audience: 'seller', recipientName: 'Kat', counterAmountAud: 4500 });
    expect(seller).toContain('Buyer must pay by');
    expect(seller).toContain('$4500.00');
    expect(seller).not.toContain('Pay Now');
  });

  it('countered → shows both amounts, the message and the respond-by time', () => {
    const html = offerUpdateEmail({ ...base, kind: 'countered', audience: 'buyer', counterAmountAud: 4500, counterMessage: 'Meet me at 45' });
    expect(html).toContain('$4000.00');
    expect(html).toContain('$4500.00');
    expect(html).toContain('Meet me at 45');
    expect(html).toContain('Respond by');
  });

  it.each([
    ['declined', 'buyer', /no longer bound/],
    ['counter_declined', 'seller', /declined your counter/],
    ['withdrawn', 'seller', /withdrew their offer/],
  ])('%s → %s copy', (kind, audience, text) => {
    expect(offerUpdateEmail({ ...base, kind, audience, counterAmountAud: 4500 })).toMatch(text);
  });

  it('escapes user-controlled strings', () => {
    const html = offerUpdateEmail({ ...base, kind: 'countered', audience: 'buyer', counterAmountAud: 1, cardName: XSS, recipientName: XSS, counterMessage: XSS });
    expect(html).not.toContain('<a href="https://evil.example">click</a>');
  });

  it('throws on an unknown kind rather than sending a blank email', () => {
    expect(() => offerUpdateEmail({ ...base, kind: 'nope', audience: 'buyer' })).toThrow(/Unknown offer email kind/);
  });
});
