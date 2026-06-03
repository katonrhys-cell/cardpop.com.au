import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';

/**
 * Fetch eras for a collection slug from the DB.
 * Falls back to the static collectionConfigs.js eras if the DB returns nothing.
 */
export function useCollectionEras(collectionSlug) {
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collectionSlug) { setEras([]); return; }

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
        if (data && data.length > 0) {
          setEras(data);
        } else {
          // Fall back to static config so nothing breaks if DB is empty
          setEras(COLLECTION_CONFIGS[collectionSlug]?.eras ?? []);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [collectionSlug]);

  return { eras, loading };
}
