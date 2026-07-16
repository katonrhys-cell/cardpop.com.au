import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, UserCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';

const FeaturedSellersCarousel = () => {
  const [sellers, setSellers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSellers = async () => {
      try {
        setIsLoading(true);
        // featuredSellers has no direct Supabase equivalent — get top sellers by positive_feedback_pct
        let activeSellers = [];

        const { data: topUsers } = await supabase
          .from('profiles')
          .select(PUBLIC_PROFILE_COLUMNS)
          .gt('total_sales', 0)
          .order('positive_feedback_pct', { ascending: false })
          .limit(4);

        // Deduplicate by user id to prevent duplicates
        const seen = new Set();
        const uniqueSellers = (topUsers || []).filter(seller => {
          if (seen.has(seller.id)) return false;
          seen.add(seller.id);
          return true;
        });

        activeSellers = uniqueSellers;

        if (isMounted) {
          setSellers(activeSellers);
        }
      } catch (error) {
        console.error('Error fetching sellers:', error);
        // Fail silently - UI handles empty state
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSellers();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4 md:px-0">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-background rounded-2xl p-6 border border-border shadow-sm flex flex-col items-center">
            <Skeleton className="w-24 h-24 rounded-2xl mb-5" />
            <Skeleton className="h-6 w-32 mb-3" />
            <Skeleton className="h-4 w-24 mb-6" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (sellers.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-background/50 rounded-2xl border border-border border-dashed mx-4 md:mx-0">
        <UserCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground font-medium">Our community is growing. Trusted sellers will appear here soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4 md:px-0">
      {sellers.map((seller) => (
        <Link 
          key={seller.id} 
          to={`/community/user/${seller.id}`}
          className="group bg-background rounded-2xl p-6 border border-border shadow-sm flex flex-col items-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
        >
          <div className="relative mb-5">
            <div className="w-24 h-24 rounded-2xl bg-muted overflow-hidden flex items-center justify-center border-2 border-background shadow-sm group-hover:border-primary/20 transition-colors">
              {seller.avatar_url ? (
                <img
                  src={seller.avatar_url}
                  alt={seller.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  width="96"
                  height="96"
                />
              ) : (
                <span className="text-3xl font-bold text-muted-foreground font-serif">
                  {seller.name ? seller.name.charAt(0).toUpperCase() : 'U'}
                </span>
              )}
            </div>
            {seller.verified && (
              <div className="absolute -bottom-2 -right-2 bg-background rounded-xl p-1 shadow-sm border border-border">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>
          
          <h3 className="font-bold text-foreground text-lg mb-1 truncate w-full text-center group-hover:text-primary transition-colors">
            {seller.name || 'Anonymous Collector'}
          </h3>
          
          <div className="flex items-center justify-center gap-1.5 mb-6">
            <Star className="w-4 h-4 fill-primary text-primary" />
            <span className="font-bold tabular-nums">{seller.positive_feedback_pct || '5.0'}</span>
            <span className="text-muted-foreground text-sm">({seller.total_sales || 0})</span>
          </div>
          
          <div className="w-full text-center text-sm font-bold text-primary bg-primary/5 py-2.5 rounded-xl group-hover:bg-primary/10 transition-colors">
            View Vault
          </div>
        </Link>
      ))}
    </div>
  );
};

export default FeaturedSellersCarousel;