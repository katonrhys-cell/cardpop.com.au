import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

const PAGE_SIZE = 20;

/**
 * Published reviews + rating summary for a pool of shop products (see
 * utils/productReviews.js → reviewPoolKey). Reads go straight to Supabase —
 * RLS only ever returns `status = 'published'` rows. Fails quiet: a product
 * page must render with no reviews rather than break.
 *
 * @returns {{ stats: {review_count:number, average_rating:number}|null,
 *             reviews: object[], loading: boolean }}
 */
export default function useShopReviews(poolKey) {
  const [state, setState] = useState({ stats: null, reviews: [], loading: Boolean(poolKey) });

  useEffect(() => {
    if (!poolKey) { setState({ stats: null, reviews: [], loading: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const done = (next) => { if (!cancelled) setState(next); };
    const empty = { stats: null, reviews: [], loading: false };
    // Built inside the try so even a synchronous failure leaves the product
    // page rendering with no reviews rather than crashing it.
    try {
      Promise.all([
        supabase.from('shop_product_review_stats').select('review_count, average_rating').eq('pool_key', poolKey).maybeSingle(),
        supabase.from('shop_product_reviews')
          .select('id, rating, title, body, reviewer_name, created_at')
          .eq('pool_key', poolKey).eq('status', 'published')
          .order('created_at', { ascending: false }).limit(PAGE_SIZE),
      ]).then(([statsRes, listRes]) => {
        done({
          stats: statsRes.error ? null : (statsRes.data || null),
          reviews: listRes.error ? [] : (listRes.data || []),
          loading: false,
        });
      }).catch(() => done(empty));
    } catch {
      done(empty);
    }
    return () => { cancelled = true; };
  }, [poolKey]);

  return state;
}
