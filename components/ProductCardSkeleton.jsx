import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// The loading placeholder for one card in a product or listing grid. It has
// the same frame as ProductCard / MarketplaceListingCard — the bordered card,
// the 4:5 image area in the image placeholder's own colour, the p-5 body and
// the ruled price footer — so when the rows land the image box and the card
// edges are already where they will be and only the text and photo fill in.
//
// The grids used to hand-roll their own tiles (bare rounded blocks with no
// card around them, each page a little different), so every load showed one
// layout and then swapped to another.
const ProductCardSkeleton = ({ action = true }) => (
  <div
    className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden"
    aria-hidden="true"
    data-testid="product-card-skeleton"
  >
    <div className="aspect-[4/5] bg-muted/30 animate-pulse" />
    <div className="p-5 flex flex-col flex-1">
      <div className="mb-2">
        {/* eyebrow (10px text), then one title line */}
        <Skeleton className="h-[15px] w-1/4 mb-1" />
        <Skeleton className="h-[22px] w-4/5 mb-1" />
      </div>
      <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
        <Skeleton className="h-7 w-1/3" />
        {action && <Skeleton className="h-9 w-full rounded-xl" />}
      </div>
    </div>
  </div>
);

/** `count` skeleton cards, for dropping straight into a grid container. */
export const ProductCardSkeletons = ({ count = 8, action = true }) => (
  Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} action={action} />)
);

export default ProductCardSkeleton;
