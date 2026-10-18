import { useEffect, useState } from 'react';
import { fetchPublishedPlayers } from '@/lib/players.js';

// One read per page load, shared by every picker, chip and search on the page.
// The list is small (tens to a few hundred rows) and changes only when an
// admin edits it, so a module-level cache with a short TTL is enough; the
// player page itself reads its row fresh.
const TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, players: null, promise: null };

export function loadPlayers({ force = false } = {}) {
  const fresh = cache.players && Date.now() - cache.at < TTL_MS;
  if (fresh && !force) return Promise.resolve(cache.players);
  if (cache.promise && !force) return cache.promise;
  cache.promise = fetchPublishedPlayers()
    .then((players) => {
      cache = { at: Date.now(), players, promise: null };
      return players;
    })
    .catch((err) => {
      cache.promise = null;
      throw err;
    });
  return cache.promise;
}

/** Test hook: forget the cached list. */
export const resetPlayersCache = () => { cache = { at: 0, players: null, promise: null }; };

/**
 * The published players, in display order. `players` is [] until loaded;
 * `error` is set (and the list stays empty) if the read fails, so a form that
 * embeds the picker still works when the players table is unreachable.
 */
export default function usePlayers({ enabled = true } = {}) {
  const [players, setPlayers] = useState(() => cache.players || []);
  const [loading, setLoading] = useState(enabled && !cache.players);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(!cache.players);
    loadPlayers()
      .then((list) => { if (!cancelled) { setPlayers(list); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  return { players, loading, error };
}
