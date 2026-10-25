import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { markTrialRedeemed } from './welcomeOfferService.js';
import { isStripeObjectMissing } from '../utils/stripeErrors.js';
import { recordSubscriptionReferral } from './partnerService.js';
import { ENV, PAID_TIER_ORDER, TIER_PRICES_AUD } from '../../config/subscription.js';
import { PLANS } from '../../config/plans.js';
import { sendMembershipTrialEnding } from '../utils/emailService.js';

/** A subscription status that maps to a paid tier. */
const isEntitledStatus = (status) => ['trialing', 'active'].includes(status);

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

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

/** The tier every admin holds, free — the top of config/plans.js PLAN_ORDER. */
export const ADMIN_COMPLIMENTARY_TIER = 'ultimate';

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

  // A free trial that converted into a failed first charge is ended here, not
  // left to Stripe's retry schedule: the profile drops to Hobby the moment the
  // subscription goes past_due, so every retry after that is a charge for a
  // membership the member can no longer see (support case 2026-10-25 — two
  // ex-trial members kept getting "payment failed" notices for a plan their
  // account said they weren't on). The cancelled subscription is applied in
  // its place.
  if (subscription.status === 'past_due') {
    const ended = await endFailedTrialConversion(subscription, userId);
    if (ended) subscription = ended;
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

/** The subscription id an invoice bills — top-level before Stripe API 2025-03-31, under `parent` after. */
export function invoiceSubscriptionId(invoice) {
  const sub = invoice?.parent?.subscription_details?.subscription ?? invoice?.subscription;
  return typeof sub === 'string' ? sub : sub?.id || null;
}

/** Void every open (unpaid, still-retrying) invoice on a subscription so nothing is collected later. */
async function voidOpenInvoices(subscriptionId) {
  const open = await stripe.invoices.list({ subscription: subscriptionId, status: 'open', limit: 10 });
  for (const invoice of open?.data || []) {
    try {
      await stripe.invoices.voidInvoice(invoice.id);
      logger.info(`[SUB] Voided open invoice ${invoice.id} on ${subscriptionId}`);
    } catch (err) {
      logger.warn(`[SUB] Could not void invoice ${invoice.id} on ${subscriptionId}: ${err.message}`);
    }
  }
}

/** Cancel a subscription now, with no final invoice, and void what it still owes. */
async function cancelStripeSubscriptionNow(subscriptionId) {
  const cancelled = await stripe.subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false });
  await voidOpenInvoices(subscriptionId);
  return cancelled;
}

/**
 * End a past_due subscription whose member has never actually paid — i.e. the
 * first charge after the free trial failed. Members who HAVE paid before keep
 * Stripe's retry schedule (an expired card on a renewal shouldn't cost them
 * the membership the moment it's declined). Best-effort: any Stripe error
 * leaves the subscription as it was and returns null.
 * @returns {Promise<object|null>} the cancelled subscription, or null if left alone
 */
export async function endFailedTrialConversion(subscription, userId) {
  if (subscription?.status !== 'past_due' || !subscription.trial_end) return null;
  try {
    const paid = await stripe.invoices.list({ subscription: subscription.id, status: 'paid', limit: 100 });
    if ((paid?.data || []).some((inv) => (inv.amount_paid || 0) > 0)) return null;
    const cancelled = await cancelStripeSubscriptionNow(subscription.id);
    logger.info(`[SUB] ${userId}: first charge after the trial failed — cancelled ${subscription.id} instead of retrying`);
    return cancelled;
  } catch (err) {
    logger.error(`[SUB] Could not end failed trial conversion ${subscription.id} for ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Webhook `invoice.payment_failed`: re-read the invoice's subscription and
 * apply it, so a failed trial conversion is ended (endFailedTrialConversion)
 * even when no `customer.subscription.updated` follows — a retry on an
 * already-past_due subscription doesn't change its status, so it emits none.
 */
export async function handleSubscriptionInvoiceFailed(invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return; // a one-off (order) invoice — not a membership
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await applyStripeSubscription(subscription);
  } catch (err) {
    if (isStripeObjectMissing(err)) return;
    throw err;
  }
}

/**
 * Webhook `customer.subscription.trial_will_end` (Stripe sends it 3 days
 * before the trial converts): email the member when, and how much, they'll be
 * charged and where to cancel. Skipped when they've already cancelled.
 */
export async function sendTrialEndingReminder(subscription) {
  if (subscription?.status !== 'trialing' || subscription.cancel_at_period_end || subscription.cancel_at) return;
  const userId = subscription.metadata?.userId;
  const query = supabase.from('profiles').select('email, display_name, username, subscription_status');
  const { data: profile } = await (userId ? query.eq('id', userId) : query.eq('stripe_customer_id', subscription.customer)).maybeSingle();
  if (!profile?.email || profile.subscription_status === COMPLIMENTARY_STATUS) return;
  const tier = tierFromStripeSubscription(subscription);
  const { amountAud } = describeStripeMembership(subscription);
  await sendMembershipTrialEnding({
    to: profile.email,
    name: profile.display_name || profile.username,
    planName: PLANS[tier]?.name || 'Pro',
    amountAud: amountAud ?? TIER_PRICES_AUD[tier] ?? null,
    chargeDate: new Date(subscription.trial_end * 1000).toISOString(),
  });
}

/** Load the member's own Stripe subscription, refusing complimentary / PayPal / Hobby accounts. */
async function loadOwnStripeSubscription(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_provider, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw httpError(404, 'Profile not found.');
  if (profile.subscription_status === COMPLIMENTARY_STATUS) {
    throw httpError(409, 'Your complimentary membership is managed by CardPop — you are never billed for it.');
  }
  if (profile.subscription_provider === 'paypal') {
    throw httpError(409, 'Your membership is billed through PayPal — cancel it from your PayPal account.');
  }
  if (!profile.stripe_subscription_id) throw httpError(409, 'You don’t have a paid membership.');
  try {
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    return { profile, subscription };
  } catch (err) {
    if (isStripeObjectMissing(err)) throw httpError(409, 'You don’t have a paid membership.');
    throw err;
  }
}

/** What the membership page shows about the member's billing, from Stripe itself. */
export function describeStripeMembership(subscription) {
  const item = subscription?.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? subscription?.current_period_end ?? null;
  const toIso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
  return {
    status: mapStripeStatus(subscription?.status),
    tier: tierFromStripeSubscription(subscription),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end || subscription?.cancel_at),
    // When access (and billing) stops if cancelled, or the next charge if not.
    periodEndsAt: toIso(subscription?.cancel_at) || toIso(subscription?.trial_end && subscription.status === 'trialing' ? subscription.trial_end : periodEnd),
    amountAud: item?.price?.unit_amount != null ? item.price.unit_amount / 100 : null,
  };
}

/** GET /subscription/stripe/details — null when the member has no Stripe subscription. */
export async function getStripeMembershipDetails(userId) {
  try {
    const { subscription } = await loadOwnStripeSubscription(userId);
    return describeStripeMembership(subscription);
  } catch (err) {
    if (err.statusCode === 409) return null;
    throw err;
  }
}

/**
 * Account → Membership → "Cancel membership". A trialing or active member is
 * cancelled at the end of the period they already have (a trial ends without
 * ever being charged); a member whose payment is failing (past_due / unpaid /
 * incomplete) is cancelled immediately and the unpaid invoice voided, so the
 * retries stop now. Idempotent.
 */
export async function cancelStripeMembership(userId) {
  const { subscription } = await loadOwnStripeSubscription(userId);
  let result = subscription;
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    // Already over — just make sure the profile agrees.
  } else if (['trialing', 'active'].includes(subscription.status)) {
    if (!subscription.cancel_at_period_end) {
      result = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
    }
  } else {
    result = await cancelStripeSubscriptionNow(subscription.id);
  }
  await applyStripeSubscription(result);
  logger.info(`[SUB] ${userId} cancelled membership ${subscription.id} (${subscription.status} → ${result.status}${result.cancel_at_period_end ? ', at period end' : ''})`);
  return describeStripeMembership(result);
}

/** Undo a scheduled cancellation while the period is still running ("Keep my membership"). */
export async function resumeStripeMembership(userId) {
  const { subscription } = await loadOwnStripeSubscription(userId);
  if (!['trialing', 'active'].includes(subscription.status)) {
    throw httpError(409, 'Your membership has already ended — start a plan below.');
  }
  const result = subscription.cancel_at_period_end || subscription.cancel_at
    ? await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
    : subscription;
  await applyStripeSubscription(result);
  return describeStripeMembership(result);
}

/**
 * Account → Membership → "Update card". A Checkout Session in `setup` mode
 * collects the new card (no charge, no card data on CardPop — the same hosted
 * card step as the trial sign-up); on return the card becomes the
 * membership's payment method (applyMembershipCardFromSession). Members never
 * see Stripe's own billing portal.
 */
export async function createMembershipCardSession(userId, { successUrl, cancelUrl }) {
  const { profile, subscription } = await loadOwnStripeSubscription(userId);
  if (!['trialing', 'active', 'past_due'].includes(subscription.status)) {
    throw httpError(409, 'Your membership has ended — start a plan below.');
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    payment_method_types: ['card'],
    customer: profile.stripe_customer_id || subscription.customer,
    success_url: successUrl,
    cancel_url: cancelUrl,
    // saveCard: the webhook's setup branch also mirrors has_saved_card.
    metadata: { userId, saveCard: 'true', membershipCard: 'true', subscriptionId: subscription.id },
  });
  if (!session?.url) throw new Error('Stripe returned a session without a URL');
  return session.url;
}

/**
 * Make the card from a completed membership-card setup session the
 * subscription's payment method, and — if the membership is past_due — retry
 * the unpaid invoice on it straight away so the plan is restored now rather
 * than at Stripe's next retry. Idempotent: called from the return page and the
 * `checkout.session.completed` webhook, whichever lands first.
 */
export async function applyMembershipCardFromSession(session) {
  const subscriptionId = session?.metadata?.subscriptionId;
  const setupIntentId = typeof session?.setup_intent === 'string' ? session.setup_intent : session?.setup_intent?.id;
  if (!subscriptionId || !setupIntentId || session.status !== 'complete') return null;

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethod = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id;
  if (!paymentMethod) return null;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (customerId) {
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod } });
  }
  let subscription = await stripe.subscriptions.update(subscriptionId, { default_payment_method: paymentMethod });

  if (subscription.status === 'past_due') {
    const open = await stripe.invoices.list({ subscription: subscriptionId, status: 'open', limit: 10 });
    for (const invoice of open?.data || []) {
      try {
        await stripe.invoices.pay(invoice.id, { payment_method: paymentMethod });
        logger.info(`[SUB] Paid overdue invoice ${invoice.id} with the new card (${subscriptionId})`);
      } catch (err) {
        logger.warn(`[SUB] Overdue invoice ${invoice.id} still declined on the new card: ${err.message}`);
      }
    }
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  await applyStripeSubscription(subscription);
  return describeStripeMembership(subscription);
}

/** The return leg of "Update card": confirm the session is this member's, then apply it. */
export async function confirmMembershipCard(userId, sessionId) {
  if (!sessionId || typeof sessionId !== 'string') throw httpError(400, 'sessionId is required.');
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    if (isStripeObjectMissing(err)) throw httpError(404, 'Card update not found.');
    throw err;
  }
  if (session?.metadata?.userId !== userId || session.metadata?.membershipCard !== 'true') {
    throw httpError(404, 'Card update not found.');
  }
  if (session.status !== 'complete') throw httpError(409, 'The card update wasn’t completed.');
  return applyMembershipCardFromSession(session);
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


/**
 * Move a member's existing Stripe subscription to another paid tier, up or
 * down (Account → Membership → "Change your plan"). The subscription's single
 * item is re-priced in place with prorations — an upgrade bills the
 * difference on the next invoice, a downgrade credits the unused part of the
 * dearer plan against it — so the member keeps their billing anchor, trial and
 * payment method: no second subscription, no second trial. Dropping to Hobby
 * is a cancellation (cancelStripeMembership), not a tier change. The webhook
 * mirrors the change too, but the profile is updated here as well so the UI
 * reflects the new tier straight away.
 *
 * Throws an Error with `statusCode` for the route to relay: 400 for the
 * member's current tier or a non-paid one, 409 when there is no Stripe
 * subscription to change (Hobby, PayPal-billed, complimentary or lapsed), 503
 * when the target tier's price isn't configured.
 */
export async function changeStripeSubscriptionTier(userId, tier) {
  if (!PAID_TIER_ORDER.includes(tier)) throw httpError(400, 'Choose a paid plan to switch to.');
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
  if (tier === profile.subscription_tier) {
    throw httpError(400, 'You’re already on that plan.');
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
  const direction = PAID_TIER_ORDER.indexOf(tier) > PAID_TIER_ORDER.indexOf(profile.subscription_tier) ? 'upgraded' : 'downgraded';
  logger.info(`[SUB] ${userId} ${direction} ${profile.subscription_tier} → ${tier} (stripe ${updated.id})`);
  return { tier: tierFromStripeSubscription(updated), status: mapStripeStatus(updated.status) };
}

/**
 * Admins hold the complimentary Ultimate plan — a rule, not a per-account
 * grant (the `trg_sync_admin_complimentary_membership` trigger in
 * 20261023032430 is the database half: it flips the plan columns whenever
 * `is_admin` is written, and backfilled every existing admin). This is the
 * server half — the part a trigger can't do: an admin must never be CHARGED,
 * so any live Stripe subscription the newly promoted account was paying for is
 * cancelled, immediately and without a final invoice, before the profile is
 * marked complimentary (once it is, the provider webhooks ignore the account
 * and a still-running subscription would bill a plan the profile no longer
 * reads). The profile columns are written here too so the grant doesn't wait
 * on the migration landing; the writes agree with the trigger.
 *
 * Called by `PATCH /admin/users/:id/role` on promotion. Idempotent.
 * @returns {{ cancelledStripeSubscription: string|null }}
 */
export async function grantAdminComplimentaryMembership(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_provider, subscription_tier, stripe_subscription_id, paypal_subscription_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw httpError(404, 'Profile not found.');

  let cancelledStripeSubscription = null;
  if (profile.stripe_subscription_id && profile.subscription_status !== COMPLIMENTARY_STATUS) {
    try {
      const current = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      if (current && current.status !== 'canceled') {
        await stripe.subscriptions.cancel(current.id, { invoice_now: false, prorate: false });
        cancelledStripeSubscription = current.id;
        logger.info(`[SUB] Cancelled Stripe ${current.id} for ${userId} — admins hold Ultimate free`);
      }
    } catch (err) {
      // A subscription Stripe no longer knows about has nothing left to bill.
      if (!isStripeObjectMissing(err)) throw err;
      logger.warn(`[SUB] Stripe subscription ${profile.stripe_subscription_id} for ${userId} no longer exists — nothing to cancel`);
    }
  }
  if (profile.paypal_subscription_id && ['trialing', 'active', 'past_due'].includes(profile.subscription_status)) {
    // PayPal billing is switched off (config/subscription.js PAYMENT_PROVIDERS)
    // and the client here can't cancel at PayPal; say so loudly rather than
    // silently leaving a billed subscription behind.
    logger.error(`[SUB] ${userId} is now an admin but has a live PayPal subscription ${profile.paypal_subscription_id} — cancel it in the PayPal dashboard`);
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_tier:      ADMIN_COMPLIMENTARY_TIER,
      subscription_status:    COMPLIMENTARY_STATUS,
      trial_ends_at:          null,
      // The cancelled subscription is finished with; a stale id would only
      // confuse the next change-tier / status read.
      ...(cancelledStripeSubscription ? { stripe_subscription_id: null } : {}),
    })
    .eq('id', userId);
  if (updateError) throw updateError;

  logger.info(`[SUB] ${userId} → complimentary ${ADMIN_COMPLIMENTARY_TIER} (admin)`);
  return { cancelledStripeSubscription };
}

/**
 * The reverse of grantAdminComplimentaryMembership, for a demoted admin: the
 * complimentary plan goes with the role, back to Hobby. Only a complimentary
 * (grandfathered) membership is touched — a real paid subscription is left
 * exactly as it is. Mirrors the trigger's demotion branch. Idempotent.
 */
export async function revokeAdminComplimentaryMembership(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: 'free', subscription_status: 'none' })
    .eq('id', userId)
    .eq('subscription_status', COMPLIMENTARY_STATUS);
  if (error) throw error;
  logger.info(`[SUB] ${userId} → Hobby (complimentary membership revoked with admin access)`);
}

/**
 * Refuse to sell a paid plan to an account that already holds the top tier for
 * free: an admin, or any complimentary (grandfathered) member. Before this the
 * checkout happily created a Stripe subscription the profile then ignored —
 * a bill for nothing. Throws a 409 the checkout routes relay as-is.
 */
export async function assertCanStartPaidMembership(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin, subscription_status')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (profile?.is_admin) {
    throw httpError(409, 'Admin accounts include the Ultimate plan at no charge — there is nothing to buy.');
  }
  if (profile?.subscription_status === COMPLIMENTARY_STATUS) {
    throw httpError(409, 'Your complimentary membership is managed by CardPop — there is nothing to buy.');
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
