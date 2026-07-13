import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import RookieJerseyIcon from '@/components/icons/RookieJerseyIcon.jsx';

// The one rookie reference shown on card tiles and detail pages: a single
// "Rookie Card (RC)" pill with the jersey icon. Rendered when the
// ROOKIE_VARIANT chip is selected (or the legacy is_rookie flag is set) —
// see lib/cardVariants.js.
const RookiePill = ({ className }) => (
  <Badge
    variant="outline"
    className={cn('text-[10px] font-bold border-amber-400/50 text-amber-700 bg-amber-400/10 dark:text-amber-300 gap-1', className)}
  >
    <RookieJerseyIcon className="w-3 h-3 shrink-0" /> Rookie Card (RC)
  </Badge>
);

export default RookiePill;
