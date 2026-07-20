import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import stripe from '../utils/stripeClient.js';
import { payoutSeller } from '../services/payoutService.js';
import { namesMatch } from '../services/identityService.js';
import { payoutAccountName } from '../utils/sellerAccountShape.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAal2 } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams, validateRequestQuery } from '../middleware/validateRequest.js';
import { setUserRoleSchema, setUserRoleBodySchema, reviewVerificationSchema, reviewVerificationBodySchema, processRefundSchema, processRefundBodySchema, getDisputesSchema, resolveDisputeSchema, resolveDisputeBodySchema, setUserStatusSchema, setUserStatusBodySchema, identityReviewSchema, identityReviewBodySchema, createBusinessProfileBodySchema, businessProfileIdSchema, updateBusinessProfileBodySchema, createCardArtBodySchema, cardArtIdSchema } from '../schemas/adminSchemas.js';
import { cardArtLookupKey } from '../utils/cardImageResolver.js';
import logger from '../utils/logger.js';

const router = Router();

// Every endpoint here performs a PRIVILEGED write that must never be reachable
// by a normal user. These operations were previously done with direct
// client-side Supabase writes from admin-only React pages — but the React UI is
// not a security boundary. Moving them server-side behind isAdminUser closes the
// privilege/trust-escalation vectors (self-promote to admin, self-verify
// identity, self-approve refunds) at the application layer. Tighten RLS in the
// database to forbid the corresponding client writes for full defence in depth.
router.use(authMiddleware);
router.use(async (req, res, next) => {
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});
// Enforce MFA server-side: an admin who enrolled MFA must present an AAL2
// (stepped-up) token. Runs after the admin check so non-admins still get the
// 403 above, and never blocks admins who haven't enabled MFA.
router.use(requireAal2);

const round2 = (n) => Math.round(n * 100) / 100;

// ─── Look up user login emails (admin-only) ───────────────────────────────────
// profiles.email is deliberately not client-readable (no column grant — see
// 20260715210000), so admin UIs that need to display or act on a user's email
// (user detail sidebar, partner-applicant list) fetch it here through the
// service-role client instead of a direct client select that would 403.
router.post('/user-emails', async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.filter((x) => typeof x === 'string'))].slice(0, 500)
    : [];
  if (!ids.length) return res.json({ emails: {} });

  const { data, error } = await supabase.from('profiles').select('id, email').in('id', ids);
  if (error) {
    logger.error(`[ADMIN] user-emails lookup failed: ${error.message}`);
    return res.status(500).json({ error: 'Failed to load user emails' });
  }

  const emails = {};
  for (const row of data || []) emails[row.id] = row.email || null;
  res.json({ emails });
});

// ─── Set a user's admin flag ──────────────────────────────────────────────────
router.patch('/users/:userId/role', validateRequestParams(setUserRoleSchema), validateRequestBody(setUserRoleBodySchema), async (req, res) => {
  const { userId } = req.params;
  const { is_admin } = req.body;

  // Prevent an admin from removing their own admin rights (lock-out guard).
  if (userId === req.user.id && is_admin === false) {
    return res.status(400).json({ error: 'You cannot revoke your own admin access' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_admin })
      .eq('id', userId)
      .select('id, is_admin')
      .single();
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'update_user_admin',
      description: `Set is_admin=${is_admin} for user ${userId}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} set is_admin=${is_admin} for ${userId}`);
    res.json({ success: true, user: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to update admin flag: ${err.message}`);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// ─── Suspend / reactivate / soft-delete a user account ────────────────────────
// Previously "Suspend" only flipped profiles.is_active — a client-side write
// that hid the account from public listings (HomePage's featured sellers,
// SellersManagementPage) but never actually blocked sign-in, and "Delete" was
// a disabled no-op with no backend support at all. Both now also ban the
// Supabase auth user (GoTrue checks banned_until on every sign-in/refresh),
// so a suspended or deleted account is actually locked out, not just hidden.
// 'deleted' is a permanent-looking soft-disable, not a row deletion — all
// historical orders/listings/reviews are kept; there is no "undelete" UI.
const INDEFINITE_BAN = '876000h'; // ~100 years — lifted explicitly via 'active'
router.patch('/users/:userId/status', validateRequestParams(setUserStatusSchema), validateRequestBody(setUserStatusBodySchema), async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own account status' });
  }

  try {
    const profileUpdate = status === 'active'
      ? { is_active: true, is_deleted: false }
      : status === 'suspended'
        ? { is_active: false }
        : { is_active: false, is_deleted: true }; // 'deleted'

    const { data, error } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)
      .select('id, is_active, is_deleted')
      .single();
    if (error) throw error;

    const { error: banErr } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: status === 'active' ? 'none' : INDEFINITE_BAN,
    });
    if (banErr) throw banErr;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'update_user_status',
      description: `Set account status=${status} for user ${userId}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} set status=${status} for ${userId}`);
    res.json({ success: true, user: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to update user status: ${err.message}`);
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

// ─── Stripe Identity name-mismatch review ─────────────────────────────────────
// applyIdentitySession routes verified sessions whose document name doesn't
// match the profile's display name here instead of auto-approving: the profile
// stays 'pending' with identity_name_mismatch=true. These two endpoints back
// the admin user management UI — the flag and legal_name are service-role-only
// columns, so the browser can't read them directly.

// List every profile awaiting a name-mismatch review.
router.get('/users/identity-mismatches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, legal_name, verification_status, updated_at')
      .eq('identity_name_mismatch', true)
      .order('updated_at', { ascending: true });
    if (error) throw error;
    res.json({ mismatches: data ?? [] });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list identity mismatches: ${err.message}`);
    res.status(500).json({ error: 'Failed to load identity mismatches' });
  }
});

// List every seller whose Connect payout account's KYC'd name doesn't match
// their profile name (flag maintained by connectService on status sync).
router.get('/users/payout-mismatches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, legal_name, business_name, updated_at')
      .eq('payout_name_mismatch', true)
      .order('updated_at', { ascending: true });
    if (error) throw error;
    res.json({ mismatches: data ?? [] });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list payout mismatches: ${err.message}`);
    res.status(500).json({ error: 'Failed to load payout mismatches' });
  }
});

// Live Stripe name panel for one user: every name Stripe holds for them, with
// match verdicts computed on the spot. Names come from service-role reads and
// live Stripe retrieves — none of this is client-readable directly.
router.get('/users/:userId/stripe-names', validateRequestParams(identityReviewSchema), async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('id, display_name, legal_name, business_name, identity_name_mismatch, payout_name_mismatch, stripe_connect_account_id, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!profile) return res.status(404).json({ error: 'User not found' });

    // Connect payout account (sellers only) — KYC'd by Stripe.
    let payoutName = null;
    if (profile.stripe_connect_account_id) {
      try {
        const account = await stripe.v2.core.accounts.retrieve(profile.stripe_connect_account_id, { include: ['identity'] });
        payoutName = payoutAccountName(account) || null;
      } catch (e) {
        logger.warn(`[ADMIN] stripe-names: could not retrieve Connect account for ${userId}: ${e.message}`);
      }
    }

    // Billing customer (created for business/ABN billing with the business
    // name at the time) — informational, drifts if the business renames.
    let billingName = null;
    if (profile.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
        billingName = (!customer?.deleted && customer?.name) || null;
      } catch (e) {
        logger.warn(`[ADMIN] stripe-names: could not retrieve customer for ${userId}: ${e.message}`);
      }
    }

    const profileName = profile.legal_name || profile.display_name || null;
    res.json({
      names: {
        account: profile.display_name || null,
        idDocument: profile.legal_name || null,
        payoutAccount: payoutName,
        billingCustomer: billingName,
        business: profile.business_name || null,
      },
      // true = matches, false = mismatch, null = not comparable (missing data)
      checks: {
        idDocument: profile.legal_name && profile.display_name ? namesMatch(profile.display_name, profile.legal_name) : null,
        payoutAccount: payoutName && profileName
          ? (namesMatch(profileName, payoutName) || (profile.business_name ? namesMatch(profile.business_name, payoutName) : false))
          : null,
        billingCustomer: billingName && (profile.business_name || profileName)
          ? namesMatch(profile.business_name || profileName, billingName)
          : null,
      },
      flags: {
        identity_name_mismatch: Boolean(profile.identity_name_mismatch),
        payout_name_mismatch: Boolean(profile.payout_name_mismatch),
      },
    });
  } catch (err) {
    logger.error(`[ADMIN] stripe-names failed for ${userId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to load Stripe name checks' });
  }
});

// Resolve one: approve grants the verified badge despite the differing name;
// reject marks the verification rejected. Both clear the mismatch flag.
router.patch('/users/:userId/identity-review', validateRequestParams(identityReviewSchema), validateRequestBody(identityReviewBodySchema), async (req, res) => {
  const { userId } = req.params;
  const { decision } = req.body;

  try {
    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('id, identity_name_mismatch')
      .eq('id', userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (!profile.identity_name_mismatch) {
      return res.status(409).json({ error: 'This user has no identity name mismatch awaiting review' });
    }

    const update = decision === 'approve'
      ? { is_verified: true, verification_status: 'approved', identity_name_mismatch: false }
      : { is_verified: false, verification_status: 'rejected', identity_name_mismatch: false };

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, is_verified, verification_status')
      .single();
    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: userId,
      type: decision === 'approve' ? 'identity_verified' : 'identity_rejected',
      title: decision === 'approve' ? 'Identity verified' : 'Identity verification unsuccessful',
      body: decision === 'approve'
        ? 'Our team has reviewed and approved your ID check — your account now shows the Verified badge.'
        : 'Our team reviewed your ID check and couldn’t verify it because the name on the document doesn’t match your account. Update your profile name to match your ID and try again, or contact support.',
    }).then(() => {}, () => {});

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'identity_mismatch_review',
      description: `${decision === 'approve' ? 'Approved' : 'Rejected'} identity name-mismatch review for user ${userId}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} ${decision}d identity name-mismatch review for ${userId}`);
    res.json({ success: true, user: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed identity mismatch review: ${err.message}`);
    res.status(500).json({ error: 'Failed to resolve identity review' });
  }
});

// ─── Review an identity verification ──────────────────────────────────────────
router.patch('/verifications/:id', validateRequestParams(reviewVerificationSchema), validateRequestBody(reviewVerificationBodySchema), async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes, additional_info_requested, info_request } = req.body;

  const now = new Date().toISOString();
  const updateData = {
    admin_id: req.user.id,
    admin_notes: admin_notes?.trim() || null,
    reviewed_at: now,
    updated_at: now,
  };

  if (info_request) {
    updateData.additional_info_requested = additional_info_requested?.trim() || null;
  } else {
    updateData.status = status;
    updateData.additional_info_requested = null;
  }

  try {
    const { data, error } = await supabase
      .from('user_verifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Propagate the decision to the user's PROFILE — the verified badge and all
    // gating read profiles.is_verified / verification_status, so without this the
    // review is cosmetic (approving never actually grants verified status).
    if (!info_request && data?.user_id) {
      const profileUpdate = { verification_status: status, updated_at: now };
      if (status === 'approved') {
        profileUpdate.is_verified = true;
        profileUpdate.verified_at = now;
      } else if (['rejected', 'suspended', 'revoked'].includes(status)) {
        profileUpdate.is_verified = false;
      }
      const { error: profErr } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', data.user_id);
      if (profErr) logger.error(`[ADMIN] verification ${id}: failed to sync profile ${data.user_id}: ${profErr.message}`);
    }

    await supabase.from('verification_audit_log').insert({
      verification_id: id,
      admin_id: req.user.id,
      action: info_request ? 'info_requested' : status,
      notes: admin_notes?.trim() || null,
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} reviewed verification ${id} → ${info_request ? 'info_requested' : status}`);
    res.json({ success: true, verification: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to update verification: ${err.message}`);
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// ─── Approve / reject a refund ────────────────────────────────────────────────
router.patch('/refunds/:id', validateRequestParams(processRefundSchema), validateRequestBody(processRefundBodySchema), async (req, res) => {
  const { id } = req.params;
  const { action, admin_notes, rejection_reason } = req.body;

  try {
    const { data: refund, error: fetchErr } = await supabase
      .from('refunds').select('*, order:orders!order_id(total_aud, platform_fee_aud)').eq('id', id).single();
    if (fetchErr || !refund) return res.status(404).json({ error: 'Refund not found' });

    // Only a pending request can be approved/rejected. Re-approving an
    // already-processed refund would re-open it for /stripe/refund, and once
    // the ~24h Stripe idempotency window lapses that issues a second, duplicate
    // refund for the same order.
    if (refund.status !== 'pending') {
      return res.status(409).json({ error: `Refund is already ${refund.status}` });
    }

    if (action === 'reject') {
      const { error } = await supabase.from('refunds')
        .update({ status: 'rejected', rejection_reason, admin_notes: admin_notes || null })
        .eq('id', id);
      if (error) throw error;
      await supabase.from('orders').update({ refund_status: 'rejected' }).eq('id', refund.order_id);
      await supabase.from('notifications').insert({
        user_id: refund.buyer_id, type: 'refund_rejected', title: 'Refund Request Declined',
        body: `Your refund request was not approved. Reason: ${rejection_reason}`,
      }).then(() => {}, () => {});
      logger.info(`[ADMIN] ${req.user.id} rejected refund ${id}`);
      return res.json({ success: true, status: 'rejected' });
    }

    // Approve — compute the refundable amount from the server-authoritative
    // ORDER row (total_aud / platform_fee_aud written by the Stripe webhook),
    // NOT from the buyer-created refunds row. A buyer who set commission_aud/
    // gst_aud to 0 (or inflated total_paid_aud) could otherwise escape the fee
    // retention entirely.
    const totalFee = Number(refund.order?.platform_fee_aud) || 0; // commission + GST
    const orderTotal = Number(refund.order?.total_aud) || 0;
    const retainedFee = round2(totalFee * 0.5);
    const refundAmount = round2(orderTotal - retainedFee);

    const { error } = await supabase.from('refunds')
      .update({ status: 'approved', admin_notes: admin_notes || null })
      .eq('id', id);
    if (error) throw error;
    await supabase.from('orders').update({ refund_status: 'approved' }).eq('id', refund.order_id);
    await supabase.from('notifications').insert({
      user_id: refund.buyer_id, type: 'refund_approved', title: 'Refund Approved',
      body: `Your refund of $${refundAmount.toFixed(2)} AUD has been approved and will be processed shortly.`,
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} approved refund ${id} ($${refundAmount})`);
    res.json({ success: true, status: 'approved', refundAmount });
  } catch (err) {
    logger.error(`[ADMIN] Failed to process refund: ${err.message}`);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// ─── Chargeback disputes: list + resolve ──────────────────────────────────────
const DISPUTE_TERMINAL = ['resolved_released', 'resolved_kept'];

router.get('/disputes', validateRequestQuery(getDisputesSchema), async (req, res) => {
  const { status } = req.query;
  try {
    let query = supabase
      .from('payment_disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status === 'open') {
      // "open" = anything we haven't resolved yet.
      query = query.not('status', 'in', `(${DISPUTE_TERMINAL.join(',')})`);
    } else if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ disputes: data || [] });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list disputes: ${err.message}`);
    res.status(500).json({ error: 'Failed to load disputes' });
  }
});

// Resolve a dispute. action:
//   'release'     — chargeback won by us / resolved in seller's favour: pay the
//                   seller their (previously frozen) proceeds.
//   'keep_frozen' — chargeback lost / kept on hold: leave the payout frozen.
router.patch('/disputes/:id', validateRequestParams(resolveDisputeSchema), validateRequestBody(resolveDisputeBodySchema), async (req, res) => {
  const { id } = req.params;
  const { action, resolution_notes } = req.body;

  try {
    const { data: dispute, error: fetchErr } = await supabase
      .from('payment_disputes').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    let payout = null;
    if (action === 'release') {
      // Look up the order to recover the exact proceeds owed to the seller.
      const { data: order } = await supabase
        .from('orders')
        .select('id, seller_id, listing_id, seller_proceeds_aud')
        .eq('id', dispute.order_id)
        .maybeSingle();
      if (!order) return res.status(404).json({ error: 'Order for this dispute no longer exists' });

      payout = await payoutSeller(stripe, {
        sellerId: order.seller_id,
        sellerProceeds: order.seller_proceeds_aud,
        orderId: order.id,
        listingId: order.listing_id,
      });
    }

    const newStatus = action === 'release' ? 'resolved_released' : 'resolved_kept';
    const { data: updated, error: updErr } = await supabase
      .from('payment_disputes')
      .update({
        status: newStatus,
        resolution_notes: resolution_notes?.trim() || null,
        resolved_by: req.user.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (updErr) throw updErr;

    logger.info(`[ADMIN] ${req.user.id} resolved dispute ${id} → ${newStatus}${payout ? ` (payout: ${payout.status})` : ''}`);
    res.json({ success: true, dispute: updated, payout });
  } catch (err) {
    logger.error(`[ADMIN] Failed to resolve dispute: ${err.message}`);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ─── Business profiles: admin-curated directory of physical retail locations ──
// Deliberately separate from profiles.is_sole_trader (the self-service /dealer
// storefront any seller can enable themselves) — business_profiles is a
// curated set of real-world stores for the Retailers directory and community
// map, and only an admin creates/approves/edits them (its RLS only grants a
// row's own user self-view/self-update; there's no public write path and no
// admin bypass policy, so every privileged read/write goes through here).
router.get('/business-profiles', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('business_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ businessProfiles: data || [] });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list business profiles: ${err.message}`);
    res.status(500).json({ error: 'Failed to load business profiles' });
  }
});

router.post('/business-profiles', validateRequestBody(createBusinessProfileBodySchema), async (req, res) => {
  const { user_email, storefront_status, ...fields } = req.body;

  try {
    const { data: owner, error: ownerErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user_email.trim().toLowerCase())
      .maybeSingle();
    if (ownerErr) throw ownerErr;
    if (!owner) return res.status(404).json({ error: 'No account found with that email' });

    const { data, error } = await supabase
      .from('business_profiles')
      .insert({
        ...fields,
        user_id: owner.id,
        storefront_status: storefront_status || 'pending_review',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'create_business_profile',
      description: `Created business profile "${data.business_name}" (${data.id}) for user ${owner.id}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} created business profile ${data.id}`);
    res.json({ success: true, businessProfile: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to create business profile: ${err.message}`);
    res.status(500).json({ error: 'Failed to create business profile' });
  }
});

router.patch('/business-profiles/:id', validateRequestParams(businessProfileIdSchema), validateRequestBody(updateBusinessProfileBodySchema), async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

  // Any status transition (approve/reject/suspend) counts as a review.
  if (updates.storefront_status) {
    updates.reviewed_by = req.user.id;
    updates.reviewed_at = new Date().toISOString();
    if (updates.storefront_status !== 'suspended') updates.rejection_reason = null;
  }
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('business_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'update_business_profile',
      description: `Updated business profile ${id}${updates.storefront_status ? ` → ${updates.storefront_status}` : ''}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} updated business profile ${id}`);
    res.json({ success: true, businessProfile: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to update business profile: ${err.message}`);
    res.status(500).json({ error: 'Failed to update business profile' });
  }
});

// ─── Card-art overrides: admin-uploaded thumbnails for the analytics/movers ──
// tables. Covers cards the free card APIs don't (sports) and lets an admin
// override any card's art. The resolver (src/utils/cardImageResolver.js) reads
// this table first, keyed by cardArtLookupKey — computed HERE so the write key
// always matches the read key. Images are uploaded to the public `media` bucket
// client-side; this endpoint just records the mapping.
router.get('/card-art', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('card_art_overrides')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ cardArt: data || [] });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list card art: ${err.message}`);
    res.status(500).json({ error: 'Failed to load card art' });
  }
});

router.post('/card-art', validateRequestBody(createCardArtBodySchema), async (req, res) => {
  const { name, card_set, collection, image_url, storage_path } = req.body;
  const lookup_key = cardArtLookupKey(name, card_set, collection);

  try {
    // Upsert on lookup_key so re-uploading art for the same card replaces it
    // rather than erroring on the unique index.
    const { data, error } = await supabase
      .from('card_art_overrides')
      .upsert({
        name: name.trim(),
        card_set: card_set?.trim() || null,
        collection: collection?.trim() || null,
        image_url,
        storage_path: storage_path || null,
        lookup_key,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lookup_key' })
      .select()
      .single();
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'upsert_card_art',
      description: `Set card art for "${data.name}" (${data.id})`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} set card art ${data.id} (${lookup_key})`);
    res.json({ success: true, cardArt: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to save card art: ${err.message}`);
    res.status(500).json({ error: 'Failed to save card art' });
  }
});

router.delete('/card-art/:id', validateRequestParams(cardArtIdSchema), async (req, res) => {
  const { id } = req.params;
  try {
    // Grab the storage path first so we can clean up the object after the row.
    const { data: row } = await supabase
      .from('card_art_overrides')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('card_art_overrides').delete().eq('id', id);
    if (error) throw error;

    if (row?.storage_path) {
      supabase.storage.from('media').remove([row.storage_path]).then(() => {}, () => {});
    }

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'delete_card_art',
      description: `Deleted card art ${id}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} deleted card art ${id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`[ADMIN] Failed to delete card art: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete card art' });
  }
});

export default router;
