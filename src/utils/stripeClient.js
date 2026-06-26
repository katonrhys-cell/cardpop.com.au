import 'dotenv/config';
import Stripe from 'stripe';

// Single shared Stripe client so routes/services don't each re-instantiate it.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default stripe;
