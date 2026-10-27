import { vi, describe, it, expect, beforeEach } from 'vitest';

// The prerender function builds its own Supabase client from @supabase/supabase-js,
// so we mock that module and feed per-table results through a chainable builder.
const state = vi.hoisted(() => ({ result: { data: null }, listResult: { data: [] }, listResultByTable: null, publicUrl: 'https://cdn.test/img.jpg' }));

vi.mock('@supabase/supabase-js', () => {
  const builder = (table) => {
    // Single-row fetches end in .maybeSingle()/.single() → state.result.
    // List fetches await the chain itself (thenable) → state.listResult, or
    // state.listResultByTable[table] when a test needs per-table answers.
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      neq: vi.fn(() => b),
      in: vi.fn(() => b),
      gt: vi.fn(() => b),
      gte: vi.fn(() => b),
      like: vi.fn(() => b),
      ilike: vi.fn(() => b),
      not: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve(state.result)),
      single: vi.fn(() => Promise.resolve(state.result)),
      then: (resolve, reject) => Promise.resolve(state.listResultByTable?.[table] ?? state.listResult).then(resolve, reject),
    };
    return b;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table) => builder(table)),
      storage: { from: vi.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: state.publicUrl } }) })) },
    })),
  };
});

import handler from '../../api/prerender.js';
import { BINDER_SLUGS } from '../../data/shopBinderProducts.js';
import { PALMS_OFF_PRODUCTS } from '../../data/palmsOffCatalogue.js';
import { PALMS_OFF_CATEGORIES } from '../../data/palmsOffCategories.js';

function run(path, query = {}) {
  const req = { query: { path, ...query } };
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

beforeEach(() => { state.result = { data: null }; state.listResult = { data: [] }; state.listResultByTable = null; });

describe('prerender blog articles', () => {
  it('renders an article with its title, description and featured image', async () => {
    state.result = { data: {
      id: UUID, slug: 'parallels-guide', title: 'Understanding Card Parallels',
      seo_description: 'A complete guide to parallels.', excerpt: 'Excerpt here',
      content_html: '<h2>Intro</h2><p>Parallels are alternate versions.</p>',
      featured_image_url: 'https://cdn.test/hero.jpg', author: 'CardPop Research',
      category: 'investing-value', published_at: '2026-01-02T00:00:00.000Z',
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
      author: 'CardPop Research', category: 'investing-value',
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
      // Real row shape: the card's details live on the vault item, never on
      // the listing (which has no title/description/images columns).
      id: UUID, slug: 'charizard-base-set', price_aud: 1499.95, status: 'active',
      grading_company: 'PSA', accepts_offers: true,
      vault_item: {
        card_name: 'Charizard', set_name: 'Base Set', year: 1999,
        condition: 'Near Mint', grade: '9', grading_company: 'PSA',
        vault_images: [{ storage_path: 'https://cdn.test/charizard.jpg' }],
      },
      seller: { username: 'ash', store_slug: 'ash-cards', display_name: 'Ash Cards' },
    } };
    const { status, body } = await run('/marketplace/' + UUID + '/charizard-base-set');
    expect(status).toBe(200);
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"priceCurrency":"AUD"');
    expect(body).toContain('"price":"1499.95"');
    expect(body).toContain('schema.org/InStock');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/marketplace/' + UUID + '/charizard-base-set" />');
    expect(body).toContain('<h1>Charizard</h1>');
    expect(body).toContain('Base Set · 1999');
    expect(body).toContain('Grade: PSA 9');
  });

  it('gives the card a brand and MPN so Merchant listings has a global identifier', async () => {
    state.result = { data: {
      id: UUID, slug: 'charizard-base-set', price_aud: 1499.95, status: 'active',
      vault_item: { card_name: 'Charizard', collection: 'pokemon', set_name: 'Base Set', card_number: '4/102', year: 1999 },
      seller: { username: 'ash' },
    } };
    const { body } = await run('/marketplace/' + UUID + '/charizard-base-set');
    expect(body).toContain('"brand":{"@type":"Brand","name":"Pokémon"}');
    expect(body).toContain('"mpn":"Base Set 4/102"');
    expect(body).toContain('"sku":"4/102"');
  });

  it('falls back to the vault item\'s franchise or category row for the brand', async () => {
    state.result = { data: {
      id: UUID, slug: 'lebron', price_aud: 250, status: 'active',
      vault_item: { card_name: 'LeBron James', collection: '', franchise: { name: 'NBA Basketball' }, category: { name: 'Sports' } },
      seller: { username: 'kat' },
    } };
    const { body } = await run('/marketplace/' + UUID + '/lebron');
    expect(body).toContain('"brand":{"@type":"Brand","name":"NBA"}');
  });

  it('never invents an identifier for a card with no franchise or number', async () => {
    state.result = { data: {
      id: UUID, slug: 'mystery', price_aud: 20, status: 'active',
      vault_item: { card_name: 'Mystery Card' },
      seller: { username: 'ash' },
    } };
    const { body } = await run('/marketplace/' + UUID + '/mystery');
    expect(body).toContain('"@type":"Product"');
    expect(body).not.toContain('"brand"');
    expect(body).not.toContain('"mpn"');
  });

  it('renders a sold listing as a real page marked SoldOut', async () => {
    // A sold card stays on the site — visible, marked Sold, not purchasable —
    // so its page has genuine content and must not be a 404 (or a soft 404).
    state.result = { data: {
      id: UUID, slug: 'sold-card', price_aud: 400, status: 'sold',
      accepts_offers: true,
      vault_item: { card_name: 'Victor Wembanyama', set_name: 'Topps Chrome', year: 2023 },
      seller: { username: 'kat', display_name: 'Kat' },
    } };
    const { status, body } = await run('/marketplace/' + UUID + '/sold-card');
    expect(status).toBe(200);
    expect(body).not.toContain('noindex');
    expect(body).toContain('schema.org/SoldOut');
    expect(body).not.toContain('schema.org/InStock');
    expect(body).toContain('(Sold)');
    expect(body).toContain('no longer available for purchase');
    // A sold listing never advertises that it takes offers.
    expect(body).not.toContain('offers accepted');
  });

  it('gives an Expression of Interest listing an AggregateOffer from its offer range', async () => {
    state.result = { data: {
      id: UUID, slug: 'eoi-card', price_aud: null, price_min_aud: 250, price_max_aud: null,
      status: 'active', accepts_offers: true,
      vault_item: { card_name: 'Pikachu Illustrator' },
      seller: { username: 'ash' },
    } };
    const { body } = await run('/marketplace/' + UUID + '/eoi-card');
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"@type":"AggregateOffer"');
    expect(body).toContain('"lowPrice":"250.00"');
    expect(body).not.toContain('"highPrice"');
  });

  it('emits no Product for a listing with neither a price nor an offer range', async () => {
    state.result = { data: {
      id: UUID, slug: 'trade-card', price_aud: null, status: 'active',
      vault_item: { card_name: 'Trade Only' }, seller: { username: 'ash' },
    } };
    const { status, body } = await run('/marketplace/' + UUID + '/trade-card');
    expect(status).toBe(200);
    expect(body).not.toContain('"@type":"Product"');
    expect(body).toContain('"@type":"BreadcrumbList"');
  });

  it('returns a 404 with noindex for an archived listing', async () => {
    state.result = { data: { id: UUID, slug: 'gone-card', title: 'Gone Card', status: 'archived' } };
    const { status, body } = await run('/marketplace/' + UUID + '/gone-card');
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

  it('emits brand, sku, mpn and gtin so Merchant listings has a global identifier', async () => {
    state.result = { data: {
      id: UUID, title: 'Zip Binder', sku: 'ZB-04-BLK', brand: 'Palms Off Gaming', barcode: '1209202001436',
      price_aud: 30, stock_quantity: 5, product_type: 'supplies', status: 'active',
    } };
    const { body } = await run('/product/shop/' + UUID + '/zip-binder');
    expect(body).toContain('"brand":{"@type":"Brand","name":"Palms Off Gaming"}');
    expect(body).toContain('"sku":"ZB-04-BLK"');
    expect(body).toContain('"mpn":"ZB-04-BLK"');
    expect(body).toContain('"gtin":"1209202001436"');
  });

  it('brands a house product CardPop and drops a barcode that is not a GTIN', async () => {
    state.result = { data: {
      id: UUID, title: 'Penny Sleeves', sku: 'CP-PENNY-SLEEVES', brand: null, barcode: 'n/a',
      price_aud: 4, stock_quantity: 5, product_type: 'supplies', status: 'active',
    } };
    const { body } = await run('/product/shop/' + UUID + '/penny-sleeves');
    expect(body).toContain('"brand":{"@type":"Brand","name":"CardPop"}');
    expect(body).toContain('"mpn":"CP-PENNY-SLEEVES"');
    expect(body).not.toContain('"gtin"');
  });

  it('adds aggregateRating and review JSON-LD when the product has published reviews', async () => {
    // The mock answers every single-row query with state.result, so the one
    // object doubles as the product row and its review_stats row.
    state.result = { data: {
      id: UUID, title: 'Zip Binder', price_aud: 30, stock_quantity: 5, product_type: 'supplies', status: 'active',
      review_count: 3, average_rating: 4.67,
    } };
    state.listResult = { data: [
      { rating: 5, title: 'Great', body: 'Holds heaps', reviewer_name: 'Sam', created_at: '2026-10-01T00:00:00Z' },
    ] };
    const { body } = await run('/product/shop/' + UUID + '/zip-binder');
    expect(body).toContain('"@type":"AggregateRating"');
    expect(body).toContain('"ratingValue":"4.7"');
    expect(body).toContain('"reviewCount":3');
    expect(body).toContain('"@type":"Review"');
  });

  it('keeps an unpriced product as a Product when it has published reviews', async () => {
    // aggregateRating alone satisfies Google's offers/review/aggregateRating rule.
    state.result = { data: {
      id: UUID, title: 'Zip Binder', price_aud: 0, stock_quantity: 0, product_type: 'supplies', status: 'active',
      review_count: 2, average_rating: 5,
    } };
    state.listResult = { data: [
      { rating: 5, title: 'Great', body: 'Holds heaps', reviewer_name: 'Sam', created_at: '2026-10-01T00:00:00Z' },
    ] };
    const { body } = await run('/product/shop/' + UUID + '/zip-binder');
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"@type":"AggregateRating"');
    expect(body).not.toContain('"@type":"Offer"');
  });

  it('emits no Product for an unpriced product without reviews', async () => {
    state.result = { data: {
      id: UUID, title: 'Zip Binder', price_aud: 0, stock_quantity: 0, product_type: 'supplies', status: 'active',
    } };
    const { body } = await run('/product/shop/' + UUID + '/zip-binder');
    expect(body).not.toContain('"@type":"Product"');
  });

  it('emits no rating markup for a product without reviews', async () => {
    state.result = { data: {
      id: UUID, title: 'Zip Binder', price_aud: 30, stock_quantity: 5, product_type: 'supplies', status: 'active',
    } };
    const { body } = await run('/product/shop/' + UUID + '/zip-binder');
    expect(body).not.toContain('AggregateRating');
  });

  it('renders each description paragraph and uses the first as the meta description', async () => {
    state.result = { data: {
      id: UUID, title: 'Penny Sleeves - 100 Pack', price_aud: 4, stock_quantity: 5,
      description: 'Soft sleeves for everyday storage.\n\nSlide the card in head first.\n\nPair with a top loader.',
      product_type: 'supplies', status: 'active',
    } };
    const { body } = await run('/product/shop/' + UUID + '/penny-sleeves');
    expect(body).toContain('<p>Soft sleeves for everyday storage.</p>');
    expect(body).toContain('<p>Pair with a top loader.</p>');
    expect(body).toContain('<meta name="description" content="Soft sleeves for everyday storage."');
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

  it('301s a legacy /product/shop/:id URL onto /shop/<category>/<slug>', async () => {
    state.result = { data: {
      id: UUID, title: 'Penny Sleeves 100 Pack', slug: 'penny-sleeves-100-pack',
      category: 'Penny Sleeves', price_aud: 4.95, stock_quantity: 10, status: 'active',
    } };
    const { status, headers } = await run('/product/shop/' + UUID + '/penny-sleeves-100-pack');
    expect(status).toBe(301);
    expect(headers.Location).toBe('https://cardpop.com.au/shop/penny-sleeves/penny-sleeves-100-pack');
  });

  it('301s a colour sibling onto its line page with the colour preselected', async () => {
    state.result = { data: {
      id: UUID, title: 'Zip Binder — Blue', slug: 'palms-off-gaming-stealth-12-pocket-zip-binder-blue',
      family_sku: 'STL-12', colour: 'Blue', category: 'Binders', status: 'coming_soon',
    } };
    const { status, headers } = await run('/product/shop/' + UUID);
    expect(status).toBe(301);
    expect(headers.Location).toBe('https://cardpop.com.au/shop/binders/palms-off-gaming-stealth-12-pocket-zip-binder?colour=blue');
  });

  it('renders a house product at /shop/<category>/<slug> with that canonical', async () => {
    state.listResult = { data: [{ id: UUID, slug: 'penny-sleeves-100-pack', category: 'Penny Sleeves', status: 'active' }] };
    state.result = { data: {
      id: UUID, title: 'Penny Sleeves 100 Pack', slug: 'penny-sleeves-100-pack',
      category: 'Penny Sleeves', price_aud: 4.95, stock_quantity: 10, status: 'active',
    } };
    const { status, body } = await run('/shop/penny-sleeves/penny-sleeves-100-pack');
    expect(status).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/shop/penny-sleeves/penny-sleeves-100-pack"');
    expect(body).toContain('/shop/category/penny-sleeves');
  });

  it('301s a house product reached under the wrong category', async () => {
    state.listResult = { data: [{ id: UUID, slug: 'penny-sleeves-100-pack', category: 'Penny Sleeves', status: 'active' }] };
    const { status, headers } = await run('/shop/top-loaders/penny-sleeves-100-pack');
    expect(status).toBe(301);
    expect(headers.Location).toBe('https://cardpop.com.au/shop/penny-sleeves/penny-sleeves-100-pack');
  });

  it('serves a house binder at /shop/binders/<slug>', async () => {
    state.listResult = { data: [{ id: UUID, slug: '12-pocket-premium-binder', category: 'Binders', status: 'active' }] };
    state.result = { data: {
      id: UUID, title: '12-Pocket Premium Binder', slug: '12-pocket-premium-binder',
      category: 'Binders', price_aud: 39.95, stock_quantity: 3, status: 'active',
    } };
    const { status, body } = await run('/shop/binders/12-pocket-premium-binder');
    expect(status).toBe(200);
    expect(body).toContain('https://cardpop.com.au/shop/binders/12-pocket-premium-binder');
  });

  it('301s a renamed house product from its old slug to its current URL', async () => {
    state.listResultByTable = {
      shop_products: { data: [] },
      shop_product_slug_redirects: { data: [{
        old_slug: 'binder-12-pocket-premium',
        product: { id: UUID, slug: '12-pocket-premium-binder', category: 'Binders', colour: null, family_sku: null, status: 'active' },
      }] },
    };
    const { status, headers } = await run('/shop/binders/binder-12-pocket-premium');
    expect(status).toBe(301);
    expect(headers.Location).toBe('https://cardpop.com.au/shop/binders/12-pocket-premium-binder');
  });

  it('301s an old colour-line slug onto the renamed line, keeping the chosen colour', async () => {
    const sibling = (colour) => ({
      old_slug: `palms-off-gaming-playmat-${colour.toLowerCase()}`,
      product: { id: UUID, slug: `palms-off-gaming-core-playmat-${colour.toLowerCase()}`, category: 'Playmats', colour, family_sku: 'PM-ST', status: 'active' },
    });
    state.listResultByTable = {
      shop_products: { data: [] },
      shop_product_slug_redirects: { data: [sibling('Black'), sibling('Pink')] },
    };
    const withColour = await run('/shop/playmats/palms-off-gaming-playmat', { colour: 'pink' });
    expect(withColour.status).toBe(301);
    expect(withColour.headers.Location).toBe('https://cardpop.com.au/shop/playmats/palms-off-gaming-core-playmat?colour=pink');

    const bare = await run('/shop/playmats/palms-off-gaming-playmat');
    expect(bare.status).toBe(301);
    expect(bare.headers.Location).toBe('https://cardpop.com.au/shop/playmats/palms-off-gaming-core-playmat');
  });

  it('404s an unknown shop product slug that has no redirect', async () => {
    state.listResultByTable = { shop_products: { data: [] }, shop_product_slug_redirects: { data: [] } };
    const { status } = await run('/shop/binders/no-such-binder');
    expect(status).not.toBe(301);
  });
});

describe('prerender shop category pages', () => {
  it('renders a built-in category with its products, breadcrumb and self-canonical', async () => {
    state.listResult = { data: [
      { id: UUID, title: 'Ultra Pro Penny Sleeves (100)', slug: 'ultra-pro-penny-sleeves', category: 'Penny Sleeves', price_aud: 2.5 },
    ] };
    const { status, body } = await run('/shop/category/penny-sleeves');
    expect(status).toBe(200);
    expect(body).toContain('<h1>Penny Sleeves</h1>');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/shop/category/penny-sleeves" />');
    expect(body).toContain('Ultra Pro Penny Sleeves (100)');
    expect(body).toContain('"@type":"BreadcrumbList"');
    expect(body).toContain('https://cardpop.com.au/shop/protection');
    expect(body).not.toContain('noindex');
  });

  it('serves an empty category but keeps it out of the index', async () => {
    state.listResult = { data: [] };
    const { status, body } = await run('/shop/category/top-loaders');
    expect(status).toBe(200);
    expect(body).toContain('<h1>Top Loaders</h1>');
    expect(body).toContain('noindex');
  });

  it('serves a category an admin added', async () => {
    state.listResult = { data: [{ section_slug: 'storage', name: 'Card Tins', hidden: false }] };
    const { status, body } = await run('/shop/category/card-tins');
    expect(status).toBe(200);
    expect(body).toContain('<h1>Card Tins</h1>');
    expect(body).toContain('https://cardpop.com.au/shop/storage');
  });

  it('does not claim a category an admin hid', async () => {
    state.listResult = { data: [{ section_slug: 'protection', name: 'Penny Sleeves', hidden: true }] };
    const { body } = await run('/shop/category/penny-sleeves');
    expect(body).not.toContain('<h1>Penny Sleeves</h1>');
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
    const { body } = await run('/marketplace');
    expect(body).toContain('<title>Buy &amp; Sell Trading Cards Online Australia | CardPop Marketplace</title>');
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

  it('emits GA and presale offers when the event has both prices', async () => {
    state.result = { data: {
      id: UUID, slug: 'presale-show', title: 'Presale Show', status: 'approved',
      start_date: '2026-10-01', entry_fee_aud: 15, presale_fee_aud: 25, is_free: false,
    } };
    const { body } = await run('/events/presale-show');
    expect(body).toContain('"offers":[{');
    expect(body).toContain('"price":"15.00"');
    expect(body).toContain('"name":"General admission"');
    expect(body).toContain('"price":"25.00"');
    expect(body).toContain('"name":"Presale / early bird"');
  });

  it('emits the presale offer alone when the GA price is unpublished', async () => {
    state.result = { data: {
      id: UUID, slug: 'presale-only', title: 'Presale Only Show', status: 'approved',
      start_date: '2026-10-01', entry_fee_aud: 0, presale_fee_aud: 40, is_free: false,
    } };
    const { body } = await run('/events/presale-only');
    expect(body).toContain('"offers":{"@type":"Offer","price":"40.00"');
    expect(body).toContain('"name":"Presale / early bird"');
  });

  it('emits an offer and a body line per extra ticket price', async () => {
    state.result = { data: {
      id: UUID, slug: 'tiered-show', title: 'Tiered Show', status: 'approved',
      start_date: '2026-10-01', entry_fee_aud: 15, is_free: false,
      ticket_prices: [{ type: 'vip', price_aud: 60 }, { type: 'group', group_size: 4, price_aud: 50 }],
    } };
    const { body } = await run('/events/tiered-show');
    expect(body).toContain('"name":"General admission"');
    expect(body).toContain('"name":"VIP ticket"');
    expect(body).toContain('"price":"60.00"');
    expect(body).toContain('"name":"Group ticket (4 people)"');
    expect(body).toContain('<li>Group of 4: $50.00</li>');
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
    expect(body).toContain('What you get back');
    expect(body).toContain('refunded in full');
    expect(body).toContain('CardPop Shop returns &amp; exchanges (new products)');
    expect(body).toContain('Return window: 14 days');
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

  it('canonicalises PAID sole traders to their dealer store page', async () => {
    state.result = { data: {
      id: UUID, display_name: 'Poke Den', business_name: 'Poke Den',
      store_slug: 'poke-den', is_sole_trader: true, is_public: true,
      subscription_tier: 'pro', subscription_status: 'active',
    } };
    const { status, body } = await run(`/seller/${UUID}`);
    expect(status).toBe(200);
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/dealer/poke-den" />');
    expect(body).not.toContain('noindex');
  });

  it('keeps /seller canonical for a Hobby (free) sole trader — no live store page', async () => {
    state.result = { data: {
      id: UUID, display_name: 'Poke Den', business_name: 'Poke Den',
      store_slug: 'poke-den', is_sole_trader: true, is_public: true,
      subscription_tier: 'free', subscription_status: 'none',
    } };
    const { status, body } = await run(`/seller/${UUID}`);
    expect(status).toBe(200);
    expect(body).toContain(`<link rel="canonical" href="https://cardpop.com.au/seller/${UUID}" />`);
    expect(body).not.toContain('/dealer/poke-den');
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

  // A malformed %-escape makes decodeURIComponent throw. That must resolve to
  // the honest 404 for a broken URL, NOT the transient 503 "try again later"
  // that tells crawlers to keep the URL indexed and retry it forever.
  it.each([
    '/shop/%',
    '/marketplace/%ZZ',
    '/seller/%E0%A4%A',
    '/collections/%C3',
  ])('returns 404 (not 503) for a malformed path %s', async (path) => {
    const { status } = await run(path);
    expect(status).toBe(404);
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

describe('prerender Palms Off Gaming binders', () => {
  const SLUG = 'palms-off-gaming-collectors-series-4-pocket-zip-binder';

  it('renders the binder hub, not the shop-collection handler', async () => {
    // /shop/binders is a single segment after /shop, so it matches the
    // shop-collection regex too. The binder check has to win, or the hub
    // resolves as an unknown supply group.
    const { status, body } = await run('/shop/binders');
    expect(status).toBe(200);
    expect(body).toContain('<h1>Palms Off Gaming Binders</h1>');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/shop/binders" />');
    expect(body).toContain('"@type":"ItemList"');
    expect(body).not.toContain('noindex');
  });

  it('links every binder product from the hub', async () => {
    const { body } = await run('/shop/binders');
    for (const slug of BINDER_SLUGS) {
      expect(body).toContain(`https://cardpop.com.au/shop/binders/${slug}`);
    }
  });

  it('renders a product page with Product, Breadcrumb and FAQ JSON-LD', async () => {
    state.result = { data: { price_aud: 49.95, retail_price_aud: null, stock_quantity: 12, status: 'active' } };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain(`<link rel="canonical" href="https://cardpop.com.au/shop/binders/${SLUG}" />`);
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"sku":"ZB-04"');
    expect(body).toContain('"name":"Palms Off Gaming"');
    expect(body).toContain('"@type":"FAQPage"');
    expect(body).toContain('"@type":"BreadcrumbList"');
  });

  it('emits an Offer with the live price and stock when the product is active', async () => {
    state.result = { data: { price_aud: 49.95, retail_price_aud: null, stock_quantity: 12, status: 'active' } };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('"price":"49.95"');
    expect(body).toContain('"priceCurrency":"AUD"');
    expect(body).toContain('https://schema.org/InStock');
    expect(body).not.toContain('noindex');
  });

  it('marks the product out of stock when stock is zero', async () => {
    state.result = { data: { price_aud: 49.95, retail_price_aud: null, stock_quantity: 0, status: 'active' } };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('https://schema.org/OutOfStock');
  });

  it('stays indexable with an Enquire now CTA when the product has no price', async () => {
    // Enquiry-only: seeded rows are draft with no price, but the page is still
    // complete — so it is indexed, just without an Offer it cannot honour.
    state.result = { data: { price_aud: 0, retail_price_aud: null, stock_quantity: 0, status: 'draft' } };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).not.toContain('noindex');
    expect(body).not.toContain('"@type":"Offer"');
    // Google rejects a Product with no offers/review/aggregateRating.
    expect(body).not.toContain('"@type":"Product"');
    expect(body).toContain('https://cardpop.com.au/signup');
    expect(body).toContain('Enquire now');
    expect(body).toContain('Why collectors pick this binder');
  });

  it('shows RRP without an Offer when only a retail price is known', async () => {
    state.result = { data: { price_aud: 0, retail_price_aud: 59.95, stock_quantity: 0, status: 'draft' } };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('RRP A$59.95');
    expect(body).not.toContain('"@type":"Offer"');
  });

  it('prices a colour family from its public siblings when the line row is archived', async () => {
    // After the colour split the slug row is archived (not returned); the
    // family siblings carry the live price/stock.
    state.result = { data: null };
    state.listResult = { data: [
      { price_aud: 54.95, retail_price_aud: 64.95, stock_quantity: 0, status: 'active' },
      { price_aud: 49.95, retail_price_aud: 64.95, stock_quantity: 3, status: 'active' },
    ] };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('"@type":"Offer"');
    expect(body).toContain('"price":"49.95"');
    expect(body).toContain('https://schema.org/InStock');
  });

  it('carries the priced colour\'s barcode as the gtin, with the SKU as mpn', async () => {
    state.result = { data: null };
    state.listResult = { data: [
      { price_aud: 54.95, retail_price_aud: null, stock_quantity: 2, status: 'active', barcode: '1209202001450' },
      { price_aud: 49.95, retail_price_aud: null, stock_quantity: 3, status: 'active', barcode: '1209202001436' },
    ] };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('"price":"49.95"');
    expect(body).toContain('"gtin":"1209202001436"');
    expect(body).toContain('"brand":{"@type":"Brand","name":"Palms Off Gaming"}');
    expect(body).toMatch(/"mpn":"[A-Z0-9-]+"/);
  });

  it('marks a family of only pre-order siblings as PreOrder', async () => {
    state.listResult = { data: [
      { price_aud: 49.95, retail_price_aud: null, stock_quantity: 0, status: 'preorder' },
      { price_aud: 49.95, retail_price_aud: null, stock_quantity: 0, status: 'active' },
    ] };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('https://schema.org/PreOrder');
  });

  it('marks a family with no purchasable stock out of stock', async () => {
    state.listResult = { data: [
      { price_aud: 49.95, retail_price_aud: null, stock_quantity: 0, status: 'active' },
    ] };
    const { body } = await run(`/shop/binders/${SLUG}`);
    expect(body).toContain('https://schema.org/OutOfStock');
  });

  it('404s an unknown binder slug', async () => {
    const { status, body } = await run('/shop/binders/not-a-real-binder');
    expect(status).toBe(404);
    expect(body).toContain('noindex');
  });
});

describe('prerender Palms Off Gaming products', () => {
  // These products live in the shop's normal product-type taxonomy, so their
  // URLs carry no brand segment: /shop/<type>/<product>.
  const CAT = 'top-loaders';
  const SLUG = 'palms-off-gaming-top-loaders-35pt';

  it('renders an unpriced product page with Breadcrumb and FAQ JSON-LD but no Product', async () => {
    state.result = { data: { price_aud: 0, retail_price_aud: null, stock_quantity: 0, status: 'draft' } };
    const { status, body } = await run(`/shop/${CAT}/${SLUG}`);
    expect(status).toBe(200);
    expect(body).toContain(`<link rel="canonical" href="https://cardpop.com.au/shop/${CAT}/${SLUG}" />`);
    // Google rejects a Product with no offers/review/aggregateRating.
    expect(body).not.toContain('"@type":"Product"');
    expect(body).toContain('"@type":"BreadcrumbList"');
    expect(body).toContain('"@type":"FAQPage"');
    expect(body).toContain('Enquire now');
    expect(body).not.toContain('"@type":"Offer"');
    expect(body).not.toContain('noindex');
  });

  it('breadcrumbs to the existing category page, with no brand level', async () => {
    state.result = { data: null };
    const { body } = await run(`/shop/${CAT}/${SLUG}`);
    expect(body).toContain(`https://cardpop.com.au/shop/category/${CAT}`);
    expect(body).not.toContain('palms-off-gaming/');
  });

  it('emits an Offer once the product is priced and active', async () => {
    state.result = { data: { price_aud: 12.5, retail_price_aud: null, stock_quantity: 6, status: 'active' } };
    const { body } = await run(`/shop/${CAT}/${SLUG}`);
    expect(body).toContain('"@type":"Product"');
    expect(body).toContain('"name":"Palms Off Gaming"');
    expect(body).toContain('"price":"12.50"');
    expect(body).toContain('https://schema.org/InStock');
  });

  it('404s a real product reached through the wrong product type', async () => {
    const { status } = await run(`/shop/playmats/${SLUG}`);
    expect(status).toBe(404);
  });

  it('does not claim /shop/category/<slug>, which is the category page', async () => {
    // Both are two-segment /shop/ paths; the product matcher must not swallow
    // the category listing.
    const { body } = await run('/shop/category/top-loaders');
    expect(body).not.toContain('"@type":"Product"');
  });

  it('every catalogue product resolves under its own product type', async () => {
    for (const p of PALMS_OFF_PRODUCTS) {
      state.result = { data: null };
      const { status } = await run(`/shop/${p.categorySlug}/${p.slug}`);
      expect(status, `${p.categorySlug}/${p.slug}`).toBe(200);
    }
  });

  it('assigns every product to a real leaf category in the shop taxonomy', () => {
    for (const p of PALMS_OFF_PRODUCTS) {
      expect(PALMS_OFF_CATEGORIES[p.categorySlug], p.slug).toBeTruthy();
      expect(PALMS_OFF_CATEGORIES[p.categorySlug].name).toBe(p.categoryName);
    }
  });
});

describe('Palms Off Gaming per-product copy', () => {
  it('every product has its own description, intro and highlights', () => {
    for (const p of PALMS_OFF_PRODUCTS) {
      expect(p.metaDescription, p.sku).toBeTruthy();
      expect(p.intro, p.sku).toBeTruthy();
      expect(p.highlights?.length, p.sku).toBeGreaterThan(0);
    }
  });

  it('no two products share an intro or a meta description', () => {
    // The whole point of per-product copy is that sibling pages stop being
    // reworded duplicates of each other — 10 top loaders differing only by a
    // point rating is exactly the thin-content shape this guards against.
    for (const field of ['intro', 'metaDescription']) {
      const seen = new Map();
      for (const p of PALMS_OFF_PRODUCTS) {
        const prev = seen.get(p[field]);
        expect(prev, `${field} duplicated between ${prev} and ${p.sku}`).toBeUndefined();
        seen.set(p[field], p.sku);
      }
    }
  });

  it('keeps meta descriptions within the length search engines display', () => {
    for (const p of PALMS_OFF_PRODUCTS) {
      expect(p.metaDescription.length, `${p.sku} too long`).toBeLessThanOrEqual(165);
      expect(p.metaDescription.length, `${p.sku} too short`).toBeGreaterThanOrEqual(80);
    }
  });

  it('renders the product copy, not the product type fallback', async () => {
    const product = PALMS_OFF_PRODUCTS.find((p) => p.sku === 'TL-35PT');
    state.result = { data: null };
    const { body } = await run(`/shop/${product.categorySlug}/${product.slug}`);
    expect(body).toContain('These are the top loaders for ordinary cards');
    expect(body).toContain('Why collectors pick this one');
    // The long-form About section and the verified spec rows render too.
    expect(body).toContain(`<h2>About the ${product.shortTitle}</h2>`);
    expect(body).toContain('<dt>Internal size</dt><dd>70 × 98 mm</dd>');
    // The type-level intro must not also appear — one page, one description.
    expect(body).not.toContain('A top loader is the rigid sleeve that turns a card');
  });

  it('still serves the shared FAQs from the product type', async () => {
    const product = PALMS_OFF_PRODUCTS.find((p) => p.sku === 'TL-35PT');
    state.result = { data: null };
    const { body } = await run(`/shop/${product.categorySlug}/${product.slug}`);
    expect(body).toContain('"@type":"FAQPage"');
    expect(body).toContain('Point rating is the card');
  });

  it('puts the product description in the meta tag and JSON-LD', async () => {
    const product = PALMS_OFF_PRODUCTS.find((p) => p.sku === 'MAG-180PT');
    // Priced, so the Product JSON-LD (which carries the description) is emitted.
    state.result = { data: { price_aud: 9.95, retail_price_aud: null, stock_quantity: 4, status: 'active' } };
    const { body } = await run(`/shop/${product.categorySlug}/${product.slug}`);
    expect(body).toContain(`<meta name="description" content="${product.metaDescription}"`);
    expect(body).toContain(`"description":"${product.metaDescription}"`);
  });
});

describe('prerender homepage', () => {
  it('gives crawlers the full homepage, not just the hero', async () => {
    state.listResultByTable = {
      listings: { data: [
        { id: 'l1', slug: 'charizard-base-set-psa-9', price_aud: 1250, vault_item: { card_name: 'Charizard Base Set', collection: 'Pokémon' } },
      ] },
      blog_articles: { data: [
        { slug: 'nrl-rookie-cards-price-check-2026', title: 'What NRL rookie cards are actually selling for', excerpt: 'A price check.', author: 'CardPop Research', published_at: '2026-08-03T00:00:00.000Z' },
      ] },
      events: { data: [
        { id: 'e1', slug: 'melbourne-card-show', title: 'Melbourne Card Show', short_description: 'Vendors and trading.', venue_name: 'Showgrounds', suburb: 'Ascot Vale', state: 'VIC', start_date: '2099-01-10' },
      ] },
    };
    const { status, body, headers } = await run('/');
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('text/html');
    // Same title as index.html — Google reads it as the site-name candidate.
    expect(body).toContain('<title>CardPop Australia™ | Trading Card Marketplace</title>');
    expect(body).toContain('<link rel="canonical" href="https://cardpop.com.au/" />');
    expect(body).not.toContain('noindex');
    // Every section HomePage.jsx renders, as real HTML.
    expect(body).toContain('<h1>Buy and Sell Trading Cards with Collectors Across Australia</h1>');
    expect(body).toContain('<h2>How CardPop works</h2>');
    expect(body).toContain('<h2>Why collectors trust CardPop</h2>');
    expect(body).toContain('CardPop Buyer Protection');
    expect(body).toContain('<h2>Browse by category</h2>');
    expect(body).toContain('href="https://cardpop.com.au/collections/pokemon"');
    expect(body).toContain('<h2>Just listed</h2>');
    expect(body).toContain('href="https://cardpop.com.au/marketplace/l1/charizard-base-set-psa-9"');
    expect(body).toContain('Charizard Base Set');
    expect(body).toContain('<h2>From The Parallel Report</h2>');
    expect(body).toContain('href="https://cardpop.com.au/blog/nrl-rookie-cards-price-check-2026"');
    expect(body).toContain('<h2>Upcoming card shows and events</h2>');
    expect(body).toContain('href="https://cardpop.com.au/events/melbourne-card-show"');
    expect(body).toContain('2099-01-10');
    expect(body).toContain('href="https://cardpop.com.au/prices/pokemon"');
    // Main navigation + the pages a reviewer looks for.
    for (const path of ['/about', '/contact', '/faq', '/privacy-policy', '/terms', '/trust-safety', '/shop', '/events', '/blog']) {
      expect(body).toContain(`href="https://cardpop.com.au${path}"`);
    }
    expect(body).toContain('"@type":"WebSite"');
    expect(body).toContain('"@type":"Organization"');
    expect(body).toContain('"@type":"SearchAction"');
    // Honest copy: no invented scale.
    expect(body).not.toMatch(/thousands of/i);
  });

  it('still renders the static sections when every table is empty', async () => {
    const { status, body } = await run('/');
    expect(status).toBe(200);
    expect(body).toContain('<h2>How CardPop works</h2>');
    expect(body).toContain('New cards land here as collectors list them.');
    expect(body).toContain('href="https://cardpop.com.au/blog"');
    expect(body).not.toContain('noindex');
  });
});

describe('prerender empty community pages', () => {
  it('marks the forum noindex until there are discussions', async () => {
    const { status, body } = await run('/community/forum');
    expect(status).toBe(200);
    expect(body).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it('indexes the forum once collectors have posted', async () => {
    state.listResult = { data: [{ id: 'p1', title: 'Best binder for slabs?', body: 'Looking for options.', category: 'Storage', created_at: '2026-09-01T00:00:00Z' }] };
    const { body } = await run('/community/forum');
    expect(body).not.toContain('noindex');
    expect(body).toContain('Best binder for slabs?');
  });

  it('marks the profiles directory noindex when empty and never claims thousands of members', async () => {
    const { body } = await run('/community/profiles');
    expect(body).toContain('<meta name="robots" content="noindex, follow" />');
    expect(body).not.toMatch(/thousands of/i);
  });

  it('keeps the pre-launch page out of the index', async () => {
    const { status, body } = await run('/launch');
    expect(status).toBe(200);
    expect(body).toContain('<meta name="robots" content="noindex, follow" />');
  });
});

describe('vercel.json routes crawlers to the prerendered homepage', () => {
  it('rewrites "/" for bots and the AdSense crawler, but not Lighthouse', async () => {
    const { readFileSync } = await import('node:fs');
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    const rewrites = vercel.rewrites;
    const home = rewrites.find((r) => r.source === '/' && r.destination === '/api/prerender?path=/');
    expect(home).toBeTruthy();
    const ua = home.has.find((h) => h.type === 'header' && h.key.toLowerCase() === 'user-agent');
    expect(ua).toBeTruthy();
    const re = new RegExp(ua.value.replace(/^\(\?i\)/, ''), 'i');
    for (const agent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mediapartners-Google',
      'AdsBot-Google (+http://www.google.com/adsbot.html)',
      'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ]) {
      expect(re.test(agent), agent).toBe(true);
    }
    // PageSpeed Insights must keep measuring the real homepage.
    expect(re.test('Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse')).toBe(false);
    expect(re.test('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36')).toBe(false);
    // It must sit before the catch-all that serves the SPA shell.
    const catchAll = rewrites.findIndex((r) => r.destination === '/app.html');
    expect(rewrites.indexOf(home)).toBeLessThan(catchAll);
  });
});

describe('prerender article provenance', () => {
  it('discloses AI-assisted drafts and says nothing on hand-written ones', async () => {
    state.result = { data: { id: 'a1', slug: 'afl-rookies', title: 'AFL rookies, priced', content: '<p>Body.</p>', is_published: true, auto_generated: true, published_at: '2026-08-02T00:00:00.000Z' } };
    let { body } = await run('/blog/afl-rookies');
    expect(body).toContain('How this article was produced');
    expect(body).toContain('checked and published by the CardPop team');

    state.result = { data: { id: 'a2', slug: 'hand-written', title: 'Hand written', content: '<p>Body.</p>', is_published: true, auto_generated: false, published_at: '2026-08-02T00:00:00.000Z' } };
    ({ body } = await run('/blog/hand-written'));
    expect(body).not.toContain('How this article was produced');
  });
});
