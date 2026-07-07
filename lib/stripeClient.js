import { loadStripe } from '@stripe/stripe-js';

// Publishable key is safe to ship client-side (it can only create tokens /
// confirm the sessions our server authorises — it can never move money on its
// own). Set VITE_STRIPE_PUBLISHABLE_KEY in the Vercel project env. Falls back
// to null so the checkout can render a clear "not configured" message instead
// of crashing if the var is missing.
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export const hasStripeKey = Boolean(publishableKey);

// loadStripe returns a singleton promise — call it once at module load, never
// inside a component render.
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
