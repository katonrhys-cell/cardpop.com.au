
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient.js';
import MarketFiltersPanel from '@/components/MarketFiltersPanel.jsx';
import MarketStatsSection from '@/components/MarketStatsSection.jsx';
import PriceHistoryChart from '@/components/PriceHistoryChart.jsx';
import SalesTimelineTable from '@/components/SalesTimelineTable.jsx';
import ProductResearchModal from '@/components/ProductResearchModal.jsx';
import { toast } from 'sonner';

const MarketPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState({
    totalVolume: 0,
    avgPrice: 0,
    highestSale: 0,
    transactionCount: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filters, setFilters] = useState({
    cardType: 'all',
    timeframe: '30d',
    minPrice: '',
    maxPrice: ''
  });

  const [researchModalOpen, setResearchModalOpen] = useState(false);
  const [selectedCardName, setSelectedCardName] = useState('');

  const fetchMarketData = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch completed transactions
      const { data: records, error: fetchError } = await supabase
        .from('market_data')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;

      // Apply client-side filters
      let filtered = records || [];
      
      if (filters.minPrice && !isNaN(filters.minPrice)) {
        filtered = filtered.filter(t => t.price >= parseFloat(filters.minPrice));
      }
      if (filters.maxPrice && !isNaN(filters.maxPrice)) {
        filtered = filtered.filter(t => t.price <= parseFloat(filters.maxPrice));
      }
      
      // Calculate stats
      const totalVol = filtered.reduce((sum, t) => sum + (t.price || 0), 0);
      const count = filtered.length;
      const avg = count > 0 ? totalVol / count : 0;
      const highest = count > 0 ? Math.max(...filtered.map(t => t.price || 0)) : 0;

      setStats({
        totalVolume: totalVol,
        avgPrice: avg,
        highestSale: highest,
        transactionCount: count
      });

      setTransactions(filtered.slice(0, 50)); // Show top 50 recent

      // Generate mock chart data based on transactions for visualization
      // In a real app, this would group by date
      const mockChartData = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          price: Math.floor(avg * (0.8 + Math.random() * 0.4)) || Math.floor(Math.random() * 100) + 20
        };
      });
      setChartData(mockChartData);

      if (showToast) toast.success('Market data refreshed');
    } catch (err) {
      console.error("Error fetching market data:", err);
      setError("Failed to load market statistics.");
      if (showToast) toast.error('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  const handleClearFilters = () => {
    setFilters({
      cardType: 'all',
      timeframe: '30d',
      minPrice: '',
      maxPrice: ''
    });
  };

  const handleResearchCard = (cardName) => {
    if (cardName) {
      setSelectedCardName(cardName);
      setResearchModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans pb-20">
      <Helmet>
        <title>Market Dashboard | CardPop</title>
        <meta name="description" content="Analyze trading card market trends, sales history, and live eBay data." />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-card border-b border-border py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-serif mb-6 text-balance tracking-tight">
            Market Dashboard
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed text-balance">
            Track real-time sales data, analyze price trends, and research live eBay listings to make informed trading decisions.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 flex flex-col lg:flex-row gap-8 lg:gap-12 w-full">
        
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-72 shrink-0">
          <MarketFiltersPanel 
            filters={filters} 
            setFilters={setFilters} 
            onClear={handleClearFilters} 
          />
        </aside>

        {/* Dashboard Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
            <h2 className="text-2xl font-bold font-serif text-foreground">Market Overview</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchMarketData(true)} 
              disabled={loading}
              className="rounded-lg h-9"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3 mb-8">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error loading dashboard</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          )}

          <MarketStatsSection stats={stats} loading={loading} />
          
          <PriceHistoryChart data={chartData} loading={loading} />
          
          <SalesTimelineTable 
            transactions={transactions} 
            loading={loading} 
            onCardClick={handleResearchCard} 
          />
        </div>
      </section>

      <ProductResearchModal 
        isOpen={researchModalOpen} 
        onClose={() => setResearchModalOpen(false)} 
        cardName={selectedCardName} 
      />
    </div>
  );
};

export default MarketPage;
