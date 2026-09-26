import React from 'react';
import { cn } from '@/lib/utils';

// "Sale" pill for a shop product with a genuine sale price (see
// utils/shopPricing.js). Optional `percentOff` renders "Sale · 20% off".
// Position it with `className`, like SoldBadge.
const SIZES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-[11px]',
};

const SaleBadge = ({ percentOff = null, size = 'md', className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full bg-brand-red text-white font-extrabold uppercase tracking-widest leading-none shadow-md pointer-events-none select-none',
      SIZES[size] ?? SIZES.md,
      className,
    )}
  >
    Sale{percentOff ? ` · ${percentOff}% off` : ''}
  </span>
);

export default SaleBadge;
