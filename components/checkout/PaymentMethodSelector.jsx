import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

/*
 * Payment step. Card details, PayPal and Afterpay are never entered on
 * CardPop — the actual payment is completed on Stripe's PCI-compliant hosted
 * checkout after "Confirm & Pay". This panel sets that expectation clearly and
 * shows exactly which methods are accepted, with the trust signals a buyer
 * expects before handing over money. Which methods actually appear on the
 * Stripe page depends on what's enabled in the Stripe Dashboard and on order
 * eligibility (e.g. Afterpay only shows within its supported amount range).
 */

const Badge = ({ label, children }) => (
  <div
    className="flex h-11 min-w-[3.75rem] items-center justify-center rounded-lg border border-border bg-white px-3 shadow-sm"
    title={label}
    aria-label={label}
  >
    {children}
  </div>
);

const VisaMark = () => (
  <svg viewBox="0 0 48 16" height="14" role="img" aria-hidden="true">
    <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="15" fill="#1434CB">VISA</text>
  </svg>
);

const MastercardMark = () => (
  <svg viewBox="0 0 40 24" height="22" role="img" aria-hidden="true">
    <circle cx="15" cy="12" r="10" fill="#EB001B" />
    <circle cx="25" cy="12" r="10" fill="#F79E1B" />
    <path d="M20 4.5a10 10 0 0 1 0 15 10 10 0 0 1 0-15Z" fill="#FF5F00" />
  </svg>
);

const AmexMark = () => (
  <svg viewBox="0 0 42 24" height="22" role="img" aria-hidden="true">
    <rect width="42" height="24" rx="3" fill="#006FCF" />
    <text x="21" y="15" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#fff">AMEX</text>
  </svg>
);

const PayPalMark = () => (
  <svg viewBox="0 0 62 16" height="15" role="img" aria-hidden="true">
    <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="14" fill="#003087">Pay</text>
    <text x="30" y="13" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="14" fill="#009CDE">Pal</text>
  </svg>
);

const AfterpayMark = () => (
  <svg viewBox="0 0 72 24" height="22" role="img" aria-hidden="true">
    <rect width="72" height="24" rx="4" fill="#000" />
    <circle cx="14" cy="12" r="6" fill="#B2FCE4" />
    <text x="24" y="16" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="10" fill="#fff">afterpay</text>
  </svg>
);

const ApplePayMark = () => (
  <svg viewBox="0 0 44 20" height="18" role="img" aria-hidden="true">
    <path d="M7.4 4.3c.5-.6.8-1.4.7-2.3-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1Zm.7 1.2c-1.2-.1-2.2.7-2.8.7-.6 0-1.4-.6-2.4-.6-1.2 0-2.4.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8 1-.03 1.3-.6 2.5-.6 1.2 0 1.5.6 2.5.6 1 0 1.7-.9 2.3-1.8.7-1 1-2 1-2.1-.03 0-2-.8-2-3 0-1.9 1.5-2.8 1.6-2.8-.9-1.3-2.3-1.5-2.8-1.5Z" fill="#000" />
    <text x="16" y="15" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="11" fill="#000">Pay</text>
  </svg>
);

const GooglePayMark = () => (
  <svg viewBox="0 0 52 20" height="18" role="img" aria-hidden="true">
    <text x="0" y="15" fontFamily="Arial, sans-serif" fontWeight="500" fontSize="12">
      <tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan>
    </text>
    <text x="38" y="15" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="12" fill="#5F6368">Pay</text>
  </svg>
);

const METHODS = [
  { label: 'Visa', mark: VisaMark },
  { label: 'Mastercard', mark: MastercardMark },
  { label: 'American Express', mark: AmexMark },
  { label: 'PayPal', mark: PayPalMark },
  { label: 'Afterpay', mark: AfterpayMark },
  { label: 'Apple Pay', mark: ApplePayMark },
  { label: 'Google Pay', mark: GooglePayMark },
];

const PaymentMethodSelector = () => {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Secure payment powered by Stripe</p>
            <p className="text-sm text-muted-foreground">
              Pay right here with Card, PayPal, Afterpay or a mobile wallet — you won't leave this
              page. Card details are entered inside Stripe's encrypted form and never touch
              CardPop's servers.
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Accepted payment methods
        </p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map(({ label, mark: Mark }) => (
            <Badge key={label} label={label}>
              <Mark />
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Afterpay lets you pay in 4 interest-free instalments, and appears at checkout for eligible
          order totals. Availability of each method depends on your device and region.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span>256-bit SSL encrypted · PCI-DSS compliant · You are only charged when you press Pay below.</span>
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
