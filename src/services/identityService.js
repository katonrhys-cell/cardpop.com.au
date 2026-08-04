import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { isStripeObjectMissing } from '../utils/stripeErrors.js';
import { sendIdentityReviewNeeded } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';

// Best-effort: alert admins (in-app + email) that a verification needs a human
// look. Never throws — called from the Stripe Identity webhook, where an
// unhandled error would turn a successfully-processed event into a 500 and
// cause Stripe to retry it.
async function notifyAdminsOfIdentityReview({ userId, userName, userEmail }) {
  try {
    const { data: admins, error: adminsErr } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (adminsErr) throw adminsErr;
    if (admins?.length) {
      // supabase-js resolves failed inserts with { error } instead of throwing —
      // check it explicitly so a rejected insert is logged rather than silently
      // dropped (the table's link column is related_id, not entity_id).
      const { error: insertErr } = await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'verification_requested',
        title: 'Identity verification needs review',
        body: `${userName || 'A user'}'s ID name doesn't match their profile — needs manual approve/reject.`,
        link: `/admin/users/${userId}`,
        related_id: userId,
      })));
      if (insertErr) throw insertErr;
    }
  } catch (e) {
    logger.warn(`[IDENTITY] admin review in-app notification failed for ${userId}: ${e.message}`);
  }

  try {
    const to = await getAdminNotificationEmails();
    await sendIdentityReviewNeeded({ to, userId, userName, userEmail });
  } catch (e) {
    logger.warn(`[IDENTITY] admin review email failed for ${userId}: ${e.message}`);
  }
}

// Stripe Identity document verification.
//
// Flow: the signup page (or /verify-identity) POSTs /stripe/identity/session,
// we create a hosted verification session and redirect the user to Stripe.
// Stripe runs the document + selfie checks and sends the outcome to the
// existing /stripe/webhook endpoint (identity.verification_session.* events),
// which maps it onto the same profile fields the manual admin-review flow
// writes ('approved'/'pending'/'rejected' + is_verified) so badges and the
// account pages keep working unchanged. GET /stripe/identity/status re-syncs
// from Stripe directly, so verification still lands even if the webhook isn't
// configured for identity events yet.

const appBase = () => (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/$/, '');

const isApproved = (profile) =>
  profile?.is_verified === true || profile?.verification_status === 'approved';

async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('stripe_identity_session_id, verification_status, is_verified, display_name, identity_name_mismatch, email')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

// Lowercase, strip diacritics, and reduce to space-separated letter tokens so
// "María O'Brien-Smith" and "Maria O Brien Smith" compare equal.
const nameTokens = (s) => (s || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z]+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean);

/**
 * Does the profile name plausibly match the name on the verified document?
 * Compares first and last tokens only, so middle names on either side don't
 * fail legitimate users. Anything failing this is routed to manual review,
 * never auto-rejected.
 */
export function namesMatch(profileName, documentName) {
  const p = nameTokens(profileName);
  const d = nameTokens(documentName);
  if (!p.length || !d.length) return false;
  return p[0] === d[0] && p[p.length - 1] === d[d.length - 1];
}

/**
 * Mirror a Stripe Identity session outcome onto the user's profile.
 * Never downgrades an already-approved profile (a stale failed session must
 * not strip a verified badge). Safe to call repeatedly — used by both the
 * webhook and the status endpoint.
 */
export async function applyIdentitySession(session) {
  const userId = session?.metadata?.userId;
  if (!userId) return;

  const profile = await getProfile(userId);
  const now = new Date().toISOString();

  if (session.status === 'verified') {
    if (isApproved(profile)) return;

    const verifiedName = [session.verified_outputs?.first_name, session.verified_outputs?.last_name]
      .filter(Boolean).join(' ').trim();

    // Cross-check the document name against the profile name (set at signup).
    // A mismatch is routed to manual admin review — the account stays
    // unverified with identity_name_mismatch flagged so it surfaces in the
    // admin user management section. Sessions where Stripe extracted no name
    // have nothing to compare and keep the auto-approve path.
    if (verifiedName && !namesMatch(profile?.display_name, verifiedName)) {
      // Already flagged and awaiting review (the status endpoint re-applies
      // the session on every poll) — don't re-write or re-notify.
      if (profile?.identity_name_mismatch && profile?.verification_status === 'pending') return;
      logger.warn(`[IDENTITY] ${userId} name mismatch (session ${session.id}) — routed to manual review`);
      const { error } = await supabase.from('profiles').update({
        verification_status: 'pending',
        identity_name_mismatch: true,
        legal_name: verifiedName,
        updated_at: now,
      }).eq('id', userId);
      if (error) {
        logger.error(`[IDENTITY] Failed to flag ${userId} for manual review: ${error.message}`);
        return;
      }
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'identity_review',
        title: 'Identity check under review',
        body: 'The name on your ID didn’t match your profile name, so our team is reviewing your verification. No action is needed from you.',
      }).then(() => {}, () => {});
      await notifyAdminsOfIdentityReview({ userId, userName: verifiedName || profile?.display_name, userEmail: profile?.email });
      return;
    }

    const fields = { is_verified: true, verification_status: 'approved', identity_name_mismatch: false, updated_at: now };
    if (verifiedName) fields.legal_name = verifiedName;

    const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
    if (error) {
      logger.error(`[IDENTITY] Failed to mark ${userId} verified: ${error.message}`);
      return;
    }

    logger.info(`[IDENTITY] ${userId} verified via session ${session.id}`);
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'identity_verified',
      title: 'Identity verified',
      body: 'Your ID check is complete — your account now shows the Verified badge.',
    }).then(() => {}, () => {});
    return;
  }

  if (session.status === 'processing') {
    if (isApproved(profile) || profile?.verification_status === 'pending') return;
    await supabase.from('profiles')
      .update({ verification_status: 'pending', updated_at: now })
      .eq('id', userId);
    return;
  }

  // requires_input with a last_error means the checks ran and failed (an
  // abandoned session is requires_input with no error — leave those alone).
  if (session.status === 'requires_input' && session.last_error) {
    if (isApproved(profile)) return;
    logger.warn(`[IDENTITY] ${userId} verification failed: ${session.last_error.code}`);
    await supabase.from('profiles')
      .update({ verification_status: 'rejected', updated_at: now })
      .eq('id', userId);
  }
}

// ─── POST /stripe/identity/session ──────────────────────────────────────────
// Creates a hosted Stripe Identity session and returns its redirect URL.

export async function createIdentitySession(req, res) {
  try {
    const userId = req.user.id;
    const profile = await getProfile(userId);

    if (isApproved(profile)) {
      return res.status(409).json({ error: 'Your identity is already verified', code: 'already_verified' });
    }

    // Where Stripe sends the user afterwards — an app path only, never an
    // absolute URL, so the redirect can't be pointed off-site.
    const requested = req.body?.returnPath;
    const returnPath = (typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//'))
      ? requested
      : '/verify-identity';

    // With STRIPE_IDENTITY_FLOW_ID set, the session uses a Verification Flow
    // configured in the Stripe dashboard (document types, selfie check, etc.
    // all come from the flow — the API forbids passing type/options alongside
    // it). Without it, fall back to an inline document + selfie config.
    const flowId = process.env.STRIPE_IDENTITY_FLOW_ID;
    const session = await stripe.identity.verificationSessions.create({
      ...(flowId
        ? { verification_flow: flowId }
        : { type: 'document', options: { document: { require_matching_selfie: true } } }),
      metadata: { userId },
      ...(req.user.email ? { provided_details: { email: req.user.email } } : {}),
      return_url: `${appBase()}${returnPath}`,
    });

    const { error } = await supabase.from('profiles')
      .update({ stripe_identity_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw new Error(`Could not store verification session: ${error.message}`);

    logger.info(`[IDENTITY] Session ${session.id} created for ${userId}`);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error(`[IDENTITY] create session error: ${err.message}`);
    res.status(500).json({ error: 'Could not start identity verification' });
  }
}

// ─── GET /stripe/identity/status ─────────────────────────────────────────────
// Live status for the current user's latest session; also re-syncs the
// profile as a fallback when identity webhook events aren't delivered.

export async function getIdentityStatus(req, res) {
  try {
    const userId = req.user.id;
    const profile = await getProfile(userId);

    if (isApproved(profile)) return res.json({ status: 'verified' });
    if (!profile?.stripe_identity_session_id) return res.json({ status: 'not_started' });

    let session;
    try {
      session = await stripe.identity.verificationSessions.retrieve(profile.stripe_identity_session_id);
    } catch (err) {
      // Stale session id (from a previous Stripe account): the stored
      // verification outcome on the profile stays authoritative; report
      // not_started so an unverified user can simply run the check again.
      if (!isStripeObjectMissing(err)) throw err;
      return res.json({ status: 'not_started' });
    }
    await applyIdentitySession(session);

    res.json({
      status: session.status, // 'verified' | 'processing' | 'requires_input' | 'canceled'
      lastError: session.last_error
        ? { code: session.last_error.code, reason: session.last_error.reason }
        : null,
    });
  } catch (err) {
    logger.error(`[IDENTITY] status error: ${err.message}`);
    res.status(500).json({ error: 'Could not fetch verification status' });
  }
}
