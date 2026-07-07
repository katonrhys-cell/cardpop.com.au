import React, { useCallback } from 'react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { AlertTriangle } from 'lucide-react';
import { stripePromise, hasStripeKey } from '@/lib/stripeClient.js';
import apiServerClient from '@/lib/apiServerClient.js';

/*
 * Inline Stripe payment. Renders Stripe's Embedded Checkout (card / PayPal /
 * Afterpay / wallets) directly on our page — the buyer never leaves
 * cardpop.com.au. Card data is entered inside Stripe's own secure iframe, so it
 * never touches our servers (PCI scope stays with Stripe).
 *
 * `requestBody` MUST be a stable/memoised object: EmbeddedCheckoutProvider calls
 * fetchClientSecret once on mount, and a new object identity would recreate the
 * session. On completion Stripe redirects the buyer to the session's
 * return_url (our /checkout-success page), where the webhook-confirmed order is
 * shown — identical to the previous hosted flow.
 */

const EmbeddedStripeCheckout = ({ requestBody }) => {
  const fetchClientSecret = useCallback(async () => {
    const res = await apiServerClient.fetch('/stripe/create-cart-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...requestBody,
        uiMode: 'embedded',
        returnUrl: `${window.location.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.clientSecret) {
      throw new Error(data.error || 'Could not start the payment. Please try again.');
    }
    return data.clientSecret;
  }, [requestBody]);

  if (!hasStripeKey) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Payments aren't configured yet.</p>
          <p className="mt-1">
            Set <code className="rounded bg-amber-100 px-1">VITE_STRIPE_PUBLISHABLE_KEY</code> in the
            site environment to enable on-page card payments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[420px]">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};

export default EmbeddedStripeCheckout;
