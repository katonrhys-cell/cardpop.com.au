import React from 'react';
import { cn } from '@/lib/utils';
import { LOW_STOCK_THRESHOLD } from '@/utils/shopStock.js';
import LowStockMeter from '@/components/shop/LowStockMeter.jsx';

/**
 * How many are left, beside the buy button on shop product pages.
 *
 *   <StockLevel count={stockCount(row, chosenVariant, { hasVariants })} />
 *
 * At LOW_STOCK_THRESHOLD or fewer it is the "Hurry! Only N left" meter; above
 * that, a plain "10 in stock" line. `count` comes from stockCount() in
 * utils/shopStock.js, which is null for pre-order, coming-soon, untracked and
 * sold-out stock — so this renders nothing for those. Never feed it a made-up
 * number.
 */
export default function StockLevel({ count, className }) {
  if (!Number.isInteger(count) || count <= 0) return null;
  if (count <= LOW_STOCK_THRESHOLD) return <LowStockMeter count={count} className={className} />;
  return (
    <p className={cn('text-sm font-medium text-muted-foreground', className)} data-testid="stock-level">
      <span className="font-bold tabular-nums text-foreground">{count.toLocaleString('en-AU')}</span> in stock
    </p>
  );
}
