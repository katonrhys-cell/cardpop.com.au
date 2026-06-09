import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';

/**
 * Fetch eras for a collection slug.
 * Initialises immediately from the static collectionConfigs so the era pill
 * bar renders without waiting for the DB round-trip.  If the DB returns
 * active eras they replace the static ones; otherwise the static set stays.
 */
export function useCollectionEras(collectionSlug) {
  const [eras, setEras] = useState(() =>
    collectionSlug ? (COLLECTION_CONFIGS[collectionSlug]?.eras ?? []) : []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collectionSlug) {
      setEras([]);
      return;
    }

    // Seed from static config immediately so the bar renders right away
    setEras(COLLECTION_CONFIGS[collectionSlug]?.eras ?? []);

    let cancelled = false;
    setLoading(true);

    supabase
      .from('collection_eras')
      .select('id, name, years, gradient, hint, sort_order')
      .eq('collection_slug', collectionSlug)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return;
        // Only override static eras if the DB actually has rows
        if (data && data.length > 0) setEras(data);
        setLoading(false);
      })
      .catch(() => {
        // Static eras already set above; just clear loading flag
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [collectionSlug]);

  return { eras, loading };
}
