import React from 'react';
import { BNPL_PROVIDER, BNPL_INSTALMENTS, bnplEligible } from '@/lib/payments.js';

/*
 * "or 4 interest-free payments of $X.XX with Afterpay" — the standard
 * buy-now-pay-later instalment line professional retailers show up front on
 * product cards, the cart and the checkout summary.
 *
 * Display-only: it never initiates a payment. Afterpay itself is completed
 * inside Stripe's embedded checkout; this just sets the expectation early to
 * lift conversion. Renders nothing when BNPL is disabled (VITE_ENABLE_BNPL=false)
 * or the amount falls outside Afterpay's eligible range, so it's safe to drop in
 * anywhere a price is shown.
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
