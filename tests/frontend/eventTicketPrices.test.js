import { describe, it, expect } from 'vitest';
import { cleanTicketPrices, ticketPriceLines, ticketPricesFormError } from '@/utils/eventTicketPrices.js';

describe('cleanTicketPrices', () => {
  it('normalises form strings, drops bad rows and sorts into display order', () => {
    expect(cleanTicketPrices([
      { type: 'group', group_size: '10', price_aud: '90' },
      { type: 'vip', price_aud: '49.999' },
      { type: 'bogus', price_aud: '5' },
      { type: 'child', price_aud: '' },
      { type: 'group', group_size: '4', price_aud: '40' },
      { type: 'group', group_size: '1', price_aud: '5' },
      { type: 'vip', price_aud: '99' },
      { type: 'ga_early', price_aud: '0' },
    ])).toEqual([
      { type: 'vip', price_aud: 50 },
      { type: 'ga_early', price_aud: 0 },
      { type: 'group', price_aud: 40, group_size: 4 },
      { type: 'group', price_aud: 90, group_size: 10 },
    ]);
  });

  it('returns [] for anything that is not an array', () => {
    expect(cleanTicketPrices(null)).toEqual([]);
    expect(cleanTicketPrices({})).toEqual([]);
  });
});

describe('ticketPriceLines', () => {
  it('labels each price for the event page', () => {
    expect(ticketPriceLines([
      { type: 'child', price_aud: 5 },
      { type: 'ga_late', price_aud: 10 },
      { type: 'group', group_size: 4, price_aud: 40 },
      { type: 'vip', price_aud: 0 },
    ])).toEqual([
      { label: 'Child', price: '$5.00', soldOut: false, waitlistUrl: null },
      { label: 'VIP', price: 'Free', soldOut: false, waitlistUrl: null },
      { label: 'GA Late Access', price: '$10.00', soldOut: false, waitlistUrl: null },
      { label: 'Group of 4', price: '$40.00', soldOut: false, waitlistUrl: null },
    ]);
  });
});

describe('ticketPricesFormError', () => {
  it('flags a ticked option with no price, bad group sizes and duplicate groups', () => {
    expect(ticketPricesFormError([{ type: 'child', price_aud: '' }])).toMatch(/price for the Child ticket/);
    expect(ticketPricesFormError([{ type: 'group', group_size: '1', price_aud: '5' }])).toMatch(/number of people/);
    expect(ticketPricesFormError([
      { type: 'group', group_size: '4', price_aud: '40' },
      { type: 'group', group_size: '4', price_aud: '35' },
    ])).toMatch(/two group prices for 4 people/);
    expect(ticketPricesFormError([{ type: 'vip', price_aud: '60' }, { type: 'group', group_size: '6', price_aud: '50' }])).toBeNull();
  });
});

import { cleanTicketPrices as _clean, ticketPriceLines as _lines, ticketPricesFormError as _err, ticketPriceOfferName as _name } from '@/utils/eventTicketPrices.js';

describe('custom (organiser-named) tickets', () => {
  it('keeps a free-text ticket with its sold-out flag and waitlist link', () => {
    const rows = _clean([
      { type: 'custom', label: '  Flame   Flame Fruit Coliseum Player Entry ', price_aud: '65', sold_out: true, waitlist_url: 'https://events.humanitix.com/x' },
      { type: 'vip', price_aud: 100 },
    ]);
    expect(rows).toEqual([
      { type: 'vip', price_aud: 100 },
      { type: 'custom', label: 'Flame Flame Fruit Coliseum Player Entry', price_aud: 65, sold_out: true, waitlist_url: 'https://events.humanitix.com/x' },
    ]);
    expect(_lines(rows)[1]).toEqual({ label: 'Flame Flame Fruit Coliseum Player Entry', price: '$65.00', soldOut: true, waitlistUrl: 'https://events.humanitix.com/x' });
    expect(_name(rows[1])).toBe('Flame Flame Fruit Coliseum Player Entry');
  });

  it('drops unnamed and duplicate rows, bad waitlist links, and waitlists on tickets that are not sold out', () => {
    const rows = _clean([
      { type: 'custom', label: '', price_aud: 5 },
      { type: 'custom', label: 'Spectator', price_aud: 5, waitlist_url: 'https://ok.example' },
      { type: 'custom', label: 'spectator', price_aud: 6 },
      { type: 'custom', label: 'Player', price_aud: 9, sold_out: true, waitlist_url: 'javascript:alert(1)' },
    ]);
    expect(rows).toEqual([
      { type: 'custom', label: 'Spectator', price_aud: 5 },
      { type: 'custom', label: 'Player', price_aud: 9, sold_out: true },
    ]);
  });

  it('explains what is wrong before saving', () => {
    expect(_err([{ type: 'custom', label: '', price_aud: '5' }])).toMatch(/name/);
    expect(_err([{ type: 'custom', label: 'Player', price_aud: '' }])).toMatch(/price/);
    expect(_err([{ type: 'custom', label: 'Player', price_aud: '5', sold_out: true, waitlist_url: 'nope' }])).toMatch(/http/);
    expect(_err([{ type: 'custom', label: 'Player', price_aud: '5' }])).toBeNull();
  });
});
