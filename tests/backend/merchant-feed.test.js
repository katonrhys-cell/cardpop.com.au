import { vi, describe, it, expect, beforeEach } from 'vitest';

// The merchant-feed function builds its own Supabase client from
// @supabase/supabase-js, so we mock that module and feed the shop_products
// list result through a chainable builder (mirrors prerender.test.js).
const state = vi.hoisted(() => ({ listResult: { data: [] } }));

vi.mock('@supabase/supabase-js', () => {
  const builder = () => {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      // List fetches await the chain itself (thenable) → state.listResult.
      then: (resolve, reject) => Promise.resolve(state.listResult).then(resolve, reject),
    };
    return b;
  };
  return {
    createClient: vi.fn(() => ({ from: vi.fn(() => builder()) })),
  };
});

import handler from '../../api/merchant-feed.js';

function run() {
  let body = '';
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { body = payload; return this; },
  };
  return handler({}, res).then(() => ({ status: res.statusCode, body, headers: res.headers }));
}

const UUID = '11111111-2222-3333-4444-555555555555';

const product = (overrides = {}) => ({
  id: UUID,
  title: 'Prismatic Evolutions Booster Box',
  description: 'A factory-sealed booster box.',
  price_aud: 289.95,
  stock_quantity: 5,
  category: 'Pokémon',
  product_type: 'sealed',
  images: ['https://cdn.test/box.jpg'],
  image_url: 'https://cdn.test/box.jpg',
  ...overrides,
});

beforeEach(() => { state.listResult = { data: [] }; });

describe('merchant feed', () => {
  it('serves valid RSS with the g: namespace and XML content type', async () => {
    const { status, body, headers } = await run();
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/xml');
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(body).toContain('<channel>');
    expect(body).toContain('</rss>');
  });

  it('renders an active product as a complete Google Shopping item', async () => {
    state.listResult = { data: [product()] };
    const { body } = await run();
    expect(body).toContain(`<g:id>${UUID}</g:id>`);
    expect(body).toContain('<title>Prismatic Evolutions Booster Box</title>');
    expect(body).toContain(`<link>https://cardpop.com.au/product/shop/${UUID}/prismatic-evolutions-booster-box</link>`);
    expect(body).toContain('<g:image_link>https://cdn.test/box.jpg</g:image_link>');
    expect(body).toContain('<g:price>289.95 AUD</g:price>');
    expect(body).toContain('<g:availability>in_stock</g:availability>');
    expect(body).toContain('<g:condition>new</g:condition>');
    expect(body).toContain('<g:identifier_exists>no</g:identifier_exists>');
    expect(body).toContain('Collectible Trading Cards');
  });

  it('marks a zero-stock product out_of_stock', async () => {
    state.listResult = { data: [product({ stock_quantity: 0 })] };
    const { body } = await run();
    expect(body).toContain('<g:availability>out_of_stock</g:availability>');
  });

  it('skips products with no image, no price or no title', async () => {
    state.listResult = { data: [
      product({ id: 'a', images: [], image_url: null }),
      product({ id: 'b', price_aud: 0 }),
      product({ id: 'c', title: '  ' }),
      product({ id: 'd' }),
    ] };
    const { body } = await run();
    expect(body).not.toContain('<g:id>a</g:id>');
    expect(body).not.toContain('<g:id>b</g:id>');
    expect(body).not.toContain('<g:id>c</g:id>');
    expect(body).toContain('<g:id>d</g:id>');
  });

  it('XML-escapes titles and strips HTML from descriptions', async () => {
    state.listResult = { data: [product({
      title: 'Sun & Moon <Base>',
      description: '<p>Sealed & mint.</p>',
    })] };
    const { body } = await run();
    expect(body).toContain('<title>Sun &amp; Moon &lt;Base&gt;</title>');
    expect(body).toContain('<description>Sealed &amp; mint.</description>');
    expect(body).not.toContain('<p>');
  });

  it('emits additional_image_link for extra photos', async () => {
    state.listResult = { data: [product({
      images: ['https://cdn.test/box.jpg', 'https://cdn.test/back.jpg'],
    })] };
    const { body } = await run();
    expect(body).toContain('<g:additional_image_link>https://cdn.test/back.jpg</g:additional_image_link>');
  });

  it('returns an empty but valid feed on a DB error', async () => {
    // Force the builder to reject.
    state.listResult = { get data() { throw new Error('db down'); } };
    const { status, body } = await run();
    expect(status).toBe(200);
    expect(body).toContain('</rss>');
    expect(body).not.toContain('<item>');
  });
});
