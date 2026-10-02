import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockCreate = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { constructor() { this.beta = { messages: { create: mockCreate } }; } },
}));

const {
  extractStructuredPrice, parsePriceValue, priceChanged, readSupplierPrice,
} = await import('../../src/utils/supplierPrice.js');
const { normaliseSupplierUrl } = await import('../../utils/supplierUrl.js');
const { outcomeFor } = await import('../../src/services/supplierPriceWatchService.js');

describe('normaliseSupplierUrl', () => {
  it('strips marketplace share tracking but keeps load-bearing params', () => {
    const url = 'https://www.temu.com/au/slab-g-601105058555908.html?top_gallery_url=x&spec_gallery_id=0&sku_id=17617748644961&share_token=abc&refer_page_name=kuiper&_x_sessn_id=k1#reviews';
    expect(normaliseSupplierUrl(url)).toBe('https://www.temu.com/au/slab-g-601105058555908.html?sku_id=17617748644961');
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(normaliseSupplierUrl('')).toBeNull();
    expect(normaliseSupplierUrl('temu.com/item')).toBeNull();
    expect(normaliseSupplierUrl('javascript:alert(1)')).toBeNull();
    expect(normaliseSupplierUrl('ftp://example.com/x')).toBeNull();
  });
});

describe('parsePriceValue', () => {
  it.each([
    ['AU$14.95', 14.95],
    ['14.95', 14.95],
    [14.95, 14.95],
    ['$1,299.00', 1299],
    ['7,68', 7.68],
    ['  $3 ', 3],
  ])('%s → %s', (input, expected) => {
    expect(parsePriceValue(input)).toBe(expected);
  });

  it.each([[''], [null], ['free'], [0], [-2], ['0.00']])('%s → null', (input) => {
    expect(parsePriceValue(input)).toBeNull();
  });
});

describe('extractStructuredPrice', () => {
  it('reads a schema.org Offer from JSON-LD, including inside @graph', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Case",
       "offers":{"@type":"Offer","price":"7.68","priceCurrency":"AUD"}}]}
    </script></head></html>`;
    expect(extractStructuredPrice(html)).toEqual({ price: 7.68, currency: 'AUD', source: 'json-ld' });
  });

  it('reads lowPrice from an AggregateOffer', () => {
    const html = '<script type="application/ld+json">{"@type":"Product","offers":{"@type":"AggregateOffer","lowPrice":5.5,"priceCurrency":"USD"}}</script>';
    expect(extractStructuredPrice(html)).toEqual({ price: 5.5, currency: 'USD', source: 'json-ld' });
  });

  it('skips broken JSON-LD and falls back to product meta tags', () => {
    const html = `<script type="application/ld+json">{not json</script>
      <meta property="product:price:amount" content="12.50"><meta property="product:price:currency" content="AUD">`;
    expect(extractStructuredPrice(html)).toEqual({ price: 12.5, currency: 'AUD', source: 'meta' });
  });

  it('falls back to microdata', () => {
    const html = '<span itemprop="price" content="9.99">$9.99</span><meta itemprop="priceCurrency" content="AUD">';
    expect(extractStructuredPrice(html)).toEqual({ price: 9.99, currency: 'AUD', source: 'microdata' });
  });

  it('returns null when the page publishes no price', () => {
    expect(extractStructuredPrice('<html><body>Sold out</body></html>')).toBeNull();
    expect(extractStructuredPrice('')).toBeNull();
  });
});

describe('readSupplierPrice', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => mockCreate.mockReset());
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('uses structured data without calling the model', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    const html = '<meta property="og:price:amount" content="4.20">';
    expect(await readSupplierPrice(html, 'https://shop.example/x')).toMatchObject({ price: 4.2, source: 'meta' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('reports unreadable, not a guess, when there is no key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await readSupplierPrice('<p>Price AU$7.68</p>', 'https://shop.example/x');
    expect(result.price).toBeNull();
    expect(result.reason).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('falls back to the model for pages without structured data', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ found: true, price: 7.68, currency: 'AUD', reason: null }) }],
    });
    const result = await readSupplierPrice('<p>Was AU$8.26 now AU$7.68</p>', 'https://www.temu.com/au/x.html');
    expect(result).toEqual({ price: 7.68, currency: 'AUD', reason: null, source: 'model' });
    const request = mockCreate.mock.calls[0][0];
    expect(request.output_config.format.type).toBe('json_schema');
    expect(request.messages[0].content).toContain('untrusted');
  });

  it('passes on the model saying it found no price', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ found: false, price: null, currency: null, reason: 'The page is a captcha.' }) }],
    });
    const result = await readSupplierPrice('<p>Please verify you are human</p>', 'https://www.temu.com/au/x.html');
    expect(result).toMatchObject({ price: null, reason: 'The page is a captcha.' });
  });
});

describe('priceChanged', () => {
  it('flags a move of a cent or more, and ignores unknowns', () => {
    expect(priceChanged(7.68, 7.68)).toBe(false);
    expect(priceChanged(7.68, 7.69)).toBe(true);
    expect(priceChanged('7.68', 8.26)).toBe(true);
    expect(priceChanged(null, 7.68)).toBe(false);
    expect(priceChanged(7.68, null)).toBe(false);
  });
});

describe('outcomeFor', () => {
  it('treats a first reading as ok, without a notification', () => {
    expect(outcomeFor({ supplier_price_aud: null }, { status: 'ok', price: 7.68 })).toEqual({ status: 'ok', notify: null });
  });

  it('flags and notifies a price change', () => {
    expect(outcomeFor({ supplier_price_aud: '7.68', supplier_price_status: 'ok' }, { status: 'ok', price: 8.26 }))
      .toEqual({ status: 'changed', notify: 'changed' });
  });

  it('notifies the first failure only, so a broken page does not bell every week', () => {
    expect(outcomeFor({ supplier_price_status: 'ok' }, { status: 'unreadable' })).toEqual({ status: 'unreadable', notify: 'failing' });
    expect(outcomeFor({ supplier_price_status: 'unreadable' }, { status: 'error' })).toEqual({ status: 'error', notify: null });
  });
});
