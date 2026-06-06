import React from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * RefundPolicyNote — inline disclosure shown on checkout and listing detail pages.
 *
 * Props:
 *   variant  'compact' (one line) | 'full' (two lines with example)   default 'compact'
 *   itemPrice  number  optional — used in 'full' variant to show a live example
 *   commissionAud  number  optional — used in 'full' variant
 */
const RefundPolicyNote = ({ variant = 'compact', itemPrice, commissionAud }) => {
  if (variant === 'full' && itemPrice !== undefined && commissionAud !== undefined) {
    const retained = Math.round(commissionAud * 0.5 * 100) / 100;
    const refunded = Math.round((itemPrice + commissionAud - retained) * 100) / 100;

    return (
      <div className="flex gap-2.5 p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />
        <div className="space-y-0.5">
          <p>
            <span className="font-semibold text-foreground">Refund policy:</span>{' '}
            If a refund is issued, 50% of the platform fee is non-refundable to cover processing costs.
          </p>
          <p>
            On this order: you'd receive{' '}
            <span className="font-semibold text-foreground">${refunded.toFixed(2)} AUD</span> back
            (${itemPrice.toFixed(2)} item + ${(commissionAud - retained).toFixed(2)} of the ${commissionAud.toFixed(2)} platform fee).{' '}
            <Link to="/returns" className="text-primary font-semibold hover:underline">Full policy →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Info className="w-3.5 h-3.5 shrink-0 text-primary/70" />
      <span>
        50% of the platform fee is retained on refunds.{' '}
        <Link to="/returns" className="text-primary font-semibold hover:underline">Refund policy →</Link>
      </span>
    </div>
  );
};

export default RefundPolicyNote;
