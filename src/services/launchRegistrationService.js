import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendLaunchWelcome } from '../utils/emailService.js';

// Only these attribution sources are accepted; anything else is coerced to the
// default so a caller can't write arbitrary strings into the column.
const ALLOWED_SOURCES = new Set(['launch_modal', 'launch_page']);

/**
 * Record a pre-launch early-access registration.
 *
 * Idempotent: the same email can be submitted repeatedly (Kit dedupes too), but
 * the row is created once and the welcome email — with the early-access PDF — is
 * sent exactly once (guarded by `welcome_email_sent_at`).
 *
 * Failures here are the caller's to handle; the newsletter route treats this as
 * best-effort so a transient DB/email hiccup never blocks the visitor's signup.
 *
 * @param {{ email: string, firstName?: string, source?: string }} params
 * @returns {Promise<{ created: boolean, emailed: boolean }>}
 */
export async function registerLaunchInterest({ email, firstName, source } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  const firstNameClean = firstName?.trim() || null;
  const sourceClean = ALLOWED_SOURCES.has(source) ? source : 'launch_modal';

  // Find any existing registration first (case-insensitive) so re-submissions
  // don't re-send the welcome email.
  const { data: existing, error: selectError } = await supabase
    .from('launch_registrations')
    .select('id, email, welcome_email_sent_at')
    .ilike('email', normalizedEmail)
    .maybeSingle();
  if (selectError) throw selectError;

  let row = existing;
  let created = false;
  if (!row) {
    const { data: inserted, error: insertError } = await supabase
      .from('launch_registrations')
      .insert({
        email: normalizedEmail,
        first_name: firstNameClean,
        source: sourceClean,
      })
      .select('id, email, welcome_email_sent_at')
      .single();
    // A concurrent insert can still race past the select and hit the unique
    // index — treat that as "already registered", not an error.
    if (insertError) {
      if (insertError.code === '23505') {
        return { created: false, emailed: false };
      }
      throw insertError;
    }
    row = inserted;
    created = true;
  }

  // Welcome email already sent for this address — nothing more to do.
  if (row.welcome_email_sent_at) {
    return { created, emailed: false };
  }

  const sent = await sendLaunchWelcome({ to: normalizedEmail, name: firstNameClean });
  if (sent) {
    const { error: updateError } = await supabase
      .from('launch_registrations')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) {
      // The email went out; failing to stamp it just risks a duplicate on a
      // later re-submit. Log rather than throw so the signup still succeeds.
      logger.error('[launch] failed to stamp welcome_email_sent_at:', updateError);
    }
  }

  return { created, emailed: sent };
}

export default registerLaunchInterest;
