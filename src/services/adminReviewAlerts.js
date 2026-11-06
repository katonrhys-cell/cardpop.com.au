import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';
import { sendAdminReviewAlert } from '../utils/emailService.js';

/**
 * Tell every admin that a member submission is waiting in a review queue:
 * an in-app bell for each admin account (NotificationBell) and one email to
 * every admin's login address plus the configured alerts inbox
 * (getAdminNotificationEmails).
 *
 * Best-effort by design: the member's submission has already been saved, so
 * a failed bell or email is logged and never thrown — a notification problem
 * must not turn a successful submission into an error for the member.
 *
 * `type` must be a value of the notification_type enum (see
 * supabase/migrations/20261106061312_admin_review_notification_types.sql).
 * An unknown type makes the bell insert fail, which is logged here rather
 * than swallowed.
 *
 * @returns {Promise<{ belled: number, emailed: boolean }>}
 */
export async function alertAdminsToReview({
  type, title, body, path = '/admin', relatedId = null, email, bell = true,
}) {
  const result = { belled: 0, emailed: false };

  // `bell: false` when a database trigger already bells the admins
  // (product reviews) — this then only sends the email.
  if (bell) try {
    const { data: admins, error } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (error) throw error;
    if (admins?.length) {
      const { error: insertErr } = await supabase.from('notifications').insert(admins.map((a) => ({
        user_id: a.id,
        type,
        title,
        body,
        link: path,
        related_id: relatedId,
      })));
      if (insertErr) throw insertErr;
      result.belled = admins.length;
    }
  } catch (err) {
    logger.warn(`[ADMIN_ALERT] ${type} bell failed: ${err.message}`);
  }

  try {
    const to = await getAdminNotificationEmails();
    result.emailed = Boolean(await sendAdminReviewAlert({
      to,
      subject: email?.subject || title,
      heading: title,
      intro: email?.intro || body,
      rows: email?.rows || [],
      path,
    }));
  } catch (err) {
    logger.warn(`[ADMIN_ALERT] ${type} email failed: ${err.message}`);
  }

  return result;
}
