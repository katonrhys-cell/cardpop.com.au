import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Sparkles, ArrowLeft, ArrowRight, Flame, Calendar, Crown, TrendingUp, Trophy, Lightbulb, LineChart,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { getBuyingGuide, BUYING_GUIDES, GUIDE_CATEGORY_META, GUIDE_PRICE_CATEGORY } from '@/data/buyingGuides.js';
import { fetchPokemonCardImage } from '@/utils/pokemonCardImage.js';
import { fetchTrackedCards, formatAud, PRICE_CATEGORIES } from '@/lib/cardPrices.js';

// Value-chip styling by chase tier.
const TIER_STYLES = {
  grail: { label: 'Grail', chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Icon: Crown },
  high: { label: 'High', chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', Icon: TrendingUp },
  mid: { label: 'Value', chip: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', Icon: Trophy },
};

// Pokémon card art thumbnail — fetched lazily from the Pokémon TCG API (its own
// CDN, so no Supabase egress). Falls back to a gradient placeholder for
// non-Pokémon guides or when a lookup misses.
const ChaseArt = ({ pokemonName, set, gradient }) => {
  const [img, setImg] = useState(undefined); // undefined = loading, null = none

  useEffect(() => {
    if (!pokemonName) { setImg(null); return; }
    let cancelled = false;
    fetchPokemonCardImage(pokemonName, set)
      .then((r) => { if (!cancelled) setImg(r?.small || null); })
      .catch(() => { if (!cancelled) setImg(null); });
    return () => { cancelled = true; };
  }, [pokemonName, set]);

  if (img) {
    return (
      <img
        src={img}
        alt=""
        loading="lazy"
        className="w-full h-full object-contain drop-shadow-md"
      />
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${gradient}`}>
      {img === undefined && pokemonName
        ? <div className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white/90 animate-spin" />
        : <Sparkles className="w-8 h-8 text-white/70" />}
    </div>
  );
};

// Inline "live price" line shown on a chase card when it maps to a tracked card
// in the /prices dataset (card.priceRef → tracked_cards.slug). Links through to
// the full price page. `tracked` is the tracked card (with its latest snapshot)
// resolved by the parent, or undefined when there's no match / data isn't in yet.
const ChasePriceLink = ({ tracked }) => {
  if (!tracked) return null;
  const raw = tracked.latest?.raw_avg;
  const graded = tracked.latest?.graded_avg;
  const href = `/prices/${tracked.category}/${tracked.slug}`;
  return (
    <Link
      to={href}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
    >
      <LineChart className="w-3.5 h-3.5 shrink-0" />
      {raw != null || graded != null ? (
        <span>
          Live market: {formatAud(raw)} raw
          {graded != null && <> · {formatAud(graded)} graded</>}
        </span>
      ) : (
        <span>Track {tracked.name} prices</span>
      )}
      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
    </Link>
  );
};

const ChaseCard = ({ card, guide, tracked }) => {
  const tier = TIER_STYLES[card.tier] || TIER_STYLES.mid;
  const isPokemon = guide.category === 'pokemon';
  return (
    <div className="flex gap-4 bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all">
      <div className="w-24 sm:w-28 shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-muted">
        <ChaseArt
          pokemonName={isPokemon ? card.pokemonName : null}
          set={guide.pokemonSet}
          gradient={guide.gradient}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-tight">{card.name}</h3>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0 ${tier.chip}`}>
            <tier.Icon className="w-3 h-3" /> {tier.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
        <p className="text-sm mt-2 leading-relaxed text-muted-foreground">{card.blurb}</p>
        <p className="mt-2 text-sm font-bold text-foreground">
          {card.value}
          {/^[$\d]/.test(card.value) && (
            <span className="text-xs font-normal text-muted-foreground"> AUD</span>
          )}
        </p>
        {tracked && (
          <div>
            <ChasePriceLink tracked={tracked} />
          </div>
        )}
      </div>
    </div>
  );
};

const BuyingGuideDetailPage = () => {
  const { slug } = useParams();
  const guide = getBuyingGuide(slug);

  // Live price data: pull the tracked cards for this guide's mapped price
  // category (null → no matching /prices category, e.g. baseball). The result
  // powers both the "Live AUD prices" section and the inline price line on any
  // chase card whose priceRef points at a tracked card. `null` = still loading.
  const priceCategory = guide ? GUIDE_PRICE_CATEGORY[guide.category] : null;
  const [tracked, setTracked] = useState(null);

  useEffect(() => {
    if (!priceCategory) { setTracked([]); return; }
    let cancelled = false;
    fetchTrackedCards(priceCategory)
      .then((cards) => { if (!cancelled) setTracked(cards); })
      .catch(() => { if (!cancelled) setTracked([]); });
    return () => { cancelled = true; };
  }, [priceCategory]);

  // slug → tracked card, for resolving each chase card's priceRef.
  const trackedBySlug = useMemo(() => {
    const map = {};
    for (const c of tracked || []) map[c.slug] = c;
    return map;
  }, [tracked]);

  if (!guide) return <Navigate to="/analytics/buying-guides" replace />;

  const categoryLabel = GUIDE_CATEGORY_META[guide.category]?.label || guide.game;
  const others = BUYING_GUIDES.filter((g) => g.slug !== guide.slug);
  const marketplaceLink = `/marketplace?q=${encodeURIComponent(guide.marketplaceQuery)}`;
  const priceCategoryMeta = priceCategory ? PRICE_CATEGORIES[priceCategory] : null;
  // Cards to feature in the live-price section (cap so a big category like
  // Pokémon doesn't dump 37 rows onto the page).
  const livePriceCards = (tracked || []).filter((c) => c.latest).slice(0, 8);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${guide.title} — Buying Guide & Chase Cards`,
    description: guide.summary,
    datePublished: guide.releaseDate,
    dateModified: guide.updated,
    author: { '@type': 'Organization', name: 'CardPop' },
    publisher: { '@type': 'Organization', name: 'CardPop' },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${guide.shortTitle} Buying Guide — Chase Cards to Hunt | CardPop`}
        description={guide.summary}
        canonicalUrl={`/analytics/buying-guides/${guide.slug}`}
        structuredData={structuredData}
      />

      {/* Hero */}
      <section className={`relative bg-gradient-to-br ${guide.gradient} text-white`}>
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <Link
            to="/analytics/buying-guides"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> All buying guides
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
              {categoryLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
              {guide.status === 'coming-soon'
                ? <><Calendar className="w-3 h-3" /> Coming soon</>
                : <><Flame className="w-3 h-3" /> New release</>}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/85">
              <Calendar className="w-3 h-3" /> {guide.releaseLabel}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight max-w-3xl">{guide.title}</h1>
          <p className="mt-3 text-lg text-white/90 max-w-2xl">{guide.tagline}</p>
        </div>
      </section>

      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-3 gap-10">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-10">
          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold mb-4">The set at a glance</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              {guide.overview.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          {/* Chase cards */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">The chase cards</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              The most valuable and most-hyped cards in the set — ranked by how hard collectors are
              hunting them right now.
            </p>
            <div className="grid gap-4">
              {guide.chaseCards.map((card, i) => (
                <ChaseCard
                  key={`${card.name}-${i}`}
                  card={card}
                  guide={guide}
                  tracked={card.priceRef ? trackedBySlug[card.priceRef] : undefined}
                />
              ))}
            </div>
          </section>

          {/* Live prices — wires the guide into the existing /prices dataset.
              Shown only when the category has tracked cards with snapshots. */}
          {priceCategoryMeta && livePriceCards.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <LineChart className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Live {priceCategoryMeta.label} prices</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Real AUD market data for tracked {priceCategoryMeta.label} cards, updated daily —
                handy context while you decide what to chase.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {livePriceCards.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/prices/${c.category}/${c.slug}`}
                    className="group bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="font-semibold leading-snug group-hover:text-primary transition-colors truncate">
                      {c.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.set_name}</div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Raw avg</div>
                        <div className="text-base font-bold">{formatAud(c.latest?.raw_avg)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Graded avg</div>
                        <div className="text-base font-bold">{formatAud(c.latest?.graded_avg)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                to={`/prices/${priceCategory}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                View all {priceCategoryMeta.label} prices
                <ArrowRight className="w-4 h-4" />
              </Link>
            </section>
          )}

          {/* Collecting tips */}
          {guide.collectingTips?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Collector tips</h2>
              </div>
              <ul className="space-y-3">
                {guide.collectingTips.map((tip, i) => (
                  <li key={i} className="flex gap-3 bg-muted/50 rounded-xl px-4 py-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-sm text-muted-foreground leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* CTA */}
          <section className="bg-card border border-border rounded-3xl p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Chase it on CardPop</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Browse live listings for {guide.shortTitle} from verified Australian sellers — or list
              your own pulls in minutes.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to={marketplaceLink} className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                Shop {guide.shortTitle}
              </Link>
              <Link to="/prices" className="px-6 py-3 rounded-full border border-border bg-background font-semibold hover:border-primary/50 transition-colors">
                Check AUD prices
              </Link>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Quick facts */}
          <div className="bg-card border border-border rounded-2xl p-5 lg:sticky lg:top-24">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground mb-4">
              Quick facts
            </h3>
            <dl className="space-y-3">
              {guide.quickFacts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                  <dd className="text-sm font-semibold leading-snug">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Other guides */}
          {others.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground mb-4">
                More guides
              </h3>
              <div className="space-y-2">
                {others.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/analytics/buying-guides/${g.slug}`}
                    className="group flex items-center gap-3 rounded-xl p-2 -mx-2 hover:bg-muted transition-colors"
                  >
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${g.gradient} shrink-0`}>
                      <Sparkles className="w-4 h-4 text-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                        {g.shortTitle}
                      </span>
                      <span className="block text-xs text-muted-foreground">{GUIDE_CATEGORY_META[g.category]?.label || g.game}</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto px-4 pb-12">
        Values are indicative AUD guides only and given as ranges — new-release prices move fast.
        Card artwork, where shown, is sourced from the Pokémon TCG API. Always check current live
        listings before buying or selling.
      </p>
    </div>
  );
};

export default BuyingGuideDetailPage;
