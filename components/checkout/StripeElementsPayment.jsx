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
const appearanceFor = (dark) => ({
  theme: dark ? 'night' : 'stripe',
  variables: {
    colorPrimary: '#CE1126',
    colorDanger: '#CE1126',
    borderRadius: '8px',
    fontFamily: 'inherit',
  },
});

const EXPRESS_OPTIONS = {
  // Google Pay is the point of this row; 'always' shows the button even when
  // the buyer has no card saved to Google yet (Google then offers to add one).
  // Apple Pay appears on supported Apple devices. PayPal and Link are offered
  // in the card form below instead, so they aren't duplicated up here.
  paymentMethods: {
    googlePay: 'always',
    applePay: 'auto',
    paypal: 'never',
    link: 'never',
    amazonPay: 'never',
    klarna: 'never',
  },
  buttonType: { googlePay: 'buy', applePay: 'buy' },
  buttonTheme: { googlePay: 'black', applePay: 'black' },
  buttonHeight: 48,
};

const PAYMENT_OPTIONS = {
  layout: 'tabs',
  // The wallets already have their own button above — don't repeat them as tabs.
  wallets: { googlePay: 'never', applePay: 'never' },
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
          <ExpressCheckoutElement
            options={EXPRESS_OPTIONS}
            onReady={({ availablePaymentMethods }) => setExpressAvailable(!!availablePaymentMethods)}
            onConfirm={(event) => confirm({ expressCheckoutConfirmEvent: event })}
          />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or pay with card or PayPal</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <PaymentElement options={PAYMENT_OPTIONS} />

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button
        size="lg"
        className="w-full font-semibold"
        disabled={submitting || !checkout.canConfirm}
        onClick={() => confirm()}
      >
        {submitting ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
        ) : (
          <><Lock className="mr-2 h-4 w-4" /> Pay {checkout.total?.total?.amount ?? ''}</>
        )}
      </Button>
    </div>
  );
};

const StripeElementsPayment = ({ clientSecret }) => {
  const { resolvedTheme } = useTheme();
  // Appearance is read once when the SDK initialises; fix it per mount so a
  // theme flip mid-checkout can't re-create the provider (and its session).
  const options = useMemo(
    () => ({ clientSecret, elementsOptions: { appearance: appearanceFor(resolvedTheme === 'dark') } }),
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
