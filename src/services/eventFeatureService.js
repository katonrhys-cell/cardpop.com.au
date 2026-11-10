/**
 * Paid Featured Placement for events.
 *
 * createFeatureCheckout — the organiser picks a package in Account → My Events;
 *   the price comes from utils/featuredPackages.js (never the request), a
 *   `pending` event_feature_purchases row is written, and a Stripe Checkout
 *   Session is opened with metadata.kind = 'event_feature'.
 * handleEventFeaturePaid — checkout.session.completed for that kind: marks the
 *   row `paid`, switches events.is_featured on (service role; the organiser
 *   write guard pins that column for everyone else), bells the organiser and
 *   every admin, and emails the admins what's left to do by hand.
 * handleEventFeatureExpired — the session lapsed or the async payment failed:
 *   the row goes `expired` so the organiser can try again.
 *
 * Every handler is idempotent: Stripe redelivers, and the status transition
 * is claimed with a conditional update.
 */
import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import { sendEventFeaturePaid } from '../utils/emailService.js';
import {
  featuredQuote, featureEligibility, todayInAustralia, featuredPackage,
} from '../../utils/featuredPackages.js';

export const EVENT_FEATURE_KIND = 'event_feature';

const EVENT_COLS = 'id, title, slug, status, start_date, end_date, is_featured, organiser_id, organizer_name';

/** What the team still does by hand for each package (the calendar is automatic). */
export const MANUAL_EXTRAS = {
  spotlight: [],
  spotlight_instagram: ['Instagram post and story in the weeks before the show'],
  full: [
    'Instagram post and story in the weeks before the show',
    'Second Instagram story in show week',
  ],
};

/** Packages that also put the event in the homepage Featured events section. */
export const HOMEPAGE_PACKAGES = new Set(['full']);

export class FeatureCheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function hasPaidFeature(eventId) {
  const { data, error } = await supabase
    .from('event_feature_purchases')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'paid')
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function createFeatureCheckout({ user, eventId, packageKey, successUrl, cancelUrl, now = new Date() }) {
  if (!featuredPackage(packageKey)) throw new FeatureCheckoutError(400, 'Choose a featuring package.');

  const { data: event, error } = await supabase.from('events').select(EVENT_COLS).eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!event) throw new FeatureCheckoutError(404, 'Event not found.');
  if (event.organiser_id !== user.id) throw new FeatureCheckoutError(403, 'You can only feature your own events.');

  const today = todayInAustralia(now);
  const eligibility = featureEligibility(event, today, { paid: await hasPaidFeature(event.id) });
  if (!eligibility.ok) throw new FeatureCheckoutError(409, eligibility.reason);

  const quote = featuredQuote(packageKey, event.start_date, today);
  const toAud = (cents) => Number((cents / 100).toFixed(2));

  const { data: purchase, error: insertError } = await supabase
    .from('event_feature_purchases')
    .insert({
      event_id: event.id,
      organiser_id: user.id,
      package: quote.pkg.key,
      base_aud: toAud(quote.baseCents),
      discount_aud: toAud(quote.discountCents),
      amount_aud: toAud(quote.priceCents),
      early_bird: quote.earlyBird,
      status: 'pending',
    })
    .select('id')
    .single();
  if (insertError) throw insertError;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: user.email || undefined,
    line_items: [{
      price_data: {
        currency: 'aud',
        product_data: {
          name: `Featured Placement: ${quote.pkg.name}`,
          description: `${event.title}${quote.earlyBird ? ' (early bird price)' : ''}`.slice(0, 500),
        },
        unit_amount: quote.priceCents,
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      kind: EVENT_FEATURE_KIND,
      purchaseId: purchase.id,
      eventId: event.id,
      userId: user.id,
      package: quote.pkg.key,
    },
  });
  if (!session?.url) throw new Error('Stripe returned a session without a URL');

  const { error: stampError } = await supabase
    .from('event_feature_purchases')
    .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq('id', purchase.id);
  if (stampError) logger.error(`[EVENT FEATURE] Could not stamp session ${session.id} on purchase ${purchase.id}: ${stampError.message}`);

  logger.info(`[EVENT FEATURE] Checkout ${session.id} for event ${event.id} (${quote.pkg.key}, ${quote.priceCents}c${quote.earlyBird ? ', early bird' : ''})`);
  return { url: session.url, sessionId: session.id, quote };
}

async function findPurchase(session) {
  const purchaseId = session.metadata?.purchaseId;
  let query = supabase.from('event_feature_purchases').select('id, event_id, organiser_id, package, amount_aud, early_bird, status');
  query = purchaseId ? query.eq('id', purchaseId) : query.eq('stripe_session_id', session.id);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Feature purchase lookup failed for session ${session.id}: ${error.message}`);
  return data;
}

export async function handleEventFeaturePaid(session) {
  if (session.payment_status && session.payment_status !== 'paid') {
    logger.info(`[EVENT FEATURE] Session ${session.id} not paid yet (${session.payment_status}), deferring`);
    return;
  }
  const purchase = await findPurchase(session);
  if (!purchase) {
    logger.error(`[EVENT FEATURE] Paid session ${session.id} has no purchase row; featuring not switched on`);
    return;
  }
  if (purchase.status === 'paid') {
    logger.info(`[EVENT FEATURE] Purchase ${purchase.id} already paid, skipping`);
    return;
  }

  // Claim the transition so a redelivery can't double-notify.
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
  const { data: claimed, error: claimError } = await supabase
    .from('event_feature_purchases')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
    })
    .eq('id', purchase.id)
    .neq('status', 'paid')
    .select('id');
  if (claimError) throw new Error(`Feature purchase ${purchase.id} could not be marked paid: ${claimError.message}`);
  if (!claimed?.length) return;

  const { data: event, error: featureError } = await supabase
    .from('events')
    .update(HOMEPAGE_PACKAGES.has(purchase.package)
      ? { is_featured: true, homepage_featured: true }
      : { is_featured: true })
    .eq('id', purchase.event_id)
    .select(EVENT_COLS)
    .maybeSingle();
  if (featureError) throw new Error(`Event ${purchase.event_id} could not be featured: ${featureError.message}`);

  const pkg = featuredPackage(purchase.package);
  const extras = MANUAL_EXTRAS[purchase.package] || [];
  logger.info(`[EVENT FEATURE] Event ${purchase.event_id} featured (${purchase.package}, purchase ${purchase.id})`);

  // Notifications are best-effort: the money and the featuring are recorded.
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    const title = event?.title || 'your event';
    const rows = [{
      user_id: purchase.organiser_id,
      type: 'event_featured',
      title: 'Your event is featured',
      body: `${title} is now in the Featured events section of the CardPop calendar.`,
      related_id: purchase.event_id,
    }];
    for (const a of admins || []) {
      if (a.id === purchase.organiser_id) continue;
      rows.push({
        user_id: a.id,
        type: 'event_featured',
        title: 'Featured Placement paid',
        body: `${title}: ${pkg?.name || purchase.package}.${extras.length ? ` To do: ${extras.join('; ')}.` : ''}`,
        related_id: purchase.event_id,
      });
    }
    const { error: bellError } = await supabase.from('notifications').insert(rows);
    if (bellError) logger.error(`[EVENT FEATURE] Bell failed for purchase ${purchase.id}: ${bellError.message}`);

    const { data: organiser } = await supabase
      .from('profiles').select('display_name, username').eq('id', purchase.organiser_id).maybeSingle();
    await sendEventFeaturePaid({
      to: await getAdminNotificationEmails(),
      event,
      packageName: pkg?.name || purchase.package,
      amountAud: purchase.amount_aud,
      earlyBird: purchase.early_bird,
      organiserName: event?.organizer_name || organiser?.display_name || organiser?.username || null,
      extras,
    });
  } catch (err) {
    logger.error(`[EVENT FEATURE] Notify failed for purchase ${purchase.id}: ${err.message}`);
  }
}

export async function handleEventFeatureExpired(session) {
  const purchase = await findPurchase(session);
  if (!purchase || purchase.status !== 'pending') return;
  const { error } = await supabase
    .from('event_feature_purchases')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', purchase.id)
    .eq('status', 'pending');
  if (error) throw new Error(`Feature purchase ${purchase.id} could not be expired: ${error.message}`);
  logger.info(`[EVENT FEATURE] Purchase ${purchase.id} expired unpaid`);
}
