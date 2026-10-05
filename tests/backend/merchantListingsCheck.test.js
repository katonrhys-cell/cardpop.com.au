import { vi, describe, it, expect, beforeEach } from 'vitest';
import { checkPageMarkup, productNodes, identifierProblems } from '../../src/utils/merchantListingsCheck.js';

// scripts/check-merchant-listings.mjs fetches live pages; these are the pure
// pieces it runs on each one, proven here against a hand-built page and —
// more importantly — against what api/prerender.js actually emits, so the
// weekly live check and the markup it inspects can't drift apart silently.

const state = vi.hoisted(() => ({ result: { data: null }, listResult: { data: [] } }));
vi.mock('@supabase/supabase-js', () => {
  const builder = () => {
    const b = {
      select: vi.fn(() => b), eq: vi.fn(() => b), neq: vi.fn(() => b), in: vi.fn(() => b), gt: vi.fn(() => b),
      gte: vi.fn(() => b), like: vi.fn(() => b), ilike: vi.fn(() => b), not: vi.fn(() => b), order: vi.fn(() => b),
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
      storage: { from: vi.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/img.jpg' } }) })) },
    })),
  };
});
import handler from '../../api/prerender.js';

const UUID = '11111111-2222-3333-4444-555555555555';
function render(path) {
  const req = { query: { path } };
  let body = '';
  const res = { setHeader() {}, status() { return this; }, send(p) { body = p; return this; } };
  return handler(req, res).then(() => body);
}
beforeEach(() => { state.result = { data: null }; state.listResult = { data: [] }; });

const page = (...blocks) => `<html><head>${blocks.map((b) => `<script type="application/ld+json">${typeof b === 'string' ? b : JSON.stringify(b)}</script>`).join('')}</head></html>`;

describe('identifierProblems', () => {
  it('accepts a brand, an mpn or a valid gtin on its own', () => {
    expect(identifierProblems({ '@type': 'Product', brand: { '@type': 'Brand', name: 'CardPop' } })).toEqual([]);
    expect(identifierProblems({ '@type': 'Product', brand: 'Pokémon' })).toEqual([]);
    expect(identifierProblems({ '@type': 'Product', mpn: 'Base Set 4/102' })).toEqual([]);
    expect(identifierProblems({ '@type': 'Product', gtin13: '1209202001436' })).toEqual([]);
  });
  it('reports the Search Console warning case and a malformed gtin', () => {
    expect(identifierProblems({ '@type': 'Product', name: 'X', sku: 'ABC' })).toEqual(['no global identifier (brand / mpn / gtin)']);
    expect(identifierProblems({ '@type': 'Product', gtin: 'Base Set-4/102' })).toEqual([
      'gtin "Base Set-4/102" is not an 8/12/13/14-digit GTIN',
      'no global identifier (brand / mpn / gtin)',
    ]);
    expect(identifierProblems({ '@type': 'Product', brand: { '@type': 'Brand', name: '' }, mpn: 'X' })).toEqual(['brand present but empty']);
  });
});

describe('checkPageMarkup', () => {
  it('finds Products nested in an ItemList and reports unparsable blocks', () => {
    const html = page(
      { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: [
        { '@type': 'ListItem', position: 1, item: { '@type': 'Product', name: 'Good', brand: { '@type': 'Brand', name: 'NBA' } } },
        { '@type': 'ListItem', position: 2, item: { '@type': 'Product', name: 'Bad' } },
      ] },
      '{ not json',
    );
    const r = checkPageMarkup(html);
    expect(r.products).toBe(2);
    expect(r.problems).toEqual([
      'JSON-LD block does not parse: { not json…',
      'Bad: no global identifier (brand / mpn / gtin)',
    ]);
    expect(productNodes([{ '@type': ['Product', 'Thing'] }])).toHaveLength(1);
  });

  it('passes a prerendered shop product page', async () => {
    state.result = { data: {
      id: UUID, title: 'Penny Sleeves', sku: 'CP-PENNY-SLEEVES', price_aud: 4, stock_quantity: 5, product_type: 'supplies', status: 'active',
    } };
    const r = checkPageMarkup(await render(`/product/shop/${UUID}/penny-sleeves`));
    expect(r.products).toBe(1);
    expect(r.problems).toEqual([]);
  });

  it('passes a prerendered marketplace listing and its dealer store list', async () => {
    state.result = { data: {
      id: UUID, slug: 'charizard', price_aud: 1499.95, status: 'active',
      vault_item: { card_name: 'Charizard', collection: 'Pokemon', set_name: 'Base Set', card_number: '4/102' },
      seller: { username: 'ash' },
    } };
    const listing = checkPageMarkup(await render(`/marketplace/${UUID}/charizard`));
    expect(listing.products).toBe(1);
    expect(listing.problems).toEqual([]);

    state.result = { data: {
      id: UUID, store_slug: 'ash-cards', business_name: 'Ash Cards', is_sole_trader: true, is_public: true,
      subscription_tier: 'pro', subscription_status: 'active',
    } };
    state.listResult = { data: [
      { id: UUID, slug: 'charizard', price_aud: 1499.95, vault_item: { card_name: 'Charizard', collection: 'Pokemon', set_name: 'Base Set', card_number: '4/102' } },
    ] };
    const store = checkPageMarkup(await render('/dealer/ash-cards'));
    expect(store.products).toBe(1);
    expect(store.problems).toEqual([]);
  });

  it('flags a card listed with no franchise and no number — the data case the weekly check exists for', async () => {
    state.result = { data: {
      id: UUID, slug: 'mystery', price_aud: 20, status: 'active',
      vault_item: { card_name: 'Mystery Card' }, seller: { username: 'ash' },
    } };
    const r = checkPageMarkup(await render(`/marketplace/${UUID}/mystery`));
    expect(r.problems).toEqual(['Mystery Card: no global identifier (brand / mpn / gtin)']);
  });
});
