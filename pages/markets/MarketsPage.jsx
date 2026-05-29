import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import {
  TrendingUp, TrendingDown, Search, LineChart, Star, StarOff,
  ArrowUpRight, ArrowDownRight, Activity, DollarSign, BarChart3,
  Clock, Zap, Info, ChevronRight, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

// ─── Demo data (replaced by eBay API once integrated) ───────────────────────

const genPriceHistory = (base, days = 30, volatility = 0.06) => {
  const out = [];
  let price = base;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    price = Math.max(1, price * (1 + (Math.random() - 0.48) * volatility));
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), price: +price.toFixed(2) });
  }
  return out;
};

const DEMO_MOVERS = {
  advancers: [
    { name: 'Charizard ex (Special Illustration Rare)', set: 'Obsidian Flames', collection: 'Pokémon', price: 580, change: 24.3, volume: 142 },
    { name: 'Charizard VSTAR 018/172', set: 'Brilliant Stars', collection: 'Pokémon', price: 94, change: 18.4, volume: 389 },
    { name: 'Pikachu VMAX 044/185', set: 'Vivid Voltage', collection: 'Pokémon', price: 68, change: 14.7, volume: 201 },
    { name: 'LeBron James RC Auto', set: '2003-04 Upper Deck', collection: 'NBA', price: 8500, change: 9.8, volume: 23 },
    { name: 'Charizard Holo (Base Set)', set: 'Base Set', collection: 'Pokémon', price: 2400, change: 8.2, volume: 17 },
    { name: 'Mew ex 151/165', set: 'Scarlet & Violet 151', collection: 'Pokémon', price: 45, change: 7.9, volume: 614 },
    { name: 'Black Lotus (Alpha)', set: 'Alpha', collection: 'Magic: The Gathering', price: 58000, change: 6.1, volume: 4 },
  ],
  decliners: [
    { name: 'Charizard VMAX (Rainbow)', set: "Champion's Path", collection: 'Pokémon', price: 220, change: -14.2, volume: 98 },
    { name: 'Evolving Skies ETB', set: 'Evolving Skies', collection: 'Pokémon', price: 78, change: -9.4, volume: 312 },
    { name: 'Mewtwo V-Union (Alt Art)', set: 'Celebrations', collection: 'Pokémon', price: 48, change: -7.3, volume: 187 },
    { name: 'Connor McDavid Young Guns', set: '2015-16 Upper Deck', collection: 'Hockey', price: 1200, change: -6.8, volume: 34 },
    { name: 'Paradox Rift Booster Box', set: 'Paradox Rift', collection: 'Pokémon', price: 165, change: -5.9, volume: 503 },
    { name: 'Zacian V Alt Art 211/202', set: 'Sword & Shield', collection: 'Pokémon', price: 82, change: -5.1, volume: 241 },
    { name: 'Michael Jordan 1986 Fleer RC', set: '1986-87 Fleer', collection: 'NBA', price: 18500, change: -4.7, volume: 11 },
  ],
  active: [
    { name: 'Mew ex 151/165', set: 'Scarlet & Violet 151', collection: 'Pokémon', price: 45, change: 7.9, volume: 614 },
    { name: 'Paradox Rift Booster Box', set: 'Paradox Rift', collection: 'Pokémon', price: 165, change: -5.9, volume: 503 },
    { name: 'Evolving Skies ETB', set: 'Evolving Skies', collection: 'Pokémon', price: 78, change: -9.4, volume: 312 },
    { name: 'Charizard VSTAR 018/172', set: 'Brilliant Stars', collection: 'Pokémon', price: 94, change: 18.4, volume: 389 },
    { name: 'Iron Valiant ex (Alt Art)', set: 'Paradox Rift', collection: 'Pokémon', price: 310, change: 3.1, volume: 298 },
    { name: 'Pikachu VMAX 044/185', set: 'Vivid Voltage', collection: 'Pokémon', price: 68, change: 14.7, volume: 201 },
    { name: 'Charizard VMAX (Rainbow)', set: "Champion's Path", collection: 'Pokémon', price: 220, change: -14.2, volume: 98 },
  ],
};

const DEMO_RECENT_SALES = (base) => [
  { date: '24 May 2026', platform: 'eBay AU', grade: 'PSA 10', price: +(base * 1.18).toFixed(2) },
  { date: '23 May 2026', platform: 'eBay AU', grade: 'Raw',    price: +(base * 0.82).toFixed(2) },
  { date: '23 May 2026', platform: 'eBay AU', grade: 'BGS 9.5',price: +(base * 1.09).toFixed(2) },
  { date: '22 May 2026', platform: 'eBay AU', grade: 'Raw',    price: +(base * 0.79).toFixed(2) },
  { date: '22 May 2026', platform: 'eBay AU', grade: 'PSA 9',  price: +(base * 0.95).toFixed(2) },
  { date: '21 May 2026', platform: 'eBay AU', grade: 'Raw',    price: +(base * 0.76).toFixed(2) },
  { date: '20 May 2026', platform: 'eBay AU', grade: 'PSA 10', price: +(base * 1.14).toFixed(2) },
  { date: '19 May 2026', platform: 'eBay AU', grade: 'Raw',    price: +(base * 0.84).toFixed(2) },
];

const OVERVIEW_STATS = [
  { label: 'Pokémon Avg (PSA 10)', value: '$312', icon: TrendingUp,   delta: '+4.2%', up: true },
  { label: '7-Day Sales Volume',   value: '12,840', icon: Activity,   delta: '+8.1%', up: true },
  { label: 'Most Active Set',      value: 'SV 151', icon: Zap,        delta: '614 sold', up: true },
  { label: 'Largest Mover',        value: '+24.3%',  icon: BarChart3, delta: 'Charizard ex OBF', up: true },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

const PriceBadge = ({ change }) => {
  if (change === null || change === undefined) return null;
  const up = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${up ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
};

const LiveBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
    Live
  </span>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-bold">${payload[0].value.toFixed(2)}</p>
    </div>
  );
};

const InvestmentSignal = ({ change7d, change30d }) => {
  const score = change7d * 0.6 + (change30d || change7d * 2) * 0.4;
  let label, color, bars;
  if (score > 12)      { label = 'Strong Uptrend';  color = 'text-emerald-600'; bars = 5; }
  else if (score > 5)  { label = 'Uptrend';          color = 'text-emerald-500'; bars = 4; }
  else if (score > -5) { label = 'Stable';            color = 'text-amber-500';  bars = 3; }
  else if (score > -12){ label = 'Downtrend';         color = 'text-orange-500'; bars = 2; }
  else                 { label = 'Strong Downtrend';  color = 'text-destructive'; bars = 1; }
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(b => (
          <div key={b} className={`h-4 w-3 rounded-sm ${b <= bars ? (bars >= 4 ? 'bg-emerald-500' : bars === 3 ? 'bg-amber-400' : 'bg-destructive') : 'bg-muted'}`} />
        ))}
      </div>
      <span className={`text-sm font-semibold ${color}`}>{label}</span>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const API_BASE = '/hcgi/api';

const MarketsPage = () => {
  const { isAuthenticated } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Live popular cards from eBay API
  const [liveCards, setLiveCards] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState(false);
  const [selectedTab, setSelectedTab] = useState('advancers');

  const [watchlist, setWatchlist] = useState([
    { name: 'Charizard VSTAR 018/172', set: 'Brilliant Stars', price: 94, change: 18.4 },
    { name: 'Mew ex 151/165', set: 'Scarlet & Violet 151', price: 45, change: 7.9 },
  ]);
  const resultsRef = useRef(null);

  // ── Fetch live popular card prices on mount ────────────────────────────
  useEffect(() => {
    supabase.from('market_data').select('*').limit(20)
      .then(({ data }) => setMarketData(data ?? []))
      .catch(() => {});
  }, []);

  // ── Transform live cards for the movers table ──────────────────────────
  const liveMoverRows = liveCards
    .filter(c => c.avgPrice && c.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .map(c => ({
      id: c.id,
      name: c.name,
      set: c.set,
      collection: c.collection,
      price: c.avgPrice,
      minPrice: c.minPrice,
      maxPrice: c.maxPrice,
      volume: c.volume,
      change: null, // historical data needed for real % — shown as "Live" badge
      isLive: true,
    }));

  // ── Real eBay search ───────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setSearchTerm(searchInput);

    try {
      const res = await fetch(
        `${API_BASE}/ebay/search?cardName=${encodeURIComponent(searchInput.trim())}&limit=10`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const listings = await res.json();

      if (listings.length === 0) {
        // No eBay results — fall back to demo
        throw new Error('No listings found');
      }

      const prices = listings.map(l => l.price).filter(p => p > 0);
      const avgSale = prices.length > 0
        ? +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
        : 0;
      const high90d = prices.length > 0 ? +Math.max(...prices).toFixed(2) : 0;
      const low90d = prices.length > 0 ? +Math.min(...prices).toFixed(2) : 0;

      // Build price history from listing prices as a rough snapshot
      const priceHistory = listings.map((l, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (listings.length - i - 1));
        return { date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), price: l.price };
      });

      const recentSales = listings.slice(0, 8).map(l => ({
        date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
        platform: 'eBay AU',
        grade: l.condition || 'Raw',
        price: l.price,
        listingUrl: l.listingUrl,
      }));

      setSearchResult({
        name: searchInput.trim(),
        set: 'eBay AU',
        collection: 'Live Data',
        avgSale,
        high90d,
        low90d,
        change7d: null,
        change30d: null,
        volume90d: listings.length,
        priceHistory,
        recentSales,
        isLive: true,
        rawListings: listings,
      });
    } catch (err) {
      // Fallback to demo simulation
      console.warn('[MarketsPage] Real search failed, falling back to demo:', err.message);
      const base = 50 + Math.random() * 200;
      const change7d = +(Math.random() * 30 - 10).toFixed(1);
      setSearchResult({
        name: searchInput.trim(),
        set: 'Demo data',
        collection: 'Pokémon',
        avgSale: +base.toFixed(2),
        high90d: +(base * 1.35).toFixed(2),
        low90d: +(base * 0.65).toFixed(2),
        change7d,
        change30d: +(change7d * 2.1 + (Math.random() * 4 - 2)).toFixed(1),
        volume90d: Math.floor(50 + Math.random() * 500),
        priceHistory: genPriceHistory(base),
        recentSales: DEMO_RECENT_SALES(base),
        isLive: false,
      });
    } finally {
      setIsSearching(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setSearchResult(null);
  };

  const cardUrl = (card) => `/analytics/card?name=${encodeURIComponent(card.name)}&set=${encodeURIComponent(card.set)}&collection=${encodeURIComponent(card.collection)}&price=${card.price}&change=${card.change}`;

  const MoverRow = ({ card }) => (
    <Link
      to={`/analytics/${slugify(card.collection)}/${slugify(card.name)}`}
      className="flex items-center gap-3 py-3 px-4 hover:bg-muted/30 rounded-xl transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{card.name}</p>
        <p className="text-xs text-muted-foreground truncate">{card.set} · {card.collection}</p>
      </div>
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="font-bold text-sm">${card.price?.toLocaleString() ?? '—'}</p>
        {card.change !== null && card.change !== undefined ? <PriceBadge change={card.change} /> : <LiveBadge />}
      </div>
      <div className="text-right text-xs text-muted-foreground w-14 flex-shrink-0">
        {card.volume.toLocaleString()} {card.isLive ? 'active' : 'sold'}
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Card Market Analytics | CardPop</title></Helmet>

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <LineChart className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Card Market Analytics</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Research sold prices, track investment trends, and identify market movers across
            every major trading card collection — all in one place.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* Search bar */}
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search any card — e.g. Charizard VSTAR Brilliant Stars..."
                className="pl-11 h-13 text-base rounded-xl bg-card border-border pr-10"
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button type="submit" size="lg" className="rounded-xl px-6" disabled={isSearching || !searchInput.trim()}>
              {isSearching ? 'Searching…' : 'Research'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Searches eBay AU active listings · Sold price history coming soon
          </p>
        </div>

        {/* Market overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {OVERVIEW_STATS.map(({ label, value, icon: Icon, delta, up }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mb-1">{value}</p>
              <p className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>{delta}</p>
            </div>
          ))}
        </div>

        {/* Search results panel */}
        {(isSearching || searchResult) && (
          <div ref={resultsRef} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm scroll-mt-8">
            {/* Banner */}
            {searchResult?.isLive ? (
              <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0 inline-block" />
                Live eBay AU listings · Average price based on active listings · Sold price history coming soon
              </div>
            ) : (
              <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Demo preview — eBay sold data will power this panel once integrated. Prices and dates are illustrative.
              </div>
            )}

            {isSearching ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
                <Skeleton className="h-52 rounded-xl" />
              </div>
            ) : searchResult ? (
              <div className="p-6 md:p-8 space-y-8">
                {/* Card header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary">{searchResult.collection}</Badge>
                      <span className="text-sm text-muted-foreground">{searchResult.set}</span>
                    </div>
                    <h2 className="text-2xl font-bold">{searchResult.name}</h2>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-3xl font-bold">${searchResult.avgSale.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{searchResult.isLive ? 'Avg active listing (AUD)' : 'Avg sold (AUD)'}</p>
                    <div className="mt-1">
                      {searchResult.isLive ? <LiveBadge /> : <PriceBadge change={searchResult.change7d} />}
                    </div>
                  </div>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: '90-Day High',  value: `$${searchResult.high90d}`,     icon: TrendingUp },
                    { label: '90-Day Low',   value: `$${searchResult.low90d}`,      icon: TrendingDown },
                    { label: '7-Day Change', value: searchResult.change7d !== null ? `${searchResult.change7d > 0 ? '+' : ''}${searchResult.change7d}%` : 'N/A', icon: Activity, colored: searchResult.change7d !== null, up: searchResult.change7d !== null && searchResult.change7d >= 0 },
                    { label: '30-Day Change', value: searchResult.change30d !== null ? `${searchResult.change30d > 0 ? '+' : ''}${searchResult.change30d}%` : 'N/A', icon: BarChart3, colored: searchResult.change30d !== null, up: searchResult.change30d !== null && searchResult.change30d >= 0 },
                    { label: '90-Day Sales', value: searchResult.volume90d,          icon: DollarSign },
                  ].map(({ label, value, icon: Icon, colored, up }) => (
                    <div key={label} className="bg-muted/30 rounded-xl p-4 text-center">
                      <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
                      <p className={`text-lg font-bold ${colored ? (up ? 'text-emerald-600' : 'text-destructive') : ''}`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Price chart */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">30-Day Price History (AUD)</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" /> Updated daily
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={searchResult.priceHistory} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={searchResult.avgSale} stroke="hsl(var(--primary))" strokeDasharray="4 4" opacity={0.5} />
                      <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#priceGrad)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Investment signal + recent sales */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Signal */}
                  <div className="bg-muted/20 rounded-2xl p-6 space-y-4">
                    <h3 className="font-semibold">Investment Signal</h3>
                    {searchResult.change7d !== null ? (
                      <>
                        <InvestmentSignal change7d={searchResult.change7d} change30d={searchResult.change30d} />
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p className="flex justify-between"><span>7-day momentum</span><span className={searchResult.change7d >= 0 ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'}>{searchResult.change7d > 0 ? '▲' : '▼'} {Math.abs(searchResult.change7d)}%</span></p>
                          <p className="flex justify-between"><span>30-day trend</span><span className={searchResult.change30d >= 0 ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'}>{searchResult.change30d > 0 ? '▲' : '▼'} {Math.abs(searchResult.change30d)}%</span></p>
                          <p className="flex justify-between"><span>Avg vs 90-day high</span><span className="font-medium">{((searchResult.avgSale / searchResult.high90d) * 100).toFixed(0)}%</span></p>
                        </div>
                        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                          Signal based on price momentum. Not financial advice.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Trend signals require sold price history — live listing prices are shown above.
                      </p>
                    )}
                  </div>

                  {/* Recent sales */}
                  <div>
                    <h3 className="font-semibold mb-3">Recent Sold Listings (AUD)</h3>
                    <div className="space-y-1">
                      <div className="grid grid-cols-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-1">
                        <span>Date</span><span>Platform</span><span>Grade</span><span className="text-right">Sold</span>
                      </div>
                      {searchResult.recentSales.map((sale, i) => (
                        <div key={i} className="grid grid-cols-4 text-sm py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors items-center">
                          <span className="text-muted-foreground text-xs">{sale.date}</span>
                          <span className="text-xs">{sale.platform}</span>
                          <span><Badge variant="outline" className="text-xs">{sale.grade}</Badge></span>
                          <span className="text-right font-bold">${sale.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Market movers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Market Movers</h2>
            {selectedTab === 'active' ? (
              liveLoading ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Loading live data…</span>
              ) : liveMoverRows.length > 0 ? (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Live eBay AU prices
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Demo data</span>
              )
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Demo data</span>
            )}
          </div>
          <Tabs defaultValue="advancers" onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="advancers" className="gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Advancers
              </TabsTrigger>
              <TabsTrigger value="decliners" className="gap-1.5">
                <TrendingDown className="w-4 h-4 text-destructive" /> Decliners
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-1.5">
                <Activity className="w-4 h-4" /> Most Active
              </TabsTrigger>
            </TabsList>

            {['advancers', 'decliners', 'active'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3 bg-muted/40 border-b border-border">
                    <span>Card</span>
                    <span className="text-right mr-12">Price (AUD)</span>
                    <span className="text-right">Volume</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {tab === 'active' ? (
                      liveLoading ? (
                        Array(6).fill(0).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 py-3 px-4">
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4 rounded" />
                              <Skeleton className="h-3 w-1/2 rounded" />
                            </div>
                            <Skeleton className="h-8 w-20 rounded-lg" />
                            <Skeleton className="h-4 w-14 rounded" />
                          </div>
                        ))
                      ) : liveMoverRows.length > 0 ? (
                        liveMoverRows.map((card, i) => <MoverRow key={i} card={card} />)
                      ) : (
                        DEMO_MOVERS.active.map((card, i) => <MoverRow key={i} card={card} />)
                      )
                    ) : (
                      DEMO_MOVERS[tab].map((card, i) => <MoverRow key={i} card={card} />)
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Watchlist */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your Watchlist</h2>
            {isAuthenticated && (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Star className="w-3.5 h-3.5" /> Manage
              </Button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <StarOff className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="font-semibold mb-1">Sign in to use your Watchlist</p>
              <p className="text-sm text-muted-foreground mb-4">Track specific cards and get notified when prices move.</p>
              <Button variant="outline" size="sm">Sign In</Button>
            </div>
          ) : watchlist.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map((card, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground">{card.set}</p>
                    </div>
                    <button className="text-amber-400 hover:text-muted-foreground transition-colors flex-shrink-0">
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold">${card.price}</p>
                    <PriceBadge change={card.change} />
                  </div>
                  <Link to={cardUrl(card)} className="w-full">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-xs"
                  >
                    <Search className="w-3.5 h-3.5" /> Research this card
                  </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="font-semibold mb-1">Your watchlist is empty</p>
              <p className="text-sm text-muted-foreground">Search for a card and add it to start tracking prices.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MarketsPage;
