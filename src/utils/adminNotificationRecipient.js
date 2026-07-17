import supabase from './supabaseClient.js';
import logger from './logger.js';

// Where internal admin alerts (new orders, user event submissions) are sent when
// no address is configured. A dedicated inbox, kept separate from the public
// support address so operational alerts don't mix with customer mail.
const ADMIN_NOTIFICATION_FALLBACK = 'notifications@cardpop.com.au';

/**
 * Resolve the recipient for admin notification emails.
 *
 * Preference order:
 *   1. platform_settings.notification_email — the dedicated alerts inbox set on
 *      the admin Settings page.
 *   2. platform_settings.contact_email — the general public contact address,
 *      used if no dedicated notification address has been configured.
 *   3. ADMIN_NOTIFICATION_FALLBACK — so an alert is never silently dropped.
 *
 * Never throws: on any read failure it returns the fallback.
 */
async function getAdminNotificationEmail() {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['notification_email', 'contact_email']);
    const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    const notif = typeof byKey.notification_email === 'string' && byKey.notification_email.trim();
    const contact = typeof byKey.contact_email === 'string' && byKey.contact_email.trim();
    return notif || contact || ADMIN_NOTIFICATION_FALLBACK;
  } catch (e) {
    logger.warn(`[NOTIFY] Failed to resolve admin notification email: ${e.message}`);
    return ADMIN_NOTIFICATION_FALLBACK;
  }
}

export { getAdminNotificationEmail, ADMIN_NOTIFICATION_FALLBACK };
