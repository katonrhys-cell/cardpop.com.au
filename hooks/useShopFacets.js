import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { cachedQuery } from '@/lib/queryCache.js';
import { fetchPublicJson, PUBLIC_SHOP_FACETS_URL } from '@/lib/publicApi.js';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';
import { FACET_SELECT, DEFAULT_FACET_KEYS, buildFacetOptions, readSelection } from '@/utils/shopFacets.js';

// The unscoped facet rows (every public product) are the same for every
// visitor, so they come from the server's edge-cached endpoint
// (lib/publicApi.js) and Cloudflare answers repeats without touching
// Supabase. Scoped grids (a category page narrows the base query) still read
// Supabase directly; any failure of the endpoint falls back to that too.
const FACETS_TTL_MS = 60 * 1000;
const PUBLIC_FACETS_KEY = 'shop_facets_public';

export const loadPublicFacetRows = () => cachedQuery(PUBLIC_FACETS_KEY, async () => {
  const body = await fetchPublicJson(PUBLIC_SHOP_FACETS_URL);
  if (!Array.isArray(body?.data)) throw new Error('public/shop/facets: unexpected shape');
  return body.data;
}, FACETS_TTL_MS);

async function loadFacetRows(scope) {
  if (!scope) {
    try {
      const rows = await loadPublicFacetRows();
      if (Array.isArray(rows)) return rows;
    } catch {
      // fall through to the direct query
    }
  }
  let query = supabase.from('shop_products').select(FACET_SELECT).in('status', PUBLIC_SHOP_STATUSES);
  if (scope) query = scope(query);
  const { data, error } = await query;
  return error ? [] : (data || []);
}

// Whether each grid had filter dropdowns last time this browser loaded it, so
// the page can hold the filter row's place while the facet rows are on their
// way. A category with one product line has no filters at all, so reserving
// the row everywhere would trade one jump (the grid dropping when the chips
// arrive) for another (the grid rising when they don't); remembering the
// answer per grid gets both right from the second visit on.
const SEEN_KEY = 'cardpop_shop_filter_rows';
const SEEN_MAX = 150;
let seenCache = null;
const readSeen = () => {
  if (seenCache) return seenCache;
  try { seenCache = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { seenCache = {}; }
  if (typeof seenCache !== 'object') seenCache = {};
  return seenCache;
};
const rememberSeen = (id, hasFilters) => {
  const seen = readSeen();
  if (seen[id] === hasFilters) return;
  seen[id] = hasFilters;
  const ids = Object.keys(seen);
  // Oldest first out (insertion order), so the record can't grow without bound.
  for (const stale of ids.slice(0, Math.max(0, ids.length - SEEN_MAX))) delete seen[stale];
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* storage blocked */ }
};

/**
 * Loads the facet rows for a shop grid and keeps the filter selection in the
 * URL (?type=ZB-04&colour=pink…) so a filtered view can be shared or reloaded.
 *
 * - `scope(query)` narrows the base query (e.g. to a category); `scopeKey` is a
 *   string that changes whenever the scope does. `enabled: false` defers the load.
 * - Never throws: any load error means no filters, and the page behaves as before.
 * - `pending` is true while the rows are loading for a grid that is expected
 *   to have filters (it did last time, or `expectFilters` says so) — pass it to
 *   <ShopFilterPanel loading> so the grid below doesn't move when they arrive.
 *
 * `waiting` is true while a filter in the URL can't be resolved yet — pages
 * should hold their fetch rather than flash the unfiltered grid first.
 */
export function useShopFacets({ scope, scopeKey, enabled = true, keys = DEFAULT_FACET_KEYS, expectFilters }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const keysKey = keys.join(',');
  const seenId = `${scopeKey ?? ''}#${keysKey}`;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const rows = await loadFacetRows(scope);
        if (!cancelled) {
          setRows(rows);
          rememberSeen(seenId, Object.keys(buildFacetOptions(rows, keysKey.split(','))).length > 0);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // `scope` is a fresh closure each render; scopeKey tracks it by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope is deliberately tracked via scopeKey
  }, [scopeKey, enabled]);

  const options = useMemo(() => buildFacetOptions(rows, keysKey.split(',')), [rows, keysKey]);
  const selection = useMemo(() => readSelection(searchParams, options), [searchParams, options]);
  const activeCount = Object.keys(selection).length;
  const waiting = !loaded && keys.some((k) => searchParams.get(k));
  const pending = !loaded && (readSeen()[seenId] ?? Boolean(expectFilters));

  const setFacet = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  };

  const clearFacets = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  };

  return { rows, loaded, pending, options, selection, activeCount, waiting, setFacet, clearFacets };
}

export default useShopFacets;
