import 'dotenv/config';
import { createRequire } from 'node:module';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

// Single shared Stripe client so routes/services don't each re-instantiate it.
//
// Lazily constructed: the Stripe SDK is a large CJS bundle, and this module is
// reached transitively from routes/index.js — an eager `new Stripe(...)` at
// import time put the whole SDK load + client init on EVERY cold start of the
// serverless function, including requests that never touch payments. The
// proxy defers that work to the first actual property access (i.e. the first
// payment-related request an instance serves). Consumers are unchanged:
// `import stripe from '../utils/stripeClient.js'` keeps working.
const require = createRequire(import.meta.url);

let _stripe = null;
function instance() {
  if (!_stripe) {
    const Stripe = require('stripe');
    // Stripe's defaults are an 80 s request timeout and one network retry.
    // Every Stripe call here runs inside the 40 s function, so 80 s is a
    // guaranteed 504 for the buyer; 20 s fails inside the budget with a real
    // error instead. Retries stay at one — Stripe requests carry idempotency
    // keys, so a retry can't double-charge.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      timeout: OUTBOUND_TIMEOUT_MS.stripe,
      maxNetworkRetries: 1,
    });
  }
  return _stripe;
}

const stripe = new Proxy(
  {},
  {
    get(_target, prop) {
      const s = instance();
      const value = s[prop];
      return typeof value === 'function' ? value.bind(s) : value;
    },
    has(_target, prop) {
      return prop in instance();
    },
  },
);

export default stripe;
