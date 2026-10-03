import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';

/**
 * Price, stock and status for each size in a point-size group, keyed by slug,
 * so the picker can show what each size costs and strike through sold-out ones.
 * Never throws — any error leaves the map empty and the picker simply shows
 * sizes without prices.
 */
export default function useSizeStock(options) {
  const [bySlug, setBySlug] = useState({});
  const key = options.map((o) => o.slug).join('|');

  useEffect(() => {
    if (options.length < 2) { setBySlug({}); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('shop_products')
          .select('slug, price_aud, stock_quantity, status')
          .in('slug', options.map((o) => o.slug))
          .in('status', PUBLIC_SHOP_STATUSES);
        if (cancelled || error) return;
        setBySlug(Object.fromEntries((data || []).map((r) => [r.slug, r])));
      } catch { /* picker works without prices */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return bySlug;
}
