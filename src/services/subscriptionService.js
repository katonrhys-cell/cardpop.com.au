import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { markTrialRedeemed } from './welcomeOfferService.js';
import { isStripeObjectMissing } from '../utils/stripeErrors.js';
import { recordSubscriptionReferral } from './partnerService.js';
import { ENV, PAID_TIER_ORDER } from '../../config/subscription.js';

/** A subscription status that maps to a paid tier. */
const isEntitledStatus = (status) => ['trialing', 'active'].includes(status);

/**
 * The status of a COMPLIMENTARY membership: a tier granted service-side (by
 * migration — the owner/admin accounts hold Ultimate this way) with no
 * Stripe/PayPal subscription behind it. No provider ever emits it, so a
 * provider event about such an account is never the source of truth for its
 * tier: applying one would silently downgrade a free grant to whatever the
 * event says (a `customer.subscription.deleted` → Hobby, a PayPal create →
 * 'none'). Both apply* helpers therefore leave a grandfathered profile alone.
 */
export const COMPLIMENTARY_STATUS = 'grandfathered';

/**
 * Which paid tier a Stripe subscription buys. The tier is stamped into the
 * subscription metadata at checkout; for subscriptions created before the
 * multi-tier ladder (or with missing metadata) fall back to matching the
 * billed price id against the per-tier price env vars, then to 'pro' (every
 * legacy subscription was Pro).
 */
export function tierFromStripeSubscription(subscription) {
  const metaTier = subscription?.metadata?.tier;
  if (PAID_TIER_ORDER.includes(metaTier)) return metaTier;
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  if (priceId) {
    for (const tier of PAID_TIER_ORDER) {
      const configured = process.env[ENV.stripePriceIds[tier]];
      if (configured && configured === priceId) return tier;
    }
  }
  return 'pro';
}

/**
 * Which paid tier a PayPal billing plan buys, resolved against the per-tier
 * plan-id env vars. Unknown/missing plan ids fall back to 'pro' (the only
 * plan that existed before the ladder).
 */
export function tierFromPaypalPlanId(planId) {
  if (planId) {
    for (const tier of PAID_TIER_ORDER) {
      const configured = process.env[ENV.paypalPlanIds[tier]];
      if (configured && configured === planId) return tier;
    }
  }
  return 'pro';
}

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

  // Validate a stored id before trusting it — it may be stale (deleted, or
  // minted on a previous Stripe account before the platform switched). Fall
  // through and recreate instead of letting checkout fail with
  // "No such customer".
  if (profile?.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!existing?.deleted) return profile.stripe_customer_id;
    } catch (err) {
      if (!isStripeObjectMissing(err)) throw err;
    }
    logger.warn(`[SUBSCRIPTION] Stored Stripe customer ${profile.stripe_customer_id} for user ${userId} no longer exists — recreating`);
  }

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
  // membership (trialing/active) gets the tier its price bills for; anything
  // else drops to Hobby ('free'). This keeps profiles.subscription_tier — the
  // value the UI, the storefront gate and the monthly listing quota read — in
  // lockstep with what the member actually pays for.
  const tier = isEntitledStatus(status) ? tierFromStripeSubscription(subscription) : 'free';

  // The status filter makes the write a no-op on a complimentary
  // (grandfathered) membership — see COMPLIMENTARY_STATUS. Done in the same
  // statement rather than a read-then-write so a concurrent event can't slip
  // between the check and the update.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      subscription_status:    status,
      subscription_provider:  'stripe',
      subscription_tier:      tier,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subscription.id,
      trial_ends_at:          trialEndsAt,
    })
    .eq('id', userId)
    .neq('subscription_status', COMPLIMENTARY_STATUS)
    .select('id');

  if (error) {
    logger.error(`[SUB] Failed to apply Stripe subscription for ${userId}: ${error.message}`);
    return;
  }
  if (!updated?.length) {
    logger.info(`[SUB] ${userId} holds a complimentary membership — ignored Stripe ${subscription.id} (${status})`);
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
 * Apply a PayPal subscription state to a profile. `planId` (the PayPal billing
 * plan the subscription runs on) picks the paid tier; omitted → 'pro'.
 * @param {object} args - { userId?, paypalSubscriptionId, status, trialEndsAt?, planId? }
 */
export async function applyPaypalSubscription({ userId, paypalSubscriptionId, status, trialEndsAt = null, planId = null }) {
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

  // No-op on a complimentary (grandfathered) membership — see COMPLIMENTARY_STATUS.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      subscription_status:    status,
      subscription_provider:  'paypal',
      subscription_tier:      isEntitledStatus(status) ? tierFromPaypalPlanId(planId) : 'free',
      paypal_subscription_id: paypalSubscriptionId,
      trial_ends_at:          trialEndsAt,
    })
    .eq('id', userId)
    .neq('subscription_status', COMPLIMENTARY_STATUS)
    .select('id');

  if (error) {
    logger.error(`[SUB] Failed to apply PayPal subscription for ${userId}: ${error.message}`);
    return;
  }
  if (!updated?.length) {
    logger.info(`[SUB] ${userId} holds a complimentary membership — ignored PayPal ${paypalSubscriptionId} (${status})`);
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
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/**
 * Move a member's existing Stripe subscription onto a higher paid tier
 * (Account → Dashboard / Membership → "Upgrade your plan"). The subscription's
 * single item is re-priced in place with prorations, so the member keeps
 * their billing anchor, trial and payment method — no second subscription,
 * no second trial. The webhook mirrors the change too, but the profile is
 * updated here as well so the UI reflects the new tier straight away.
 *
 * Throws an Error with `statusCode` for the route to relay: 400 for a tier
 * that isn't a step up, 409 when there is no Stripe subscription to change
 * (Hobby, PayPal-billed, complimentary or lapsed), 503 when the target
 * tier's price isn't configured.
 */
export async function changeStripeSubscriptionTier(userId, tier) {
  if (!PAID_TIER_ORDER.includes(tier)) throw httpError(400, 'Choose a paid plan to upgrade to.');
  const priceId = process.env[ENV.stripePriceIds[tier]];
  if (!priceId) {
    logger.error(`[SUB] ${ENV.stripePriceIds[tier]} not configured`);
    throw httpError(503, `The ${tier} plan is not available yet.`);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_provider, subscription_tier, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw httpError(404, 'Profile not found.');

  if (profile.subscription_status === COMPLIMENTARY_STATUS) {
    throw httpError(409, 'Your complimentary membership is managed by CardPop — contact support to change it.');
  }
  if (profile.subscription_provider === 'paypal') {
    throw httpError(409, 'Your membership is billed through PayPal. Cancel it there, then start the new plan here.');
  }
  if (!profile.stripe_subscription_id) {
    throw httpError(409, 'No active membership to change — start a plan below.');
  }
  if (PAID_TIER_ORDER.indexOf(tier) <= PAID_TIER_ORDER.indexOf(profile.subscription_tier)) {
    throw httpError(400, 'Choose a plan above your current one.');
  }

  const current = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  if (!['active', 'trialing'].includes(current?.status)) {
    throw httpError(409, 'Your membership is not active — start a plan below.');
  }
  const item = current.items?.data?.[0];
  if (!item?.id) throw new Error(`Stripe subscription ${current.id} has no item to re-price`);

  const updated = await stripe.subscriptions.update(current.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: 'create_prorations',
    // `tier` in the metadata is what applyStripeSubscription mirrors onto
    // profiles.subscription_tier.
    metadata: { ...(current.metadata || {}), userId, tier },
  });

  await applyStripeSubscription(updated);
  logger.info(`[SUB] ${userId} upgraded ${profile.subscription_tier} → ${tier} (stripe ${updated.id})`);
  return { tier: tierFromStripeSubscription(updated), status: mapStripeStatus(updated.status) };
}

export async function getSubscriptionStatus(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_provider, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}
