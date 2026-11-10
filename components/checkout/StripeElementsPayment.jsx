import React, { useMemo, useState } from 'react';
import {
  CheckoutElementsProvider,
  useCheckoutElements,
  ExpressCheckoutElement,
  PaymentElement,
} from '@stripe/react-stripe-js/checkout';
import { useTheme } from 'next-themes';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stripePromise } from '@/lib/stripeClient.js';

/*
 * Inline payment form built from Stripe Elements against a Checkout Session
 * created with ui_mode 'elements' (src/routes/stripe.js). It is the same
 * session, price and pending order as the embedded page — fulfilment still
 * runs off checkout.session.completed — but because we lay the form out
 * ourselves we can put a real Google Pay button inline at the top of the
 * payment step (https://docs.stripe.com/google-pay), above the card form.
 *
 * The Google Pay button is drawn by Stripe's Express Checkout Element, which
 * renders Google's own button asset (buttonType 'buy' → "Buy with G Pay"), so
 * it follows Google's brand guidelines without any artwork of ours. Stripe
 * represents a Google Pay payment as a card payment with card.wallet.type set,
 * so it rides on the pinned 'card' method and the webhook already labels the
 * receipt "Paid with Google Pay" (resolveWalletType).
 *
 * Prerequisites (Stripe Dashboard, no code): Google Pay switched on under
 * Settings → Payment methods, and cardpop.com.au registered under Settings →
 * Payment method domains — Elements won't show wallets on an unregistered
 * domain. See docs/accelerated-checkout.md.
 */

// Brand palette only — no blue (tailwind.config.js).
//
// The fields render inside Stripe's cross-origin iframe, so the page's CSS
// never reaches them: `fontFamily: 'inherit'` resolves to the iframe's own
// default, which in Safari is Times (serif). Name the body stack explicitly —
// it mirrors --font-sans in index.css and is all system fonts, so nothing has
// to be loaded into the iframe.
export const CHECKOUT_FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const appearanceFor = (dark) => ({
  theme: dark ? 'night' : 'stripe',
  labels: 'above',
  variables: {
    colorPrimary: '#CE1126',
    colorDanger: '#CE1126',
    colorText: dark ? '#F5F7FA' : '#1F2937',
    colorTextSecondary: dark ? '#C4CED4' : '#6B7280',
    colorTextPlaceholder: dark ? '#8A949C' : '#9CA3AF',
    colorBackground: dark ? '#111827' : '#FFFFFF',
    fontFamily: CHECKOUT_FONT_STACK,
    fontSizeBase: '15px',
    fontWeightNormal: '400',
    fontWeightMedium: '500',
    borderRadius: '8px',
    spacingUnit: '4px',
    gridRowSpacing: '16px',
  },
  rules: {
    '.Label': { fontWeight: '500', fontSize: '14px', marginBottom: '6px' },
    '.Input': {
      border: `1px solid ${dark ? '#374151' : '#D1D5DB'}`,
      boxShadow: 'none',
      padding: '12px',
    },
    '.Input:focus': {
      border: '1px solid #CE1126',
      boxShadow: '0 0 0 3px rgba(206, 17, 38, 0.15)',
    },
    '.Input--invalid': { border: '1px solid #CE1126', boxShadow: 'none' },
    '.Error': { fontSize: '13px' },
  },
});

const EXPRESS_OPTIONS = {
  // 'always' shows each wallet button even when the buyer has no card saved to
  // it yet (the wallet then offers to add one). Apple Pay still only appears on
  // devices/browsers that support it. PayPal and Link are not offered
  // (src/utils/checkoutPaymentMethods.js pins checkout to card).
  paymentMethods: {
    googlePay: 'always',
    applePay: 'always',
    paypal: 'never',
    link: 'never',
    amazonPay: 'never',
    klarna: 'never',
  },
  buttonType: { googlePay: 'buy', applePay: 'buy' },
  buttonTheme: { googlePay: 'black', applePay: 'black' },
  buttonHeight: 48,
  // One full-width button per row, and never fold a wallet behind Stripe's
  // "Show more" overflow toggle — on a phone the default layout hid the second
  // wallet until the buyer tapped it.
  layout: { maxColumns: 1, overflow: 'never' },
};

// Two stacked 48px buttons + the gap between them. Held open while the
// wallets load so the card form doesn't jump down when they appear.
const EXPRESS_RESERVED_HEIGHT = 'min-h-[108px]';

const PAYMENT_OPTIONS = {
  layout: 'tabs',
  // The wallets already have their own button above — don't repeat them as tabs.
  // Link is off too: its "Save my information for faster checkout" opt-in adds
  // its own email / mobile / full-name fields and a Link terms line under the
  // card, which made the form long and read like a third-party sign-up.
  wallets: { googlePay: 'never', applePay: 'never', link: 'never' },
};

/*
 * The checkout form's billing address (or the shipping address when "Same as
 * shipping" is ticked) in the shape Stripe's Checkout SDK prefills from. Left
 * to itself the card form guesses the country from the buyer's IP — a
 * shopper near the Tasman or on a VPN saw "New Zealand" on an Australia-only
 * checkout. Country is always AU: checkAustralianAddress() refuses anything
 * else server-side before the session exists.
 */
export const billingContactFor = (addr = {}) => {
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(' ').trim();
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const address = { country: 'AU' };
  const fields = { line1: pick(addr.address), line2: pick(addr.address2), city: pick(addr.suburb), state: pick(addr.state), postal_code: pick(addr.postcode) };
  for (const [k, v] of Object.entries(fields)) if (v) address[k] = v;
  return { ...(name ? { name } : {}), address };
};

const ErrorNote = ({ children }) => (
  <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{children}</span>
  </div>
);

const PaymentForm = () => {
  const result = useCheckoutElements();
  const [expressAvailable, setExpressAvailable] = useState(true);
  const [expressReady, setExpressReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (result.type === 'loading') {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Loading secure payment form…</p>
      </div>
    );
  }
  if (result.type === 'error') {
    return <ErrorNote>{result.error.message || 'Could not load the payment form. Please refresh and try again.'}</ErrorNote>;
  }

  const { checkout } = result;

  // On success Stripe redirects to the session's return_url (/checkout-success),
  // so only the error branch ever comes back here.
  const confirm = async (args) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await checkout.confirm(args);
      if (res.type === 'error') setError(res.error.message);
    } catch (err) {
      setError(err?.message || 'Payment could not be completed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {expressAvailable && (
        <div className="space-y-3">
          <div className={expressReady ? undefined : EXPRESS_RESERVED_HEIGHT}>
            <ExpressCheckoutElement
              options={EXPRESS_OPTIONS}
              onReady={({ availablePaymentMethods }) => {
                setExpressAvailable(!!availablePaymentMethods);
                setExpressReady(true);
              }}
              onConfirm={(event) => confirm({ expressCheckoutConfirmEvent: event })}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or pay with card</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <PaymentElement options={PAYMENT_OPTIONS} />

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Not disabled while the card is still empty: a pale disabled button
          read as broken. Pressing it early runs Stripe's own validation, which
          marks the missing fields inline. Only blocked while a payment runs. */}
      <Button
        size="lg"
        className="w-full font-semibold"
        disabled={submitting}
        aria-busy={submitting || undefined}
        data-ready={checkout.canConfirm ? 'true' : 'false'}
        onClick={() => confirm()}
      >
        {submitting ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
        ) : (
          <><Lock className="mr-2 h-4 w-4" /> Pay {checkout.total?.total?.amount ?? ''}</>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Secured by <span className="font-semibold text-foreground">Stripe</span>. Your card details are encrypted and never reach CardPop.
        </span>
      </p>
    </div>
  );
};

const StripeElementsPayment = ({ clientSecret, billingAddress }) => {
  const { resolvedTheme } = useTheme();
  // Appearance and default values are read once when the SDK initialises; fix
  // them per mount so a theme flip or an edit mid-checkout can't re-create
  // the provider (and its session).
  const options = useMemo(
    () => ({
      clientSecret,
      elementsOptions: { appearance: appearanceFor(resolvedTheme === 'dark') },
      defaultValues: { billingAddress: billingContactFor(billingAddress) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientSecret],
  );

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <CheckoutElementsProvider stripe={stripePromise} options={options}>
        <PaymentForm />
      </CheckoutElementsProvider>
    </div>
  );
};

export default StripeElementsPayment;
