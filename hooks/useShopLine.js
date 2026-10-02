import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { VARIANTS_SELECT } from '@/utils/shopVariants.js';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';
import { fetchFamily, pickDefaultSibling } from '@/utils/shopFamily.js';
import { slugify } from '@/utils/shopProductUrl.js';

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
 *
 * The chosen colour is mirrored in the URL as ?colour=<colour-slug> (the shape
 * utils/shopProductUrl.js links to), so a grid card for the blue binder opens
 * on blue and a colour switch is shareable. The page's canonical URL stays the
 * colour-less line URL.
 */
export default function useShopLine({ slug, sku, enabled = true }) {
  const [single, setSingle] = useState(null);
  const [family, setFamily] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const colourParam = searchParams.get('colour') || '';

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      (async () => {
        const run = (extra) => supabase
          .from('shop_products')
          .select(`id, title, price_aud, retail_price_aud, stock_quantity, status${extra}, ${VARIANTS_SELECT}`)
          .eq('slug', slug)
          .maybeSingle();
        let { data, error } = await run(', preorder_eta');
        // Deploy-before-migration window: load the row without the estimate.
        if (error && /preorder_eta/.test(error.message || '')) ({ data, error } = await run(''));
        return error ? null : (data || null);
      })().catch(() => null),
      fetchFamily(supabase, sku, PUBLIC_SHOP_STATUSES),
    ]).then(([singleRow, siblings]) => {
      if (cancelled) return;
      setSingle(singleRow);
      setFamily(siblings);
      const wanted = colourParam
        && siblings.find((s) => slugify(s.colour || '') === slugify(colourParam));
      setSelectedId((wanted || pickDefaultSibling(siblings))?.id ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // colourParam is read once per load; later changes come from selectColour.
  }, [enabled, slug, sku]);

  const selected = family.find((s) => s.id === selectedId) || null;

  const selectColour = (id) => {
    setSelectedId(id);
    const sibling = family.find((s) => s.id === id);
    const colour = sibling?.colour ? slugify(sibling.colour) : '';
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (colour) next.set('colour', colour); else next.delete('colour');
      return next;
    }, { replace: true });
  };
  return {
    row: family.length > 0 ? selected : single,
    family,
    selectedId,
    setSelectedId: selectColour,
    loading,
  };
}
