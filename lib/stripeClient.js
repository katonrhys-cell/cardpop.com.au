import { loadStripe } from '@stripe/stripe-js';

// Publishable key is safe to ship client-side (it can only create tokens /
// confirm the sessions our server authorises — it can never move money on its
// own). Set VITE_STRIPE_PUBLISHABLE_KEY in the Vercel project env. Falls back
// to null so the checkout can render a clear "not configured" message instead
// of crashing if the var is missing.
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export const hasStripeKey = Boolean(publishableKey);

// Warm the connection the Checkout Session is initialised over (Stripe.js
// calls api.stripe.com with CORS as soon as the payment step mounts), so the
// TLS handshake is done while the buyer is still filling in the address form.
// This module is only imported by the checkout chunk, so it costs nothing
// elsewhere. Stripe.js itself already starts downloading via loadStripe below.
if (publishableKey && typeof document !== 'undefined'
  && !document.head.querySelector('link[rel="preconnect"][href="https://api.stripe.com"]')) {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://api.stripe.com';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

// loadStripe returns a singleton promise — call it once at module load, never
// inside a component render.
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
