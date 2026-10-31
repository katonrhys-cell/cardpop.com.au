import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FeaturedSellerCard from '@/components/FeaturedSellerCard.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';

/**
 * The homepage "Trusted Australian Sellers" strip: a native scroll-snap track
 * (so it swipes on touch) with an arrow either side that pages through the
 * sellers and wraps around — Next on the last page returns to the first,
 * Previous on the first page jumps to the last — so visitors can rotate
 * through every featured seller rather than only the four that fit.
 *
 * One card per page on phones, two on tablets, three on desktop (the widths
 * below must stay in step with the `gap-6` between cards). The arrows only
 * render once the track actually overflows, so a short list stays a plain row.
 *
 * `inView` drives the same reveal-up animation the grid used; the reveal
 * wrapper stays the card's direct parent (a test relies on it).
 */
const FeaturedSellersCarousel = ({ sellers, inView = true }) => {
  const trackRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScroll(el.scrollWidth - el.clientWidth > 1);
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    let observer;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, sellers.length]);

  const scrollTrackTo = (left) => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: 'smooth' });
    else el.scrollLeft = left;
  };

  const page = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const maxLeft = scrollWidth - clientWidth;
    if (direction > 0) {
      // Past the last page → wrap to the start.
      scrollTrackTo(scrollLeft >= maxLeft - 1 ? 0 : Math.min(scrollLeft + clientWidth, maxLeft));
    } else {
      scrollTrackTo(scrollLeft <= 1 ? maxLeft : Math.max(scrollLeft - clientWidth, 0));
    }
  };

  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-background/95 hover:bg-background ' +
    'border border-border shadow-lg flex items-center justify-center text-foreground transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="relative">
      {canScroll && (
        <>
          <button
            type="button"
            onClick={() => page(-1)}
            aria-label="Previous sellers"
            className={`${arrowClass} -left-3 sm:-left-5`}
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            aria-label="Next sellers"
            className={`${arrowClass} -right-3 sm:-right-5`}
          >
            <ChevronRight className="w-6 h-6" aria-hidden="true" />
          </button>
        </>
      )}

      <div
        ref={trackRef}
        data-testid="featured-sellers-track"
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto scrollbar-hide py-2 -my-2"
        aria-label="Trusted sellers"
      >
        {sellers.map((seller, i) => (
          <div
            key={seller.id}
            className={`snap-start shrink-0 basis-full sm:basis-[calc((100%_-_1.5rem)/2)] lg:basis-[calc((100%_-_3rem)/3)] ${inView ? 'anim-reveal-up' : 'opacity-0'}`}
            style={inView ? { animationDelay: `${Math.min(i, 5) * 0.1}s` } : undefined}
          >
            <ErrorBoundary fallback={null}>
              <FeaturedSellerCard seller={seller} />
            </ErrorBoundary>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeaturedSellersCarousel;
