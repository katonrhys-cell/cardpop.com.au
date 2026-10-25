import React from 'react';
import ProductCard from './ProductCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

const ProductGrid = ({ items, loading, isVault = true, onAddToCart }) => {
  // Matches the responsive product grid used on the main Shop and Marketplace
  // pages so category listings line up with the rest of the site. (The old
  // `seo-product-grid` class had no CSS rule anywhere, so cards fell back to
  // block layout and each stretched to the full container width.)
  const gridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';

  // Skeletons only while there is nothing to show yet: a refetch (filter,
  // return to the tab) keeps the current cards on screen instead of flashing
  // the whole grid back to placeholders.
  if (loading && !items?.length) {
    return (
      <div className={gridClass}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-4 h-[350px]">
            <Skeleton className="w-full h-48 rounded-xl" />
            <Skeleton className="w-3/4 h-5 mt-2" />
            <Skeleton className="w-1/2 h-4" />
            <Skeleton className="w-1/3 h-6 mt-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 rounded-2xl border border-border border-dashed">
        <h3 className="text-xl font-bold text-foreground mb-2">No items found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or browsing a different category.</p>
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {items.map((item, i) => (
        <ProductCard
          key={item.id}
          product={{ ...item, source: item.source || (isVault ? 'vault' : 'shop') }}
          onAddToCart={onAddToCart}
          priority={i < 2}
        />
      ))}
    </div>
  );
};

export default ProductGrid;