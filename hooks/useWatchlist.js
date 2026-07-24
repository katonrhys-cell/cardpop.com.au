import { useContext } from 'react';
import { WatchlistContext } from '@/contexts/WatchlistContext.jsx';

/**
 * Watchlist state and toggle for the current user, shared app-wide via
 * WatchlistProvider (mounted once in App.jsx — see contexts/WatchlistContext.jsx
 * for why this must not be per-component state).
 * isWatchlisted(listingId) — O(1) Set lookup
 * toggle(listingId)        — optimistic update, rolls back on error
 * count                    — number of watchlisted listings
 */
export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
};
