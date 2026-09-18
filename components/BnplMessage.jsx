import React from 'react';
import { BNPL_PROVIDER, BNPL_INSTALMENTS, bnplEligible } from '@/lib/payments.js';

/*
 * "or 4 interest-free payments of $X.XX with Afterpay" — the standard
 * buy-now-pay-later instalment line professional retailers show up front on
 * product cards, the cart and the checkout summary.
 *
 * Display-only: it never initiates a payment. Renders nothing unless BNPL is
 * explicitly switched on (VITE_ENABLE_BNPL=true) and the amount is in range —
 * and it is OFF by default, because checkout no longer offers a BNPL method
 * (see lib/payments.js and docs/order-pricing.md). Safe to leave in place
 * anywhere a price is shown: it simply renders nothing.
 */
const BnplMessage = ({ amount, className = '', align = 'left' }) => {
  const value = Number(amount);
  if (!bnplEligible(value)) return null;

  const perInstalment = (value / BNPL_INSTALMENTS).toFixed(2);

  return (
    <p className={`text-xs text-muted-foreground ${align === 'center' ? 'text-center' : ''} ${className}`}>
      or {BNPL_INSTALMENTS} interest-free payments of{' '}
      <span className="font-semibold text-foreground">${perInstalment}</span> with{' '}
      <span className="font-semibold text-foreground">{BNPL_PROVIDER}</span>
    </p>
  );
};

export default BnplMessage;
