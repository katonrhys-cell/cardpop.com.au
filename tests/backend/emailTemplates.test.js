import { describe, it, expect } from 'vitest';
import {
  esc,
  orderConfirmedEmail,
  itemSoldEmail,
  eventSubmittedEmail,
  orderAdminNoticeEmail,
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
});
