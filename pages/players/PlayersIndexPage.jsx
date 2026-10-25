import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, UsersRound } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import usePlayers from '@/hooks/usePlayers.js';
import { PlayerAvatar } from '@/components/PlayerPicker.jsx';
import { groupPlayersBySport, matchPlayers, playerPath, playerSubtitle, PLAYERS_INDEX_SEO } from '@/utils/players.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const PlayerTile = ({ player }) => (
  <Link
    to={playerPath(player)}
    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
  >
    <PlayerAvatar player={player} className="h-14 w-14 text-base" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors">{player.name}</p>
      <p className="truncate text-xs text-muted-foreground">{playerSubtitle(player)}</p>
      {player.headline && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{player.headline}</p>}
    </div>
    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
  </Link>
);

const PlayersIndexPage = () => {
  const { players, loading, error } = usePlayers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => matchPlayers(players, query, players.length || 1), [players, query]);
  const groups = useMemo(() => groupPlayersBySport(filtered), [filtered]);

  const structuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Players — the most collected athletes',
    url: `${SITE_ORIGIN}/players`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: players.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
        url: `${SITE_ORIGIN}${playerPath(p)}`,
      })),
    },
  }), [players]);

  return (
    <div className="container-default section-padding">
      <SEOHead
        title={PLAYERS_INDEX_SEO.title}
        description={PLAYERS_INDEX_SEO.description}
        canonicalUrl={`${SITE_ORIGIN}/players`}
        structuredData={structuredData}
      />

      <div className="max-w-3xl mx-auto text-center mb-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UsersRound className="h-6 w-6" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3">Players</h1>
        <p className="text-muted-foreground">
          The athletes collectors chase most. Each page has a short profile, the cards worth knowing,
          Australian-dollar price history where we track it, and every card of theirs listed on CardPop.
        </p>
      </div>

      <div className="relative max-w-md mx-auto mb-10">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players — e.g. LeBron, Wemby, Daicos"
          className="h-11 pl-9 bg-background"
          aria-label="Search players"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(9).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : error ? (
        <p className="text-center text-muted-foreground">Player pages are unavailable right now. Please try again shortly.</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No player matches “{query}”. Only the most collected athletes have pages so far.
        </p>
      ) : (
        <div className="space-y-10">
          {groups.map(({ sport, players: items }) => (
            <section key={sport}>
              <h2 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">{sport}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((p) => <PlayerTile key={p.id} player={p} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Adding a card to your vault? Pick the player in the card form and it appears on their page once listed.{' '}
        <Link to="/vault/add" className="font-bold text-primary hover:underline">List a card</Link>
      </p>
    </div>
  );
};

export default PlayersIndexPage;
