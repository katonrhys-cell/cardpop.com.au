import { vi, describe, it, expect, beforeEach } from 'vitest';

// The prerender function builds its own Supabase client from @supabase/supabase-js,
// so we mock that module and feed per-table results through a chainable builder.
const state = vi.hoisted(() => ({ result: { data: null }, listResult: { data: [] }, publicUrl: 'https://cdn.test/img.jpg' }));

vi.mock('@supabase/supabase-js', () => {
  const builder = () => {
    // Single-row fetches end in .maybeSingle()/.single() → state.result.
    // List fetches await the chain itself (thenable) → state.listResult.
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      neq: vi.fn(() => b),
      in: vi.fn(() => b),
      gt: vi.fn(() => b),
      gte: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve(state.result)),
      single: vi.fn(() => Promise.resolve(state.result)),
      then: (resolve, reject) => Promise.resolve(state.listResult).then(resolve, reject),
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

beforeEach(() => { state.result = { data: null }; state.listResult = { data: [] }; });

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

  it('emits FAQPage JSON-LD and a visible FAQ section when the article has faqs', async () => {
    state.result = { data: {
      id: UUID, slug: 'grading-guide', title: 'PSA Grading Guide',
      content_html: '<p>Body.</p>', author: 'CardPop Research', is_published: true,
      faqs: [
        { question: 'How much does PSA grading cost?', answer: 'From about AUD $68 per card.' },
        { question: 'Is grading worth it?', answer: 'When graded value exceeds raw + fees.' },
        { question: '', answer: 'dropped — no question' },
      ],
    } };
    const { body } = await run('/blog/grading-guide');
    expect(body).toContain('"@type":"FAQPage"');
    expect(body).toContain('How much does PSA grading cost?');
    expect(body).toContain('From about AUD $68 per card.');
    // visible on-page FAQ content (required for the rich result)
    expect(body).toContain('Frequently Asked Questions');
    // the incomplete entry is filtered out
    expect(body).not.toContain('dropped — no question');
  });

  it('omits FAQPage when the article has no faqs', async () => {
    state.result = { data: {
      id: UUID, slug: 'no-faq', title: 'No FAQ Article',
      content_html: '<p>Body.</p>', is_published: true,
    } };
    const { body } = await run('/blog/no-faq');
    expect(body).not.toContain('"@type":"FAQPage"');
  });

  it('returns a 404 with noindex when the article is missing', async () => {
    state.result = { data: null };
    const { status, body } = await run('/blog/does-not-exist');
    expect(status).toBe(404);
    expect(body).toContain('name="robots" content="noindex, follow"');
    expect(body).toContain('Article Not Found');
  });

  it('returns a 404 with noindex for an unpublished article', async () => {
    state.result = { data: { id: UUID, slug: 'draft', title: 'Draft', is_published: false } };
    const { status, body } = await run('/blog/draft');
    expect(status).toBe(404);
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

  it('returns a 404 with noindex for a sold/inactive listing', async () => {
    state.result = { data: { id: UUID, slug: 'sold-card', title: 'Sold Card', status: 'sold' } };
    const { status, body } = await run('/marketplace/' + UUID + '/sold-card');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
    expect(body).toContain('Listing Unavailable');
  });

  it('returns a 404 noindex doc for a non-UUID id', async () => {
    const { status, body } = await run('/marketplace/category/pokemon');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
    expect(body).toContain('CardPop Marketplace');
  });
});

describe('prerender shop products', () => {
  it('renders an in-stock product with Product + Offer JSON-LD', async () => {
    state.result = { data: {
      id: UUID, title: 'Pokémon Scarlet & Violet Booster Box', description: 'Factory sealed box.',
      price_aud: 199.99, stock_quantity: 5, category: 'Pokémon', product_type: 'sealed',
      images: ['https://cdn.test/box.jpg'], status: 'active',
    } };
    const { status, body } = await run('/product/shop/' + UUID + '/pokemon-box');
    expect(status).toBe(200);
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"priceCurrency":"AUD"');
    expect(body).toContain('schema.org/InStock');
    // canonical uses the slugified title, not the URL slug param
    expect(body).toContain('/product/shop/' + UUID + '/pokemon-scarlet-violet-booster-box');
  });

  it('marks a zero-stock product OutOfStock', async () => {
    state.result = { data: {
      id: UUID, title: 'Sold Out Box', price_aud: 50, stock_quantity: 0,
      product_type: 'sealed', status: 'active',
    } };
    const { body } = await run('/product/shop/' + UUID + '/sold-out');
    expect(body).toContain('schema.org/OutOfStock');
  });

  it('returns a 404 with noindex for an inactive product', async () => {
    state.result = { data: { id: UUID, title: 'Draft', status: 'draft' } };
    const { status, body } = await run('/product/shop/' + UUID + '/draft');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
    expect(body).toContain('Product Unavailable');
  });
});

describe('prerender landing pages', () => {
  it('renders the shop landing with a product ItemList', async () => {
    state.listResult = { data: [
      { id: UUID, title: 'Booster Box', price_aud: 199.99, images: ['https://cdn.test/a.jpg'] },
    ] };
    const { status, body } = await run('/shop');
    expect(status).toBe(200);
    expect(body).toContain('<title>The Shop | CardPop</title>');
    expect(body).toContain('"@type":"CollectionPage"');
    expect(body).toContain('"@type":"ItemList"');
    expect(body).toContain('Booster Box');
    expect(body).toContain('/product/shop/' + UUID + '/booster-box');
  });

  it('renders the marketplace landing with listing items', async () => {
    state.listResult = { data: [
      { id: UUID, slug: 'charizard', title: 'Charizard', price_aud: 1000, vault_item: { card_name: 'Charizard' } },
    ] };
    const { body } = await run('/marketplace');
    expect(body).toContain('Buy &amp; Sell Trading Cards Online Australia | CardPop Marketplace');
    expect(body).toContain('/marketplace/' + UUID + '/charizard');
    expect(body).toContain('"@type":"ItemList"');
  });

  it('renders an empty but valid landing when there are no items', async () => {
    state.listResult = { data: [] };
    const { body } = await run('/browse');
    expect(body).toContain('<title>Browse Listings | CardPop</title>');
    expect(body).toContain('No items available right now.');
    expect(body).not.toContain('noindex');
  });
});

describe('prerender events', () => {
  it('renders the events landing with an Event ItemList', async () => {
    state.listResult = { data: [
      { id: UUID, slug: 'melbourne-card-expo', title: 'Melbourne Card Expo', start_date: '2026-08-01', venue_name: 'Royal Exhibition Building', suburb: 'Carlton', state: 'VIC' },
    ] };
    const { status, body } = await run('/events');
    expect(status).toBe(200);
    expect(body).toContain('<title>Trading Card Events, Shows &amp; Expos in Australia | CardPop</title>');
    expect(body).toContain('"@type":"ItemList"');
    expect(body).toContain('Melbourne Card Expo');
    expect(body).toContain('/events/melbourne-card-expo');
    expect(body).not.toContain('noindex');
    // Every listed Event must carry the fields Google's rich-result report
    // checks, with fallbacks when the record is sparse.
    expect(body).toContain('"eventStatus":"https://schema.org/EventScheduled"');
    expect(body).toContain('"offers":{"@type":"Offer"');
    expect(body).toContain('"organizer":{"@type":"Organization","name":"CardPop"');
    expect(body).toContain('"performer":{"@type":"Organization"');
    expect(body).toContain('https://cardpop.com.au/og-image.jpg');
    expect(body).toContain('"description":"Melbourne Card Expo at Royal Exhibition Building, Carlton, VIC on 2026-08-01');
  });

  it('renders a category landing for a known slug', async () => {
    state.listResult = { data: [] };
    const { status, body } = await run('/events/card-shows');
    expect(status).toBe(200);
    expect(body).toContain('Trading Card Shows in Australia');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/events/card-shows" />');
    expect(body).not.toContain('noindex');
  });

  it('renders an individual event with Event JSON-LD and a self-canonical', async () => {
    state.result = { data: {
      id: UUID, slug: 'melbourne-card-expo', title: 'Melbourne Card Expo', status: 'approved',
      description: 'The biggest trading card expo in Victoria.', image_url: 'https://cdn.test/expo.jpg',
      venue_name: 'Royal Exhibition Building', address: '9 Nicholson St', suburb: 'Carlton', state: 'VIC', postcode: '3053',
      start_date: '2026-08-01', end_date: '2026-08-02', entry_fee_aud: 15, is_free: false, organizer_name: 'CardPop',
    } };
    const { status, body } = await run('/events/melbourne-card-expo');
    expect(status).toBe(200);
    expect(body).toContain('"@type":"Event"');
    expect(body).toContain('Melbourne Card Expo');
    expect(body).toContain('"addressRegion":"VIC"');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/events/melbourne-card-expo" />');
    expect(body).not.toContain('noindex');
  });

  it('always emits offers, image, organizer, eventStatus and description for a sparse event', async () => {
    state.result = { data: {
      id: UUID, slug: 'tiny-meetup', title: 'Tiny Meetup', status: 'approved',
      start_date: '2026-09-05',
    } };
    const { body } = await run('/events/tiny-meetup');
    expect(body).toContain('"eventStatus":"https://schema.org/EventScheduled"');
    expect(body).toContain('"offers":{"@type":"Offer","price":"0","priceCurrency":"AUD"');
    expect(body).toContain('"organizer":{"@type":"Organization","name":"CardPop"');
    expect(body).toContain('"performer":{"@type":"Organization","name":"CardPop"}');
    expect(body).toContain('"image":["https://cardpop.com.au/og-image.jpg"]');
    expect(body).toContain('"endDate":"2026-09-05"');
    expect(body).toContain('"description":"Tiny Meetup on 2026-09-05');
  });

  it('returns a 404 noindex document for an unknown event', async () => {
    state.result = { data: null };
    const { status, body } = await run('/events/does-not-exist');
    expect(status).toBe(404);
    expect(body).toContain('Event Not Found');
    expect(body).toContain('noindex');
  });
});

describe('prerender static content pages', () => {
  it('renders the grading hub with FAQ JSON-LD and chapter links', async () => {
    const { status, body } = await run('/grading');
    expect(status).toBe(200);
    expect(body).toContain('<title>Grading Hub | CardPop');
    expect(body).toContain('<h1>The Grading Handbook</h1>');
    expect(body).toContain('"@type":"FAQPage"');
    expect(body).toContain('"@type":"BreadcrumbList"');
    expect(body).toContain('href="https://cardpop.com.au/grading/what-is-grading"');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/grading" />');
    expect(body).not.toContain('noindex');
  });

  it('renders a legal page (returns) with its sections', async () => {
    const { status, body } = await run('/returns');
    expect(status).toBe(200);
    expect(body).toContain('<h1>Returns &amp; Refunds</h1>');
    expect(body).toContain('Platform fee retention on refunds');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/returns" />');
    expect(body).not.toContain('noindex');
  });

  it('reuses shared grader lists on submission-partners', async () => {
    const { body } = await run('/grading/submission-partners');
    expect(body).toContain('Card Grading Australia (CGA)');
    expect(body).toContain('How to submit');
  });

  it('escapes and renders the FAQ page questions', async () => {
    const { body } = await run('/faq');
    expect(body).toContain('How does the CardPop™ Vault work?');
    expect(body).toContain('"@type":"Question"');
  });

  it('renders the analytics page', async () => {
    const { status, body } = await run('/analytics');
    expect(status).toBe(200);
    expect(body).toContain('<h1>Card Market Analytics</h1>');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/analytics" />');
    expect(body).not.toContain('noindex');
  });
});

describe('prerender blog index', () => {
  it('lists recent articles and static topic categories', async () => {
    state.listResult = { data: [
      { slug: 'card-parallels', title: 'Understanding Parallels', excerpt: 'A guide.', author: 'CardPop', published_at: '2026-03-01T00:00:00.000Z' },
    ] };
    const { status, body } = await run('/blog');
    expect(status).toBe(200);
    expect(body).toContain('<title>The Parallel Report | CardPop</title>');
    expect(body).toContain('Explore by topic');
    expect(body).toContain('/blog/card-parallels');
    expect(body).toContain('/blog/category/grading-guides');
    expect(body).toContain('"@type":"ItemList"');
    expect(body).not.toContain('noindex');
  });
});

describe('prerender collections', () => {
  it('renders the collections index with links to every collection', async () => {
    const { status, body } = await run('/collections');
    expect(status).toBe(200);
    expect(body).toContain('<title>Trading Card Collections | CardPop</title>');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/collections" />');
    expect(body).toContain('/collections/pokemon');
    expect(body).toContain('/collections/nba');
    expect(body).toContain('"@type":"ItemList"');
    expect(body).not.toContain('noindex');
  });

  it('renders a collection page with SEO copy and listing links', async () => {
    state.listResult = { data: [
      { id: UUID, slug: 'charizard-base-set', title: 'Charizard Base Set', price_aud: 450, category: 'Pokemon', vault_item: { card_name: 'Charizard' } },
    ] };
    const { status, body } = await run('/collections/pokemon');
    expect(status).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/collections/pokemon" />');
    expect(body).toContain('Pokémon Cards for Sale in Australia');
    expect(body).toContain(`/marketplace/${UUID}/charizard-base-set`);
    expect(body).toContain('"@type":"CollectionPage"');
    expect(body).not.toContain('noindex');
  });

  it('canonicalises alias slugs to the primary collection URL', async () => {
    const { status, body } = await run('/collections/Pokemon');
    expect(status).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/collections/pokemon" />');
  });

  it('returns a 404 with noindex for an unknown collection', async () => {
    const { status, body } = await run('/collections/beyblades');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
  });
});

describe('prerender seller profiles', () => {
  it('renders a regular seller with a self-canonical and their listings', async () => {
    state.result = { data: {
      id: UUID, display_name: 'CardShark', bio: 'Collector since 1999.',
      rating: 4.8, reviews_count: 12, is_sole_trader: false, is_public: true,
    } };
    state.listResult = { data: [
      { id: UUID, slug: 'jordan-fleer', title: 'Jordan Fleer 1986', price_aud: 900, vault_item: { card_name: 'Michael Jordan' } },
    ] };
    const { status, body } = await run(`/seller/${UUID}`);
    expect(status).toBe(200);
    expect(body).toContain(`<link rel="canonical" href="https://cardpop.com.au/seller/${UUID}" />`);
    expect(body).toContain('CardShark');
    expect(body).toContain(`/marketplace/${UUID}/jordan-fleer`);
    expect(body).not.toContain('noindex');
  });

  it('canonicalises sole traders to their dealer store page', async () => {
    state.result = { data: {
      id: UUID, display_name: 'Poke Den', business_name: 'Poke Den',
      store_slug: 'poke-den', is_sole_trader: true, is_public: true,
    } };
    const { status, body } = await run(`/seller/${UUID}`);
    expect(status).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/dealer/poke-den" />');
    expect(body).not.toContain('noindex');
  });

  it('returns a 404 with noindex for a missing or private profile', async () => {
    state.result = { data: null };
    const { status, body } = await run(`/seller/${UUID}`);
    expect(status).toBe(404);
    expect(body).toContain('noindex');

    state.result = { data: { id: UUID, display_name: 'Hidden', is_public: false } };
    const { status: privateStatus, body: privateBody } = await run(`/seller/${UUID}`);
    expect(privateStatus).toBe(404);
    expect(privateBody).toContain('noindex');
  });

  it('returns a 404 noindex doc for a non-UUID seller id', async () => {
    const { status, body } = await run('/seller/not-a-uuid');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
  });
});

describe('prerender blog category pages', () => {
  it('renders a known category with its articles and a self-canonical', async () => {
    state.listResult = { data: [
      { slug: 'first-binder', id: UUID, title: 'Your First Binder', excerpt: 'Where to start.', author: 'CardPop Research', published_at: '2026-06-01T00:00:00.000Z' },
    ] };
    const { status, body } = await run('/blog/category/beginner-guides');
    expect(status).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/blog/category/beginner-guides" />');
    expect(body).toContain('<h1>Beginner Guides</h1>');
    expect(body).toContain('/blog/first-binder');
    expect(body).toContain('"@type":"ItemList"');
    expect(body).not.toContain('noindex');
  });

  it('links the other categories from a category page', async () => {
    const { body } = await run('/blog/category/beginner-guides');
    expect(body).toContain('/blog/category/investing-value');
    expect(body).not.toContain('href="https://cardpop.com.au/blog/category/beginner-guides">Beginner');
  });

  it('returns a 404 with noindex for an unknown category', async () => {
    const { status, body } = await run('/blog/category/knitting');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
    expect(body).toContain('Category Not Found');
  });
});

describe('prerender unknown paths', () => {
  it('returns a 404 with noindex instead of a 200 shell', async () => {
    const { status, body } = await run('/definitely/not/a/page');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
    expect(body).toContain('Page Not Found');
  });
});

describe('prerender whatnot page', () => {
  it('renders the whatnot static page for bots', async () => {
    const { status, body } = await run('/community/whatnot');
    expect(status).toBe(200);
    expect(body).toContain('<title>Whatnot Shows | CardPop Community</title>');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/community/whatnot" />');
    expect(body).not.toContain('noindex');
  });
});
