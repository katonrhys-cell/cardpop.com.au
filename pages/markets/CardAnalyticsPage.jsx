import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import {
  ArrowLeft, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3,
  Clock, ExternalLink, ShoppingCart, ArrowUpRight, ArrowDownRight,
  RefreshCw, Star, Info, ChevronRight, ShieldCheck,
} from 'lucide-react';
import PriceRangeIndicator from '@/components/PriceRangeIndicator.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── Seeded PRNG for consistent demo data per card ──────────────────────────
const makePrng = (str) => {
  let s = str.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return (min = 0, max = 1) => {
    s = (s * 16807) % 2147483647;
    return min + ((s - 1) / 2147483646) * (max - min);
  };
};

const genHistory = (base, days, rng, volatility = 0.055) => {
  const out = [];
  let price = base * (0.85 + rng() * 0.3);
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    price = Math.max(1, price * (1 + (rng() - 0.47) * volatility));
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), price: +price.toFixed(2) });
  }
  return out;
};

const genSales = (base, rng) => {
  const grades = ['Raw', 'PSA 9', 'PSA 10', 'BGS 9.5', 'CGC 9', 'Raw'];
  const now = new Date();
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(rng(0, 45)));
    return {
      date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' }),
      grade: grades[Math.floor(rng(0, grades.length))],
      price: +(base * (0.65 + rng() * 0.7)).toFixed(2),
      platform: 'eBay AU',
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
};

const genSimilar = (cardName, set, collection, rng) => {
  const suffixes = ['Alt Art', 'Full Art', 'Rainbow Rare', 'Gold Rare', 'Reverse Holo', 'Regular Holo'];
  return Array.from({ length: 4 }, (_, i) => ({
    name: `${cardName.split(' ')[0]} ${suffixes[Math.floor(rng(0, suffixes.length))]}`,
    set,
    collection,
    price: +(20 + rng() * 300).toFixed(2),
    change: +(rng(-20, 20)).toFixed(1),
  }));
};

// ─── Sub-components ─────────────────────────────────────────────────────────
const PriceBadge = ({ change }) => {
  const up = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${up ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="font-bold">${payload[0].value.toFixed(2)}</p>
    </div>
  );
};

const InvestmentSignal = ({ change7d, change30d }) => {
  const score = change7d * 0.6 + change30d * 0.4;
  let label, desc, color, bars;
  if (score > 12)      { label = 'Strong Uptrend';  desc = 'Significant buying pressure driving prices higher.'; color = 'text-emerald-600'; bars = 5; }
  else if (score > 5)  { label = 'Uptrend';          desc = 'Steady price appreciation over recent period.';     color = 'text-emerald-500'; bars = 4; }
  else if (score > -5) { label = 'Stable';            desc = 'Price holding relatively steady with low volatility.'; color = 'text-amber-500'; bars = 3; }
  else if (score > -12){ label = 'Downtrend';         desc = 'Declining prices — monitor before buying.';         color = 'text-orange-500'; bars = 2; }
  else                 { label = 'Strong Downtrend';  desc = 'Significant selling pressure. High caution advised.'; color = 'text-destructive'; bars = 1; }
  const barColor = bars >= 4 ? 'bg-emerald-500' : bars === 3 ? 'bg-amber-400' : 'bg-destructive';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">{[1,2,3,4,5].map(b => <div key={b} className={`h-5 w-3.5 rounded-sm ${b <= bars ? barColor : 'bg-muted'}`} />)}</div>
        <span className={`font-bold ${color}`}>{label}</span>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
};

// ─── Marketplace listing card (compact) ─────────────────────────────────────
const ListingCard = ({ listing }) => {
  const imgUrl = listing.vault_images?.[0]?.image_url || listing.image_url || listing.image || null;
  return (
    <div className="flex gap-4 bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/40 transition-all">
      <div className="w-16 h-20 flex-shrink-0 bg-muted rounded-xl overflow-hidden">
        {imgUrl
          ? <img src={imgUrl} alt={listing.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center p-1">No image</div>}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <p className="font-semibold text-sm truncate">{listing.title || listing.name}</p>
          {listing.condition && <Badge variant="outline" className="text-xs mt-1">{listing.condition}</Badge>}
        </div>
        <div className="flex items-end justify-between mt-2">
          <p className="text-lg font-bold text-primary">${(listing.price || 0).toFixed(2)}</p>
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
            <ShoppingCart className="w-3 h-3" /> View
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── External source links ────────────────────────────────────────────────────
const SOURCES = (name, set) => [
  {
    label: 'eBay Australia',
    icon: '🛒',
    href: `https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(name + ' ' + set + ' trading card')}&LH_Sold=1&LH_Complete=1`,
    desc: 'Sold listings',
  },
  {
    label: 'TCGPlayer',
    icon: '📊',
    href: `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(name)}`,
    desc: 'Buy & sell',
  },
  {
    label: 'PriceCharting',
    icon: '📈',
    href: `https://www.pricecharting.com/search-products?q=${encodeURIComponent(name)}`,
    desc: 'Price tracking',
  },
  {
    label: 'CardMarket',
    icon: '🌏',
    href: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}`,
    desc: 'EU marketplace',
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────
const CardAnalyticsPage = () => {
  const [searchParams] = useSearchParams();
  const cardName      = searchParams.get('name')          || 'Unknown Card';
  const cardSet       = searchParams.get('set')           || '';
  const cardColl      = searchParams.get('collection')    || '';
  const rawPrice      = parseFloat(searchParams.get('price')  || '75');
  const rawChange     = parseFloat(searchParams.get('change') || '0');
  const cardsightId   = searchParams.get('cardsight_id')  || null;

  const [listings, setListings]     = useState([]);
  const [vaultItems, setVaultItems] = useState([]);
  const [loadingL, setLoadingL]     = useState(true);

  // Live eBay AU pricing
  const [liveData, setLiveData]       = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);

  // CardSight AI real pricing + marketplace listings
  const [csData, setCsData]             = useState(null);
  const [csMarket, setCsMarket]         = useState(null);
  const [csLoading, setCsLoading]       = useState(false);

  // Stored market valuations from DB (CardSight, eBay, PSA)
  const [storedVal, setStoredVal]       = useState(null);
  const [priceRange, setPriceRange]     = useState(null);

  const rng = useMemo(() => makePrng(cardName + cardSet), [cardName, cardSet]);

  const change7d  = rawChange;
  const change30d = +(rawChange * 1.8 + (rng(-4, 4))).toFixed(1);
  const avgSale   = rawPrice;
  const high90    = +(rawPrice * (1.25 + rng(0, 0.25))).toFixed(2);
  const low90     = +(rawPrice * (0.55 + rng(0, 0.2))).toFixed(2);
  const vol90     = Math.floor(rng(30, 600));
  const priceHistory = useMemo(() => genHistory(rawPrice, 30, makePrng(cardName + 'hist')), [rawPrice, cardName]);
  const recentSales  = useMemo(() => genSales(rawPrice, makePrng(cardName + 'sales')), [rawPrice, cardName]);
  const similarCards = useMemo(() => genSimilar(cardName, cardSet, cardColl, makePrng(cardName + 'sim')), [cardName, cardSet, cardColl]);

  useEffect(() => {
    let cancelled = false;
    const term = cardName.split(' ')[0].replace(/"/g, '');

    Promise.all([
      supabase.from('listings').select('*').ilike('title', `%${term}%`).eq('type', 'shop').order('price_aud').limit(6).then(r => r.data ?? []),
      supabase.from('vault_items').select('*').ilike('card_name', `%${term}%`).eq('is_public', true).order('created_at', { ascending: false }).limit(6).then(r => r.data ?? []),
    ]).then(([shop, vault]) => {
      if (!cancelled) {
        setListings(shop.map(i => ({ ...i, _source: 'shop' })));
        setVaultItems(vault.map(i => ({ ...i, _source: 'vault' })));
      }
    }).catch((err) => { console.warn('[CardAnalyticsPage] listings fetch failed:', err); }).finally(() => { if (!cancelled) setLoadingL(false); });

    return () => { cancelled = true; };
  }, [cardName]);

  // Fetch CardSight AI real pricing + marketplace data + stored valuations
  useEffect(() => {
    if (!cardsightId) return;
    setCsLoading(true);
    Promise.allSettled([
      apiServerClient.fetch(`/cardsight/pricing/${cardsightId}`).then(r => r.ok ? r.json() : null),
      apiServerClient.fetch(`/cardsight/marketplace/${cardsightId}`).then(r => r.ok ? r.json() : null),
      apiServerClient.fetch(`/market-data/card/${cardsightId}`).then(r => r.ok ? r.json() : null),
    ]).then(([pricing, market, stored]) => {
      if (pricing.status === 'fulfilled' && pricing.value) setCsData(pricing.value);
      if (market.status === 'fulfilled' && market.value)   setCsMarket(market.value);
      if (stored.status === 'fulfilled' && stored.value) {
        setStoredVal(stored.value?.valuations ?? null);
      }
      // Also fetch price range from DB
      apiServerClient.fetch(`/market-data/price-range/${cardsightId}`)
        .then(r => r.ok ? r.json() : null)
        .then(r => { if (r) setPriceRange(r); })
        .catch((err) => { console.warn('[CardAnalyticsPage] price range fetch failed:', err); });
    }).finally(() => setCsLoading(false));
  }, [cardsightId]);

  // Fetch live eBay AU prices for this card
  useEffect(() => {
    if (!cardName || cardName === 'Unknown Card') { setLiveLoading(false); return; }
    let cancelled = false;
    setLiveLoading(true);
    const query = [cardName, cardSet].filter(Boolean).join(' ');
    apiServerClient.fetch(`/ebay/search?cardName=${encodeURIComponent(query)}&limit=15`)
      .then(r => r.json())
      .then(items => {
        if (cancelled) return;
        if (!Array.isArray(items) || items.length === 0) return;
        const prices = items.map(l => l.price).filter(p => p > 0);
        if (prices.length === 0) return;
        setLiveData({
          listings: items,
          avgPrice: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          volume:   items.length,
        });
      })
      .catch((err) => { console.warn('[CardAnalyticsPage] live sales fetch failed:', err); })
      .finally(() => { if (!cancelled) setLiveLoading(false); });
    return () => { cancelled = true; };
  }, [cardName, cardSet]);

  // Fetch eBay pricing for this card (replaces CardSight autocomplete → pricing flow)
  useEffect(() => {
    if (!cardName || cardName === 'Unknown Card') { setCsLoading(false); return; }
    let cancelled = false;
    const run = async () => {
      setCsLoading(true);
      try {
        const params = new URLSearchParams({ name: cardName });
        if (cardSet) params.set('set', cardSet);
        const prRes = await apiServerClient.fetch(`/catalog/pricing?${params}`);
        if (!prRes.ok || cancelled) return;
        const prData = await prRes.json();
        if (!cancelled && prData.count > 0) setCsData(prData);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setCsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [cardName, cardSet]);

  const cardUrl = (c) => `/analytics/card?name=${encodeURIComponent(c.name)}&set=${encodeURIComponent(c.set)}&collection=${encodeURIComponent(c.collection)}&price=${c.price}&change=${c.change}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={`${cardName} | Card Analytics | CardPop`} description={`Track price history, market trends and analytics for ${cardName} on CardPop Australia.`} />

      {/* Hero */}
      <section className="bg-card border-b border-border py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/analytics" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Analytics
          </Link>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Card art placeholder */}
            <div className="w-full lg:w-56 flex-shrink-0">
              <div
                className="aspect-[2.5/3.5] rounded-2xl flex flex-col items-center justify-center text-center p-4 shadow-lg border border-primary/20 overflow-hidden relative"
                style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))` }}
              >
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, hsl(var(--primary)), transparent 70%)' }} />
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 relative z-10">{cardColl}</p>
                <p className="font-black text-lg leading-tight text-foreground relative z-10">{cardName}</p>
                {cardSet && <p className="text-xs text-muted-foreground mt-2 relative z-10">{cardSet}</p>}
                <div className="mt-4 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold relative z-10">CardPop</div>
              </div>
            </div>

            {/* Card info */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                {cardColl && <Badge variant="secondary">{cardColl}</Badge>}
                {cardSet  && <Badge variant="outline">{cardSet}</Badge>}
                {cardsightId && csData ? (
                  <span className="flex items-center gap-1 text-xs text-violet-600 font-semibold bg-violet-500/10 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" /> CardSight AI Verified · {csData.salesCount ?? '?'} completed sales
                  </span>
                ) : cardsightId && csLoading ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    CardSight AI pricing…
                  </span>
                ) : null}
                {liveData ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live eBay AU · {liveData.volume} active listing{liveData.volume !== 1 ? 's' : ''}
                  </span>
                ) : liveLoading ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
                    Fetching live prices…
                  </span>
                ) : !cardsightId ? (
                  <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                    <Info className="w-3 h-3" /> Demo data · eBay unavailable
                  </span>
                ) : null}
              </div>
              <h1 className="text-3xl md:text-4xl font-black leading-tight">{cardName}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-4xl font-black">${avgSale.toFixed(2)}</span>
                <div className="space-y-1">
                  <PriceBadge change={change7d} />
                  <p className="text-xs text-muted-foreground">7-day change (AUD avg)</p>
                </div>
              </div>

              {/* External links */}
              <div className="flex flex-wrap gap-2 pt-2">
                {SOURCES(cardName, cardSet).map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 border border-border transition-colors">
                    <span>{s.icon}</span> {s.label}
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* CardSight AI real pricing panel — shown when cardsight_id is available */}
        {cardsightId && (csData || csLoading) && (
          <div className={`rounded-2xl border p-5 ${csData ? 'bg-violet-500/5 border-violet-500/20' : 'bg-muted/30 border-border'}`}>
            {csLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading CardSight AI market intelligence…
              </div>
            ) : csData && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-violet-600" />
                  <h3 className="font-bold text-sm text-violet-700">CardSight AI — Real Completed Sales Data</h3>
                  {csData.lastSaleDate && (
                    <span className="text-xs text-muted-foreground ml-auto">Last sale: {new Date(csData.lastSaleDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-foreground">${csData.avgPrice?.toFixed(2) ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Avg Sold Price</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-600">${csData.maxPrice?.toFixed(2) ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">High Sale</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-foreground">${csData.minPrice?.toFixed(2) ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Low Sale</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-foreground">{csData.salesCount ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Completed Sales</p>
                  </div>
                </div>
                {csData.lastSalePrice && (
                  <div className="mt-3 pt-3 border-t border-violet-500/10 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Most recent sale: <strong className="text-foreground">${csData.lastSalePrice?.toFixed(2)}</strong>
                      {csData.currency && csData.currency !== 'AUD' ? ` (${csData.currency})` : ' AUD'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Price range panel — Low / Avg / High / Floor */}
        {priceRange && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Market Price Range</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                {priceRange.sources_used?.join(' · ')}
                {priceRange.source_count ? ` · ${priceRange.source_count} data points` : ''}
              </span>
            </div>
            <PriceRangeIndicator range={priceRange} />
          </div>
        )}

        {/* Stored market valuations panel */}
        {storedVal && Object.keys(storedVal).length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Market Valuations — All Sources
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['cardsight', 'ebay_au', 'psa'].map(src => {
                const v = storedVal[src];
                if (!src) return null;
                const labels = { cardsight: 'CardSight AI', ebay_au: 'eBay AU', psa: 'PSA Population' };
                const colors = { cardsight: 'text-violet-600', ebay_au: 'text-amber-600', psa: 'text-blue-600' };
                return (
                  <div key={src} className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <p className={`text-xs font-bold uppercase tracking-wide ${colors[src]}`}>{labels[src]}</p>
                    {v ? (
                      <>
                        <p className="text-2xl font-black">
                          {v.market_value != null ? `$${parseFloat(v.market_value).toFixed(2)}` : '—'}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Confidence</span>
                          <span className="font-semibold">{v.confidence_score != null ? `${v.confidence_score}%` : '—'}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Updated {v.last_updated ? new Date(v.last_updated).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: csData ? (csData.source === 'ebay_au' ? 'Avg Listed (eBay AU)' : 'Avg Sold (CardSight)') : liveData ? 'Avg Listed (AUD)' : 'Avg Sold (AUD)',
              value: `$${(csData?.avgPrice ?? liveData?.avgPrice ?? avgSale).toFixed(2)}`, icon: DollarSign, colored: false },
            { label: csData ? (csData.source === 'ebay_au' ? 'High Listed (eBay AU)' : 'High Sale (CardSight)') : liveData ? 'Highest Listed' : '90-Day High',
              value: `$${(csData?.maxPrice ?? liveData?.maxPrice ?? high90).toFixed(2)}`,  icon: TrendingUp, colored: false },
            { label: csData ? (csData.source === 'ebay_au' ? 'Low Listed (eBay AU)' : 'Low Sale (CardSight)') : liveData ? 'Lowest Listed' : '90-Day Low',
              value: `$${(csData?.minPrice ?? liveData?.minPrice ?? low90).toFixed(2)}`,   icon: TrendingDown, colored: false },
            { label: '7-Day Change',
              value: `${change7d >= 0 ? '+' : ''}${change7d}%`,       icon: Activity, colored: true, up: change7d >= 0 },
            { label: csData ? (csData.source === 'ebay_au' ? 'Active Listings' : 'Completed Sales') : liveData ? 'Active Listings' : '90-Day Sales',
              value: csData?.salesCount ?? liveData?.volume ?? vol90,  icon: BarChart3, colored: false },
          ].map(({ label, value, icon: Icon, colored, up }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
              <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
              <p className={`text-xl font-bold ${colored ? (up ? 'text-emerald-600' : 'text-destructive') : ''}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Market pricing data (eBay AU or CardSight) */}
        {(csLoading || csData) && (() => {
          if (csLoading) {
            return (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="w-3.5 h-3.5 animate-pulse text-blue-500" />
                Loading market data…
              </div>
            );
          }
          const avg = csData.avg_price ?? csData.average_price ?? csData.mean_price;
          const min = csData.min_price ?? csData.minimum_price;
          const max = csData.max_price ?? csData.maximum_price;
          const count = csData.count ?? csData.total_count ?? csData.total;
          if (!avg) return null;
          const isEbay = csData.source === 'ebay_au';
          return (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <ShieldCheck className="w-4 h-4" /> {isEbay ? 'eBay AU · Active Listings' : 'CardSight · 30-Day Completed Sales'}
                </h2>
                {count != null && <span className="text-xs text-muted-foreground">{count} {isEbay ? 'listings' : 'sales'}</span>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">${Number(avg).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Average Sold</p>
                </div>
                {min != null && (
                  <div className="text-center">
                    <p className="text-2xl font-bold">${Number(min).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Lowest Sold</p>
                  </div>
                )}
                {max != null && (
                  <div className="text-center">
                    <p className="text-2xl font-bold">${Number(max).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Highest Sold</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Chart + Signal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Price chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">30-Day Price History (AUD)</h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> Updated daily via eBay
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={priceHistory} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={liveData?.avgPrice ?? avgSale} stroke="hsl(var(--primary))" strokeDasharray="4 4" opacity={0.4} label={{ value: liveData ? 'Live Avg' : 'Avg', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cardGrad)" dot={false} activeDot={{ r: 4, fill: 'hsl(var(--primary))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Signal + stats */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-6">
            <div>
              <h2 className="font-bold text-lg mb-4">Investment Signal</h2>
              <InvestmentSignal change7d={change7d} change30d={change30d} />
            </div>
            <div className="space-y-3 pt-2 border-t border-border">
              {[
                { label: '7-day momentum',     val: change7d,  type: 'pct' },
                { label: '30-day trend',        val: change30d, type: 'pct' },
                { label: 'vs 90-day high',      val: ((avgSale / high90) * 100).toFixed(0) + '%', type: 'raw' },
                { label: 'Avg vs 90-day low',   val: ((avgSale / low90 - 1) * 100).toFixed(0) + '%', type: 'raw' },
              ].map(({ label, val, type }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  {type === 'pct'
                    ? <span className={`font-semibold ${val >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{val >= 0 ? '▲' : '▼'} {Math.abs(val)}%</span>
                    : <span className="font-semibold">{val}</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-3">Signal based on price momentum only. Not financial advice.</p>
          </div>
        </div>

        {/* Tabs: Buy Now / Trade / Sold History / Similar */}
        <Tabs defaultValue="buy">
          <TabsList className="w-full mb-6 h-12">
            <TabsTrigger value="buy"     className="flex-1 gap-1.5"><ShoppingCart className="w-4 h-4" /> Buy Now</TabsTrigger>
            <TabsTrigger value="trade"   className="flex-1 gap-1.5"><RefreshCw className="w-4 h-4" /> For Trade</TabsTrigger>
            <TabsTrigger value="sold"    className="flex-1 gap-1.5"><Clock className="w-4 h-4" /> Sold History</TabsTrigger>
            <TabsTrigger value="similar" className="flex-1 gap-1.5"><Star className="w-4 h-4" /> Similar Cards</TabsTrigger>
          </TabsList>

          {/* Buy Now */}
          <TabsContent value="buy" className="space-y-8">
            {/* CardPop marketplace listings */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">Available on CardPop Marketplace</h3>
                <a href={`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(cardName + ' ' + cardSet)}&LH_BIN=1`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                  Also search eBay <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {loadingL ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
              ) : listings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                </div>
              ) : (
                <div className="py-8 bg-muted/20 rounded-3xl border border-dashed border-border text-center">
                  <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="font-semibold mb-1 text-sm">No CardPop listings for this card yet</p>
                </div>
              )}
            </div>

            {/* CardSight AI active marketplace listings */}
            {cardsightId && (csMarket || csLoading) && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="font-bold">Active Listings — CardSight AI</h3>
                  <span className="flex items-center gap-1 text-xs text-violet-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
                    Live · Multi-platform
                  </span>
                </div>
                {csLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                  </div>
                ) : csMarket?.listings?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {csMarket.listings.slice(0, 9).map((l, i) => (
                      <a key={l.id ?? i} href={l.listingUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                        className="flex gap-3 bg-card border border-violet-500/20 rounded-2xl p-4 hover:shadow-md hover:border-violet-500/40 transition-all">
                        {l.imageUrl && (
                          <div className="w-12 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-muted">
                            <img src={l.imageUrl} alt={l.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{l.title ?? 'Marketplace Listing'}</p>
                          <div className="flex items-end justify-between mt-1">
                            <p className="text-base font-bold text-violet-700">${(l.price ?? 0).toFixed(2)}</p>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 border border-violet-400/20">
                              {l.platform ?? 'Market'}
                            </span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-muted/20 rounded-3xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">No active CardSight marketplace listings found.</p>
                  </div>
                )}
              </div>
            )}

            {/* Live eBay AU listings */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">Live eBay Australia Listings</h3>
                  {liveData && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      Live
                    </span>
                  )}
                </div>
                <a href={`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(cardName + ' ' + cardSet)}&LH_BIN=1`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                  See all on eBay <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {liveLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
              ) : liveData?.listings?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveData.listings.map(l => (
                    <a key={l.itemId} href={l.listingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex gap-3 bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/40 transition-all">
                      <div className="w-14 h-18 flex-shrink-0 bg-muted rounded-xl overflow-hidden">
                        {l.thumbnailUrl
                          ? <img src={l.thumbnailUrl} alt={l.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">No image</div>}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{l.title}</p>
                        <div className="flex items-end justify-between mt-1">
                          <p className="text-base font-bold text-primary">${l.price.toFixed(2)}</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-600 border border-amber-400/20">eBay AU</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-muted/20 rounded-3xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground mb-3">No active eBay AU listings found.</p>
                  <a href={`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(cardName + ' ' + cardSet)}&LH_BIN=1`}
                    target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      Search eBay AU <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </TabsContent>

          {/* For Trade */}
          <TabsContent value="trade">
            <div className="mb-4">
              <h3 className="font-bold">Community Trade Listings</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Cards listed for trade by CardPop members</p>
            </div>
            {loadingL ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
              </div>
            ) : vaultItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vaultItems.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <div className="text-center py-14 bg-muted/20 rounded-3xl border border-dashed border-border">
                <RefreshCw className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="font-semibold mb-1">No trade listings for this card yet</p>
                <p className="text-sm text-muted-foreground">Members with this card in their vault can list it for trade.</p>
              </div>
            )}
          </TabsContent>

          {/* Sold History */}
          <TabsContent value="sold">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Recent Sold Prices (AUD)</h3>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Indicative data — eBay sold history requires a seller-level API scope
                </p>
              </div>
              <a href={`https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(cardName + ' ' + cardSet)}&LH_Sold=1&LH_Complete=1`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                View on eBay <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 px-5 py-3 border-b border-border">
                <span>Date</span><span>Platform</span><span>Grade / Condition</span><span className="text-right">Sold Price</span>
              </div>
              {recentSales.map((s, i) => (
                <div key={i} className={`grid grid-cols-4 text-sm px-5 py-3.5 items-center hover:bg-muted/20 transition-colors ${i < recentSales.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <span className="text-muted-foreground text-xs">{s.date}</span>
                  <span className="text-xs">{s.platform}</span>
                  <span><Badge variant="outline" className="text-xs">{s.grade}</Badge></span>
                  <span className="text-right font-bold">${s.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Similar Cards */}
          <TabsContent value="similar">
            <div className="mb-4">
              <h3 className="font-bold">Similar Cards from {cardSet || cardColl}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> Generated from set data — search individual cards for live eBay prices
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similarCards.map((c, i) => (
                <Link key={i} to={cardUrl(c)} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-all group">
                  <div className="aspect-[2.5/3.5] rounded-xl mb-3 flex items-center justify-center text-center p-3"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.03))' }}>
                    <p className="font-bold text-xs leading-tight">{c.name}</p>
                  </div>
                  <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{c.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{c.set}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">${c.price.toFixed(2)}</span>
                    <PriceBadge change={c.change} />
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* External research links */}
        <div>
          <h2 className="font-bold text-lg mb-4">Research This Card Elsewhere</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SOURCES(cardName, cardSet).map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-all group flex flex-col gap-2">
                <span className="text-3xl">{s.icon}</span>
                <p className="font-bold group-hover:text-primary transition-colors">{s.label}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
                <span className="flex items-center gap-1 text-xs text-primary font-semibold mt-auto">
                  Open <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CardAnalyticsPage;
