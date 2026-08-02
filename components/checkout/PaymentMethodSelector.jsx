import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock } from 'lucide-react';
import { PAYMENT_MARKS } from '@/components/checkout/PaymentMarks.jsx';

/*
 * Payment step. Card details, PayPal and Afterpay are never entered on
 * CardPop — the actual payment is completed on Stripe's PCI-compliant hosted
 * checkout after "Confirm & Pay". This panel sets that expectation clearly and
 * shows exactly which methods are accepted, with the trust signals a buyer
 * expects before handing over money. Which methods actually appear on the
 * Stripe page depends on what's enabled in the Stripe Dashboard and on order
 * eligibility (e.g. Afterpay only shows within its supported amount range).
 *
 * The acceptance marks themselves are real brand artwork — see PaymentMarks.jsx.
 * Every badge is the same size and each logo is pre-fitted to a shared inner
 * box, so the row reads as one set rather than eight differently-scaled marks.
 *
 * Stripe Link is deliberately absent from this row: Stripe does not publish a
 * Link acceptance mark alongside the payment-method logos above, and a redrawn
 * stand-in would be the one thing here that isn't the genuine logo. Link still
 * appears on the Stripe checkout itself for returning Link customers, and both
 * /safe-buying and /trust-safety still name it in the accepted-methods copy.
 */

export const PaymentBadge = ({ label, children }) => (
  <span
    className="inline-flex h-[34px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white shadow-sm"
    title={label}
    role="img"
    aria-label={label}
  >
    {children}
  </span>
);

const PaymentMethodSelector = () => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Secure payment</p>
            <p className="text-xs text-muted-foreground">Powered by Stripe · you never leave this page</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PAYMENT_MARKS.map(({ label, Mark }) => (
            <PaymentBadge key={label} label={label}>
              <Mark />
            </PaymentBadge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span>
          256-bit SSL · PCI-DSS compliant. Card details are entered inside Stripe's encrypted form and never touch our servers.{' '}
          <Link to="/trust-safety" className="font-medium text-primary hover:underline">
            See how you're protected
          </Link>
          .
        </span>
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
