import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, MapPin, User, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const TrustedSellersCarousel = () => {
  const [sellers, setSellers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleItems, setVisibleItems] = useState(3);
  const pauseTimeoutRef = useRef(null);

  // Fetch trusted sellers
  useEffect(() => {
    const fetchSellers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: response } = await supabase
          .from('profiles')
          .select('*')
          .gt('positive_feedback_pct', 0)
          .order('positive_feedback_pct', { ascending: false })
          .limit(20);
        setSellers(response || []);
      } catch (err) {
        console.error("Failed to fetch sellers:", err);
        setError("Unable to load trusted sellers at this time.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSellers();
  }, []);

  // Handle responsiveness
  useEffect(() => {
    const updateVisibleItems = () => {
      if (window.innerWidth < 640) setVisibleItems(1);
      else if (window.innerWidth < 1024) setVisibleItems(2);
      else setVisibleItems(3);
    };

    updateVisibleItems();
    window.addEventListener('resize', updateVisibleItems);
    return () => window.removeEventListener('resize', updateVisibleItems);
  }, []);

  // Adjust max index safely
  const maxIndex = Math.max(0, sellers.length - visibleItems);

  // Auto rotation
  useEffect(() => {
    if (isPaused || sellers.length === 0 || maxIndex <= 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, maxIndex, sellers.length]);

  // Force index bounds
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(Math.max(0, maxIndex));
    }
  }, [maxIndex, currentIndex]);

  const handleInteraction = (direction) => {
    if (maxIndex <= 0) return;
    
    setIsPaused(true);
    if (direction === 'next') {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    } else {
      setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    }

    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-hidden pb-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-full sm:w-1/2 lg:w-1/3 flex-shrink-0 bg-card rounded-2xl border border-border p-6 flex flex-col items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-1/2 mb-3" />
            <Skeleton className="h-4 w-1/3 mb-6" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-muted rounded-2xl p-12 text-center border border-border/50">
        <h3 className="text-lg font-bold text-foreground mb-2">Connection Issue</h3>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (sellers.length === 0) {
    return null; // Hide section gracefully if no sellers
  }

  // Exact mathematical sizing to prevent drifting or cutoffs
  const containerWidth = `${(sellers.length / visibleItems) * 100}%`;
  const itemWidth = `${100 / sellers.length}%`;
  const transformX = `-${(currentIndex / sellers.length) * 100}%`;

  return (
    <div className="relative w-full group">
      
      {/* Navigation Arrows */}
      {maxIndex > 0 && (
        <>
          <button 
            onClick={() => handleInteraction('prev')}
            className="absolute top-1/2 -translate-y-1/2 left-2 md:-left-5 z-10 w-12 h-12 bg-background/95 hover:bg-background border border-border rounded-full flex items-center justify-center shadow-lg transition-all text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous sellers"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => handleInteraction('next')}
            className="absolute top-1/2 -translate-y-1/2 right-2 md:-right-5 z-10 w-12 h-12 bg-background/95 hover:bg-background border border-border rounded-full flex items-center justify-center shadow-lg transition-all text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next sellers"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Track */}
      <div className="overflow-hidden px-2 py-4 -mx-2">
        <motion.div 
          className="flex"
          style={{ width: containerWidth }}
          animate={{ x: transformX }}
          transition={{ ease: "easeInOut", duration: 0.5 }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {sellers.map((seller) => (
            <div 
              key={seller.id} 
              className="flex-shrink-0 px-3"
              style={{ width: itemWidth }}
            >
              <div className="bg-card rounded-2xl border border-border p-8 flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full">
                
                <div className="relative mb-5 group/avatar">
                  {seller.avatar_url ? (
                    <img
                      src={seller.avatar_url}
                      alt={`${seller.name || 'Seller'} avatar`}
                      className="w-24 h-24 rounded-2xl object-cover shadow-sm ring-4 ring-background"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center shadow-sm ring-4 ring-background">
                      <User className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                  )}
                  {seller.verified && (
                    <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-0.5 shadow-sm">
                      <CheckCircle2 className="w-6 h-6 text-primary fill-background" />
                    </div>
                  )}
                </div>
                
                <h3 className="font-bold text-xl text-foreground mb-2">
                  {seller.name || 'Anonymous Collector'}
                </h3>
                
                <div className="flex flex-col gap-2 items-center w-full mb-6">
                  <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 px-3 py-1 rounded-full">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" aria-hidden="true" />
                    <span className="text-foreground">{seller.rating ? seller.rating.toFixed(1) : 'New'}</span>
                    <span className="text-muted-foreground ml-1">
                      ({seller.reviewsCount || 0} reviews)
                    </span>
                  </div>
                  
                  {seller.location && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{seller.location}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto w-full">
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl border-border text-foreground hover:bg-primary hover:border-primary hover:text-white transition-all duration-300 active:scale-[0.98] font-bold"
                    asChild
                  >
                    <Link to={`/seller/${seller.id}`}>View Vault</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default TrustedSellersCarousel;