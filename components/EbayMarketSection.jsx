import React, { useState } from 'react';
import { ExternalLink, TrendingUp, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useEbayEstimate } from '@/hooks/useEbayEstimate.js';

const EbayMarketSection = ({ cardName, cardSet, gradingService, gradeScore }) => {
  // Shared with MarketPriceAnchor on the product page — one request per card
  // view (see useEbayEstimate's promise cache).
  const { data, loading, error } = useEbayEstimate({ cardName, cardSet, gradingService, gradeScore });
  const [displayCurrency, setDisplayCurrency] = useState('AUD');

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!cardName) return null;

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-card rounded-2xl border border-border shadow-sm">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div id="market-data" className="mt-8 p-6 bg-card rounded-2xl border border-border shadow-sm scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg text-foreground">eBay Market Data</h3>
        </div>
        {data?.exchangeRate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDisplayCurrency('AUD')}
              className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
                displayCurrency === 'AUD'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              AUD
            </button>
            <button
              onClick={() => setDisplayCurrency('USD')}
              className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
                displayCurrency === 'USD'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              USD
            </button>
            <span className="text-[10px] text-muted-foreground ml-1 whitespace-nowrap">
              1 USD = ${data.exchangeRate.toFixed(2)} AUD
            </span>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">Unable to fetch eBay market data at this time.</p>
        </div>
      ) : data && data.count > 0 ? (
        <>
          {/* Price Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {displayCurrency === 'AUD' ? 'Avg Price (AUD)' : 'Avg Price (USD)'}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {displayCurrency === 'AUD'
                  ? formatCurrency(data.avgPrice)
                  : `$${(data.avgPrice / data.exchangeRate).toFixed(2)}`}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Price Range</p>
              <p className="text-lg font-bold text-foreground">
                {displayCurrency === 'AUD'
                  ? `${formatCurrency(data.minPrice)} - ${formatCurrency(data.maxPrice)}`
                  : `$${(data.minPrice / data.exchangeRate).toFixed(2)} - $${(data.maxPrice / data.exchangeRate).toFixed(2)}`}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Listings Found</p>
              <p className="text-2xl font-bold text-foreground">{data.count}</p>
            </div>
          </div>

          {/* Base Card Listings */}
          {data.baseListings && data.baseListings.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Base Cards ({data.baseCount})</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.baseListings.map((listing, idx) => {
                  const displayPrice = displayCurrency === 'USD' && listing.currency === 'AUD'
                    ? listing.price / data.exchangeRate
                    : displayCurrency === 'AUD' && listing.currency === 'USD'
                    ? listing.priceInAUD
                    : listing.price;

                  return (
                    <a
                      key={idx}
                      href={listing.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-muted/20 hover:bg-muted/40 rounded-lg border border-border/50 hover:border-primary/50 transition-colors group"
                    >
                      {listing.thumbnailUrl && (
                        <img
                          src={listing.thumbnailUrl}
                          alt="Listing"
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {listing.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs font-bold">
                            {listing.condition}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-bold">
                            {listing.marketplace === 'US' ? '🇺🇸 eBay.com' : '🇦🇺 eBay.au'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {listing.shippingPrice > 0 ? `+${formatCurrency(listing.shippingPrice)} shipping` : 'Free shipping'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-bold text-lg text-foreground tabular-nums">
                          {displayCurrency === 'AUD' ? formatCurrency(displayPrice) : `$${displayPrice.toFixed(2)}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {listing.currency}
                        </p>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </a>
                  );
                })}
              </div>
              <Button asChild variant="outline" className="w-full mt-4 rounded-lg" size="sm">
                <a href={`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(cardName)}`} target="_blank" rel="noopener noreferrer">
                  View all base cards on eBay
                </a>
              </Button>
            </div>
          )}

          {/* Graded Card Listings */}
          {data.gradedListings && data.gradedListings.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Graded Versions ({data.gradedCount})</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.gradedListings.map((listing, idx) => {
                  const displayPrice = displayCurrency === 'USD' && listing.currency === 'AUD'
                    ? listing.price / data.exchangeRate
                    : displayCurrency === 'AUD' && listing.currency === 'USD'
                    ? listing.priceInAUD
                    : listing.price;

                  return (
                    <a
                      key={idx}
                      href={listing.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-muted/20 hover:bg-muted/40 rounded-lg border border-border/50 hover:border-primary/50 transition-colors group"
                    >
                      {listing.thumbnailUrl && (
                        <img
                          src={listing.thumbnailUrl}
                          alt="Listing"
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {listing.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs font-bold">
                            {listing.condition}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-bold">
                            {listing.marketplace === 'US' ? '🇺🇸 eBay.com' : '🇦🇺 eBay.au'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {listing.shippingPrice > 0 ? `+${formatCurrency(listing.shippingPrice)} shipping` : 'Free shipping'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-bold text-lg text-foreground tabular-nums">
                          {displayCurrency === 'AUD' ? formatCurrency(displayPrice) : `$${displayPrice.toFixed(2)}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {listing.currency}
                        </p>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </a>
                  );
                })}
              </div>
              <Button asChild variant="outline" className="w-full mt-4 rounded-lg" size="sm">
                <a href={`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(cardName)} graded`} target="_blank" rel="noopener noreferrer">
                  View all graded listings on eBay
                </a>
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">No comparable eBay listings found for this card.</p>
        </div>
      )}
    </div>
  );
};

export default EbayMarketSection;
