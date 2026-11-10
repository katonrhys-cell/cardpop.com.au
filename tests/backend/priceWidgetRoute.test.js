import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// GET /public/price-widget/:slug.svg — the embeddable price image
// (utils/priceWidget.js). Other sites load it as an <img>, so it must be
// cross-origin loadable, edge-cached, and never a broken image.

const anon = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../src/utils/supabaseAnonClient.js', () => ({ default: anon }));

import app from '../../src/app.js';
import { priceWidgetCache, PRICE_WIDGET_CACHE_CONTROL } from '../../src/routes/public.js';

const card = { id: 'tc1', slug: 'charizard-base-set-4', name: 'Charizard', set_name: 'Base Set', category: 'pokemon' };
// Newest first, as the route queries them.
const snapshots = [
  { snapshot_date: '2026-11-06', raw_avg: 550, graded_avg: 2400 },
  { snapshot_date: '2026-11-05', raw_avg: 500, graded_avg: 2300 },
];

const mockTables = ({ cardResult = { data: card, error: null }, historyResult = { data: snapshots, error: null } } = {}) => {
  anon.from.mockImplementation((table) => {
    if (table === 'tracked_cards') {
      const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn(async () => cardResult) };
      return chain;
    }
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(async () => historyResult) };
    return chain;
  });
};

beforeEach(() => {
  priceWidgetCache.clear();
  anon.from.mockReset();
  process.env.PUBLIC_READ_CACHE_TTL_MS = '60000';
});

describe('GET /public/price-widget/:slug.svg', () => {
  it('draws the latest real price as a cross-origin, edge-cached SVG', async () => {
    mockTables();
    const res = await request(app).get('/hcgi/api/public/price-widget/charizard-base-set-4.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/svg\+xml/);
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['cache-control']).toBe(PRICE_WIDGET_CACHE_CONTROL);
    const svg = res.body.toString();
    expect(svg).toContain('Charizard');
    expect(svg).toContain('$550.00');
    expect(svg).toContain('+10.0%');

    await request(app).get('/public/price-widget/charizard-base-set-4.svg');
    expect(anon.from).toHaveBeenCalledTimes(2); // one card + one history read, then cached
  });

  it('answers an unknown card with the neutral image, not a broken one', async () => {
    mockTables({ cardResult: { data: null, error: null } });
    const res = await request(app).get('/public/price-widget/no-such-card.svg');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^image\/svg\+xml/);
    expect(res.body.toString()).toContain('Australian card prices');
  });

  it('rejects a malformed slug without querying', async () => {
    const res = await request(app).get('/public/price-widget/BAD_slug!.svg');
    expect(res.status).toBe(404);
    expect(anon.from).not.toHaveBeenCalled();
  });

  it('never caches a failed read', async () => {
    mockTables({ historyResult: { data: null, error: { message: 'boom' } } });
    const res = await request(app).get('/public/price-widget/charizard-base-set-4.svg');
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(priceWidgetCache.size()).toBe(0);
  });
});
