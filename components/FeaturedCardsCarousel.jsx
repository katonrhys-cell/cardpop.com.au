import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const FeaturedCardsCarousel = () => {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleItems, setVisibleItems] = useState(4);
  const pauseTimeoutRef = useRef(null);

  // Fetch cards and subscribe
  useEffect(() => {
    let isMounted = true;

    const fetchCards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: items } = await supabase
          .from('vault_items')
          .select('*')
          .eq('featured', true)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (isMounted) {
          setCards(items || []);
        }
      } catch (err) {
        console.error("Failed to fetch featured cards:", err);
        if (isMounted) setError("Unable to load featured cards at this time.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchCards();

    // Real-time subscription
    const channel = supabase
      .channel('vault-items-featured')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_items' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCards(prev => prev.filter(c => c.id !== payload.old.id));
        } else {
          const record = payload.new;
          if (record.featured) {
            setCards(prev => {
              const exists = prev.find(c => c.id === record.id);
              if (exists) {
                return prev.map(c => c.id === record.id ? record : c);
              }
              return [record, ...prev].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            });
          } else {
            setCards(prev => prev.filter(c => c.id !== record.id));
          }
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle responsiveness
  useEffect(() => {
    const updateVisibleItems = () => {
      if (window.innerWidth < 640) setVisibleItems(1);
      else if (window.innerWidth < 1024) setVisibleItems(2);
      else if (window.innerWidth < 1280) setVisibleItems(3);
      else setVisibleItems(4);
    };

    updateVisibleItems();
    window.addEventListener('resize', updateVisibleItems);
    return () => window.removeEventListener('resize', updateVisibleItems);
  }, []);

  // Adjust max index safely
  const maxIndex = Math.max(0, cards.length - visibleItems);

  // Auto rotation
  useEffect(() => {
    if (isPaused || cards.length === 0 || maxIndex <= 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, maxIndex, cards.length]);

  // Force index bounds if window resize reduces maxIndex
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
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-full sm:w-1/2 lg:w-1/4 flex-shrink-0 flex flex-col gap-4 bg-card rounded-2xl border border-border p-4">
            <Skeleton className="aspect-[4/5] w-full rounded-xl" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between mt-auto pt-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-6 w-1/4 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-muted rounded-2xl p-12 text-center border border-border/50">
        <div className="inline-flex w-12 h-12 rounded-full bg-destructive/10 items-center justify-center mb-4">
          <span className="text-destructive font-bold text-xl">!</span>
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Connection Issue</h3>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-muted/30 rounded-2xl p-16 text-center border border-border border-dashed flex flex-col items-center justify-center"
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-muted-foreground/60" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">No featured cards yet.</h3>
        <p className="text-muted-foreground max-w-md">Check back soon! Our team is currently selecting the best cards to showcase.</p>
      </motion.div>
    );
  }

  // Exact mathematical sizing to prevent drifting or cutoffs
  const containerWidth = `${(cards.length / visibleItems) * 100}%`;
  const itemWidth = `${100 / cards.length}%`;
  const transformX = `-${(currentIndex / cards.length) * 100}%`;

  return (
    <div className="relative w-full group">
      
      {/* Navigation Arrows */}
      {maxIndex > 0 && (
        <>
          <button 
            onClick={() => handleInteraction('prev')}
            className="absolute top-1/2 -translate-y-1/2 left-2 md:-left-5 z-10 w-12 h-12 bg-background/95 hover:bg-background border border-border rounded-full flex items-center justify-center shadow-lg transition-all text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous cards"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => handleInteraction('next')}
            className="absolute top-1/2 -translate-y-1/2 right-2 md:-right-5 z-10 w-12 h-12 bg-background/95 hover:bg-background border border-border rounded-full flex items-center justify-center shadow-lg transition-all text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Next cards"
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
          <AnimatePresence mode="popLayout">
            {cards.map((card) => {
              const formattedPrice = card.estimated_value_aud ? `$${Number(card.estimated_value_aud).toFixed(2)}` : 'Contact for Price';
              
              return (
                <motion.div 
                  key={card.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className="flex-shrink-0 px-3"
                  style={{ width: itemWidth }}
                >
                  <Link 
                    to={`/card/${card.id}`} 
                    className="group/card bg-card rounded-2xl border border-border shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-primary/30 transition-all duration-300 overflow-hidden flex flex-col h-full"
                  >
                    <div className="aspect-[4/5] bg-muted/20 p-6 flex items-center justify-center relative overflow-hidden">
                      {card.image_urls && card.image_urls.length > 0 ? (
                        <img
                          src={card.image_urls[0]}
                          alt={card.card_name || card.cardName || 'Trading Card'}
                          className="w-full h-full object-contain drop-shadow-xl group-hover/card:scale-[1.03] transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground/50">
                          <ImageOff className="w-12 h-12 mb-2" />
                          <span className="text-sm font-medium">No Image</span>
                        </div>
                      )}
                      
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        {card.featured && (
                          <Badge className="bg-[hsl(var(--brand-red))] text-white hover:bg-[hsl(var(--brand-red))]/90 border-none shadow-sm font-bold tracking-wide">
                            <Sparkles className="w-3 h-3 mr-1" /> Featured
                          </Badge>
                        )}
                        {card.condition && (
                          <Badge variant="secondary" className="shadow-sm font-bold bg-background/90 backdrop-blur-sm">
                            {card.condition}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-5 flex flex-col flex-1 bg-card">
                      <div className="mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {card.collectionType || 'Trading Card'}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground text-lg mb-4 line-clamp-2 leading-tight">
                        {card.card_name || card.cardName}
                      </h3>
                      
                      <div className="mt-auto pt-4 border-t border-border/50 flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-0.5">Est. Value</span>
                          <span className="font-bold text-xl text-primary leading-none">
                            {formattedPrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default FeaturedCardsCarousel;