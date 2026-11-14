import React from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOW_STOCK_THRESHOLD } from '@/utils/shopStock.js';

/**
 * "Hurry! Only 2 left in stock" with a meter that empties as stock runs down.
 * Shown beside the buy button on shop product pages.
 *
 *   <LowStockMeter count={lowStockCount(row, chosenVariant)} />
 *
 * `count` comes from lowStockCount() in utils/shopStock.js, which returns the
 * real stock figure only when it is at or below LOW_STOCK_THRESHOLD and null
 * otherwise — so this renders nothing for healthy, untracked or pre-order
 * stock. Never feed it a made-up number.
 */
export default function LowStockMeter({ count, className }) {
  if (!Number.isInteger(count) || count <= 0 || count > LOW_STOCK_THRESHOLD) return null;
  const pct = Math.round((count / LOW_STOCK_THRESHOLD) * 100);
  const last = count === 1;
  return (
    <div className={cn('w-full max-w-sm', className)} data-testid="low-stock-meter">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Flame className="h-4 w-4 shrink-0 text-brand-red" aria-hidden="true" />
        <span>
          Hurry! Only <span className="font-extrabold tabular-nums text-brand-red">{count}</span> left in stock
          {last ? ' — last one' : ''}
        </span>
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-silver/40"
        role="meter"
        aria-label="Stock remaining"
        aria-valuemin={0}
        aria-valuemax={LOW_STOCK_THRESHOLD}
        aria-valuenow={count}
        aria-valuetext={`${count} left in stock`}
      >
        <div
          className={cn('h-full rounded-full bg-brand-red transition-[width] duration-500', last && 'motion-safe:animate-pulse')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
