import React from 'react';
import ProductCard from './ProductCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

const ProductGrid = ({ items, loading, isVault = true }) => {
  if (loading) {
    return (
      <div className="seo-product-grid">
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
    <div className="seo-product-grid">
      {items.map((item) => (
        <ProductCard key={item.id} product={{ ...item, source: item.source || (isVault ? 'vault' : 'shop') }} />
      ))}
    </div>
  );
};

export default ProductGrid;