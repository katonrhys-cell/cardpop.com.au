import { describe, it, expect } from 'vitest';
import { isFeaturedEvent, featuredFirst, featuredStrip } from '@/utils/eventFeatured.js';
import {
  EVENT_REGIONS, eventRegionBySlug, eventRegionByState, eventRegionPath, eventRegionSeo, regionsWithEvents,
} from '@/data/eventRegions.js';
import { eventBadgeSnippet, eventPublicUrl } from '@/utils/eventBadge.js';

const TODAY = '2026-11-06';
const ev = (over) => ({ id: over.id, status: 'approved', start_date: '2026-12-01', ...over });

describe('featured events', () => {
  it('shows the badge only on live, upcoming, featured events', () => {
    expect(isFeaturedEvent(ev({ id: 1, is_featured: true }), TODAY)).toBe(true);
    expect(isFeaturedEvent(ev({ id: 2, is_featured: false }), TODAY)).toBe(false);
    expect(isFeaturedEvent(ev({ id: 3, is_featured: true, start_date: '2026-10-01' }), TODAY)).toBe(false);
    expect(isFeaturedEvent(ev({ id: 4, is_featured: true, status: 'pending_review' }), TODAY)).toBe(false);
    expect(isFeaturedEvent(ev({ id: 5, is_featured: true, status: 'completed' }), TODAY)).toBe(false);
  });

  it('a multi-day show stays featured until its last day', () => {
    expect(isFeaturedEvent(ev({ id: 1, is_featured: true, start_date: '2026-11-05', end_date: '2026-11-07' }), TODAY)).toBe(true);
  });

  it('puts featured events first and keeps the rest in order', () => {
    const list = [ev({ id: 'a' }), ev({ id: 'b', is_featured: true }), ev({ id: 'c' }), ev({ id: 'd', is_featured: true })];
    expect(featuredFirst(list, TODAY).map((e) => e.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('builds a soonest-first, capped strip', () => {
    const list = [
      ev({ id: 'late', is_featured: true, start_date: '2027-02-01' }),
      ev({ id: 'soon', is_featured: true, start_date: '2026-11-20' }),
      ev({ id: 'plain' }),
    ];
    expect(featuredStrip(list, TODAY).map((e) => e.id)).toEqual(['soon', 'late']);
    expect(featuredStrip(list, TODAY, 1)).toHaveLength(1);
    expect(featuredStrip(null, TODAY)).toEqual([]);
  });
});

describe('event regions', () => {
  it('covers every state and territory once', () => {
    const states = EVENT_REGIONS.map((r) => r.state).sort();
    expect(states).toEqual(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
    expect(new Set(EVENT_REGIONS.map((r) => r.slug)).size).toBe(EVENT_REGIONS.length);
  });

  it('looks regions up by slug and state', () => {
    expect(eventRegionBySlug('Melbourne').state).toBe('VIC');
    expect(eventRegionBySlug('nowhere')).toBeNull();
    expect(eventRegionByState('nsw').slug).toBe('sydney');
    expect(eventRegionPath(eventRegionBySlug('perth'))).toBe('/card-shows/perth');
  });

  it('names the city and state in the SEO copy without a count', () => {
    const seo = eventRegionSeo(eventRegionBySlug('brisbane'));
    expect(seo.title).toMatch(/Card Shows in Brisbane/);
    expect(seo.description).toMatch(/Queensland/);
    for (const r of EVENT_REGIONS) expect(r.intro).not.toMatch(/\d{3,}/);
  });

  it('lists only states with an upcoming approved event', () => {
    const events = [
      ev({ id: 1, state: 'VIC' }),
      ev({ id: 2, state: 'nsw', start_date: '2026-10-01' }),
      ev({ id: 3, state: 'QLD', status: 'completed' }),
      ev({ id: 4, state: 'WA', start_date: '2026-11-01', end_date: '2026-11-08' }),
    ];
    expect(regionsWithEvents(events, TODAY).map((r) => r.state)).toEqual(['VIC', 'WA']);
  });
});

describe('organiser website badge', () => {
  it('links to the event page and escapes the title', () => {
    const html = eventBadgeSnippet({ id: 'x', slug: 'oz-card-show', title: 'Tom & "Jerry" <Show>' });
    expect(html).toContain('href="https://cardpop.com.au/events/oz-card-show"');
    expect(html).toContain('Tom &amp; &quot;Jerry&quot; &lt;Show&gt; on CardPop');
    expect(html).toContain('src="https://cardpop.com.au/badges/listed-on-cardpop.svg"');
    expect(html).not.toMatch(/nofollow/);
  });

  it('falls back to the id when there is no slug', () => {
    expect(eventPublicUrl({ id: 'abc-123' })).toBe('https://cardpop.com.au/events/abc-123');
  });
});
