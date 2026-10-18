import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, UsersRound } from 'lucide-react';
import usePlayers from '@/hooks/usePlayers.js';
import { PlayerAvatar } from '@/components/PlayerPicker.jsx';
import { playerPath, playersForSport } from '@/utils/players.js';

/**
 * "Shop by player" row for a sport's collection page: the published players
 * whose sport matches the collection (name or alias), linking to each player
 * page. Renders nothing for a TCG collection or while the list is loading, so
 * it never shifts a page that has no players. Mirrors the list the prerender
 * emits for bots (api/prerender.js renderCollection).
 */
const PlayersStrip = ({ names = [], className = '' }) => {
  const { players } = usePlayers();
  const matched = useMemo(() => playersForSport(players, names), [players, names]);
  if (!matched.length) return null;

  return (
    <section className={className} aria-labelledby="players-strip-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="players-strip-heading" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <UsersRound className="h-5 w-5 text-primary" /> Shop by player
        </h2>
        <Link to="/players" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          All players <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {matched.map((p) => (
          <Link
            key={p.id}
            to={playerPath(p)}
            className="group flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
          >
            <PlayerAvatar player={p} className="h-10 w-10 text-xs" />
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-sm font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</span>
              {p.team && <span className="block whitespace-nowrap text-xs text-muted-foreground">{p.team}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default PlayersStrip;
