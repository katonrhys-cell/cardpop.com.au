import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

/**
 * Provides watchlist state and toggle for the current user.
 * isWatchlisted(listingId) — O(1) Set lookup
 * toggle(listingId)        — optimistic update, rolls back on error
 * count                    — number of watchlisted listings
 */
export const useWatchlist = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [ids, setIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  // Number of toggles currently in flight. While > 0 we suppress realtime
  // refetches (they'd clobber the optimistic state); once it returns to 0 we
  // reconcile with the server to pick up anything that changed meanwhile.
  const pendingRef = useRef(0);
  const fetchRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;
    const uid = currentUser.id;

    const fetchIds = async () => {
      const { data } = await supabase
        .from('watchlist')
        .select('listing_id')
        .eq('user_id', uid);
      if (!cancelled) {
        setIds(new Set((data ?? []).map(r => r.listing_id)));
        setLoading(false);
      }
    };
    fetchRef.current = fetchIds;

    fetchIds();

    // Sync across tabs / devices via realtime
    const channel = supabase
      .channel(`watchlist-ids-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${uid}` },
        () => { if (pendingRef.current === 0) fetchIds(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      fetchRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, isAuthenticated]);

  const toggle = useCallback(async (listingId) => {
    if (!currentUser?.id) return false;
    const uid = currentUser.id;
    const already = ids.has(listingId);

    // Optimistic update
    pendingRef.current += 1;
    setIds(prev => {
      const next = new Set(prev);
      if (already) next.delete(listingId);
      else next.add(listingId);
      return next;
    });

    try {
      if (already) {
        await supabase.from('watchlist').delete().eq('user_id', uid).eq('listing_id', listingId);
      } else {
        await supabase.from('watchlist').insert({ user_id: uid, listing_id: listingId });
      }
      return !already;
    } catch {
      // Roll back on error
      setIds(prev => {
        const next = new Set(prev);
        if (already) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
      return already;
    } finally {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      // Once the last concurrent toggle settles, reconcile with server truth.
      if (pendingRef.current === 0) fetchRef.current?.();
    }
  }, [currentUser?.id, ids]);

  return {
    isWatchlisted: useCallback((listingId) => ids.has(listingId), [ids]),
    toggle,
    count: ids.size,
    loading,
  };
};
