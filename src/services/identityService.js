import stripe from '../utils/stripeClient.js';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

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
    .select('stripe_identity_session_id, verification_status, is_verified')
    .eq('id', userId)
    .maybeSingle();
  return data;
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

    const fields = { is_verified: true, verification_status: 'approved', updated_at: now };
    const verifiedName = [session.verified_outputs?.first_name, session.verified_outputs?.last_name]
      .filter(Boolean).join(' ').trim();
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

    const session = await stripe.identity.verificationSessions.retrieve(profile.stripe_identity_session_id);
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
