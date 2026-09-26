import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { VARIANTS_SELECT } from '@/utils/shopVariants.js';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';
import { fetchFamily, pickDefaultSibling } from '@/utils/shopFamily.js';

/**
 * Commercial data for a catalogue-driven product page (the Palms Off Gaming
 * line pages and binder pages), whose copy comes from data/*.js.
 *
 * A line is either:
 *  - a colour family — one shop_products row per colour, linked by
 *    family_sku = the line SKU. `row` is the chosen colour's product and the
 *    page offers the siblings as a colour picker; or
 *  - a single product row matched by slug (optionally with colour variants),
 *    as before colours were split into products.
 *
 * @returns {{ row: object|null, family: object[], selectedId: string|null,
 *             setSelectedId: Function, loading: boolean }}
 */
export default function useShopLine({ slug, sku, enabled = true }) {
  const [single, setSingle] = useState(null);
  const [family, setFamily] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from('shop_products')
        .select(`id, title, price_aud, retail_price_aud, stock_quantity, status, ${VARIANTS_SELECT}`)
        .eq('slug', slug)
        .maybeSingle()
        .then(({ data }) => data || null, () => null),
      fetchFamily(supabase, sku, PUBLIC_SHOP_STATUSES),
    ]).then(([singleRow, siblings]) => {
      if (cancelled) return;
      setSingle(singleRow);
      setFamily(siblings);
      setSelectedId(pickDefaultSibling(siblings)?.id ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [enabled, slug, sku]);

  const selected = family.find((s) => s.id === selectedId) || null;
  return {
    row: family.length > 0 ? selected : single,
    family,
    selectedId,
    setSelectedId,
    loading,
  };
}
