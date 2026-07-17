import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendEventSubmitted } from '../utils/emailService.js';
import { getAdminNotificationEmail } from '../utils/adminNotificationRecipient.js';

const router = Router();

/**
 * POST /events/notify-submission
 *
 * Fired by the user-facing event form immediately after a user inserts a
 * `pending_review` event, so a new community submission doesn't sit unnoticed
 * in the moderation queue. The recipient is the dedicated Notification Email set
 * under Admin → Platform Settings (falls back to the contact address, then a
 * default alerts inbox).
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

    const recipient = await getAdminNotificationEmail();
    await sendEventSubmitted({ to: recipient, event });

    logger.info(`[EVENTS] Notified ${recipient} of pending event ${event.id}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[EVENTS] notify-submission failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
