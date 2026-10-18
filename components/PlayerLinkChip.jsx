import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { fetchPlayerById } from '@/lib/players.js';
import { playerPath } from '@/utils/players.js';
import { PlayerAvatar } from '@/components/PlayerPicker.jsx';

// Cache per page so a product page and its "more from this seller" rail don't
// each re-read the same player.
const cache = new Map();

/**
 * "Player: LeBron James →" chip for a card tagged with a player. Reads the
 * player row itself (by id) rather than embedding it in the card query, so a
 * grid or product page whose main query must not grow never breaks if the
 * players table is unavailable — the chip simply doesn't render.
 */
const PlayerLinkChip = ({ playerId, className = '' }) => {
  const [player, setPlayer] = useState(() => cache.get(playerId) || null);

  useEffect(() => {
    if (!playerId) { setPlayer(null); return undefined; }
    if (cache.has(playerId)) { setPlayer(cache.get(playerId)); return undefined; }
    let cancelled = false;
    fetchPlayerById(playerId)
      .then((p) => { if (p) cache.set(playerId, p); if (!cancelled) setPlayer(p || null); })
      .catch(() => { if (!cancelled) setPlayer(null); });
    return () => { cancelled = true; };
  }, [playerId]);

  if (!player) return null;
  return (
    <Link
      to={playerPath(player)}
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary ${className}`}
    >
      <PlayerAvatar player={player} className="h-5 w-5 text-[9px]" />
      <span className="text-muted-foreground font-medium">Player</span>
      <span>{player.name}</span>
      <UserRound className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
};

export default PlayerLinkChip;
