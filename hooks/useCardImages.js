import { useEffect, useMemo, useState } from 'react';

// Resolves official card art for a list of cards through the backend
// (`POST /catalog/images`), which does the upstream lookup once and caches it
// across all visitors. The browser only ever receives ready image URLs — no
// per-visitor rate-limit exposure, no Supabase egress.
//
// Usage:
//   const imageFor = useCardImages(cards);
//   <img src={imageFor(card)} />   // null until resolved / on a miss
//
// A card that already carries a `thumbnailUrl` (e.g. live eBay data) is used
// as-is and never sent for resolution.

const API_BASE = '/hcgi/api';

// Module-level cache so results persist across tab switches and remounts for the
// life of the SPA session (one network round-trip per unique card, ever).
const memCache = new Map(); // key -> url | null

const keyFor = (c) => `${(c?.name || '').trim()}|${(c?.set || '').trim()}`;

export function useCardImages(cards) {
  // Bumped when freshly-resolved URLs land so consumers re-render.
  const [, setVersion] = useState(0);

  // Stable signature of the cards still needing resolution — drives the effect
  // without refetching on every render.
  const pending = useMemo(() => {
    const seen = new Set();
    const need = [];
    for (const c of cards || []) {
      if (!c || c.thumbnailUrl) continue; // supplied thumbnail wins
      const key = keyFor(c);
      if (!c.name || seen.has(key) || memCache.has(key)) continue;
      seen.add(key);
      need.push({ key, name: c.name, set: c.set || '', collection: c.collection || '' });
    }
    return need;
  }, [cards]);

  const signature = pending.map((c) => c.key).sort().join('');

  useEffect(() => {
    if (!pending.length) return;
    let cancelled = false;

    fetch(`${API_BASE}/catalog/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: pending }),
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then(({ results }) => {
        if (cancelled) return;
        for (const item of results || []) {
          memCache.set(item.key, item.image?.small || item.image?.large || null);
        }
        setVersion((v) => v + 1);
      })
      .catch(() => {
        // Network error — leave keys uncached so a later render retries.
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (card) => card?.thumbnailUrl || memCache.get(keyFor(card)) || null;
}

export default useCardImages;
