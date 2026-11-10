import { describe, it, expect } from 'vitest';
import {
  LIST_EVENT_TIERS, LIST_EVENT_FAQS, LIST_EVENT_STEPS, MEMBER_OFFER_MAILTO, FEATURED_MAILTO,
  ORGANISER_EMAIL, SUBMIT_EVENT_PATH, LIST_EVENT_FEATURED_PACKAGES,
} from '@/data/listYourEvent.js';
import { FEATURED_PACKAGES } from '@/utils/featuredPackages.js';
import { buildOrganiserStats } from '@/components/events/OrganiserReach.jsx';

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

  it('adds page views and Google clicks once they clear their floors', () => {
    const stats = buildOrganiserStats(
      { visitors_30d: 1879, visitors_all_time: 7020, pageviews_30d: 5758, pageviews_all_time: 21000,
        since_date: '2026-04-07', synced_at: fresh,
        search_impressions_30d: 99962, search_clicks_30d: 1377, search_impressions_all_time: 257706,
        search_clicks_all_time: 5118, search_since_date: '2026-05-31', search_synced_at: fresh },
      { events: 12 },
    );
    expect(stats.map((s) => [s.key, s.value])).toEqual([
      ['visitors', 1879], ['pageviews', 5758], ['impressions', 99962], ['clicks', 1377], ['events', 12],
    ]);
    expect(stats.find((s) => s.key === 'pageviews').sub).toBe('21k since Apr 2026');
    // Page views below their floor stay hidden on their own.
    const few = buildOrganiserStats({ visitors_30d: 200, pageviews_30d: 300, synced_at: fresh }, null);
    expect(few.map((s) => s.key)).toEqual(['visitors']);
  });

  it('drops a stale sync', () => {
    const stats = buildOrganiserStats(
      { visitors_30d: 5000, synced_at: '2020-01-01T00:00:00Z' },
      null,
    );
    expect(stats).toEqual([]);
  });
});
