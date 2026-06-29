import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Users, AlertCircle } from 'lucide-react';
import SellerCard from '@/components/SellerCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

const CommunityPage = () => {
  const [sellers, setSellers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSellers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .or('inventory_count.gt.0,rating.gt.0')
          .order('rating', { ascending: false })
          .limit(50);
        if (fetchError) throw fetchError;
        setSellers(data || []);
      } catch (err) {
        setError('Unable to load the seller directory at this time. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      <SEOHead title="Community Hub | CardPop" description="Connect with Australian trading card collectors. Join discussions, share your collection and find trade partners." />

      {/* Hero Section */}
      <div className="bg-card py-16 relative overflow-hidden border-b border-border shadow-sm">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1593814681464-eef5af2b0628?auto=format&fit=crop&w=1920&q=80')] opacity-5 mix-blend-overlay bg-cover bg-center" />
        <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
              Seller Directory
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl text-balance mb-8 mx-auto md:mx-0">
              Discover trusted collectors, dedicated shops, and verified community members driving the Australian trading card scene.
            </p>
          </div>
          
          <div className="hidden md:flex w-32 h-32 bg-primary/10 rounded-[2rem] items-center justify-center backdrop-blur-sm shrink-0 shadow-xl border border-primary/20 transform rotate-3">
            <Users className="w-16 h-16 text-primary" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        {error && (
          <div className="bg-card border border-destructive/20 rounded-xl p-6 flex flex-col items-center justify-center text-center mb-12 shadow-sm">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">Failed to load directory</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-[12px] border border-border p-[20px] flex items-center gap-5 shadow-sm">
                <Skeleton className="w-[80px] h-[80px] rounded-full shrink-0 bg-background" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-1/2 bg-background" />
                  <Skeleton className="h-3 w-1/3 bg-background" />
                  <Skeleton className="h-4 w-2/3 bg-background" />
                </div>
                <Skeleton className="h-10 w-28 rounded-lg shrink-0 hidden sm:block bg-background" />
              </div>
            ))}
          </div>
        ) : !error && sellers.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No sellers found</h3>
            <p className="text-muted-foreground max-w-md">
              The directory is currently empty. Check back soon as new sellers join the marketplace.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CommunityPage;