import React from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * RefundPolicyNote — inline disclosure shown on marketplace checkout (CheckoutModal).
 * Marketplace purchases only: CardPop Shop orders are refunded in full with no
 * fee retained (utils/refundAmounts.js), so don't render this for shop items.
 *
 * Props:
 *   variant  'compact' (one line) | 'full' (two lines with example)   default 'compact'
 *   breakdown  object  optional — the /calculate breakdown; 'full' uses it to
 *                      show what THIS order would actually refund
 *
 * The worked example mirrors utils/refundAmounts.js for marketplace orders: the buyer
 * gets the whole order total back minus (a) half of the platform fee (the
 * commission + GST that platform_fee_aud holds) and (b) all of the payment
 * processing fee, which Stripe keeps on a refunded charge and so cannot be
 * returned. Quoting anything else here promises a refund the code won't pay.
 */
const RefundPolicyNote = ({ variant = 'compact', breakdown }) => {
  if (variant === 'full' && breakdown) {
    const round = n => Math.round(n * 100) / 100;
    const itemPrice = Number(breakdown.itemPrice) || 0;
    const commissionAud = Number(breakdown.commissionAud) || 0;
    const gstAud = Number(breakdown.gstAud) || 0;
    const processingAud = Number(breakdown.processingAud) || 0;
    const total = Number(breakdown.total) || 0;

    const retainedFee = round((commissionAud + gstAud) * 0.5);
    const retained = round(retainedFee + processingAud);
    const refunded = round(total - retained);

    return (
      <div className="flex gap-2.5 p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />
        <div className="space-y-0.5">
          <p>
            <span className="font-semibold text-foreground">Refund policy:</span>{' '}
            If a refund is issued on a marketplace purchase, 50% of the platform fee is non-refundable
            {processingAud > 0 ? ', and the payment processing fee is not returned to us by our payment provider' : ''}.
          </p>
          <p>
            On this order: you'd receive{' '}
            <span className="font-semibold text-foreground">${refunded.toFixed(2)} AUD</span> back
            of the ${total.toFixed(2)} you paid (${itemPrice.toFixed(2)} item, less ${retained.toFixed(2)} in retained fees).{' '}
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
        50% of the platform fee is retained on marketplace refunds. CardPop Shop orders are refunded in full.{' '}
        <Link to="/returns" className="text-primary font-semibold hover:underline">Refund policy →</Link>
      </span>
    </div>
  );
};

export default RefundPolicyNote;
