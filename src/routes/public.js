import { Router } from 'express';
import supabaseAnon from '../utils/supabaseAnonClient.js';
import { createTtlCache } from '../utils/ttlCache.js';
import logger from '../utils/logger.js';
import { queryHomepageBundle, bundleHasErrors, queryTickerRows, queryShowcaseRows } from '../../lib/homepageQueries.js';
import { SHOP_FACET_COLUMNS } from '../../utils/shopColumns.js';
import { PUBLIC_SHOP_STATUSES } from '../../utils/shopStock.js';
import { loadPublicSettings } from './settings.js';

// Edge-cached public reads.
//
// The browser used to run these queries against Supabase directly, once per
// visitor, which made database compute the one cost that grew with traffic
// (every anonymous page view, bypassing Cloudflare entirely). Here the same
// queries run on the server — under the ANON key, so Row Level Security still
// decides what is visible — at most once per PUBLIC_READ_CACHE_TTL_MS, and the
// response carries `s-maxage` so Cloudflare serves every repeat from its edge
// (the cache rule for /hcgi/api/public/* is in docs/performance.md). The
// browser falls back to its direct query if an endpoint is unreachable
// (lib/publicApi.js), so this layer only ever removes load, never adds a
// dependency.
//
// Rules for anything added here:
//   • read-only, anon-visible data only, identical for every visitor — no
//     Authorization, no cookies, nothing keyed on the caller;
//   • bounded result sets (these are cached blobs, not paginated APIs);
//   • a failed read is answered `no-store`, never cached — the client falls
//     back, and the next request retries.

const router = Router();

const ttlMs = () => {
  const n = Number.parseInt(process.env.PUBLIC_READ_CACHE_TTL_MS ?? '60000', 10);
  return Number.isNaN(n) ? 60000 : n;
};
export const publicReadCache = createTtlCache({ ttlMs, maxEntries: 50 });

// Browser 30 s, Cloudflare 60 s, and up to 5 minutes of a stale copy while the
// edge refetches — the data behind these changes at human speed.
export const EDGE_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';

export function edgeCacheable(res) {
  // The API router sets no-store for everything; this endpoint is the exception.
  res.removeHeader('Pragma');
  res.removeHeader('Expires');
  res.setHeader('Cache-Control', EDGE_CACHE_CONTROL);
}

export function uncacheable(res) {
  res.setHeader('Cache-Control', 'no-store');
}

// A loader that must not be cached throws this so the micro-cache stays empty
// while the client still gets whatever did load.
class PartialResult extends Error {
  constructor(payload) {
    super('partial result');
    this.payload = payload;
  }
}

/** GET /public/home — the four reads behind the home page, in one response. */
router.get('/home', async (req, res) => {
  try {
    const bundle = await publicReadCache.get('home', async () => {
      const result = await queryHomepageBundle(supabaseAnon);
      if (bundleHasErrors(result)) throw new PartialResult(result);
      return result;
    });
    edgeCacheable(res);
    return res.json(bundle);
  } catch (error) {
    if (error instanceof PartialResult) {
      logger.warn('[PUBLIC] home bundle has a failed part — answering uncached');
      uncacheable(res);
      return res.json(error.payload);
    }
    logger.error(`[PUBLIC] home bundle failed: ${error.message}`);
    uncacheable(res);
    return res.status(503).json({ error: 'Temporarily unavailable' });
  }
});

/** GET /public/shop/facets — every public shop product's facet columns. */
router.get('/shop/facets', async (req, res) => {
  try {
    const rows = await publicReadCache.get('shop-facets', async () => {
      const { data, error } = await supabaseAnon
        .from('shop_products')
        .select(SHOP_FACET_COLUMNS)
        .in('status', PUBLIC_SHOP_STATUSES);
      if (error) throw new Error(error.message || 'shop_products query failed');
      return data || [];
    });
    edgeCacheable(res);
    return res.json({ data: rows, error: null });
  } catch (error) {
    logger.error(`[PUBLIC] shop facets failed: ${error.message}`);
    uncacheable(res);
    return res.status(503).json({ data: null, error: { message: 'Temporarily unavailable' } });
  }
});

/**
 * GET /public/ticker — the "Live on CardPop" strip on the homepage and the
 * marketplace: the 10 newest active and 6 newest sold listings as raw rows
 * ({ listed, sold }); the browser shapes them (components/LiveActivityTicker.jsx).
 */
router.get('/ticker', async (req, res) => {
  try {
    const rows = await publicReadCache.get('ticker', async () => {
      const result = await queryTickerRows(supabaseAnon);
      if (result.error) throw new PartialResult(null);
      return { listed: result.listed, sold: result.sold };
    });
    edgeCacheable(res);
    return res.json(rows);
  } catch (error) {
    if (!(error instanceof PartialResult)) logger.error(`[PUBLIC] ticker failed: ${error.message}`);
    uncacheable(res);
    return res.status(503).json({ error: 'Ticker unavailable' });
  }
});

/**
 * GET /public/hero — the admin-configured hero showcase cards (raw rows; the
 * browser maps them with mapShowcaseRow in lib/heroShowcase.js).
 */
router.get('/hero', async (req, res) => {
  try {
    const rows = await publicReadCache.get('hero', async () => {
      const { data, error } = await queryShowcaseRows(supabaseAnon);
      if (error) throw new PartialResult(null);
      return data || [];
    });
    edgeCacheable(res);
    return res.json({ cards: rows });
  } catch (error) {
    if (!(error instanceof PartialResult)) logger.error(`[PUBLIC] hero failed: ${error.message}`);
    uncacheable(res);
    return res.status(503).json({ error: 'Hero cards unavailable' });
  }
});

/**
 * GET /public/settings — the public platform settings (feature flags, the
 * maintenance switch, listing and shipping limits) every page load reads.
 * It lived at /settings/public, outside this path's Cloudflare cache rule and
 * fetched with the member's bearer token, so every page view cost a function
 * invocation and a database read. The whitelist is read with the service-role client (the
 * table has no anon policy) but only the keys in PUBLIC_SETTINGS, so the
 * answer is the same for every visitor, as this router requires. A failed
 * read still answers the fail-open defaults, uncached.
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await publicReadCache.get('settings', async () => {
      const { settings: loaded, ok } = await loadPublicSettings();
      if (!ok) throw new PartialResult(loaded);
      return loaded;
    });
    edgeCacheable(res);
    return res.json(settings);
  } catch (error) {
    if (!(error instanceof PartialResult)) logger.error(`[PUBLIC] settings failed: ${error.message}`);
    uncacheable(res);
    return res.json(error instanceof PartialResult ? error.payload : (await loadPublicSettings()).settings);
  }
});

export default router;
