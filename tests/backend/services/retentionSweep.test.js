import { describe, it, expect } from 'vitest';
import { shouldEmailAbandoned, watchlistAlertFor, parseSavedSearch } from '../../../src/services/retentionSweepService.js';

const NOW = new Date('2026-10-04T08:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const base = { id: 'o1', status: 'pending', buyer_id: 'u1', created_at: hoursAgo(5), order_items: [{ id: 'l1', type: 'listing' }] };

describe('shouldEmailAbandoned — the consent and timing rules', () => {
  it('emails a signed-in buyer whose checkout is 1–72h old and unpaid', () => {
    expect(shouldEmailAbandoned(base, NOW)).toEqual({ send: true });
    expect(shouldEmailAbandoned({ ...base, status: 'cancelled' }, NOW).send).toBe(true);
  });
  it('never emails a guest who did not tick the newsletter box', () => {
    expect(shouldEmailAbandoned({ ...base, buyer_id: null, buyer_email: 'g@x.com', marketing_consent: false }, NOW)).toMatchObject({ send: false, reason: 'no consent' });
  });
  it('emails a guest who ticked the box', () => {
    expect(shouldEmailAbandoned({ ...base, buyer_id: null, buyer_email: 'g@x.com', marketing_consent: true }, NOW).send).toBe(true);
  });
  it('waits an hour and gives up after three days', () => {
    expect(shouldEmailAbandoned({ ...base, created_at: hoursAgo(0.5) }, NOW)).toMatchObject({ send: false, reason: 'too soon' });
    expect(shouldEmailAbandoned({ ...base, created_at: hoursAgo(80) }, NOW)).toMatchObject({ send: false, reason: 'too old' });
  });
  it('sends once, and never for a paid or empty order', () => {
    expect(shouldEmailAbandoned({ ...base, abandoned_email_sent_at: hoursAgo(1) }, NOW).send).toBe(false);
    expect(shouldEmailAbandoned({ ...base, status: 'paid' }, NOW).send).toBe(false);
    expect(shouldEmailAbandoned({ ...base, order_items: [] }, NOW).send).toBe(false);
  });
});

describe('watchlistAlertFor', () => {
  const row = { price_at_add_aud: 100, last_alert_price_aud: null, sold_alerted_at: null };
  it('alerts a price drop below the saved price, with the percentage', () => {
    expect(watchlistAlertFor(row, { status: 'active', price_aud: 80 })).toEqual({ kind: 'price_drop', from: 100, to: 80, pct: 20 });
  });
  it('does not repeat a drop already emailed, but alerts a further drop', () => {
    expect(watchlistAlertFor({ ...row, last_alert_price_aud: 80 }, { status: 'active', price_aud: 80 })).toBeNull();
    expect(watchlistAlertFor({ ...row, last_alert_price_aud: 80 }, { status: 'active', price_aud: 70 })).toMatchObject({ kind: 'price_drop', from: 80, to: 70 });
  });
  it('ignores a price rise, a non-active listing and a missing baseline', () => {
    expect(watchlistAlertFor(row, { status: 'active', price_aud: 120 })).toBeNull();
    expect(watchlistAlertFor(row, { status: 'draft', price_aud: 10 })).toBeNull();
    expect(watchlistAlertFor({ ...row, price_at_add_aud: null }, { status: 'active', price_aud: 10 })).toBeNull();
  });
  it('alerts a sale once', () => {
    expect(watchlistAlertFor(row, { status: 'sold', price_aud: 100 })).toEqual({ kind: 'sold' });
    expect(watchlistAlertFor({ ...row, sold_alerted_at: '2026-01-01' }, { status: 'sold', price_aud: 100 })).toBeNull();
  });
});

describe('parseSavedSearch', () => {
  it('reads the marketplace URL params', () => {
    expect(parseSavedSearch('q=charizard&min=50&max=500&graded=graded&cat=c1')).toMatchObject({ q: 'charizard', min: 50, max: 500, graded: 'graded', cat: 'c1' });
  });
  it('drops junk values', () => {
    expect(parseSavedSearch('min=abc&graded=weird')).toMatchObject({ min: null, graded: null, q: '' });
    expect(parseSavedSearch(null).q).toBe('');
  });
});
