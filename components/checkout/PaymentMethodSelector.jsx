import React from 'react';
import { Link } from 'react-router-dom';
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
    className="flex h-8 min-w-[2.75rem] items-center justify-center rounded-md border border-border bg-white px-2 shadow-sm"
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

// Google Pay acceptance mark: Google's actual "G" logo (the same unaltered
// path data Google publishes for its identity/sign-in mark and uses in the
// Google Pay button — verified against the reference asset) next to "Pay" in
// the specified neutral dark gray (#3C4043), per developers.google.com/pay/
// api/web/guides/brand-guidelines. Unlike the earlier version of this file,
// this does not spell out a colored "Google" wordmark — Google's real mark
// is the four-color "G" glyph, not a letter-by-letter recreation. The clear
// space this badge gets from its parent (`Badge`) already exceeds the
// required 0.5x cap-height-of-"G" minimum on every side.
export const GooglePayMark = () => (
  <svg viewBox="0 0 46 20" height="18" role="img" aria-hidden="true">
    <g transform="translate(0 1)">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
    </g>
    <text x="23" y="15" fontFamily="Roboto, 'Google Sans', Arial, sans-serif" fontWeight="500" fontSize="13" fill="#3C4043">Pay</text>
  </svg>
);

// Stripe Link — saved card + address, one-tap checkout (the Stripe-native
// equivalent of Shop Pay). Appears automatically for returning Link customers.
const LinkMark = () => (
  <svg viewBox="0 0 40 20" height="16" role="img" aria-hidden="true">
    <rect width="40" height="20" rx="4" fill="#00D66F" />
    <text x="20" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11" fill="#011E0F">link</text>
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
  { label: 'Link', mark: LinkMark },
];

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
          {METHODS.map(({ label, mark: Mark }) => (
            <Badge key={label} label={label}>
              <Mark />
            </Badge>
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
