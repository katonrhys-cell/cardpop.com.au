import React, { useCallback, useEffect, useState } from 'react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stripePromise, hasStripeKey } from '@/lib/stripeClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import StripeElementsPayment from '@/components/checkout/StripeElementsPayment.jsx';
import { useCart } from '@/hooks/useCart.jsx';

/*
 * Inline Stripe payment. Renders Stripe's Embedded Checkout (card / PayPal /
 * wallets) directly on our page — the buyer never leaves
 * cardpop.com.au. Card data is entered inside Stripe's own secure iframe, so it
 * never touches our servers (PCI scope stays with Stripe).
 *
 * We fetch the Checkout Session's client secret ourselves (rather than handing
 * EmbeddedCheckoutProvider a fetchClientSecret callback) so that a failed
 * request surfaces a clear, actionable error with a Retry button instead of the
 * blank gap Stripe leaves when its own fetch throws. On completion Stripe
 * redirects the buyer to the session's return_url (our /checkout-success page).
 *
 * Two renderings of the same Checkout Session:
 *  - 'elements' (default): our own layout of Stripe Elements with an inline
 *    Google Pay button above the card form — StripeElementsPayment.jsx.
 *  - 'embedded': Stripe's full embedded checkout page (Google Pay still shows
 *    inside it when the browser supports it). Build with
 *    VITE_CHECKOUT_UI=embedded to fall back to this without a code change.
 */
const UI_MODE = import.meta.env.VITE_CHECKOUT_UI === 'embedded' ? 'embedded' : 'elements';

const EmbeddedStripeCheckout = ({ requestBody }) => {
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  // A listing that sold while the buyer was typing — the server names it so
  // the fix is one tap (remove it) rather than a "Try again" that can't work.
  const [unavailableListingId, setUnavailableListingId] = useState(null);
  const [attempt, setAttempt] = useState(0); // bumping this re-runs the fetch
  const { cartItems, removeFromCart, setIsCartOpen } = useCart();

  const loadSecret = useCallback(async (signal) => {
    setError(null);
    setClientSecret(null);
    try {
      const res = await apiServerClient.fetch('/stripe/create-cart-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          uiMode: UI_MODE,
          returnUrl: `${window.location.origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (signal?.aborted) return;
      if (!res.ok || !data.clientSecret) {
        setUnavailableListingId(data.listingId || null);
        throw new Error(data.error || `Could not start the payment (HTTP ${res.status}).`);
      }
      setClientSecret(data.clientSecret);
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') return;
      setError(err.message || 'Could not start the payment. Please try again.');
    }
  }, [requestBody]);

  useEffect(() => {
    const controller = new AbortController();
    loadSecret(controller.signal);
    return () => controller.abort();
  }, [loadSecret, attempt]);

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

  if (error) {
    const unavailableLine = unavailableListingId
      ? cartItems.find((item) => item.product?.id === unavailableListingId)
      : null;
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
        <div className="flex items-start gap-3 text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">We couldn't start the payment.</p>
            <p className="mt-1 text-foreground/80">{error}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {unavailableLine ? (
            <Button
              size="sm"
              onClick={() => {
                removeFromCart(unavailableLine.variant?.id || unavailableLine.product.id);
                setUnavailableListingId(null);
                setAttempt((n) => n + 1);
              }}
            >
              Remove “{unavailableLine.product?.title || unavailableLine.product?.name || 'that item'}” and continue
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setIsCartOpen(true)}>Edit cart</Button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Loading secure payment form…</p>
      </div>
    );
  }

  if (UI_MODE === 'elements') {
    return <StripeElementsPayment clientSecret={clientSecret} />;
  }

  return (
    <div className="min-h-[420px] rounded-xl border border-border bg-background p-1">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
        <EmbeddedCheckout className="rounded-lg" />
      </EmbeddedCheckoutProvider>
    </div>
  );
};

export default EmbeddedStripeCheckout;
