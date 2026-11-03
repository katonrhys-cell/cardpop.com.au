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

/**
 * Loads the facet rows for a shop grid and keeps the filter selection in the
 * URL (?type=ZB-04&colour=pink…) so a filtered view can be shared or reloaded.
 *
 * - `scope(query)` narrows the base query (e.g. to a category); `scopeKey` is a
 *   string that changes whenever the scope does. `enabled: false` defers the load.
 * - Never throws: any load error means no filters, and the page behaves as before.
 *
 * `waiting` is true while a filter in the URL can't be resolved yet — pages
 * should hold their fetch rather than flash the unfiltered grid first.
 */
export function useShopFacets({ scope, scopeKey, enabled = true, keys = DEFAULT_FACET_KEYS }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const keysKey = keys.join(',');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const rows = await loadFacetRows(scope);
        if (!cancelled) setRows(rows);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // `scope` is a fresh closure each render; scopeKey tracks it by value.
  }, [scopeKey, enabled]);

  const options = useMemo(() => buildFacetOptions(rows, keysKey.split(',')), [rows, keysKey]);
  const selection = useMemo(() => readSelection(searchParams, options), [searchParams, options]);
  const activeCount = Object.keys(selection).length;
  const waiting = !loaded && keys.some((k) => searchParams.get(k));

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

  return { rows, loaded, options, selection, activeCount, waiting, setFacet, clearFacets };
}

export default useShopFacets;
