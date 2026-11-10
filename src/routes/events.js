import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { sendEventSubmitted, sendEventReviewOutcome, sendEventChangeRequested } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import { EVENT_CHANGE_LABELS } from '../../utils/eventChangeRequests.js';

const router = Router();

/**
 * POST /events/notify-submission
 *
 * Fired by the user-facing event form immediately after a user inserts a
 * `pending_review` event, so a new community submission doesn't sit unnoticed
 * in the moderation queue. Emails every admin account, plus the dedicated
 * Notification Email set under Admin → Platform Settings (falls back to the
 * contact address, then a default alerts inbox) for backward compatibility.
 * A separate DB trigger (see supabase/migrations) also fans out an in-app
 * notification to every admin — this endpoint only handles the email leg.
 *
 * Auth + ownership are checked so a user can only trigger a notice for their own
 * freshly-submitted, still-pending event — never email an arbitrary address or
 * re-notify on an already-approved one. Fail-safe: the submission itself already
 * succeeded client-side, so any error here is logged and surfaced without
 * affecting the user's saved event.
 */
router.post('/notify-submission', authMiddleware, async (req, res) => {
  const { eventId } = req.body || {};
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, title, event_type, status, suburb, state, start_date, organiser_id, organizer_name, organizer_email')
      .eq('id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Only the submitter can trigger the notice, and only while the event is
    // actually awaiting review — closes the "email anyone / re-notify" hole.
    if (event.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only notify for your own event' });
    }
    if (event.status !== 'pending_review') {
      return res.json({ ok: true, skipped: 'not_pending' });
    }

    const recipients = await getAdminNotificationEmails();
    await sendEventSubmitted({ to: recipients, event });

    logger.info(`[EVENTS] Notified ${recipients.join(', ')} of pending event ${event.id}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[EVENTS] notify-submission failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to send notification' });
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

// ─── Organiser emails: review outcomes and change requests ───────────────────
// The bell for each of these comes from DB triggers
// (20261109235618_event_organiser_review_flow.sql); these routes are the email
// leg. The admin UI calls them right after its decision write. Each send is
// stamped (events.organiser_notified_status, event_change_requests.*_emailed_at)
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
      .select('id, title, slug, status, organiser_id, rejection_reason, organiser_notified_status')
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
      kind: 'submission',
      approved,
      note: approved ? null : event.rejection_reason,
      eventUrl: eventUrl(event),
    });
    res.json({ ok: true, sent: Boolean(sent) });
  } catch (err) {
    logger.error(`[EVENTS] notify-decision failed for ${eventId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to email the organiser' });
  }
});

/**
 * POST /events/change-requests/:id/notify-admins  (the requesting organiser)
 *
 * Emails the admin notification addresses that a live event has an open
 * change request. Once per request.
 */
router.post('/change-requests/:id/notify-admins', authMiddleware, async (req, res) => {
  const requestId = req.params.id;
  if (!UUID_RE.test(requestId)) return res.status(400).json({ error: 'Invalid request ID' });
  try {
    const { data: request, error } = await supabase
      .from('event_change_requests')
      .select('id, event_id, organiser_id, status, changes, admins_emailed_at')
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw error;
    if (!request) return res.status(404).json({ error: 'Change request not found' });
    if (request.organiser_id !== req.user.id) return res.status(403).json({ error: 'You can only notify for your own request' });
    if (request.status !== 'pending' || request.admins_emailed_at) return res.json({ ok: true, skipped: 'already_sent' });

    const { data: claimed, error: claimError } = await supabase
      .from('event_change_requests')
      .update({ admins_emailed_at: new Date().toISOString() })
      .eq('id', request.id)
      .is('admins_emailed_at', null)
      .select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) return res.json({ ok: true, skipped: 'already_sent' });

    const [{ data: event }, { data: profile }] = await Promise.all([
      supabase.from('events').select('id, title').eq('id', request.event_id).maybeSingle(),
      supabase.from('profiles').select('display_name, username').eq('id', request.organiser_id).maybeSingle(),
    ]);
    const fields = Object.keys(request.changes || {}).map((f) => EVENT_CHANGE_LABELS[f] || f);
    const recipients = await getAdminNotificationEmails();
    await sendEventChangeRequested({
      to: recipients,
      event: event || { title: 'An event' },
      organiserName: profile?.display_name || profile?.username || null,
      fields,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[EVENTS] change-request notify-admins failed for ${requestId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * POST /events/change-requests/:id/notify-decision  (admin)
 *
 * Emails the organiser that their changes were applied or dismissed (with the
 * admin's note). Once per request.
 */
router.post('/change-requests/:id/notify-decision', authMiddleware, requireAdmin, async (req, res) => {
  const requestId = req.params.id;
  if (!UUID_RE.test(requestId)) return res.status(400).json({ error: 'Invalid request ID' });
  try {
    const { data: request, error } = await supabase
      .from('event_change_requests')
      .select('id, event_id, organiser_id, status, review_note, organiser_emailed_at')
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw error;
    if (!request) return res.status(404).json({ error: 'Change request not found' });
    if (!['applied', 'dismissed'].includes(request.status)) return res.json({ ok: true, skipped: 'undecided' });
    if (request.organiser_emailed_at || request.organiser_id === req.user.id) return res.json({ ok: true, skipped: 'already_sent' });

    const approved = request.status === 'applied';
    const to = await organiserRecipient(request.organiser_id, approved ? 'event_approved' : 'event_rejected');
    const { data: claimed, error: claimError } = await supabase
      .from('event_change_requests')
      .update({ organiser_emailed_at: new Date().toISOString() })
      .eq('id', request.id)
      .is('organiser_emailed_at', null)
      .select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) return res.json({ ok: true, skipped: 'already_sent' });
    if (!to) return res.json({ ok: true, skipped: 'no_recipient' });

    const { data: event } = await supabase.from('events').select('id, title, slug').eq('id', request.event_id).maybeSingle();
    const sent = await sendEventReviewOutcome({
      to: to.email,
      name: to.name,
      eventTitle: event?.title,
      kind: 'changes',
      approved,
      note: request.review_note,
      eventUrl: event ? eventUrl(event) : null,
    });
    res.json({ ok: true, sent: Boolean(sent) });
  } catch (err) {
    logger.error(`[EVENTS] change-request notify-decision failed for ${requestId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to email the organiser' });
  }
});

export default router;
