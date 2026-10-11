import React from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MARKETPLACE_PROTECTION, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

/**
 * RefundPolicyNote — inline disclosure shown on marketplace checkout (CheckoutModal).
 *
 * Reads utils/buyerProtectionPolicy.js: an approved claim is a full refund of
 * the whole order (utils/refundAmounts.js defaults to retaining nothing), and a
 * marketplace sale is binding when the card is as advertised. `breakdown`
 * (the /calculate figures) is accepted so the 'full' variant can quote the
 * exact amount that comes back.
 *
 * Props:
 *   variant  'compact' (one line) | 'full' (two lines with the order's figure)
 *   breakdown  object  optional — the /calculate breakdown
 */
const RefundPolicyNote = ({ variant = 'compact', breakdown }) => {
  if (variant === 'full') {
    const total = Number(breakdown?.total) || 0;
    return (
      <div className="flex gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
        <div className="space-y-0.5">
          <p>
            <span className="font-semibold text-foreground">{MARKETPLACE_PROTECTION.name}:</span>{' '}
            {PROTECTION_COPY.marketplaceOneLine} Report it within {MARKETPLACE_PROTECTION.claimWindowDaysFromDelivery} days of delivery
            {total > 0 ? <> and the full <span className="font-semibold text-foreground">${total.toFixed(2)} AUD</span> comes back, fees included.</> : ', fees included.'}
          </p>
          <p>
            {PROTECTION_COPY.marketplaceNoChangeOfMind}{' '}
            <Link to="/returns" className="font-semibold text-primary hover:underline">Full policy →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <span>
        {PROTECTION_COPY.marketplaceOneLine} No change-of-mind returns on marketplace cards.{' '}
        <Link to="/returns" className="font-semibold text-primary hover:underline">Refund policy →</Link>
      </span>
    </div>
  );
};

export default RefundPolicyNote;
