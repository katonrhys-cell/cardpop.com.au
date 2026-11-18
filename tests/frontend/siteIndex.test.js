import { describe, it, expect } from 'vitest';
import {
  STATIC_SECTIONS, buildDynamicSections, listingLabel, listingPath, eventDateLabel, cityLabel,
} from '@/utils/siteIndex.js';

const listing = (id, card, slug) => ({ id, slug, vault_item: card });

describe('site index sections', () => {
  it('lists each card for sale once, labelled so two copies of a player can be told apart', () => {
    const sections = buildDynamicSections({
      listings: [
        listing('a', { card_name: 'Victor Wembanyama', year: 2023, set_name: 'Prizm', card_number: '136' }),
        listing('b', { card_name: 'Victor Wembanyama', year: 2023, set_name: 'Select', card_number: '#12' }),
        // An identical second copy: one line is enough in an index.
        listing('c', { card_name: 'Victor Wembanyama', year: 2023, set_name: 'Prizm', card_number: '136' }),
        listing('d', { card_name: 'Pikachu' }, 'pikachu-promo'),
      ],
    });
    const cards = sections.find((s) => s.key === 'listings');
    expect(cards.title).toBe('Cards for sale now');
    expect(cards.links).toEqual([
      { label: 'Victor Wembanyama — 2023 Prizm #136', path: '/marketplace/a/victor-wembanyama' },
      { label: 'Victor Wembanyama — 2023 Select #12', path: '/marketplace/b/victor-wembanyama' },
      { label: 'Pikachu', path: '/marketplace/d/pikachu-promo' },
    ]);
    expect(cards.more.path).toBe('/marketplace');
  });

  it('never links a vault card page — only listings', () => {
    const sections = buildDynamicSections({ listings: [listing('a', { card_name: 'Goku' })] });
    const paths = [...STATIC_SECTIONS, ...sections].flatMap((s) => s.links.map((l) => l.path));
    expect(paths.some((p) => p.startsWith('/product/vault'))).toBe(false);
  });

  it('builds events, card shop cities, articles and players, and leaves out empty sections', () => {
    const sections = buildDynamicSections({
      events: [{ id: 'e1', slug: 'perth-card-fest-7', title: 'Perth Card Fest 7', start_date: '2026-12-06', state: 'wa' }],
      stores: [{ city: 'melbourne' }, { city: 'gold-coast' }, { city: 'melbourne' }, { city: '' }],
      articles: [{ slug: 'psa-guide', title: 'PSA grading guide' }, { slug: '', title: 'No slug' }],
      players: [{ slug: 'lebron-james', name: 'LeBron James' }],
    });
    expect(sections.map((s) => s.key)).toEqual(['events', 'stores', 'articles', 'players']);
    expect(sections[0].links).toEqual([
      { label: 'Perth Card Fest 7', path: '/events/perth-card-fest-7', note: 'Sun 6 Dec 2026 · WA' },
    ]);
    expect(sections[1].links.map((l) => [l.label, l.path])).toEqual([
      ['Card shops in Gold Coast', '/card-shops/gold-coast'],
      ['Card shops in Melbourne', '/card-shops/melbourne'],
    ]);
    expect(sections[2].links).toEqual([{ label: 'PSA grading guide', path: '/blog/psa-guide' }]);
    expect(sections[3].links).toEqual([{ label: 'LeBron James', path: '/players/lebron-james' }]);
    expect(buildDynamicSections({})).toEqual([]);
  });

  it('has headed static sections with unique, site-relative links', () => {
    expect(STATIC_SECTIONS.map((s) => s.title)).toEqual([
      'Main pages', 'Card supplies', 'Prices & market', 'Grading', 'Articles by topic', 'Help & policies',
    ]);
    const paths = STATIC_SECTIONS.flatMap((s) => s.links.map((l) => l.path));
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^\/[a-z0-9/-]*$/);
  });

  it('labels and paths', () => {
    expect(listingLabel({ vault_item: {} })).toBe('Trading card');
    expect(listingLabel({ vault_item: { card_name: 'Larry Johnson', year: '1993-94', set_name: '1993-94 Fleer Ultra', card_number: '22' } }))
      .toBe('Larry Johnson — 1993-94 Fleer Ultra #22');
    expect(listingPath({ id: 'x', vault_item: { card_name: '' } })).toBe('/marketplace/x/listing');
    expect(eventDateLabel('2026-12-06T10:00:00+11:00')).toBe('Sun 6 Dec 2026');
    expect(eventDateLabel('soon')).toBe('');
    expect(cityLabel('gold-coast')).toBe('Gold Coast');
  });
});
