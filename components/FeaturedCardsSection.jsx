import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import FeaturedProductCard from '@/components/FeaturedProductCard.jsx';

const FeaturedCardsSection = () => {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchFeaturedCards = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 1. Fetch featured cards from vault_items (high value, ordered by estimated_value_aud desc)
        const { data: featuredItems, error: featuredError } = await supabase
          .from('vault_items')
          .select('*')
          .gt('estimated_value_aud', 0)
          .order('estimated_value_aud', { ascending: false })
          .limit(50);

        if (featuredError || !featuredItems || featuredItems.length === 0) {
          if (isMounted) setCards([]);
          return;
        }

        // Use the ordered products directly
        const orderedProducts = featuredItems.map((item, idx) => ({
          ...item,
          _featuredOrder: idx
        }));

        if (isMounted) {
          setCards(orderedProducts);
        }
      } catch (err) {
        console.error('[FeaturedCardsSection] Error fetching featured cards:', err);
        if (isMounted) {
          setError('Failed to load featured collectibles. Please check your connection and try again.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchFeaturedCards();

    // Clean up
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-4 bg-card rounded-xl border border-border p-5 shadow-sm">
            <Skeleton className="aspect-[3/4] w-full rounded-lg bg-muted" />
            <Skeleton className="h-4 w-1/3 bg-muted mt-2 rounded" />
            <Skeleton className="h-6 w-3/4 bg-muted mb-4 rounded" />
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
              <Skeleton className="h-10 w-24 bg-muted rounded" />
              <Skeleton className="h-8 w-20 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl p-12 text-center border border-border shadow-sm">
        <div className="inline-flex w-12 h-12 rounded-full bg-destructive/10 items-center justify-center mb-4">
          <AlertCircle className="text-destructive w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-card-foreground mb-2">Connection Issue</h3>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-6 font-bold rounded-lg" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-16 text-center border border-border border-dashed shadow-sm flex flex-col items-center justify-center"
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-muted-foreground/60" />
        </div>
        <h3 className="text-xl font-bold text-card-foreground mb-2">No featured cards currently.</h3>
        <p className="text-muted-foreground max-w-md">Our curation team is currently selecting the best vault drops to showcase. Check back soon!</p>
      </motion.div>
    );
  }

  return (
    <div className="w-full">
      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {cards.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3 }}
            >
              <FeaturedProductCard product={product} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      
      <div className="text-center mt-12">
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-8 h-12 font-bold transition-all duration-300 active:scale-[0.98] shadow-sm">
          <Link to="/shop">View All Products</Link>
        </Button>
      </div>
    </div>
  );
};

export default FeaturedCardsSection;