import * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// Stuck-payment reconciliation.
//
// An order row is written as 'pending' when its Checkout Session is created,
// and only moves forward when `checkout.session.completed` reaches the webhook.
// If that event never arrives — the endpoint isn't subscribed to it, the
// handler throws past Stripe's retries, a deploy is mid-flight — the buyer has
// paid and *nothing* happens: no payout, no confirmation email, no listing
// marked sold, and no error anywhere, because from the app's point of view the
// order simply never completed.
//
// That is exactly what happened on 2026-07-16: a live payment settled, five
// sibling events (payment_intent.succeeded, charge.succeeded…) were processed
// seconds apart, and the order sat 'pending' for two weeks unnoticed.
//
// This job closes that blind spot by asking Stripe directly: for every order
// still 'pending' past a short grace period, is the session actually paid? Any
// that are get raised to Sentry and to the admin notification bell.
//
// It only ever reports. Replaying the missed webhook is a deliberate act (the
// fulfilment path moves money), so this deliberately does not self-heal — it
// tells you which session to resend.
//
// Runs once a day (vercel.json). Hourly would be better — a stuck payment is
// then found within the hour rather than within the day — but Vercel's Hobby
// plan rejects any cron that fires more than once daily, and the whole
// deployment fails to build with one. Restore `15 * * * *` if the account moves
// to Pro; nothing else here depends on the cadence.
// ─────────────────────────────────────────────────────────────────────────────

// How long an order may legitimately sit 'pending' before it's suspicious.
// Generous: the webhook normally lands within seconds, but a delayed payment
// method (some BNPL / bank debit flows) completes the session 'unpaid' and
// settles later, and those sessions read as unpaid here until they do.
const STALE_AFTER_MS = 15 * 60 * 1000;

// Ceiling on Stripe calls per run. Abandoned checkouts are cancelled by
// handleCheckoutSessionExpired when their session expires (~24h), so the
// pending set stays small; this is a backstop against an unbounded scan if that
// ever stops being true.
const MAX_ORDERS_PER_RUN = 200;

const NOTIFICATION_TYPE = 'order_payment_unfulfilled';

// Find orders that Stripe considers paid but that never got fulfilled.
// `now` is injectable so tests don't depend on wall-clock time.
export async function findUnfulfilledPaidOrders(stripe, { now = Date.now() } = {}) {
  const cutoff = new Date(now - STALE_AFTER_MS).toISOString();

  const { data: pending, error } = await supabase
    .from('orders')
    .select('id, stripe_session_id, total_aud, created_at')
    .eq('status', 'pending')
    .not('stripe_session_id', 'is', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_ORDERS_PER_RUN);

  if (error) throw new Error(`could not read pending orders: ${error.message}`);
  if (!pending?.length) return { checked: 0, stuck: [], truncated: false };

  const stuck = [];
  for (const order of pending) {
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      // 'paid' is the only status that means money actually moved. 'unpaid'
      // covers both abandoned checkouts and delayed methods still settling;
      // 'no_payment_required' covers fully-discounted orders, which the webhook
      // still has to fulfil — but those are not a lost-payment emergency, so
      // they're left out rather than dressed up as one.
      if (session?.payment_status === 'paid') {
        stuck.push({
          orderId: order.id,
          sessionId: order.stripe_session_id,
          totalAud: Number(order.total_aud) || 0,
          createdAt: order.created_at,
          paymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
        });
      }
    } catch (e) {
      // A session Stripe can't return (deleted test data, wrong mode key) must
      // not abort the scan — the next order might be the one that matters.
      logger.warn(`[ORDER_RECONCILE] Could not check session ${order.stripe_session_id} for order ${order.id}: ${e.message}`);
    }
  }

  return { checked: pending.length, stuck, truncated: pending.length === MAX_ORDERS_PER_RUN };
}

// Which of these orders have already been reported, so a repeat run doesn't
// re-notify the same stuck order every time. Keyed on notifications.related_id,
// which carries the order id.
async function alreadyAlerted(orderIds) {
  if (!orderIds.length) return new Set();
  const { data, error } = await supabase
    .from('notifications')
    .select('related_id')
    .eq('type', NOTIFICATION_TYPE)
    .in('related_id', orderIds);

  if (error) {
    // Fail open: re-alerting is noisy, staying silent about lost money is worse.
    logger.warn(`[ORDER_RECONCILE] Could not read prior alerts, may repeat: ${error.message}`);
    return new Set();
  }
  return new Set((data || []).map(r => r.related_id));
}

// Raise each newly-detected stuck order to Sentry and the admin bell.
// Sentry is the primary channel — it reaches a phone; the in-app notification
// is the record an admin sees when they next log in.
export async function alertStuckOrders(stuck) {
  if (!stuck.length) return { alerted: 0, suppressed: 0 };

  const seen = await alreadyAlerted(stuck.map(s => s.orderId));
  const fresh = stuck.filter(s => !seen.has(s.orderId));
  if (!fresh.length) return { alerted: 0, suppressed: stuck.length };

  for (const s of fresh) {
    const message =
      `[ORDER_RECONCILE] Order ${s.orderId} is paid in Stripe but still pending — ` +
      `checkout.session.completed never fulfilled it. Session ${s.sessionId}` +
      (s.paymentIntentId ? `, payment intent ${s.paymentIntentId}` : '') +
      `. Resend the event from the Stripe dashboard to fulfil it.`;
    logger.error(message);
    Sentry.captureMessage(message, 'error');
  }

  const { data: admins, error: adminErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true);

  if (adminErr || !admins?.length) {
    if (adminErr) logger.warn(`[ORDER_RECONCILE] Could not load admins: ${adminErr.message}`);
    // Sentry already fired, so the alert is not lost — but without a
    // notification row the dedupe has nothing to key on and the next run will
    // report these again. Sentry groups repeats, so that is the safe direction.
    return { alerted: fresh.length, suppressed: stuck.length - fresh.length, notified: 0 };
  }

  const rows = admins.flatMap(a => fresh.map(s => ({
    user_id: a.id,
    type: NOTIFICATION_TYPE,
    title: 'Paid order was never fulfilled',
    body:
      `Order ${s.orderId} ($${s.totalAud.toFixed(2)} AUD, placed ${new Date(s.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC) ` +
      `is paid in Stripe but still pending. Resend checkout.session.completed for session ${s.sessionId}.`,
    related_id: s.orderId,
  })));

  const { error: insErr } = await supabase.from('notifications').insert(rows);
  if (insErr) logger.warn(`[ORDER_RECONCILE] Could not write admin notifications: ${insErr.message}`);

  return { alerted: fresh.length, suppressed: stuck.length - fresh.length, notified: insErr ? 0 : rows.length };
}

// Constant-time compare so the bearer check can't leak the secret via timing.
const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

// Fail-closed, matching the other cron entrypoints (prices, blog, event scan):
// with no CRON_SECRET configured the job refuses rather than letting anyone
// trigger a scan that enumerates orders.
const isAuthorisedCronCall = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[ORDER_RECONCILE] CRON_SECRET is not set — refusing (fail-closed).');
    return false;
  }
  return timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`);
};

// GET /stripe/reconcile-pending — Vercel Cron entrypoint.
export function reconcilePendingOrders(stripe) {
  return async (req, res) => {
    if (!isAuthorisedCronCall(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { checked, stuck, truncated } = await findUnfulfilledPaidOrders(stripe);
      const outcome = await alertStuckOrders(stuck);

      if (truncated) {
        logger.warn(`[ORDER_RECONCILE] Hit the ${MAX_ORDERS_PER_RUN}-order scan cap — older pending orders were not checked this run.`);
      }
      logger.info(`[ORDER_RECONCILE] checked ${checked} pending order(s), ${stuck.length} paid-but-unfulfilled, ${outcome.alerted} newly alerted`);

      res.json({ checked, stuck: stuck.length, ...outcome, truncated });
    } catch (err) {
      logger.error(`[ORDER_RECONCILE] ${err.message}`);
      res.status(500).json({ error: 'Reconciliation failed' });
    }
  };
}
