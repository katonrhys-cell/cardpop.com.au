import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { TrendingUp, TrendingDown, Minus, LineChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const MarketsPage = () => {
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await pb.collection('market_data').getList(1, 20, {
          $autoCancel: false
        });
        setMarketData(res.items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchMarkets();
  }, []);

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-5 h-5 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="w-5 h-5 text-destructive" />;
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Market Analytics | CardPop</title></Helmet>

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <LineChart className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Market Analytics</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track real-time trends, price movements, and volume data across all major TCG and Sports collections.
          </p>
        </div>
      </section>

      <section className="container-default section-padding">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : (
            marketData.map(market => (
              <Link key={market.id} to={`/markets/${market.category}/${market.id}`} className="bg-card border border-border p-6 rounded-2xl card-hover flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{market.marketName}</h3>
                    <p className="text-sm text-muted-foreground">{market.category}</p>
                  </div>
                  {getTrendIcon(market.trend)}
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-bold">{market.priceRange || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">7d Volume</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default MarketsPage;