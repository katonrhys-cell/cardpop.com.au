import React from 'react';
import { Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EARLY_BIRD, FEATURED_PACKAGES, featuredQuote, formatAud, isEarlyBird,
} from '@/utils/featuredPackages.js';

/**
 * The moment an organiser has just submitted an event — the point they care
 * most about attendance — My Events offers featuring once, in gold. Prices
 * come from utils/featuredPackages.js (the table the server charges from),
 * early bird included. Dismissable; never shown for an event that can't be
 * featured (the caller checks featureEligibility()).
 */
const FeatureUpsellCard = ({ event, today, onFeature, onDismiss }) => {
  if (!event) return null;
  const cheapest = FEATURED_PACKAGES[0];
  const quote = featuredQuote(cheapest.key, event.start_date, today);
  const earlyBird = isEarlyBird(event.start_date, today);

  return (
    <section
      aria-labelledby="feature-upsell-heading"
      data-testid="feature-upsell"
      className="relative rounded-2xl border-2 border-amber-400 bg-amber-50/70 dark:bg-amber-400/5 p-5 shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_4px_20px_rgba(251,191,36,0.25)]"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-amber-400/20 hover:text-foreground"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-950">
          <Star className="w-5 h-5 fill-current" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="feature-upsell-heading" className="font-bold text-foreground">
            Submitted! Want more collectors to see {event.title}?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Featured events sit at the top of the events calendar in gold, from{' '}
            <strong className="text-foreground">{formatAud(quote.priceCents)}</strong>
            {earlyBird
              ? ` with the early bird price (${EARLY_BIRD.pct}% off, because your show is ${EARLY_BIRD.minDays / 7}+ weeks away).`
              : '.'}
            {' '}Featuring starts as soon as your event is approved.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={onFeature} className="rounded-xl font-bold gap-1.5">
            <Star className="w-4 h-4" aria-hidden="true" /> Feature it
          </Button>
          <Button variant="ghost" onClick={onDismiss} className="rounded-xl">Not now</Button>
        </div>
      </div>
    </section>
  );
};

export default FeatureUpsellCard;
