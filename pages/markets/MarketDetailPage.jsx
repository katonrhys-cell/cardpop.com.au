import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { slugify } from '@/lib/slugify.js';

const MarketDetailPage = () => {
  const { category, market } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const { data: res } = await supabase.from('market_data').select('*').eq('id', market).maybeSingle();
        setData(res);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchMarket();
  }, [market]);

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[400px] rounded-2xl" /></div>;
  if (!data) return (
    <div className="container-default section-padding text-center space-y-4">
      <p>Market data not found</p>
      <Link to="/analytics" className="text-primary text-sm font-bold hover:underline flex items-center justify-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Analytics
      </Link>
    </div>
  );

  return (
    <div className="container-default section-padding min-h-screen">
      <SEOHead title={data ? `${data.marketName} Market Data | CardPop` : 'Market Data | CardPop'} description={data?.description || (data ? `Track ${data.marketName} card prices, trends and analytics on CardPop.` : 'Market analytics on CardPop')} />
      
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-primary/10 rounded-2xl">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{data.marketName}</h1>
          <p className="text-muted-foreground">{data.category} Insights</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-card border border-border p-6 rounded-2xl">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Price Range</h3>
          <div className="text-3xl font-bold">{data.priceRange || 'N/A'}</div>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Overall Trend</h3>
          <div className="text-3xl font-bold capitalize">{data.trend || 'Stable'}</div>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Market Status</h3>
          <div className="text-3xl font-bold text-emerald-600">Active</div>
        </div>
      </div>

      <div className="bg-card border border-border p-8 rounded-3xl min-h-[300px] flex flex-col items-center justify-center text-muted-foreground">
        <p className="mb-4 text-lg">{data.description || 'Detailed analytics coming soon.'}</p>
        <p className="text-sm">Interactive charts will render here based on historical transaction data.</p>
      </div>
    </div>
  );
};

export default MarketDetailPage;