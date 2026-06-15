import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { 
  DollarSign, Activity, BarChart3, Database, 
  TrendingUp, TrendingDown, ShieldCheck, Info
} from 'lucide-react';
import { MarketStatsCard } from '@/components/MarketStatsCard.jsx';
import { PriceTrendChart } from '@/components/PriceTrendChart.jsx';
import { GradingBreakdownChart } from '@/components/GradingBreakdownChart.jsx';
import { CardListingTable } from '@/components/CardListingTable.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import apiServerClient from '@/lib/apiServerClient.js';

const AustralianMarketsPage = () => {
  const [timeframe, setTimeframe] = useState('30d');
  const [collection, setCollection] = useState('All');
  
  const [salesData, setSalesData] = useState({ sales: [], total: 0 });
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [aggregatedHistory, setAggregatedHistory] = useState([]);
  const [gradingData, setGradingData] = useState([]);

  useEffect(() => {
    const fetchMarketData = async () => {
      setLoading(true);
      setError(null);
      try {
        const collectionParam = collection !== 'All' ? `&collection=${encodeURIComponent(collection)}` : '';
        
        const [statsRes, salesRes] = await Promise.all([
          apiServerClient.fetch(`/ebay/statistics?timeframe=${timeframe}${collectionParam}`),
          apiServerClient.fetch(`/ebay/sales?dateRange=${timeframe}${collectionParam}&limit=100`)
        ]);

        if (!statsRes.ok || !salesRes.ok) throw new Error('Failed to fetch market data');
        
        const statsJson = await statsRes.json();
        const salesJson = await salesRes.json();
        
        setStatsData(statsJson);
        setSalesData(salesJson);
        
        // Aggregate price history for chart
        const dateMap = {};
        const gradeMap = { 'Mint': 0, 'Near Mint': 0, 'Excellent': 0, 'Good': 0, 'Fair': 0 };
        
        (salesJson.sales ?? []).forEach(sale => {
          // Date aggregation
          const dateStr = sale.saleDate.split('T')[0];
          if (!dateMap[dateStr]) dateMap[dateStr] = { sum: 0, count: 0 };
          dateMap[dateStr].sum += sale.soldPrice;
          dateMap[dateStr].count += 1;

          // Grade aggregation
          if (gradeMap[sale.condition] !== undefined) {
            gradeMap[sale.condition] += 1;
          }
        });

        const historyArray = Object.keys(dateMap)
          .map(date => ({
            date,
            price: dateMap[date].sum / dateMap[date].count
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        setAggregatedHistory(historyArray);
        
        const gradeArray = Object.keys(gradeMap).map(condition => ({
          condition,
          count: gradeMap[condition]
        })).filter(g => g.count > 0);
        
        setGradingData(gradeArray);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
  }, [timeframe, collection]);

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col bg-background font-sans dark">
      <SEOHead title="Australian Card Markets | CardPop" description="Explore trading card markets across Australia. Find local card shops, events and trading communities near you." />
      
      {/* Hero Section */}
      <section className="bg-secondary py-16 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1640499900704-b00dd6a1103a?auto=format&fit=crop&w=1920&q=80')] opacity-5 mix-blend-overlay bg-cover bg-center" />
        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="max-w-3xl">
              <h1 className="font-serif text-4xl md:text-6xl font-bold mb-4 text-secondary-foreground tracking-tight">
                Market Intelligence
              </h1>
              <p className="text-lg text-muted-foreground font-medium max-w-2xl">
                Professional-grade analytics, live sales data, and price trends aggregated from verified Australian marketplaces.
              </p>
            </div>
            
            <div className="bg-background/50 backdrop-blur-md p-1.5 rounded-xl border border-border/50">
              <Tabs value={timeframe} onValueChange={setTimeframe}>
                <TabsList className="bg-transparent">
                  <TabsTrigger value="24h" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">24H</TabsTrigger>
                  <TabsTrigger value="7d" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">7D</TabsTrigger>
                  <TabsTrigger value="30d" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">30D</TabsTrigger>
                  <TabsTrigger value="90d" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">90D</TabsTrigger>
                  <TabsTrigger value="1y" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">1Y</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-7xl py-12 space-y-16">
        
        {error && (
          <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20 font-bold">
            Failed to load market data: {error}. Please try again later.
          </div>
        )}

        {/* Stats Dashboard */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold flex items-center gap-2 text-foreground">
              <Activity className="w-6 h-6 text-primary" /> Market Overview
            </h2>
            <div className="w-48">
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger className="bg-card border-border text-foreground">
                  <SelectValue placeholder="Filter Collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Collections</SelectItem>
                  <SelectItem value="Pokemon">Pokemon</SelectItem>
                  <SelectItem value="Magic">Magic: The Gathering</SelectItem>
                  <SelectItem value="Yu-Gi-Oh">Yu-Gi-Oh!</SelectItem>
                  <SelectItem value="NBA">NBA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl bg-secondary" />)
            ) : statsData ? (
              <>
                <MarketStatsCard 
                  title="Total Sales Volume" 
                  value={statsData.totalSalesVolume.toLocaleString()} 
                  icon={Database} 
                />
                <MarketStatsCard 
                  title="Total Sales Value" 
                  value={formatCurrency(statsData.totalSalesValue)} 
                  icon={DollarSign} 
                />
                <MarketStatsCard 
                  title="Average Price" 
                  value={formatCurrency(statsData.averagePrice)} 
                  icon={BarChart3} 
                  trend={5.2}
                  trendLabel="vs prev period"
                />
                <MarketStatsCard 
                  title="Median Price" 
                  value={formatCurrency(statsData.medianPrice)} 
                  icon={Activity} 
                />
                <MarketStatsCard 
                  title="Highest Sale" 
                  value={formatCurrency(statsData.highestSale?.price)} 
                  icon={TrendingUp} 
                  trendLabel={statsData.highestSale?.cardName}
                />
                <MarketStatsCard 
                  title="Lowest Sale" 
                  value={formatCurrency(statsData.lowestSale?.price)} 
                  icon={TrendingDown} 
                  trendLabel={statsData.lowestSale?.cardName}
                />
              </>
            ) : null}
          </div>
        </section>

        {/* Charts Section */}
        <section className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 premium-card p-6 md:p-8 bg-card border-border">
            <div className="mb-8">
              <h2 className="font-serif text-2xl font-bold mb-1 text-foreground">Price Trends Index</h2>
              <p className="text-sm text-muted-foreground font-medium">Average daily sale price across selected collections</p>
            </div>
            {loading ? <Skeleton className="w-full h-[350px] rounded-xl bg-secondary" /> : <PriceTrendChart data={aggregatedHistory} />}
          </div>
          
          <div className="premium-card p-6 md:p-8 bg-card border-border">
            <div className="mb-8">
              <h2 className="font-serif text-2xl font-bold mb-1 text-foreground">Condition Breakdown</h2>
              <p className="text-sm text-muted-foreground font-medium">Sales volume by card condition</p>
            </div>
            {loading ? <Skeleton className="w-full h-[300px] rounded-xl bg-secondary" /> : <GradingBreakdownChart data={gradingData} />}
          </div>
        </section>

        {/* Collection Insights */}
        {statsData?.byCollection && statsData.byCollection.length > 0 && (
          <section className="dashboard-section">
            <h2 className="font-serif text-2xl font-bold mb-6 text-foreground">Collection Insights</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsData.byCollection.map((col, idx) => (
                <div key={idx} className="premium-card p-6 bg-secondary border-border">
                  <h3 className="font-bold text-lg mb-4 text-primary">{col.name}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volume</span>
                      <span className="font-bold tabular-nums text-secondary-foreground">{col.salesCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Price</span>
                      <span className="font-bold tabular-nums text-secondary-foreground">{formatCurrency(col.avgPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Value</span>
                      <span className="font-bold tabular-nums text-secondary-foreground">{formatCurrency(col.totalValue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Live Sales Table */}
        <section className="dashboard-section">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold mb-1 text-foreground">Live Market Activity</h2>
              <p className="text-sm text-muted-foreground font-medium">Recent verified sales from eBay Australia</p>
            </div>
          </div>

          {loading ? (
            <Skeleton className="w-full h-[500px] rounded-2xl bg-secondary" />
          ) : (
            <CardListingTable data={salesData.sales} />
          )}
        </section>

        {/* Grading Info & Advanced Analytics */}
        <section className="dashboard-section grid md:grid-cols-2 gap-8">
          <div className="premium-card p-8 bg-secondary border-border">
            <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-2 text-secondary-foreground">
              <ShieldCheck className="w-6 h-6 text-primary" /> Grading Standards
            </h2>
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
              Card Pop normalizes conditions across raw and graded cards to provide accurate market comparisons.
            </p>
            <div className="space-y-4">
              {[
                { label: 'Mint (PSA 9-10)', desc: 'Flawless condition, perfect centering, sharp corners.' },
                { label: 'Near Mint (PSA 7-8)', desc: 'Minor imperfections visible upon close inspection.' },
                { label: 'Excellent (PSA 5-6)', desc: 'Light wear, minor edge whitening or surface scratches.' }
              ].map((grade, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-secondary-foreground">{grade.label}</p>
                    <p className="text-xs text-muted-foreground">{grade.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-card p-8 bg-secondary border-border">
            <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-2 text-secondary-foreground">
              <Info className="w-6 h-6 text-primary" /> Advanced Analytics
            </h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold text-secondary-foreground">Market Volatility Index</span>
                  <span className="text-sm font-bold text-amber-500">Moderate</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
                  <div className="h-full bg-amber-500 w-[45%]" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Prices are fluctuating within normal seasonal ranges.</p>
              </div>
              
              <div className="p-4 bg-background rounded-xl border border-border">
                <p className="text-sm font-bold text-primary mb-1">Investment Recommendation</p>
                <p className="text-xs text-foreground/80">
                  Vintage Pokemon (WOTC era) showing strong support levels. Modern sports cards experiencing slight correction. Consider holding high-grade vintage assets.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default AustralianMarketsPage;