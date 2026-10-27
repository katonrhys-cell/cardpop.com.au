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
      { label: 'Child', price: '$5.00' },
      { label: 'VIP', price: 'Free' },
      { label: 'GA Late Access', price: '$10.00' },
      { label: 'Group of 4', price: '$40.00' },
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
