import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SEO_TITLE_MAX, SEO_DESCRIPTION_MAX } from '../../utils/players.js';

// The player pages (/players, /players/:slug) as Googlebot receives them from
// api/prerender.js: titles inside Google's cutoff, one canonical URL per
// player, Person + FAQ structured data, and the cross-links that tie the
// pages to the collection and price hubs.

const state = vi.hoisted(() => ({ tables: {} }));
vi.mock('@supabase/supabase-js', () => {
  const builder = (rows) => {
    const b = {
      select: vi.fn(() => b), eq: vi.fn(() => b), neq: vi.fn(() => b), in: vi.fn(() => b), gt: vi.fn(() => b),
      gte: vi.fn(() => b), like: vi.fn(() => b), ilike: vi.fn(() => b), not: vi.fn(() => b), or: vi.fn(() => b),
      order: vi.fn(() => b), limit: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve({ data: rows?.[0] || null })),
      single: vi.fn(() => Promise.resolve({ data: rows?.[0] || null })),
      then: (resolve, reject) => Promise.resolve({ data: rows || [] }).then(resolve, reject),
    };
    return b;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table) => builder(state.tables[table])),
      storage: { from: vi.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/img.jpg' } }) })) },
    })),
  };
});
import handler from '../../api/prerender.js';

function render(path) {
  const req = { query: { path } };
  const res = {
    statusCode: 200, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v; },
    status(s) { this.statusCode = s; return this; },
    send(p) { this.body = p; return this; },
  };
  return handler(req, res).then(() => res);
}

const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap((m) => { const j = JSON.parse(m[1]); return j['@graph'] || [j]; });
const title = (html) => html.match(/<title>([^<]*)<\/title>/)[1].replace(/&amp;/g, '&');
const description = (html) => html.match(/<meta name="description" content="([^"]*)"/)[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const PLAYER = {
  id: 'p1', slug: 'victor-wembanyama', name: 'Victor Wembanyama', sport: 'NBA', team: 'San Antonio Spurs', position: 'Centre',
  nationality: 'France', born_year: 2004, career_span: '2023–present',
  headline: 'The most anticipated prospect since LeBron and the 2024 Rookie of the Year.',
  bio: 'Para one.\n\nPara two.', collecting_notes: 'Buy graded.',
  key_cards: [{ name: '2023-24 Panini Prizm #136', note: 'The flagship rookie.' }, { name: '2023-24 Donruss Rated Rookie #250', note: '' }],
  image_url: null, created_at: '2026-10-18T02:00:00Z', updated_at: '2026-10-18T02:00:00Z',
};
const LISTING = {
  id: 'l1', slug: 'wemby-prizm', price_aud: 450, listing_type: 'fixed',
  vault_item: { card_name: 'Victor Wembanyama Prizm', set_name: '2023-24 Panini Prizm', year: '2023', player_id: 'p1' },
};
const TRACKED = {
  slug: 'victor-wembanyama-prizm-rookie', name: 'Victor Wembanyama Prizm Rookie', set_name: '2023-24 Panini Prizm', category: 'basketball',
  card_price_snapshots: [{ snapshot_date: '2026-10-17', raw_avg: 120.5, graded_avg: 900 }],
};

beforeEach(() => { state.tables = { players: [PLAYER], listings: [LISTING], tracked_cards: [TRACKED] }; });

describe('prerender /players/:slug', () => {
  it('keeps the title and description inside the search-snippet limits', async () => {
    const { body } = await render('/players/victor-wembanyama');
    expect(title(body)).toBe('Victor Wembanyama Cards – Rookie Cards & Prices | CardPop');
    expect(title(body).length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    expect(description(body).length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
    expect(description(body)).toMatch(/^Victor Wembanyama \(NBA, San Antonio Spurs\): /);
  });

  it('emits one canonical URL, Breadcrumb + ProfilePage/Person + FAQPage JSON-LD and no noindex', async () => {
    const { body, statusCode } = await render('/players/victor-wembanyama');
    expect(statusCode).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/players/victor-wembanyama" />');
    expect(body).not.toContain('name="robots"');
    const nodes = ld(body);
    expect(nodes.map((n) => n['@type'])).toEqual(['BreadcrumbList', 'ProfilePage', 'FAQPage']);
    const profile = nodes.find((n) => n['@type'] === 'ProfilePage');
    expect(profile.mainEntity).toMatchObject({ '@type': 'Person', name: 'Victor Wembanyama', url: 'https://cardpop.com.au/players/victor-wembanyama', nationality: 'France' });
    expect(profile.dateCreated).toBe('2026-10-18T02:00:00Z');
    const faq = nodes.find((n) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(3);
    expect(faq.mainEntity[0].name).toBe("What is Victor Wembanyama's rookie card?");
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain('2023-24 Panini Prizm #136');
    // Every figure traces to the tracker snapshot handed in.
    expect(faq.mainEntity[1].acceptedAnswer.text).toContain('17 October 2026');
    expect(faq.mainEntity[1].acceptedAnswer.text).toMatch(/A?\$120\.50 ungraded/);
    expect(faq.mainEntity[2].acceptedAnswer.text).toContain('1 Victor Wembanyama listing is live');
  });

  it('renders the body content a crawler without JavaScript needs', async () => {
    const { body } = await render('/players/victor-wembanyama');
    expect(body).toContain('<h1>Victor Wembanyama</h1>');
    expect(body).toContain('<h2>About Victor Wembanyama</h2>');
    expect(body).toContain('<h2>Cards worth knowing</h2>');
    expect(body).toContain('<h2>Victor Wembanyama cards: frequently asked questions</h2>');
    // Listing line does not double the year ("2023 2023-24 …").
    expect(body).toContain('(2023-24 Panini Prizm) — ');
    expect(body).not.toContain('2023 2023-24');
    // Cross-links: the tracker card, the marketplace listing, the sport hub and the index.
    expect(body).toContain('href="https://cardpop.com.au/prices/basketball/victor-wembanyama-prizm-rookie"');
    expect(body).toContain('href="https://cardpop.com.au/marketplace/l1/wemby-prizm"');
    expect(body).toContain('href="https://cardpop.com.au/collections/nba"');
    expect(body).toContain('href="https://cardpop.com.au/players"');
  });

  it('301s a mis-cased or underscored slug onto the canonical URL', async () => {
    for (const path of ['/players/Victor-Wembanyama', '/players/victor_wembanyama', '/players/Victor%20Wembanyama']) {
      const res = await render(path);
      expect(res.statusCode).toBe(301);
      expect(res.headers.Location).toBe('https://cardpop.com.au/players/victor-wembanyama');
    }
  });

  it('returns a 404 with noindex for an unknown or unpublished player', async () => {
    state.tables.players = [];
    const res = await render('/players/nobody-here');
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('<meta name="robots" content="noindex, follow" />');
    expect(res.body).toContain('<h1>Player not found</h1>');
  });

  it('still renders when a player has no listings or tracked cards', async () => {
    state.tables = { players: [PLAYER], listings: [], tracked_cards: [] };
    const { body } = await render('/players/victor-wembanyama');
    expect(body).toContain('No cards tagged with Victor Wembanyama are listed yet.');
    const faq = ld(body).find((n) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity[1].acceptedAnswer.text).toContain('as the data builds');
    expect(faq.mainEntity[2].acceptedAnswer.text).toContain('appear here as sellers list them');
  });
});

describe('prerender /players', () => {
  it('lists every published player grouped by sport with a short title', async () => {
    state.tables.players = [PLAYER, { ...PLAYER, id: 'p2', slug: 'nick-daicos', name: 'Nick Daicos', sport: 'AFL', team: 'Collingwood' }];
    const { body } = await render('/players');
    expect(title(body).length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/players" />');
    expect(body).not.toContain('name="robots"');
    expect(body).toContain('<h2>NBA</h2>');
    expect(body).toContain('<h2>AFL</h2>');
    expect(body).toContain('href="https://cardpop.com.au/players/nick-daicos"');
    const nodes = ld(body);
    expect(nodes.map((n) => n['@type'])).toEqual(['BreadcrumbList', 'CollectionPage']);
    expect(nodes[1].mainEntity.numberOfItems).toBe(2);
  });

  it('is noindex while there are no published players (empty directory rule)', async () => {
    state.tables.players = [];
    const { body } = await render('/players');
    expect(body).toContain('<meta name="robots" content="noindex, follow" />');
  });
});

describe('player links from neighbouring pages', () => {
  it('lists the sport\'s players on its collection page', async () => {
    const { body } = await render('/collections/nba');
    expect(body).toContain('<h2>NBA players</h2>');
    expect(body).toContain('href="https://cardpop.com.au/players/victor-wembanyama">Victor Wembanyama cards</a>');
  });

  it('shows no player list on a TCG collection page', async () => {
    const { body } = await render('/collections/pokemon');
    expect(body).not.toContain('players</h2>');
  });

  it('links a tracked price card to its player page', async () => {
    state.tables.tracked_cards = [{ id: 't1', slug: 'victor-wembanyama-prizm-rookie', name: 'Victor Wembanyama Prizm Rookie', set_name: '2023-24 Panini Prizm', category: 'basketball', player: { slug: 'victor-wembanyama', name: 'Victor Wembanyama' } }];
    state.tables.card_price_snapshots = [];
    const { body } = await render('/prices/basketball/victor-wembanyama-prizm-rookie');
    expect(body).toContain('Player: <a href="https://cardpop.com.au/players/victor-wembanyama">Victor Wembanyama cards</a>');
  });
});
