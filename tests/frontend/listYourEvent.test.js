import { describe, it, expect } from 'vitest';
import {
  LIST_EVENT_TIERS, LIST_EVENT_FAQS, LIST_EVENT_STEPS, MEMBER_OFFER_MAILTO, FEATURED_MAILTO,
  ORGANISER_EMAIL, SUBMIT_EVENT_PATH, LIST_EVENT_FEATURED_PACKAGES,
} from '@/data/listYourEvent.js';
import { FEATURED_PACKAGES } from '@/utils/featuredPackages.js';
import { buildOrganiserStats } from '@/pages/community/ListYourEventPage.jsx';

const fresh = new Date().toISOString();

describe('organiser landing copy', () => {
  it('offers the three tiers, each with a call to action', () => {
    expect(LIST_EVENT_TIERS.map((t) => t.key)).toEqual(['listing', 'offer', 'featured']);
    for (const t of LIST_EVENT_TIERS) {
      expect(t.cta.href).toBeTruthy();
      expect(t.points.length).toBeGreaterThan(0);
    }
    expect(LIST_EVENT_TIERS[0].cta.href).toBe(SUBMIT_EVENT_PATH);
  });

  it('mails the organiser inbox with a subject line', () => {
    for (const href of [MEMBER_OFFER_MAILTO, FEATURED_MAILTO]) {
      expect(href.startsWith(`mailto:${ORGANISER_EMAIL}?subject=`)).toBe(true);
      expect(href).not.toMatch(/ /);
    }
  });

  it('never claims an audience figure, and only quotes the featuring prices', () => {
    const text = JSON.stringify([LIST_EVENT_TIERS, LIST_EVENT_FAQS, LIST_EVENT_STEPS]);
    expect(text).not.toMatch(/\d[\d,]{3,}\s*(visitors|collectors|members|pageviews|views)/i);
    // Every dollar figure is one of the featuring package prices (utils/featuredPackages.js).
    const allowed = new Set(FEATURED_PACKAGES.map((p) => `$${p.priceAud}`));
    for (const price of text.match(/\$\d[\d.]*/g) || []) expect(allowed.has(price)).toBe(true);
  });

  it('lists every featuring package at the price the server charges', () => {
    expect(LIST_EVENT_FEATURED_PACKAGES.map((p) => [p.key, p.price])).toEqual(
      FEATURED_PACKAGES.map((p) => [p.key, `$${p.priceAud}`]),
    );
    const featured = LIST_EVENT_TIERS.find((t) => t.key === 'featured');
    expect(featured.cta.label).toBe('Feature Now');
    expect(featured.cta.href).toBe(`${SUBMIT_EVENT_PATH}?feature=1`);
    expect(JSON.stringify(LIST_EVENT_TIERS)).not.toMatch(/newsletter/i);
  });
});

describe('buildOrganiserStats', () => {
  it('shows nothing without data', () => {
    expect(buildOrganiserStats(null, null)).toEqual([]);
  });

  it('hides visitors and impressions below their floors', () => {
    const stats = buildOrganiserStats(
      { visitors_30d: 10, synced_at: fresh, search_impressions_30d: 50, search_synced_at: fresh },
      { events: 0 },
    );
    expect(stats).toEqual([]);
  });

  it('shows the live figures that clear their floors', () => {
    const stats = buildOrganiserStats(
      { visitors_30d: 5000, visitors_all_time: 9000, since_date: '2026-01-01', synced_at: fresh,
        search_impressions_30d: 40000, search_impressions_all_time: 90000, search_synced_at: fresh },
      { events: 42 },
    );
    expect(stats.map((s) => [s.key, s.value])).toEqual([
      ['visitors', 5000], ['impressions', 40000], ['events', 42],
    ]);
  });

  it('drops a stale sync', () => {
    const stats = buildOrganiserStats(
      { visitors_30d: 5000, synced_at: '2020-01-01T00:00:00Z' },
      null,
    );
    expect(stats).toEqual([]);
  });
});
