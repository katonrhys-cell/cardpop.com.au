import React from 'react';
import FeaturedSellerCard from '@/components/FeaturedSellerCard.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import PagedCarousel from '@/components/PagedCarousel.jsx';

/**
 * The homepage "Trusted Australian Sellers" strip — a `PagedCarousel` of
 * seller cards (swipe, or arrows that page through and wrap around).
 *
 * `inView` drives the same reveal-up animation the grid used; the reveal
 * wrapper stays the card's direct parent (a test relies on it).
 */
const FeaturedSellersCarousel = ({ sellers, inView = true }) => (
  <PagedCarousel
    items={sellers}
    getKey={(seller) => seller.id}
    inView={inView}
    trackTestId="featured-sellers-track"
    trackLabel="Trusted sellers"
    prevLabel="Previous sellers"
    nextLabel="Next sellers"
    renderItem={(seller) => (
      <ErrorBoundary fallback={null}>
        <FeaturedSellerCard seller={seller} />
      </ErrorBoundary>
    )}
  />
);

export default FeaturedSellersCarousel;
