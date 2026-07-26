import React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useEbayEstimate } from '@/hooks/useEbayEstimate.js';

// Compact market-price context rendered directly under a listing's asking
// price: "Market avg $X · N% below market". This is the datum card buyers
// decide on — without it the asking price floats with no reference and the
// buyer tabs out to eBay to find one. Shares its fetch with EbayMarketSection
// further down the page (useEbayEstimate de-dupes), and links to it.
//
// Renders nothing while loading, on error, or when there's no usable market
// sample — an absent anchor beats a misleading one.
const MarketPriceAnchor = ({ cardName, cardSet, gradingService, gradeScore, listingPrice }) => {
  const { data } = useEbayEstimate({ cardName, cardSet, gradingService, gradeScore });

  const avg = Number(data?.avgPrice);
  const price = Number(listingPrice);
  if (!data || !(data.count > 0) || !(avg > 0) || !(price > 0)) return null;

  const deltaPct = Math.round(((price - avg) / avg) * 100);
  const withinMarket = Math.abs(deltaPct) < 5;

  let Icon = Minus;
  let toneClass = 'text-muted-foreground';
  let deltaText = 'in line with market';
  if (!withinMarket && deltaPct < 0) {
    Icon = TrendingDown;
    toneClass = 'text-emerald-600 dark:text-emerald-400';
    deltaText = `${Math.abs(deltaPct)}% below market`;
  } else if (!withinMarket) {
    Icon = TrendingUp;
    toneClass = 'text-amber-600 dark:text-amber-500';
    deltaText = `${deltaPct}% above market`;
  }

  const fmt = (v) => `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <a
      href="#market-data"
      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:underline underline-offset-2"
      title={`Based on ${data.count} recent eBay listings — see full market data`}
    >
      <Icon className={`w-4 h-4 ${toneClass}`} aria-hidden="true" />
      <span>
        eBay avg {fmt(avg)} · <span className={`font-bold ${toneClass}`}>{deltaText}</span>
      </span>
    </a>
  );
};

export default MarketPriceAnchor;
