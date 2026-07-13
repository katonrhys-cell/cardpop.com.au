import crypto from 'crypto';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

// Base URL used to build the status link handed back to the user (and Facebook).
const APP_URL = (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/$/, '');

// A long ban effectively blocks the account from signing in again — the same
// "permanent soft-disable" semantics as the admin Delete Account action
// (see migration 20260707124038_add_profiles_is_deleted.sql).
const PERMANENT_BAN_DURATION = '876000h'; // ~100 years

/**
 * Generate a short, human-readable, alphanumeric confirmation code.
 * Example: "CP-7F3A9K2QD1". Unambiguous uppercase alphabet (no 0/O/1/I).
 */
function generateConfirmationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let code = '';
  for (let i = 0; i < bytes.length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `CP-${code}`;
}

function statusUrlFor(code) {
  return `${APP_URL}/data-deletion?code=${encodeURIComponent(code)}`;
}

/**
 * Best-effort lookup of the CardPop auth user behind a Facebook app-scoped user
 * ID (ASID). Facebook Login stores the provider id on the Supabase auth
 * identity, so we page through users and match on any 'facebook' identity.
 *
 * Bounded to a sane number of pages so a callback can never fan out into an
 * unbounded scan. Per Meta's FAQ, IDs not present in our records may simply be
 * disregarded — so "not found" is a valid, compliant outcome, not an error.
 *
 * @returns {string|null} the matching auth user id, or null.
 */
async function findUserByFacebookId(fbUserId) {
  if (!fbUserId) return null;
  const target = String(fbUserId);
  const perPage = 1000;
  const maxPages = 20; // up to 20k users scanned before we give up

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      logger.error('[data-deletion] listUsers failed', error);
      return null;
    }
    const users = data?.users || [];
    for (const user of users) {
      const identities = user.identities || [];
      const match = identities.some(
        (idn) =>
          idn.provider === 'facebook' &&
          (String(idn.id) === target ||
            String(idn.identity_data?.sub || '') === target ||
            String(idn.identity_data?.provider_id || '') === target),
      );
      if (match) return user.id;
    }
    if (users.length < perPage) break; // last page
  }
  return null;
}

/**
 * Soft-disable a matched account: block sign-in via an auth ban and flag the
 * profile as deleted/inactive. Historical records (orders, listings, reviews)
 * are intentionally retained — the same policy as the admin Delete Account
 * action — while the personal, sign-in-able account is permanently disabled.
 */
async function softDeleteUser(userId) {
  await supabase.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN_DURATION });
  const { error } = await supabase
    .from('profiles')
    .update({ is_deleted: true, is_active: false })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Handle a Facebook data deletion request. Records the request, attempts to
 * locate and disable the matching account, and returns the confirmation code
 * plus the status URL to hand back to Facebook.
 *
 * @param {string} fbUserId  The app-scoped user ID from the signed request.
 * @returns {{ confirmationCode: string, statusUrl: string }}
 */
export async function handleFacebookDeletionRequest(fbUserId) {
  const confirmationCode = generateConfirmationCode();

  // Record first, so we always have a durable trail even if deletion fails.
  const { error: insertError } = await supabase.from('data_deletion_requests').insert({
    confirmation_code: confirmationCode,
    fb_user_id: fbUserId ? String(fbUserId) : null,
    source: 'facebook',
    status: 'received',
  });
  if (insertError) {
    // Don't fail the callback — Facebook needs a valid response. Log for
    // follow-up; the deletion attempt below still runs.
    logger.error('[data-deletion] Failed to record deletion request', insertError);
  }

  let status = 'no_data';
  let matchedUserId = null;
  let notes = null;

  try {
    matchedUserId = await findUserByFacebookId(fbUserId);
    if (matchedUserId) {
      await softDeleteUser(matchedUserId);
      status = 'completed';
    }
  } catch (err) {
    status = 'failed';
    notes = err?.message ? String(err.message).slice(0, 500) : 'Deletion error';
    logger.error('[data-deletion] Deletion failed; recorded for manual follow-up', err);
  }

  const { error: updateError } = await supabase
    .from('data_deletion_requests')
    .update({
      status,
      matched_user_id: matchedUserId,
      notes,
      completed_at: status === 'completed' || status === 'no_data' ? new Date().toISOString() : null,
    })
    .eq('confirmation_code', confirmationCode);
  if (updateError) {
    logger.error('[data-deletion] Failed to update deletion request status', updateError);
  }

  return { confirmationCode, statusUrl: statusUrlFor(confirmationCode) };
}

/**
 * Look up the status of a deletion request by its confirmation code, for the
 * public status page. Returns a small, non-sensitive summary or null.
 */
export async function getDeletionRequestStatus(confirmationCode) {
  if (!confirmationCode || typeof confirmationCode !== 'string') return null;
  const { data, error } = await supabase
    .from('data_deletion_requests')
    .select('confirmation_code, status, requested_at, completed_at')
    .eq('confirmation_code', confirmationCode)
    .maybeSingle();
  if (error) {
    logger.error('[data-deletion] Status lookup failed', error);
    return null;
  }
  return data || null;
}

export default { handleFacebookDeletionRequest, getDeletionRequestStatus };
