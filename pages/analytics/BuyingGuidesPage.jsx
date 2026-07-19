import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Flame, Calendar } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { BUYING_GUIDES, GUIDE_CATEGORY_META } from '@/data/buyingGuides.js';

const StatusBadge = ({ status }) => {
  if (status === 'coming-soon') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        <Calendar className="w-3 h-3" /> Coming soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
      <Flame className="w-3 h-3" /> New release
    </span>
  );
};

const GuideCard = ({ guide }) => {
  const categoryLabel = GUIDE_CATEGORY_META[guide.category]?.label || guide.game;
  const topChase = guide.chaseCards?.[0];
  return (
    <Link
      to={`/analytics/buying-guides/${guide.slug}`}
      className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all"
    >
      {/* Accent header */}
      <div className={`relative bg-gradient-to-br ${guide.gradient} p-5 text-white`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
            {categoryLabel}
          </span>
          <StatusBadge status={guide.status} />
        </div>
        <h2 className="text-xl font-bold leading-tight">{guide.shortTitle}</h2>
        <p className="mt-1 text-sm text-white/85">{guide.releaseLabel}</p>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">{guide.summary}</p>

        {topChase && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Top chase</p>
              <p className="text-sm font-semibold truncate">{topChase.name}</p>
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center gap-1 text-sm font-semibold text-primary">
          Read the guide
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
};

const BuyingGuidesPage = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'CardPop Buying Guides',
    itemListElement: BUYING_GUIDES.map((guide, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: guide.title,
      url: `https://cardpop.com.au/analytics/buying-guides/${guide.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Trading Card Buying Guides — New Releases & Chase Cards | CardPop"
        description="What to chase in the newest trading card releases. CardPop buying guides break down the latest Pokémon expansions, AFL Teamcoach and Topps sets — and the chase cards worth hunting."
        canonicalUrl="/analytics/buying-guides"
        structuredData={structuredData}
      />

      <section className="bg-card border-b border-border py-16 text-center">
        <div className="container mx-auto px-4">
          <Sparkles className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Buying <span className="text-primary">Guides</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The newest sets, decoded. We break down every fresh release — the latest Pokémon
            expansion, the current AFL Teamcoach range, the newest Topps drop — and call out the
            <span className="text-foreground font-medium"> chase cards</span> actually worth hunting.
          </p>
        </div>
      </section>

      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {BUYING_GUIDES.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>

        <section className="bg-card border border-border rounded-3xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Found your chase? Track it or buy it.</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Every guide links straight to live CardPop listings and AUD price data, so you can go
            from "I want that card" to owning it without leaving the site.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/marketplace" className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
              Browse the marketplace
            </Link>
            <Link to="/prices" className="px-6 py-3 rounded-full border border-border bg-background font-semibold hover:border-primary/50 transition-colors">
              Check card prices
            </Link>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto">
          Chase-card values are indicative AUD guides only, given as ranges because new-release
          prices move quickly in the weeks after launch. Always check current live listings before
          buying or selling.
        </p>
      </div>
    </div>
  );
};

export default BuyingGuidesPage;
