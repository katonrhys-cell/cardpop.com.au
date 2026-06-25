import { vi, describe, it, expect, beforeEach } from 'vitest';

// The prerender function builds its own Supabase client from @supabase/supabase-js,
// so we mock that module and feed per-table results through a chainable builder.
const state = vi.hoisted(() => ({ result: { data: null }, publicUrl: 'https://cdn.test/img.jpg' }));

vi.mock('@supabase/supabase-js', () => {
  const builder = () => {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve(state.result)),
      single: vi.fn(() => Promise.resolve(state.result)),
    };
    return b;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => builder()),
      storage: { from: vi.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: state.publicUrl } }) })) },
    })),
  };
});

import handler from '../../api/prerender.js';

function run(path) {
  const req = { query: { path } };
  let body = '';
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { body = payload; return this; },
  };
  return handler(req, res).then(() => ({ status: res.statusCode, body, headers: res.headers }));
}

const UUID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => { state.result = { data: null }; });

describe('prerender blog articles', () => {
  it('renders an article with its title, description and featured image', async () => {
    state.result = { data: {
      id: UUID, slug: 'parallels-guide', title: 'Understanding Card Parallels',
      seo_description: 'A complete guide to parallels.', excerpt: 'Excerpt here',
      content_html: '<h2>Intro</h2><p>Parallels are alternate versions.</p>',
      featured_image_url: 'https://cdn.test/hero.jpg', author: 'CardPop Research',
      category: 'Collector Insights', published_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-02-02T00:00:00.000Z', read_time_minutes: 7, is_published: true,
    } };
    const { status, body } = await run('/blog/parallels-guide');
    expect(status).toBe(200);
    expect(body).toContain('<title>Understanding Card Parallels | The Parallel Report</title>');
    expect(body).toContain('content="A complete guide to parallels."');
    expect(body).toContain('https://cdn.test/hero.jpg');
  });

  it('emits canonical, og:type article and strips scripts from content', async () => {
    state.result = { data: {
      id: UUID, slug: 'parallels-guide', title: 'Understanding Card Parallels',
      excerpt: 'Excerpt here', content_html: '<p>Body text.</p><script>alert(1)</script>',
      author: 'CardPop Research', category: 'Collector Insights',
      published_at: '2026-01-02T00:00:00.000Z', is_published: true,
    } };
    const { body } = await run('/blog/parallels-guide');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/blog/parallels-guide" />');
    expect(body).toContain('property="og:type" content="article"');
    expect(body).toContain('"@type":"BlogPosting"');
    expect(body).toContain('property="article:published_time"');
    expect(body).toContain('Body text.');
    expect(body).not.toContain('alert(1)');
  });

  it('returns noindex when the article is missing', async () => {
    state.result = { data: null };
    const { body } = await run('/blog/does-not-exist');
    expect(body).toContain('name="robots" content="noindex, follow"');
    expect(body).toContain('Article Not Found');
  });

  it('returns noindex for an unpublished article', async () => {
    state.result = { data: { id: UUID, slug: 'draft', title: 'Draft', is_published: false } };
    const { body } = await run('/blog/draft');
    expect(body).toContain('noindex');
  });
});

describe('prerender marketplace listings', () => {
  it('renders an active listing with Product + Offer JSON-LD', async () => {
    state.result = { data: {
      id: UUID, slug: 'charizard-base-set', title: 'Charizard Base Set',
      description: 'A holographic Charizard.', price_aud: 1499.95, status: 'active',
      condition: 'PSA 9', grade: '9', grading_company: 'PSA', accepts_offers: true,
      images: ['https://cdn.test/charizard.jpg'],
      vault_item: { card_name: 'Charizard', set_name: 'Base Set', year: 1999 },
      seller: { username: 'ash', store_slug: 'ash-cards', display_name: 'Ash Cards' },
    } };
    const { status, body } = await run('/marketplace/' + UUID + '/charizard-base-set');
    expect(status).toBe(200);
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"priceCurrency":"AUD"');
    expect(body).toContain('"price":"1499.95"');
    expect(body).toContain('schema.org/InStock');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/marketplace/' + UUID + '/charizard-base-set" />');
    expect(body).toContain('Charizard Base Set');
  });

  it('returns noindex for a sold/inactive listing', async () => {
    state.result = { data: { id: UUID, slug: 'sold-card', title: 'Sold Card', status: 'sold' } };
    const { body } = await run('/marketplace/' + UUID + '/sold-card');
    expect(body).toContain('noindex');
    expect(body).toContain('Listing Unavailable');
  });

  it('returns a generic noindex doc for a non-UUID id', async () => {
    const { body } = await run('/marketplace/category/pokemon');
    expect(body).toContain('noindex');
    expect(body).toContain('CardPop Marketplace');
  });
});
