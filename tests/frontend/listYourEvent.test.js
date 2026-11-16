import { describe, it, expect } from 'vitest';
import {
  LIST_EVENT_TIERS, LIST_EVENT_FAQS, LIST_EVENT_STEPS, MEMBER_OFFER_MAILTO, FEATURED_MAILTO,
  ORGANISER_EMAIL, SUBMIT_EVENT_PATH, LIST_EVENT_FEATURED_PACKAGES,
  LIST_EVENT_EXTRAS, EXTRAS_NOTE, EXTRAS_ENQUIRY_NOTE, EXTRAS_ENQUIRY_MAILTO, FEATURED_MEMBERSHIP_NOTE,
  FEATURED_BUNDLE_NOTE, FEATURED_EARLY_BIRD_NOTE,
} from '@/data/listYourEvent.js';
import { FEATURED_PACKAGES, EVENT_EXTRAS, EXTRAS_ENQUIRY_EMAIL, BUNDLE } from '@/utils/featuredPackages.js';
import { TIER_PRICES_AUD } from '@/config/subscription.js';
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

  it('never claims an audience figure, and only quotes prices from the tables the server charges from', () => {
    const text = JSON.stringify([
      LIST_EVENT_TIERS, LIST_EVENT_FAQS, LIST_EVENT_STEPS, LIST_EVENT_EXTRAS, EXTRAS_NOTE, EXTRAS_ENQUIRY_NOTE,
      FEATURED_MEMBERSHIP_NOTE, FEATURED_BUNDLE_NOTE, FEATURED_EARLY_BIRD_NOTE,
    ]);
    expect(text).not.toMatch(/\d[\d,]{3,}\s*(visitors|collectors|members|pageviews|views)/i);
    // Every dollar figure is Calendar Spotlight, its 3-event pack, an extra
    // (utils/featuredPackages.js) or the Ultimate membership (config/subscription.js).
    const allowed = new Set([
      ...FEATURED_PACKAGES.map((p) => `$${p.priceAud}`),
      ...Object.values(BUNDLE.priceAud).map((aud) => `$${aud}`),
      ...EVENT_EXTRAS.map((x) => `$${x.priceAud}`),
      `$${TIER_PRICES_AUD.ultimate}`,
    ]);
    const prices = text.match(/\$\d[\d.]*/g) || [];
    expect(prices.length).toBeGreaterThan(0);
    // A price that ends a sentence carries its full stop in the match.
    for (const price of prices) expect(allowed.has(price.replace(/\.$/, ''))).toBe(true);
  });

  it('lists the three promotion extras at the prices the server charges', () => {
    expect(LIST_EVENT_EXTRAS.map((x) => [x.key, x.name, x.price])).toEqual(
      EVENT_EXTRAS.map((x) => [x.key, x.name, `$${x.priceAud}`]),
    );
    expect(LIST_EVENT_EXTRAS.map((x) => x.price)).toEqual(['$49', '$99', '$199']);
    const review = LIST_EVENT_EXTRAS.find((x) => x.key === 'review');
    expect(review.terms.join(' | ')).toMatch(/free entry/i);
    expect(review.terms.join(' | ')).toMatch(/on the day/i);
    for (const x of LIST_EVENT_EXTRAS) expect(x.points.length).toBeGreaterThan(0);
  });

  it('keeps extras separate from featuring and membership, and points further enquiries to email', () => {
    expect(EXTRAS_NOTE).toMatch(/separate from featured placement and from membership/);
    expect(EXTRAS_ENQUIRY_NOTE).toContain(EXTRAS_ENQUIRY_EMAIL);
    expect(EXTRAS_ENQUIRY_MAILTO.startsWith(`mailto:${EXTRAS_ENQUIRY_EMAIL}?subject=`)).toBe(true);
    expect(EXTRAS_ENQUIRY_MAILTO).not.toMatch(/ /);
    // Featuring no longer promises Instagram or a homepage spot.
    const featured = LIST_EVENT_TIERS.find((t) => t.key === 'featured');
    expect(JSON.stringify([featured, LIST_EVENT_FEATURED_PACKAGES])).not.toMatch(/instagram|homepage/i);
    const faq = LIST_EVENT_FAQS.find((f) => /Instagram/.test(f.q));
    expect(faq.a).toContain('Instagram story $49, Instagram post $99, Full event review $199');
    expect(faq.a).toContain(EXTRAS_ENQUIRY_EMAIL);
    expect(faq.a).toMatch(/free entry/);
  });

  it('offers the Ultimate membership as the way to feature every show', () => {
    expect(FEATURED_MEMBERSHIP_NOTE).toContain(`$${TIER_PRICES_AUD.ultimate} a year`);
    expect(FEATURED_MEMBERSHIP_NOTE).toMatch(/features every event you run/);
    expect(FEATURED_BUNDLE_NOTE).toContain('Calendar Spotlight $119');
    expect(FEATURED_BUNDLE_NOTE).not.toMatch(/Instagram|Full Feature/);
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
