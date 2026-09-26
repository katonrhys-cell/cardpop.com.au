import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';
import { FACET_SELECT, DEFAULT_FACET_KEYS, buildFacetOptions, readSelection } from '@/utils/shopFacets.js';

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
        let query = supabase.from('shop_products').select(FACET_SELECT).in('status', PUBLIC_SHOP_STATUSES);
        if (scope) query = scope(query);
        const { data, error } = await query;
        if (!cancelled) setRows(error ? [] : (data || []));
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
