import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendLaunchWelcome } from '../utils/emailService.js';

// Only these attribution sources are accepted from the launch form; anything
// else is coerced to the default so a caller can't write arbitrary strings into
// the column. The general newsletter path sets its own source, below.
const ALLOWED_SOURCES = new Set(['launch_modal', 'launch_page']);
const NEWSLETTER_SOURCE = 'newsletter';

function normaliseEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  return normalized;
}

/**
 * Look up the registration for an address, or create it.
 *
 * Shared by the launch and newsletter paths — both need the same
 * case-insensitive lookup and the same unique-index race handling, and neither
 * may downgrade an address that is already on the list (a launch registrant who
 * later ticks the newsletter box keeps their reserved Pro access).
 *
 * @returns {Promise<{ row: object|null, created: boolean }>} `row` is null only
 *   when a concurrent insert won the race; the caller should then treat the
 *   address as already registered and do nothing further.
 */
async function findOrCreateRegistration({ email, firstName, source, proReserved }) {
  const { data: existing, error: selectError } = await supabase
    .from('launch_registrations')
    .select('id, email, welcome_email_sent_at')
    .ilike('email', email)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return { row: existing, created: false };

  const { data: inserted, error: insertError } = await supabase
    .from('launch_registrations')
    .insert({
      email,
      first_name: firstName,
      source,
      pro_reserved: proReserved,
    })
    .select('id, email, welcome_email_sent_at')
    .single();
  // A concurrent insert can still race past the select and hit the unique
  // index — treat that as "already registered", not an error.
  if (insertError) {
    if (insertError.code === '23505') return { row: null, created: false };
    throw insertError;
  }
  return { row: inserted, created: true };
}

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
  const normalizedEmail = normaliseEmail(email);
  const { row, created } = await findOrCreateRegistration({
    email: normalizedEmail,
    firstName: firstName?.trim() || null,
    source: ALLOWED_SOURCES.has(source) ? source : 'launch_modal',
    proReserved: true,
  });
  // Lost the insert race — the winner owns the welcome email.
  if (!row) return { created: false, emailed: false };

  // Welcome email already sent for this address — nothing more to do.
  if (row.welcome_email_sent_at) {
    return { created, emailed: false };
  }

  const sent = await sendLaunchWelcome({ to: normalizedEmail, name: firstName?.trim() || null });
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

/**
 * Record a general newsletter subscriber in our own database.
 *
 * Kit.com is the marketing tool, but it is not our record of who asked to hear
 * from us — before this existed, a plain newsletter signup was written to Kit
 * and nowhere else, so the list was unrecoverable if that account went away.
 * These subscribers asked for marketing email, not early access, so they are
 * stored with `pro_reserved = false` and are sent nothing here: the launch
 * welcome email (and its early-access PDF) belongs to the launch form only.
 *
 * Idempotent, and never downgrades an existing registration.
 *
 * @param {{ email: string, firstName?: string }} params
 * @returns {Promise<{ created: boolean }>}
 */
export async function recordNewsletterSubscriber({ email, firstName } = {}) {
  const { created } = await findOrCreateRegistration({
    email: normaliseEmail(email),
    firstName: firstName?.trim() || null,
    source: NEWSLETTER_SOURCE,
    proReserved: false,
  });
  return { created };
}

export default registerLaunchInterest;
