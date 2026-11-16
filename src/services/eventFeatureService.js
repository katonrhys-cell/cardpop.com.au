/**
 * What organisers pay for per event: Featured Placement (Calendar Spotlight)
 * and the promotion extras (Instagram story, Instagram post, event review).
 * Both ride the same purchase table and Stripe flow; `package` tells them
 * apart, and an extra never touches the event's featuring.
 *
 * createExtraCheckout — the organiser picks an extra in Account → My Events →
 *   Promote; flat price from utils/featuredPackages.js, a `pending` row, a
 *   Checkout Session with metadata.kind = 'event_feature'. Once paid the
 *   webhook marks the row `paid` and tells the admins what to do by hand.
 *
 * createFeatureBundleCheckout — the same for the 3-event pack (BUNDLE): one
 *   package across three of the organiser's events, one session, three
 *   `pending` rows sharing a bundle_id, each carrying its event's share.
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
import { randomUUID } from 'node:crypto';
import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import { sendEventFeaturePaid } from '../utils/emailService.js';
import {
  featuredQuote, featuredBundleQuote, featureEligibility, todayInAustralia, featuredPackage, BUNDLE,
  eventExtra, isEventExtra, extraCents, extraEligibility, purchaseName,
} from '../../utils/featuredPackages.js';

export const EVENT_FEATURE_KIND = 'event_feature';

const EVENT_COLS = 'id, title, slug, status, start_date, end_date, is_featured, organiser_id, organizer_name';
const PURCHASE_COLS = 'id, event_id, organiser_id, package, amount_aud, early_bird, status';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toAud = (cents) => Number((cents / 100).toFixed(2));

/** The packages that are a featuring (the rest of the table's rows are extras). */
export const FEATURING_PACKAGES = ['spotlight', 'spotlight_instagram', 'full'];

/**
 * What the team still does by hand for a paid row (the calendar is automatic).
 * The two retired packages are kept for a session opened before they went.
 */
export const MANUAL_EXTRAS = {
  spotlight: [],
  spotlight_instagram: ['Instagram post and story in the weeks before the show'],
  full: [
    'Instagram post and story in the weeks before the show',
    'Second Instagram story in show week',
  ],
};
const manualWork = (packageKey) => eventExtra(packageKey)?.todo || MANUAL_EXTRAS[packageKey] || [];

/** Retired package that also put the event in the homepage Featured events section. */
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
    .in('package', FEATURING_PACKAGES)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

/** The extras already paid for an event. */
async function paidExtras(eventId) {
  const { data, error } = await supabase
    .from('event_feature_purchases')
    .select('package')
    .eq('event_id', eventId)
    .eq('status', 'paid');
  if (error) throw error;
  return (data || []).map((r) => r.package).filter(isEventExtra);
}

/**
 * Checkout for one promotion extra on the caller's own event. Flat price, no
 * early bird and no pack. Whether the event is featured is irrelevant.
 */
export async function createExtraCheckout({ user, eventId, extraKey, successUrl, cancelUrl, now = new Date() }) {
  const extra = eventExtra(extraKey);
  if (!extra) throw new FeatureCheckoutError(400, 'Choose an extra.');

  const { data: event, error } = await supabase.from('events').select(EVENT_COLS).eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!event) throw new FeatureCheckoutError(404, 'Event not found.');
  if (event.organiser_id !== user.id) throw new FeatureCheckoutError(403, 'You can only add extras to your own events.');

  const eligibility = extraEligibility(event, extra.key, todayInAustralia(now), { bought: await paidExtras(event.id) });
  if (!eligibility.ok) throw new FeatureCheckoutError(409, eligibility.reason);

  const priceCents = extraCents(extra.key);
  const { data: purchase, error: insertError } = await supabase
    .from('event_feature_purchases')
    .insert({
      event_id: event.id,
      organiser_id: user.id,
      package: extra.key,
      base_aud: toAud(priceCents),
      discount_aud: 0,
      amount_aud: toAud(priceCents),
      early_bird: false,
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
          name: `Event promotion: ${extra.name}`,
          description: String(event.title || '').slice(0, 500) || undefined,
        },
        unit_amount: priceCents,
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
      package: extra.key,
    },
  });
  if (!session?.url) throw new Error('Stripe returned a session without a URL');

  const { error: stampError } = await supabase
    .from('event_feature_purchases')
    .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq('id', purchase.id);
  if (stampError) logger.error(`[EVENT EXTRA] Could not stamp session ${session.id} on purchase ${purchase.id}: ${stampError.message}`);

  logger.info(`[EVENT EXTRA] Checkout ${session.id} for event ${event.id} (${extra.key}, ${priceCents}c)`);
  return { url: session.url, sessionId: session.id, extra: { key: extra.key, name: extra.name, priceCents } };
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

export async function createFeatureBundleCheckout({ user, eventIds, packageKey, successUrl, cancelUrl, now = new Date() }) {
  if (!featuredPackage(packageKey)) throw new FeatureCheckoutError(400, 'Choose a featuring package.');
  const ids = Array.isArray(eventIds) ? [...new Set(eventIds.map(String))] : [];
  if (ids.length !== BUNDLE.size || !ids.every((id) => UUID_RE.test(id))) {
    throw new FeatureCheckoutError(400, `Choose ${BUNDLE.size} different events for the pack.`);
  }

  const { data: rows, error } = await supabase.from('events').select(EVENT_COLS).in('id', ids);
  if (error) throw error;
  const byId = new Map((rows || []).map((e) => [e.id, e]));
  const events = ids.map((id) => byId.get(id));
  if (events.some((e) => !e)) throw new FeatureCheckoutError(404, 'Event not found.');
  if (events.some((e) => e.organiser_id !== user.id)) throw new FeatureCheckoutError(403, 'You can only feature your own events.');

  const { data: paidRows, error: paidError } = await supabase
    .from('event_feature_purchases')
    .select('event_id')
    .in('event_id', ids)
    .eq('status', 'paid')
    .in('package', FEATURING_PACKAGES);
  if (paidError) throw paidError;
  const paid = new Set((paidRows || []).map((r) => r.event_id));

  const today = todayInAustralia(now);
  for (const event of events) {
    const eligibility = featureEligibility(event, today, { paid: paid.has(event.id) });
    if (!eligibility.ok) throw new FeatureCheckoutError(409, `${event.title}: ${eligibility.reason}`);
  }

  const quote = featuredBundleQuote(packageKey, events.map((e) => e.start_date), today);
  const bundleId = randomUUID();

  const { data: purchases, error: insertError } = await supabase
    .from('event_feature_purchases')
    .insert(events.map((event, i) => ({
      event_id: event.id,
      organiser_id: user.id,
      package: quote.pkg.key,
      base_aud: toAud(quote.lines[i].baseCents),
      discount_aud: toAud(quote.lines[i].discountCents),
      amount_aud: toAud(quote.lines[i].priceCents),
      early_bird: quote.lines[i].earlyBird,
      bundle_id: bundleId,
      status: 'pending',
    })))
    .select('id');
  if (insertError) throw insertError;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: user.email || undefined,
    line_items: events.map((event, i) => ({
      price_data: {
        currency: 'aud',
        product_data: {
          name: `Featured Placement ${BUNDLE.size}-event pack: ${quote.pkg.name}`,
          description: `${event.title}${quote.lines[i].earlyBird ? ' (early bird price)' : ''}`.slice(0, 500),
        },
        unit_amount: quote.lines[i].priceCents,
      },
      quantity: 1,
    })),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      kind: EVENT_FEATURE_KIND,
      bundleId,
      eventIds: ids.join(','),
      userId: user.id,
      package: quote.pkg.key,
    },
  });
  if (!session?.url) throw new Error('Stripe returned a session without a URL');

  const { error: stampError } = await supabase
    .from('event_feature_purchases')
    .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq('bundle_id', bundleId);
  if (stampError) logger.error(`[EVENT FEATURE] Could not stamp session ${session.id} on bundle ${bundleId}: ${stampError.message}`);

  logger.info(`[EVENT FEATURE] Pack checkout ${session.id} for events ${ids.join(', ')} (${quote.pkg.key}, ${quote.priceCents}c, ${purchases?.length || 0} rows)`);
  return { url: session.url, sessionId: session.id, quote };
}

/** Every purchase row a session paid for: the pack's three, or the single one. */
async function findPurchases(session) {
  const bundleId = session.metadata?.bundleId;
  if (bundleId) {
    const { data, error } = await supabase.from('event_feature_purchases').select(PURCHASE_COLS).eq('bundle_id', bundleId);
    if (error) throw new Error(`Feature bundle lookup failed for session ${session.id}: ${error.message}`);
    return data || [];
  }
  const purchase = await findPurchase(session);
  return purchase ? [purchase] : [];
}

async function findPurchase(session) {
  const purchaseId = session.metadata?.purchaseId;
  let query = supabase.from('event_feature_purchases').select(PURCHASE_COLS);
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
  const purchases = await findPurchases(session);
  if (!purchases.length) {
    logger.error(`[EVENT FEATURE] Paid session ${session.id} has no purchase row; featuring not switched on`);
    return;
  }
  // A pack's rows are handled one by one: each claims its own transition, so a
  // redelivery after a partial failure finishes only what's left.
  for (const purchase of purchases) {
    await featurePurchase(session, purchase, { bundled: Boolean(session.metadata?.bundleId) });
  }
}

async function featurePurchase(session, purchase, { bundled = false } = {}) {
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
  if (claimError?.code === '23505') {
    // Another payment already featured this event (two checkouts were open at
    // once). The money is taken; retrying can never succeed, so flag it for a
    // refund instead of failing the webhook forever.
    logger.error(`[EVENT FEATURE] Purchase ${purchase.id}: event ${purchase.event_id} already has a paid ${purchase.package} from another payment (session ${session.id}). Refund $${purchase.amount_aud} in Stripe.`);
    return;
  }
  if (claimError) throw new Error(`Feature purchase ${purchase.id} could not be marked paid: ${claimError.message}`);
  if (!claimed?.length) return;

  // An extra is promotion only: the event's place on the site is not touched.
  const isExtra = isEventExtra(purchase.package);
  const eventQuery = isExtra
    ? supabase.from('events').select(EVENT_COLS).eq('id', purchase.event_id).maybeSingle()
    : supabase
      .from('events')
      .update(HOMEPAGE_PACKAGES.has(purchase.package)
        ? { is_featured: true, homepage_featured: true }
        : { is_featured: true })
      .eq('id', purchase.event_id)
      .select(EVENT_COLS)
      .maybeSingle();
  const { data: event, error: featureError } = await eventQuery;
  if (featureError && !isExtra) throw new Error(`Event ${purchase.event_id} could not be featured: ${featureError.message}`);

  const packageName = `${purchaseName(purchase.package)}${bundled ? ` (${BUNDLE.size}-event pack)` : ''}`;
  const extras = manualWork(purchase.package);
  logger.info(`[EVENT FEATURE] Event ${purchase.event_id} ${isExtra ? 'extra paid' : 'featured'} (${purchase.package}, purchase ${purchase.id})`);

  // Notifications are best-effort: the money and the featuring are recorded.
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    const title = event?.title || 'your event';
    const rows = [{
      user_id: purchase.organiser_id,
      type: 'event_featured',
      title: isExtra ? `${packageName} booked` : 'Your event is featured',
      body: isExtra
        ? `${packageName} is booked for ${title}. The CardPop team will be in touch before the show.`
        : `${title} is now in the Featured events section of the CardPop calendar.`,
      related_id: purchase.event_id,
    }];
    for (const a of admins || []) {
      if (a.id === purchase.organiser_id) continue;
      rows.push({
        user_id: a.id,
        type: 'event_featured',
        title: isExtra ? 'Event extra paid' : 'Featured Placement paid',
        body: `${title}: ${packageName}.${extras.length ? ` To do: ${extras.join('; ')}.` : ''}`,
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
      packageName,
      amountAud: purchase.amount_aud,
      earlyBird: purchase.early_bird,
      organiserName: event?.organizer_name || organiser?.display_name || organiser?.username || null,
      extras,
      isExtra,
    });
  } catch (err) {
    logger.error(`[EVENT FEATURE] Notify failed for purchase ${purchase.id}: ${err.message}`);
  }
}

export async function handleEventFeatureExpired(session) {
  const purchases = await findPurchases(session);
  for (const purchase of purchases) {
    if (purchase.status !== 'pending') continue;
    const { error } = await supabase
      .from('event_feature_purchases')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', purchase.id)
      .eq('status', 'pending');
    if (error) throw new Error(`Feature purchase ${purchase.id} could not be expired: ${error.message}`);
    logger.info(`[EVENT FEATURE] Purchase ${purchase.id} expired unpaid`);
  }
}
