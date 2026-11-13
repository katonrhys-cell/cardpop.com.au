import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics.js', () => ({ trackEvent: (...args) => trackEvent(...args) }));

import WhatsAppChatLink from '@/components/WhatsAppChatLink.jsx';
import {
  WHATSAPP_CHAT_URL,
  WHATSAPP_GREETING,
  WHATSAPP_NUMBER_E164,
  WHATSAPP_NUMBER_LOCAL,
  whatsappChatUrl,
  whatsappMessageForPath,
} from '@/utils/whatsapp.js';

describe('whatsappChatUrl', () => {
  it('points at the business number in the international form wa.me expects', () => {
    expect(WHATSAPP_NUMBER_E164).toBe('61406378473');
    // 0406 378 473 → drop the leading 0, prefix Australia's 61.
    expect(`61${WHATSAPP_NUMBER_LOCAL.replace(/\D/g, '').slice(1)}`).toBe(WHATSAPP_NUMBER_E164);
    const u = new URL(WHATSAPP_CHAT_URL);
    expect(u.origin + u.pathname).toBe('https://wa.me/61406378473');
    expect(u.searchParams.get('text')).toBe(WHATSAPP_GREETING);
  });

  it('encodes the pre-typed message and caps its length', () => {
    const u = new URL(whatsappChatUrl('PSA 10 & more? #1'));
    expect(u.searchParams.get('text')).toBe('PSA 10 & more? #1');
    expect(new URL(whatsappChatUrl('x'.repeat(900))).searchParams.get('text')).toHaveLength(500);
  });

  it('falls back to the bare chat link for an empty message', () => {
    expect(whatsappChatUrl('  ')).toBe('https://wa.me/61406378473');
  });
});

describe('whatsappMessageForPath', () => {
  it('names the public page the visitor is on', () => {
    expect(whatsappMessageForPath('/shop/binders/9-pocket-zip-binder'))
      .toBe('Hi CardPop! I have a question about https://cardpop.com.au/shop/binders/9-pocket-zip-binder');
    expect(whatsappMessageForPath('/events')).toContain('https://cardpop.com.au/events');
  });

  it('never carries a query string or hash', () => {
    expect(whatsappMessageForPath('/shop/binders?token=abc#frag')).toBe('Hi CardPop! I have a question about https://cardpop.com.au/shop/binders');
  });

  it('uses the plain greeting everywhere else — home, private pages, look-alike prefixes, garbage', () => {
    for (const path of ['/', '/account/orders', '/admin/orders', '/checkout', '/login', '/reset-password', '/shopping', '', null, undefined, '//evil.example/shop']) {
      expect(whatsappMessageForPath(path)).toBe(WHATSAPP_GREETING);
    }
  });
});

describe('WhatsAppChatLink', () => {
  const renderAt = (path) => render(
    <MemoryRouter initialEntries={[path]}>
      <WhatsAppChatLink placement="footer_bar">Chat on WhatsApp</WhatsAppChatLink>
    </MemoryRouter>,
  );

  it('opens the chat in a new tab with the page pre-typed', () => {
    renderAt('/players/nick-daicos');
    const link = screen.getByRole('link', { name: 'Chat on WhatsApp' });
    const u = new URL(link.getAttribute('href'));
    expect(u.hostname).toBe('wa.me');
    expect(u.searchParams.get('text')).toContain('https://cardpop.com.au/players/nick-daicos');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('keeps a private page out of the message and reports the click', () => {
    renderAt('/account/orders');
    const link = screen.getByRole('link', { name: 'Chat on WhatsApp' });
    expect(new URL(link.getAttribute('href')).searchParams.get('text')).toBe(WHATSAPP_GREETING);
    // Stop happy-dom following the link out to wa.me.
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith('whatsapp_chat_click', { placement: 'footer_bar', page_path: '/account/orders' });
  });
});
