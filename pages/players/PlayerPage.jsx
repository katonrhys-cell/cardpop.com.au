import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Sparkles, Tag, TrendingUp, UsersRound } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import SEOHead from '@/components/SEOHead.jsx';
import BackButton from '@/components/BackButton.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerPicker.jsx';
import { fetchPlayerBySlug, fetchPlayerListings, fetchPlayerTrackedCards } from '@/lib/players.js';
import { formatAud } from '@/lib/cardPrices.js';
import { resolveCollectionSlug } from '@/data/collectionConfigs.js';
import { formatBorn, playerPath, playerSubtitle, splitParagraphs } from '@/utils/players.js';
import { publicImageUrl } from '@/utils/imageUrl.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const formatDate = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const Fact = ({ label, value }) => (
  value ? (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  ) : null
);

// A tracker card's stat tile + link to its full price page.
const TrackedCardTile = ({ card }) => {
  const latest = card.latest;
  return (
    <Link
      to={`/prices/${card.category}/${card.slug}`}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{card.name}</p>
      {card.set_name && <p className="text-xs text-muted-foreground -mt-1">{card.set_name}{card.card_number ? ` · #${card.card_number}` : ''}</p>}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Raw avg</div>
          <div className="font-bold">{formatAud(latest?.raw_avg)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Graded avg</div>
          <div className="font-bold">{formatAud(latest?.graded_avg)}</div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
        Full price history <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
};

const PlayerPage = () => {
  const { slug } = useParams();
  const [player, setPlayer] = useState(undefined); // undefined = loading, null = not found
  const [listings, setListings] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [chartCard, setChartCard] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPlayer(undefined);
    setListings([]);
    setTracked([]);
    setChartCard(null);
    fetchPlayerBySlug(slug)
      .then(async (p) => {
        if (cancelled) return;
        setPlayer(p || null);
        if (!p) return;
        // Listings and price history are independent and each is optional:
        // a failure in one leaves the rest of the page standing.
        const [l, t] = await Promise.allSettled([
          fetchPlayerListings(p.id),
          fetchPlayerTrackedCards(p.id),
        ]);
        if (cancelled) return;
        if (l.status === 'fulfilled') setListings(l.value);
        if (t.status === 'fulfilled') {
          setTracked(t.value);
          const withHistory = t.value.find((c) => c.history.length >= 2) || t.value[0] || null;
          setChartCard(withHistory?.id || null);
        }
      })
      .catch(() => { if (!cancelled) setPlayer(null); });
    return () => { cancelled = true; };
  }, [slug]);

  const paragraphs = useMemo(() => splitParagraphs(player?.bio), [player]);
  const notes = useMemo(() => splitParagraphs(player?.collecting_notes), [player]);
  const keyCards = useMemo(() => (Array.isArray(player?.key_cards) ? player.key_cards : []), [player]);
  const collectionSlug = useMemo(() => resolveCollectionSlug(player?.sport || ''), [player]);

  const charted = useMemo(() => tracked.find((c) => c.id === chartCard) || null, [tracked, chartCard]);
  const chartData = useMemo(() => (charted?.history || []).map((s) => ({
    date: formatDate(s.snapshot_date),
    Raw: s.raw_avg != null ? Number(s.raw_avg) : null,
    Graded: s.graded_avg != null ? Number(s.graded_avg) : null,
  })), [charted]);

  const structuredData = useMemo(() => {
    if (!player) return null;
    const url = `${SITE_ORIGIN}${playerPath(player)}`;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Players', item: `${SITE_ORIGIN}/players` },
          { '@type': 'ListItem', position: 2, name: player.name, item: url },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url,
        mainEntity: {
          '@type': 'Person',
          name: player.name,
          ...(player.nationality ? { nationality: player.nationality } : {}),
          ...(player.born_on ? { birthDate: player.born_on } : {}),
          ...(player.team ? { memberOf: { '@type': 'SportsTeam', name: player.team } } : {}),
          ...(player.image_url ? { image: publicImageUrl(player.image_url) } : {}),
          description: player.headline || undefined,
        },
      },
    ];
  }, [player]);

  if (player === null) {
    return (
      <div className="min-h-[60vh] bg-background flex flex-col items-center justify-center gap-4 py-24 text-center">
        <SEOHead title="Player not found | CardPop" description="This player page does not exist." noindex />
        <h1 className="text-2xl font-bold">Player not found</h1>
        <p className="text-muted-foreground">Only the most collected athletes have pages so far.</p>
        <Link to="/players" className="text-primary font-bold hover:underline">Browse all players</Link>
      </div>
    );
  }

  if (player === undefined) {
    return (
      <div className="container-default section-padding space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const title = `${player.name} Cards — Rookie Cards, Prices & Listings | CardPop`;
  const description = player.headline
    ? `${player.name} (${player.sport}${player.team ? `, ${player.team}` : ''}): ${player.headline} Key cards, Australian-dollar prices and every ${player.name} card listed on CardPop.`
    : `${player.name} trading cards: key rookie cards, Australian-dollar prices and every card listed on CardPop.`;

  const activeListings = listings.filter((l) => l.status === 'active');

  return (
    <div className="container-default section-padding">
      <SEOHead
        title={title}
        description={description}
        canonicalUrl={`${SITE_ORIGIN}${playerPath(player)}`}
        ogImage={player.image_url ? publicImageUrl(player.image_url) : undefined}
        structuredData={structuredData}
      />

      <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
        <BackButton fallback="/players" />
        <Link to="/players" className="inline-flex items-center gap-1.5 hover:text-primary"><UsersRound className="h-4 w-4" /> Players</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{player.name}</span>
      </div>

      {/* Hero */}
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-start">
        <PlayerAvatar player={player} className="h-24 w-24 text-2xl md:h-32 md:w-32 md:text-3xl" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {collectionSlug ? (
              <Link to={`/collections/${collectionSlug}`}><Badge variant="outline" className="font-bold">{player.sport}</Badge></Link>
            ) : (
              <Badge variant="outline" className="font-bold">{player.sport}</Badge>
            )}
            {player.team && <Badge variant="secondary" className="font-medium">{player.team}</Badge>}
            {player.position && <Badge variant="secondary" className="font-medium">{player.position}</Badge>}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold font-heading text-balance">{player.name}</h1>
          {player.headline && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{player.headline}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Nationality" value={player.nationality} />
            <Fact label="Born" value={formatBorn(player)} />
            <Fact label="Career" value={player.career_span} />
            <Fact label="Cards on CardPop" value={listings.length ? `${activeListings.length} live` : null} />
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          {/* Bio */}
          {paragraphs.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">About {player.name}</h2>
              <div className="space-y-4 text-foreground/90 leading-relaxed">
                {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          )}

          {/* Collecting notes */}
          {notes.length > 0 && (
            <section className="rounded-2xl border border-border bg-muted/30 p-6">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5 text-primary" /> Collecting {player.name}</h2>
              <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
                {notes.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          )}

          {/* Price history */}
          {tracked.length > 0 && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold"><TrendingUp className="h-5 w-5 text-primary" /> Price history (AUD)</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Daily Australian-dollar averages from live listings for the {player.name} cards CardPop tracks. Asking prices, not sales — a guide only.
              </p>
              {tracked.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {tracked.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      size="sm"
                      variant={c.id === chartCard ? 'default' : 'outline'}
                      onClick={() => setChartCard(c.id)}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              )}
              {chartData.length >= 2 ? (
                <div className="h-72 w-full rounded-2xl border border-border bg-card p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={(v) => `$${v}`} width={70} />
                      <Tooltip formatter={(value) => formatAud(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="Raw" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="Graded" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Price history builds daily — the chart appears once {charted?.name || 'this card'} has a few days of data.
                </p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {tracked.map((c) => <TrackedCardTile key={c.id} card={c} />)}
              </div>
            </section>
          )}
        </div>

        {/* Key cards */}
        <aside className="space-y-6">
          {keyCards.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><BadgeCheck className="h-5 w-5 text-primary" /> Cards worth knowing</h2>
              <ol className="space-y-4">
                {keyCards.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{c.name}</p>
                      {c.note && <p className="text-sm text-muted-foreground">{c.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            <p className="mb-3 font-bold text-foreground">Got a {player.name} card?</p>
            <p className="mb-4">Pick {player.name} in the Player field when you add it to your vault and it appears here once listed.</p>
            <Button asChild size="sm"><Link to="/vault/add"><Tag className="mr-1.5 h-4 w-4" /> List a card</Link></Button>
          </section>
        </aside>
      </div>

      {/* Listings */}
      <section className="mt-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{player.name} cards on CardPop</h2>
            <p className="text-sm text-muted-foreground">
              {listings.length
                ? `${activeListings.length} live listing${activeListings.length === 1 ? '' : 's'}${listings.length > activeListings.length ? `, ${listings.length - activeListings.length} recently sold` : ''}.`
                : 'No cards tagged with this player are listed yet.'}
            </p>
          </div>
          {collectionSlug && (
            <Link to={`/collections/${collectionSlug}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              Browse all {player.sport} cards <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        {listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((listing, i) => (
              <MarketplaceListingCard key={listing.id} listing={listing} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Be the first — list a {player.name} card and tag the player in the form.
          </div>
        )}
      </section>
    </div>
  );
};

export default PlayerPage;
