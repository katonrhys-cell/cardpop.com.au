import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendEventSubmitted } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';

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

export default router;
