import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireAal2 } from '../middleware/requireAal2.js';
import { invalidReturnUrl } from '../utils/returnUrl.js';
import { createFeatureCheckout, createFeatureBundleCheckout, FeatureCheckoutError } from '../services/eventFeatureService.js';
import {
  FEATURED_PACKAGES, EARLY_BIRD, featureEligibility, featuredQuote, formatAud, todayInAustralia,
} from '../../utils/featuredPackages.js';

/**
 * The featuring offer in the "your event is live" email: the cheapest
 * package's price for this event (early bird included) and a link that opens
 * its package picker in My Events. null when the event can't be featured
 * (already featured, already started, no date).
 */
export function featureOffer(event, today = todayInAustralia()) {
  if (!featureEligibility(event, today).ok) return null;
  const quote = featuredQuote(FEATURED_PACKAGES[0].key, event.start_date, today);
  return {
    fromPrice: formatAud(quote.priceCents),
    earlyBird: quote.earlyBird ? `${EARLY_BIRD.pct}% early bird discount applied` : null,
    url: `https://cardpop.com.au/account/events?feature=${encodeURIComponent(event.id)}`,
  };
}
import { sendEventSubmitted, sendEventReviewOutcome, sendEventChangesMade } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import { getEventSearchPerformance } from '../services/eventSearchPerformance.js';
import { isSearchConsoleConfigured } from '../utils/searchConsoleClient.js';
import { mergeChangeLog, changeRows, describeEventValue } from '../../utils/eventChangeLog.js';

const router = Router();

/**
 * POST /events/notify-submission
 *
 * Fired by the event form right after anyone adds an event — a member's
 * submission (pending review), an admin's own event (often live straight
 * away), or a member's resubmission of a rejected event — so every admin
 * hears about every event. Emails every admin account plus the Notification
 * Email under Admin → Platform Settings (getAdminNotificationEmails), minus
 * the person who added it. The bell to every admin comes from a DB trigger
 * (notify_admins_on_event_submission); this endpoint is the email leg.
 * The nightly scanner's finds (auto_discovered) have their own queue.
 *
 * Only the event's own creator can trigger it, and it sends once per
 * submission: the send is claimed through events.admins_notified_at, which
 * the DB clears again when a rejected event is resubmitted. Fail-safe: the
 * event is already saved, so any error is logged and reported only.
 */
router.post('/notify-submission', authMiddleware, async (req, res) => {
  const { eventId } = req.body || {};
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, title, slug, event_type, status, suburb, state, start_date, organiser_id, organizer_name, organizer_email, auto_discovered, admins_notified_at')
      .eq('id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Only the person who added the event can trigger the notice — closes the
    // "email the admins about anything, any time" hole.
    if (event.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only notify for your own event' });
    }
    if (event.auto_discovered) return res.json({ ok: true, skipped: 'auto_discovered' });
    // A draft hasn't been submitted — it's the organiser's own until they do.
    if (event.status === 'draft') return res.json({ ok: true, skipped: 'draft' });
    if (event.admins_notified_at) return res.json({ ok: true, skipped: 'already_sent' });

    // Claim the send before making it, so a double call can't email twice.
    const { data: claimed, error: claimError } = await supabase
      .from('events')
      .update({ admins_notified_at: new Date().toISOString() })
      .eq('id', event.id)
      .is('admins_notified_at', null)
      .select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) return res.json({ ok: true, skipped: 'already_sent' });

    const { data: creator } = await supabase
      .from('profiles')
      .select('email, display_name, username, is_admin')
      .eq('id', req.user.id)
      .maybeSingle();
    const creatorEmail = creator?.email?.trim().toLowerCase() || null;
    const all = await getAdminNotificationEmails();
    // An admin doesn't need an email about the event they just added — unless
    // they're the only recipient.
    const others = creatorEmail ? all.filter((a) => a.trim().toLowerCase() !== creatorEmail) : all;
    const recipients = others.length ? others : all;

    await sendEventSubmitted({
      to: recipients,
      event,
      addedBy: creator?.display_name || creator?.username || null,
      byAdmin: Boolean(creator?.is_admin),
    });

    logger.info(`[EVENTS] Notified ${recipients.length} admin address(es) of new event ${event.id} (${event.status})`);
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[EVENTS] notify-submission failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * GET /events/:id/search-performance
 *
 * Google search performance (Search Console: impressions, clicks, CTR, average
 * position and the top queries, last 28 days) of one event's page, for the
 * event's own organiser — events.organiser_id must be the caller. Admins have
 * Search Console itself, so there is deliberately no admin bypass here.
 * Answers { available: false } for an event that isn't public yet (Google can't
 * have shown it), 503 while Search Console isn't configured, 502 if Google
 * fails. Cached per page for hours — services/eventSearchPerformance.js.
 */
router.get('/:id/search-performance', authMiddleware, async (req, res) => {
  const eventId = req.params.id;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, slug, status, organiser_id')
      .eq('id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the event organiser can see its search performance' });
    }
    if (event.status !== 'approved' && event.status !== 'completed') {
      return res.json({ available: false, reason: 'not_live' });
    }
    if (!isSearchConsoleConfigured()) {
      return res.status(503).json({ error: 'Search performance isn’t available right now', configured: false });
    }

    const performance = await getEventSearchPerformance(event);
    res.set('Cache-Control', 'private, max-age=300');
    res.json({ available: true, ...performance });
  } catch (err) {
    logger.error(`[EVENTS] search-performance failed: ${err.message}`);
    res.status(502).json({ error: 'Could not load search performance right now' });
  }
});

/**
 * GET /events/:id/vendors
 *
 * The vendor list for an event — everyone who RSVP'd "Sell as Vendor" — for
 * the event's own organiser, once an admin has verified them
 * (event_organiser_verifications). Admins use GET /admin/events/:id/rsvps
 * instead (behind requireAal2) — there is deliberately no bare isAdminUser()
 * bypass here. Raw event_rsvps rows are
 * owner/admin-only under RLS, so this reads them with the service-role client
 * after the checks. Returns names and public profile handles only — never
 * emails: vendors agreed to show up as a vendor, not to hand their login email
 * to a third party. Organisers reach them through their profile / messages.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/:id/vendors', authMiddleware, async (req, res) => {
  const eventId = req.params.id;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

  try {
    const [{ data: event, error }, { data: verification, error: vError }] = await Promise.all([
      supabase.from('events').select('id, organiser_id').eq('id', eventId).maybeSingle(),
      supabase.from('event_organiser_verifications').select('user_id').eq('user_id', req.user.id).maybeSingle(),
    ]);
    if (error) throw error;
    if (vError) throw vError;
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the event organiser can see its vendors' });
    }
    if (!verification) {
      return res.status(403).json({ error: 'Your organiser account needs to be verified by CardPop first' });
    }

    const { data: rsvps, error: rsvpError } = await supabase
      .from('event_rsvps')
      .select('user_id, created_at')
      .eq('event_id', eventId)
      .eq('role', 'vendor')
      .order('created_at', { ascending: true });
    if (rsvpError) throw rsvpError;

    const ids = (rsvps || []).map((r) => r.user_id);
    const profiles = {};
    if (ids.length) {
      const { data: rows, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ids);
      if (profileError) throw profileError;
      for (const row of rows || []) profiles[row.id] = row;
    }

    res.json({
      vendors: (rsvps || []).map((r) => ({
        user_id: r.user_id,
        created_at: r.created_at,
        username: profiles[r.user_id]?.username || null,
        display_name: profiles[r.user_id]?.display_name || null,
        avatar_url: profiles[r.user_id]?.avatar_url || null,
      })),
    });
  } catch (err) {
    logger.error(`[EVENTS] vendor list failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load vendors' });
  }
});

// ─── Review outcomes and organiser edits ─────────────────────────────────────
// The bell for each of these comes from DB triggers
// (20261109235618_event_organiser_review_flow.sql); these routes are the email
// leg. The admin UI calls them right after its decision write. Each send is
// stamped (events.organiser_notified_status, event_change_log.admins_emailed_at)
// so a repeat call — a double click, a retry — never emails twice. Fail-safe:
// the decision is already saved, so errors are logged and reported only.
// See docs/event-submissions.md.

const SITE_URL = 'https://cardpop.com.au';
const eventUrl = (event) => `${SITE_URL}/events/${event.slug || event.id}`;

// The organiser's login email + name, unless they turned the email off for
// this notification type (Account → Notification Settings).
async function organiserRecipient(organiserId, type) {
  const [{ data: profile, error }, { data: pref }] = await Promise.all([
    supabase.from('profiles').select('id, email, display_name, username, is_admin').eq('id', organiserId).maybeSingle(),
    supabase.from('notification_preferences').select('email').eq('user_id', organiserId).eq('type', type).maybeSingle(),
  ]);
  if (error) throw error;
  if (!profile?.email || pref?.email === false) return null;
  return { email: profile.email, name: profile.display_name || profile.username || null };
}

/**
 * POST /events/:id/notify-decision  (admin)
 *
 * Emails a member-submitted event's organiser that it was approved or
 * rejected (with the admin's rejection reason).
 */
router.post('/:id/notify-decision', authMiddleware, requireAdmin, async (req, res) => {
  const eventId = req.params.id;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, title, slug, status, organiser_id, rejection_reason, organiser_notified_status, start_date, is_featured')
      .eq('id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!['approved', 'rejected'].includes(event.status)) return res.json({ ok: true, skipped: 'undecided' });
    if (!event.organiser_id || event.organiser_id === req.user.id) return res.json({ ok: true, skipped: 'no_organiser' });
    if (event.organiser_notified_status === event.status) return res.json({ ok: true, skipped: 'already_sent' });

    const approved = event.status === 'approved';
    const to = await organiserRecipient(event.organiser_id, approved ? 'event_approved' : 'event_rejected');
    // Claim the send before making it, so two quick calls can't both email.
    const { data: claimed, error: claimError } = await supabase
      .from('events')
      .update({ organiser_notified_status: event.status })
      .eq('id', event.id)
      .eq('status', event.status)
      .or(`organiser_notified_status.is.null,organiser_notified_status.neq.${event.status}`)
      .select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) return res.json({ ok: true, skipped: 'already_sent' });
    if (!to) return res.json({ ok: true, skipped: 'no_recipient' });

    const sent = await sendEventReviewOutcome({
      to: to.email,
      name: to.name,
      eventTitle: event.title,
      approved,
      note: approved ? null : event.rejection_reason,
      eventUrl: eventUrl(event),
      feature: approved ? featureOffer(event) : null,
    });
    res.json({ ok: true, sent: Boolean(sent) });
  } catch (err) {
    logger.error(`[EVENTS] notify-decision failed for ${eventId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to email the organiser' });
  }
});

/**
 * POST /events/:id/notify-changes  (the event's organiser)
 *
 * Emails every admin exactly what the organiser just changed on their live
 * event — each field before → after. The changes are already live and logged
 * by the DB (event_change_log, which also bells every admin); the form calls
 * this after saving the event and its offer. Sends every log entry the caller
 * made on this event that hasn't been emailed yet, merged into one email, and
 * stamps them first so a repeat never emails twice.
 */
const MAX_EMAIL_VALUE = 300;
const clip = (s) => (s.length > MAX_EMAIL_VALUE ? `${s.slice(0, MAX_EMAIL_VALUE - 1)}…` : s);

router.post('/:id/notify-changes', authMiddleware, async (req, res) => {
  const eventId = req.params.id;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, title, slug, organiser_id')
      .eq('id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only notify for your own event' });
    }

    // Claim this caller's un-emailed entries in one statement.
    const { data: entries, error: claimError } = await supabase
      .from('event_change_log')
      .update({ admins_emailed_at: new Date().toISOString() })
      .eq('event_id', event.id)
      .eq('changed_by', req.user.id)
      .is('admins_emailed_at', null)
      .select('id, changes, created_at');
    if (claimError) throw claimError;
    if (!entries?.length) return res.json({ ok: true, skipped: 'nothing_new' });

    const rows = changeRows(mergeChangeLog(entries)).map(({ field, label, from, to }) => ({
      label,
      from: clip(describeEventValue(field, from)),
      to: clip(describeEventValue(field, to)),
    }));
    if (!rows.length) return res.json({ ok: true, skipped: 'no_net_change' });

    const { data: editor } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', req.user.id)
      .maybeSingle();
    const recipients = await getAdminNotificationEmails();
    await sendEventChangesMade({
      to: recipients,
      event: { ...event, url: eventUrl(event) },
      editorName: editor?.display_name || editor?.username || null,
      rows,
    });
    logger.info(`[EVENTS] Emailed ${recipients.length} admin address(es) ${rows.length} change(s) to live event ${event.id}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[EVENTS] notify-changes failed for ${eventId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * POST /events/feature-bundle-checkout  { package, eventIds: [3 ids], successUrl, cancelUrl }
 *
 * The 3-event pack (BUNDLE in utils/featuredPackages.js): one package across
 * three of the caller's own events in one Stripe Checkout Session, priced
 * server-side. Same rules per event as a single featuring.
 */
router.post('/feature-bundle-checkout', authMiddleware, requireAal2, async (req, res) => {
  const { package: packageKey, eventIds, successUrl, cancelUrl } = req.body || {};
  if (!successUrl || !cancelUrl) return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
  const badReturnUrl = invalidReturnUrl({ successUrl, cancelUrl });
  if (badReturnUrl) return res.status(400).json({ error: badReturnUrl });

  try {
    const result = await createFeatureBundleCheckout({ user: req.user, eventIds, packageKey, successUrl, cancelUrl });
    res.json({ url: result.url, sessionId: result.sessionId });
  } catch (err) {
    if (err instanceof FeatureCheckoutError) return res.status(err.status).json({ error: err.message });
    logger.error(`[EVENTS] feature-bundle-checkout failed: ${err.message}`);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

/**
 * POST /events/:id/feature-checkout  { package, successUrl, cancelUrl }
 *
 * Opens a Stripe Checkout Session for paid Featured Placement on the caller's
 * own event (Account → My Events → Feature). The price is set server-side from
 * utils/featuredPackages.js, early bird included; the webhook switches the
 * featuring on once paid (src/services/eventFeatureService.js). Money in, so
 * MFA-enrolled organisers must be stepped up, like a wallet top-up.
 */
router.post('/:id/feature-checkout', authMiddleware, requireAal2, async (req, res) => {
  const { id } = req.params;
  const { package: packageKey, successUrl, cancelUrl } = req.body || {};
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid event id' });
  if (!successUrl || !cancelUrl) return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
  const badReturnUrl = invalidReturnUrl({ successUrl, cancelUrl });
  if (badReturnUrl) return res.status(400).json({ error: badReturnUrl });

  try {
    const result = await createFeatureCheckout({ user: req.user, eventId: id, packageKey, successUrl, cancelUrl });
    res.json({ url: result.url, sessionId: result.sessionId });
  } catch (err) {
    if (err instanceof FeatureCheckoutError) return res.status(err.status).json({ error: err.message });
    logger.error(`[EVENTS] feature-checkout failed for ${id}: ${err.message}`);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

export default router;
