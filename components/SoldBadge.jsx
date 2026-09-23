import React from 'react';
import { cn } from '@/lib/utils';

// The one "Sold" pill. Every card, rail, tile and detail view that can show a
// sold listing renders this, so a sold card reads the same wherever it turns
// up. Position it with `className` (e.g. "absolute top-3 left-3 z-20").
//
// size: 'sm' for compact rails/thumbnails, 'md' (default) for grid cards and
// detail headers.
const SIZES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-[11px]',
};

const SoldBadge = ({ size = 'md', className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full bg-brand-red text-white font-extrabold uppercase tracking-widest leading-none shadow-md pointer-events-none select-none',
      SIZES[size] ?? SIZES.md,
      className,
    )}
  >
    Sold
  </span>
);

export default SoldBadge;
