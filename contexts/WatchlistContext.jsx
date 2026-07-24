import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

/**
 * App-wide watchlist state. Mounted once in App.jsx so the whole tree shares
 * ONE watchlist query and ONE realtime channel — previously every rendered
 * listing card ran its own copy of this logic via useWatchlist(), so a
 * 24-card marketplace grid meant ~24 identical full-watchlist fetches plus
 * 24 websocket subscriptions per authenticated visitor, each with its own
 * (mutually inconsistent) ids Set.
 *
 * Consumers keep using useWatchlist() from '@/hooks/useWatchlist.js', which
 * now just reads this context.
 */
export const WatchlistContext = createContext(null);

export const WatchlistProvider = ({ children }) => {
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

  /**
   * Toggle a listing's watchlist membership.
   * Returns { success, watchlisted }:
   *   success    — whether the DB write succeeded
   *   watchlisted — the resulting membership state
   * (A bare boolean was ambiguous: a successful *removal* and a *failure* both
   * looked the same to callers.)
   */
  const toggle = useCallback(async (listingId) => {
    if (!currentUser?.id) return { success: false, watchlisted: ids.has(listingId) };
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

    let error;
    try {
      // Supabase resolves with { error } rather than throwing, so inspect it
      // explicitly — otherwise a failed write would be treated as success.
      if (already) {
        ({ error } = await supabase.from('watchlist').delete().eq('user_id', uid).eq('listing_id', listingId));
      } else {
        ({ error } = await supabase.from('watchlist').insert({ user_id: uid, listing_id: listingId }));
      }
    } catch (e) {
      error = e;
    }

    if (error) {
      // Roll back the optimistic change.
      setIds(prev => {
        const next = new Set(prev);
        if (already) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    }

    pendingRef.current = Math.max(0, pendingRef.current - 1);
    // Once the last concurrent toggle settles, reconcile with server truth.
    if (pendingRef.current === 0) fetchRef.current?.();

    return error
      ? { success: false, watchlisted: already }
      : { success: true, watchlisted: !already };
  }, [currentUser?.id, ids]);

  const isWatchlisted = useCallback((listingId) => ids.has(listingId), [ids]);

  const value = useMemo(
    () => ({ isWatchlisted, toggle, count: ids.size, loading }),
    [isWatchlisted, toggle, ids.size, loading],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
};
