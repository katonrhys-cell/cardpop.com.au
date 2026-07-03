import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TrendingUp, ChevronRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import {
  PRICE_CATEGORIES,
  CATEGORY_ORDER,
  fetchTrackedCards,
  formatAud,
} from '@/lib/cardPrices.js';

const CardTile = ({ card }) => (
  <Link
    to={`/prices/${card.category}/${card.slug}`}
    className="group bg-card border border-border rounded-2xl p-5 flex flex-col gap-1 hover:border-primary/50 hover:shadow-md transition-all"
  >
    <div className="font-semibold leading-snug group-hover:text-primary transition-colors">
      {card.name}
    </div>
    <div className="text-sm text-muted-foreground">
      {card.set_name}
      {card.card_number ? ` · ${card.card_number}` : ''}
    </div>
    <div className="mt-3 flex items-baseline justify-between">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Raw avg</div>
        <div className="text-lg font-bold">{formatAud(card.latest?.raw_avg)}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Graded avg</div>
        <div className="text-lg font-bold">{formatAud(card.latest?.graded_avg)}</div>
      </div>
    </div>
  </Link>
);

const CardPricesHubPage = () => {
  const { category } = useParams();
  const [cards, setCards] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const isValidCategory = !category || Boolean(PRICE_CATEGORIES[category]);

  useEffect(() => {
    if (!isValidCategory) return;
    let cancelled = false;
    fetchTrackedCards(category || null)
      .then((data) => { if (!cancelled) setCards(data); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [category, isValidCategory]);

  const grouped = useMemo(() => {
    const byCategory = {};
    for (const card of cards || []) {
      (byCategory[card.category] ||= []).push(card);
    }
    return byCategory;
  }, [cards]);

  if (!isValidCategory) return <Navigate to="/prices" replace />;

  const activeCategory = category ? PRICE_CATEGORIES[category] : null;
  const title = activeCategory
    ? `${activeCategory.label} Card Prices in AUD | CardPop`
    : 'Trading Card Prices in AUD | CardPop';
  const description = activeCategory
    ? `Live Australian-dollar market prices for ${activeCategory.label} cards — raw and graded averages updated daily from live listings. ${activeCategory.blurb}`
    : 'Live Australian-dollar market prices for Pokémon, NBA, One Piece, AFL and NRL trading cards. Raw and graded averages updated daily — no USD conversion guesswork.';

  const sections = category ? [category] : CATEGORY_ORDER;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={title}
        description={description}
        canonicalUrl={category ? `/prices/${category}` : '/prices'}
      />

      <section className="bg-card border-b border-border py-16 text-center">
        <div className="container mx-auto px-4">
          <TrendingUp className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {activeCategory ? `${activeCategory.label} Card Prices` : 'Card Prices'}{' '}
            <span className="text-primary">in AUD</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {activeCategory
              ? activeCategory.blurb
              : 'What cards are really worth in Australian dollars. Raw and graded market prices, updated daily from live listings — not stale US prices run through a currency converter.'}
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {!category && (
          <nav aria-label="Card categories" className="flex flex-wrap gap-2 justify-center">
            {CATEGORY_ORDER.map((key) => (
              <Link
                key={key}
                to={`/prices/${key}`}
                className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors"
              >
                {PRICE_CATEGORIES[key].label}
              </Link>
            ))}
          </nav>
        )}

        {loadError && (
          <p className="text-center text-muted-foreground">
            Prices are temporarily unavailable. Please try again shortly.
          </p>
        )}

        {!loadError && cards === null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 h-32 animate-pulse" />
            ))}
          </div>
        )}

        {cards !== null && sections.map((key) => {
          const sectionCards = grouped[key] || [];
          if (sectionCards.length === 0) return null;
          return (
            <section key={key}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{PRICE_CATEGORIES[key].label}</h2>
                {!category && (
                  <Link
                    to={`/prices/${key}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    All {PRICE_CATEGORIES[key].label} prices <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(category ? sectionCards : sectionCards.slice(0, 6)).map((card) => (
                  <CardTile key={card.slug} card={card} />
                ))}
              </div>
            </section>
          );
        })}

        <section className="bg-card border border-border rounded-3xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Buy and sell these cards on CardPop</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Every price page links straight to live CardPop marketplace listings, so you can act on
            the numbers — buy from verified Australian sellers or list your own cards in minutes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/marketplace" className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
              Browse the marketplace
            </Link>
            <Link to="/signup" className="px-6 py-3 rounded-full border border-border bg-background font-semibold hover:border-primary/50 transition-colors">
              Start selling
            </Link>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto">
          Methodology: prices are aggregated daily from live eBay Australia and international
          listings (converted to AUD at the current exchange rate), with outliers trimmed. Figures
          reflect current asking prices, not completed sales, and are a guide only.
        </p>
      </div>
    </div>
  );
};

export default CardPricesHubPage;
