import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { markTrialRedeemed } from './welcomeOfferService.js';
import { recordSubscriptionReferral } from './partnerService.js';

/** A subscription status that maps to the paid Pro tier. */
const isEntitledStatus = (status) => ['trialing', 'active'].includes(status);

/**
 * Subscription / free-trial state management.
 *
 * Mirrors the authoritative subscription state held by Stripe / PayPal onto the
 * `profiles` row so the app (and the RLS `can_sell()` function) can read
 * entitlement cheaply. Provider webhooks are the source of truth — these
 * helpers translate a provider event into a profile update.
 */

/** Map a Stripe subscription.status onto our internal profiles.subscription_status. */
export function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'trialing':  return 'trialing';
    case 'active':    return 'active';
    case 'past_due':  return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'none'; // incomplete, paused, etc. — not yet entitled
  }
}

/**
 * Ensure the user has a Stripe customer, returning its id. Persists the id on
 * the profile so subsequent lookups (and webhooks) can resolve the user.
 */
export async function getOrCreateStripeCustomer(userId, email) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name: profile?.display_name || undefined,
    metadata: { userId },
  });

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
}

/**
 * Apply a Stripe subscription object to the owning profile. Resolves the user
 * from customer metadata first, falling back to the stored stripe_customer_id.
 */
export async function applyStripeSubscription(subscription) {
  const customerId = subscription.customer;
  let userId = subscription.metadata?.userId;

  if (!userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = profile?.id;
  }

  if (!userId) {
    logger.warn(`[SUB] Could not resolve user for Stripe subscription ${subscription.id}`);
    return;
  }

  const status = mapStripeStatus(subscription.status);
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  // Drive the account-plan column from the subscription lifecycle: an entitled
  // membership (trialing/active) IS the Pro tier; anything else drops to Hobby
  // ('free'). This keeps profiles.subscription_tier — the value the UI and any
  // quota check read — in lockstep with what the member actually pays for.
  const tier = isEntitledStatus(status) ? 'pro' : 'free';

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status:    status,
      subscription_provider:  'stripe',
      subscription_tier:      tier,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subscription.id,
      trial_ends_at:          trialEndsAt,
    })
    .eq('id', userId);

  if (error) {
    logger.error(`[SUB] Failed to apply Stripe subscription for ${userId}: ${error.message}`);
    return;
  }
  // A started trial/subscription consumes the welcome code's trial half so
  // offer state stays accurate (e.g. for expiry-reminder targeting).
  if (['trialing', 'active'].includes(status)) await markTrialRedeemed(userId);

  // Referred subscription: 'active' means the first invoice was paid (trial
  // conversions included), so book the partner's one-off commission. The
  // expected first payment was stamped into the metadata at checkout;
  // idempotent per referred user, so repeat 'active' updates are no-ops.
  if (status === 'active' && subscription.metadata?.partnerId) {
    const fallbackCents = subscription.items?.data?.[0]?.price?.unit_amount || 0;
    await recordSubscriptionReferral({
      partnerId: subscription.metadata.partnerId,
      referredUserId: userId,
      firstPaymentCents: parseInt(subscription.metadata.partnerFirstPaymentCents || '0', 10) || fallbackCents,
    });
  }

  logger.info(`[SUB] ${userId} → ${status} (stripe ${subscription.id})`);
}

/**
 * Apply a PayPal subscription state to a profile.
 * @param {object} args - { userId?, paypalSubscriptionId, status, trialEndsAt? }
 */
export async function applyPaypalSubscription({ userId, paypalSubscriptionId, status, trialEndsAt = null }) {
  if (!userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('paypal_subscription_id', paypalSubscriptionId)
      .maybeSingle();
    userId = profile?.id;
  }

  if (!userId) {
    logger.warn(`[SUB] Could not resolve user for PayPal subscription ${paypalSubscriptionId}`);
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status:    status,
      subscription_provider:  'paypal',
      subscription_tier:      isEntitledStatus(status) ? 'pro' : 'free',
      paypal_subscription_id: paypalSubscriptionId,
      trial_ends_at:          trialEndsAt,
    })
    .eq('id', userId);

  if (error) {
    logger.error(`[SUB] Failed to apply PayPal subscription for ${userId}: ${error.message}`);
    return;
  }
  if (['trialing', 'active'].includes(status)) await markTrialRedeemed(userId);
  logger.info(`[SUB] ${userId} → ${status} (paypal ${paypalSubscriptionId})`);
}

/** Map a PayPal BILLING.SUBSCRIPTION.* event / status onto our internal status. */
export function mapPaypalStatus(paypalStatus) {
  switch ((paypalStatus || '').toUpperCase()) {
    case 'ACTIVE':     return 'active';
    // APPROVAL_PENDING means the buyer has NOT yet approved at PayPal — it must
    // not entitle. (A created-but-never-approved subscription id could otherwise
    // be replayed through /paypal/activate to open the can_sell gate for free.)
    case 'APPROVAL_PENDING': return 'none';
    case 'APPROVED':   return 'trialing'; // approved w/ trial plan → trialing until first charge
    case 'SUSPENDED':  return 'past_due';
    case 'CANCELLED':
    case 'EXPIRED':    return 'canceled';
    default:           return 'none';
  }
}

/** Read the current entitlement snapshot for a user (used by GET /status). */
export async function getSubscriptionStatus(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_provider, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}
