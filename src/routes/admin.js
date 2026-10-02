import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import stripe from '../utils/stripeClient.js';
import { payoutSeller } from '../services/payoutService.js';
import { computeRefundAmounts, getRefundRetentionPct } from '../services/refundAmounts.js';
import { namesMatch } from '../services/identityService.js';
import { payoutAccountName } from '../utils/sellerAccountShape.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAal2 } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams, validateRequestQuery } from '../middleware/validateRequest.js';
import { setUserRoleSchema, setUserRoleBodySchema, reviewVerificationSchema, reviewVerificationBodySchema, processRefundSchema, processRefundBodySchema, getDisputesSchema, getOffersSchema, resolveDisputeSchema, resolveDisputeBodySchema, setUserStatusSchema, setUserStatusBodySchema, identityReviewSchema, identityReviewBodySchema, createBusinessProfileBodySchema, businessProfileIdSchema, updateBusinessProfileBodySchema, createCardArtBodySchema, cardArtIdSchema, shipOrderSchema, shipOrderBodySchema, eventRsvpsSchema, setEventOrganiserBodySchema, eventOrganiserSchema } from '../schemas/adminSchemas.js';
import { cardArtLookupKey } from '../utils/cardImageResolver.js';
import { assertNotLiteralPrivateAddress, ssrfSafeDispatcher } from '../utils/safeFetch.js';
import { fetch } from 'undici';
import logger from '../utils/logger.js';
import { sendOrderShipped } from '../utils/emailService.js';
import { normalizeTrackingNumber, carrierLabel } from '../../utils/shipmentTracking.js';

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
        const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
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
      .from('refunds').select('*, order:orders!order_id(total_aud, platform_fee_aud, processing_fee_aud, order_items)').eq('id', id).single();
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
    // ORDER row (total_aud / platform_fee_aud / processing_fee_aud written by
    // the Stripe webhook), NOT from the buyer-created refunds row. A buyer who
    // set commission_aud/gst_aud to 0 (or inflated total_paid_aud) could
    // otherwise escape the fee retention entirely. Uses the same arithmetic as
    // processRefund, so the amount quoted here is the amount Stripe sends.
    const { retainedFee, refundAmount } = computeRefundAmounts(refund.order, await getRefundRetentionPct());

    const { error } = await supabase.from('refunds')
      .update({ status: 'approved', admin_notes: admin_notes || null, retained_fee_aud: retainedFee, refund_amount_aud: refundAmount })
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

// ─── Mark an order shipped (+ email the buyer their tracking) ─────────────────
// Replaces the old client-side status flip, which sent the customer nothing.
// Re-posting on an already-shipped order updates the tracking reference (and
// re-sends the email when notify is on) without resetting shipped_at.
const SHIPPABLE_STATUSES = new Set(['payment_confirmed', 'shipped']);

router.post('/orders/:id/ship', validateRequestParams(shipOrderSchema), validateRequestBody(shipOrderBodySchema), async (req, res) => {
  const { id } = req.params;
  const { carrier, notify } = req.body;
  const trackingNumber = normalizeTrackingNumber(req.body.tracking_number);

  try {
    const { data: order, error: readErr } = await supabase
      .from('orders')
      .select('id, status, buyer_id, buyer_email, shipping_name, order_items, shipped_at, listing:listings!listing_id(title, vault_item:vault_items(card_name))')
      .eq('id', id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!SHIPPABLE_STATUSES.has(order.status)) {
      return res.status(409).json({ error: `An order that is ${String(order.status).replace(/_/g, ' ')} can't be marked shipped` });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await supabase
      .from('orders')
      .update({
        status: 'shipped',
        tracking_carrier: carrier,
        tracking_number: trackingNumber,
        shipped_at: order.shipped_at || now,
      })
      .eq('id', id)
      .select('id, status, tracking_carrier, tracking_number, shipped_at, shipping_notified_at')
      .single();
    if (updErr) throw updErr;

    const orderRef = id.slice(0, 8).toUpperCase();
    const lines = Array.isArray(order.order_items) ? order.order_items : [];
    const items = lines.length
      ? lines.map(l => l?.title).filter(Boolean)
      : [order.listing?.vault_item?.card_name || order.listing?.title].filter(Boolean);

    let emailed = false;
    let emailError = null;
    if (notify) {
      // A guest's email is on the order; a registered buyer's lives in
      // profiles.email (service-role only).
      let buyerEmail = order.buyer_email || null;
      let buyerName = order.shipping_name || null;
      if (order.buyer_id && (!buyerEmail || !buyerName)) {
        const { data: profile } = await supabase
          .from('profiles').select('email, display_name').eq('id', order.buyer_id).maybeSingle();
        buyerEmail = buyerEmail || profile?.email || null;
        buyerName = buyerName || profile?.display_name || null;
      }

      if (!buyerEmail) {
        emailError = 'No email address on file for this buyer';
      } else {
        emailed = await sendOrderShipped({ buyerEmail, buyerName, orderRef, items, carrier, trackingNumber });
        if (emailed) {
          updated.shipping_notified_at = now;
          await supabase.from('orders').update({ shipping_notified_at: now }).eq('id', id)
            .then(() => {}, () => {});
        } else {
          emailError = 'The shipping email could not be sent';
        }
      }

      if (order.buyer_id) {
        await supabase.from('notifications').insert({
          user_id: order.buyer_id, type: 'order_update', title: 'Your order has shipped 📦',
          body: `${carrierLabel(carrier)} tracking: ${trackingNumber}`,
          link: '/account/orders', related_id: id,
        }).then(() => {}, () => {});
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      event_type: 'order_shipped',
      description: `Marked order ${id} shipped (${carrier} ${trackingNumber})${emailed ? ', buyer emailed' : ''}`,
      status: 'success',
    }).then(() => {}, () => {});

    logger.info(`[ADMIN] ${req.user.id} marked order ${id} shipped (${carrier} ${trackingNumber}, emailed=${emailed})`);
    res.json({ success: true, order: updated, emailed, emailError });
  } catch (err) {
    logger.error(`[ADMIN] Failed to mark order shipped: ${err.message}`);
    res.status(500).json({ error: 'Failed to mark order shipped' });
  }
});

// ─── Chargeback disputes: list + resolve ──────────────────────────────────────
const DISPUTE_TERMINAL = ['resolved_released', 'resolved_kept'];

// Re-pay every cart line whose payout a chargeback reversed (mirrors
// payoutService.reverseSellerPayout's cart branch). Each line's payout record
// is refreshed with the new transfer, and the order's payout_status leaves
// 'frozen' the same way payoutSeller would set it for a single-item order.
async function releaseCartLinePayouts(order, lines, reversedLines, disputeId) {
  let transferred = 0;
  let walletCredited = 0;
  let failed = 0;
  for (const line of reversedLines) {
    const result = await payoutSeller(stripe, {
      sellerId: line.seller_id,
      sellerProceeds: Number(line.payout.proceeds),
      listingId: line.id ?? null,
      // One transfer per (dispute, line), however many times release runs.
      idempotencyKey: `dispute-release-${disputeId}-${line.id ?? line.seller_id}`,
    }).catch(e => {
      logger.error(`[ADMIN] cart release payout failed for seller ${line.seller_id} (order ${order.id}): ${e.message}`);
      return { status: 'failed' };
    });
    if (result.status === 'transferred') transferred += 1;
    else if (result.status === 'wallet_credited') walletCredited += 1;
    else failed += 1;
    const released = result.status === 'transferred' || result.status === 'wallet_credited';
    line.payout = {
      ...line.payout,
      status: result.status,
      transferId: result.transferId || null,
      releasedAt: new Date().toISOString(),
      // Marks this line as paid for THIS dispute, so a retry after a partial
      // failure (the dispute is re-opened, below) only pays the lines that
      // didn't go out — never a line twice.
      ...(released && disputeId ? { releasedForDispute: disputeId } : {}),
    };
  }
  const status = transferred > 0 ? 'transferred' : walletCredited > 0 ? 'wallet_credited' : 'failed';
  await supabase.from('orders').update({ order_items: lines, payout_status: status }).eq('id', order.id);
  return { status, lines: reversedLines.length, transferred, walletCredited, failed };
}

// ─── Offers ──────────────────────────────────────────────────────────────────
// Every marketplace offer, with both parties' contact details, for oversight
// of the binding-offer flow (who offered, who responded, who didn't pay).
// Offers RLS only lets the buyer and seller read a row, so this goes through
// the service role behind the admin gate.

const OFFER_ADMIN_SELECT = `
  id, listing_id, buyer_id, seller_id, amount_aud, counter_amount_aud, message, counter_message,
  status, expires_at, payment_due_at, paid_at, responded_at, binding_acknowledged_at, created_at,
  listing:listings(id, status, price_aud, listing_type, vault_item:vault_items(card_name)),
  buyer:profiles!buyer_id(id, display_name, username, email),
  seller:profiles!seller_id(id, display_name, username, email)
`;

const applyOfferFilter = (query, status) => {
  switch (status) {
    case 'open': return query.in('status', ['pending', 'countered']);
    case 'awaiting_payment': return query.eq('status', 'accepted').is('paid_at', null);
    case 'paid': return query.not('paid_at', 'is', null);
    case 'pending': case 'countered': case 'declined': case 'expired': case 'withdrawn':
      return query.eq('status', status);
    default: return query;
  }
};

router.get('/offers', validateRequestQuery(getOffersSchema), async (req, res) => {
  const status = req.query.status || 'all';
  try {
    const count = (filter) => applyOfferFilter(
      supabase.from('offers').select('id', { count: 'exact', head: true }),
      filter,
    );
    const [list, open, awaiting, paid, expired] = await Promise.all([
      applyOfferFilter(
        supabase.from('offers').select(OFFER_ADMIN_SELECT).order('created_at', { ascending: false }).limit(200),
        status,
      ),
      count('open'),
      count('awaiting_payment'),
      count('paid'),
      count('expired'),
    ]);
    if (list.error) throw list.error;
    res.json({
      offers: list.data || [],
      counts: {
        open: open.count ?? 0,
        awaiting_payment: awaiting.count ?? 0,
        paid: paid.count ?? 0,
        expired: expired.count ?? 0,
      },
    });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list offers: ${err.message}`);
    res.status(500).json({ error: 'Failed to load offers' });
  }
});

// The account linked to an event as its organiser, and whether an admin has
// verified them (which lets them see the event's vendor list).
async function loadEventOrganiser(userId) {
  if (!userId) return null;
  const [{ data: profile, error }, { data: verification, error: vError }] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, is_admin').eq('id', userId).maybeSingle(),
    supabase.from('event_organiser_verifications').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (error) throw error;
  if (vError) throw vError;
  return {
    id: userId,
    username: profile?.username || null,
    display_name: profile?.display_name || null,
    is_admin: profile?.is_admin === true,
    verified: !!verification,
  };
}

// ─── Who's going to an event (admin-only) ─────────────────────────────────────
// event_rsvps rows are owner/admin-only under RLS and the public event page only
// ever sees aggregate counts (get_event_rsvp_counts). This lists every RSVP for
// one event with the person's name and login email so an admin can see — and
// contact — the attendees and vendors. Email lives in profiles.email, which is
// service-role only, hence a server route rather than a client select.
router.get('/events/:id/rsvps', validateRequestParams(eventRsvpsSchema), async (req, res) => {
  try {
    const [{ data: rsvps, error }, { data: event, error: eventError }] = await Promise.all([
      supabase
        .from('event_rsvps')
        .select('user_id, role, created_at, updated_at')
        .eq('event_id', req.params.id)
        .order('created_at', { ascending: true }),
      supabase.from('events').select('id, organiser_id').eq('id', req.params.id).maybeSingle(),
    ]);
    if (error) throw error;
    if (eventError) throw eventError;

    // event_rsvps.user_id references auth.users, not profiles, so there is no
    // FK for PostgREST to embed through — look the profiles up separately.
    const ids = [...new Set((rsvps || []).map((r) => r.user_id))];
    const profiles = {};
    if (ids.length) {
      const { data: rows, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, email')
        .in('id', ids);
      if (profileError) throw profileError;
      for (const row of rows || []) profiles[row.id] = row;
    }

    res.json({
      organiser: await loadEventOrganiser(event?.organiser_id),
      rsvps: (rsvps || []).map((r) => {
        const p = profiles[r.user_id] || {};
        return {
          user_id: r.user_id,
          role: r.role,
          created_at: r.created_at,
          updated_at: r.updated_at,
          username: p.username || null,
          display_name: p.display_name || null,
          avatar_url: p.avatar_url || null,
          email: p.email || null,
        };
      }),
    });
  } catch (err) {
    logger.error(`[ADMIN] Failed to list event RSVPs: ${err.message}`);
    res.status(500).json({ error: 'Failed to load attendees' });
  }
});

// ─── Link an organiser account to an event ────────────────────────────────────
// Events an admin creates are stamped with the admin as organiser_id, so the
// real organiser's CardPop account has to be linked by hand. Identified by
// username or login email. The linked organiser can then edit the event while
// it's pending, manage its information board and — once verified — see its
// vendor list.
router.patch('/events/:id/organiser', validateRequestParams(eventRsvpsSchema), validateRequestBody(setEventOrganiserBodySchema), async (req, res) => {
  const identifier = req.body.identifier.trim();
  try {
    // "@handle" is a username; "name@domain" is an email.
    const column = /^[^@\s]+@[^@\s]+$/.test(identifier) ? 'email' : 'username';
    const value = column === 'email' ? identifier.toLowerCase() : identifier.replace(/^@/, '');
    const { data: matches, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike(column, value.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(2);
    if (error) throw error;
    if (!matches?.length) return res.status(404).json({ error: `No CardPop account found for ${identifier}` });
    if (matches.length > 1) return res.status(409).json({ error: `More than one account matches ${identifier}` });

    const { data: updated, error: updateError } = await supabase
      .from('events')
      .update({ organiser_id: matches[0].id })
      .eq('id', req.params.id)
      .select('id, organiser_id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(404).json({ error: 'Event not found' });

    logger.info(`[ADMIN] ${req.user.id} linked organiser ${matches[0].id} to event ${req.params.id}`);
    res.json({ organiser: await loadEventOrganiser(updated.organiser_id) });
  } catch (err) {
    logger.error(`[ADMIN] Failed to set event organiser: ${err.message}`);
    res.status(500).json({ error: 'Failed to link organiser' });
  }
});

// ─── Verify / unverify an event organiser ─────────────────────────────────────
// A verified organiser can see the vendor list for the events they organise
// (GET /events/:id/vendors). Applies to the account, so to all their events.
router.put('/event-organisers/:userId', validateRequestParams(eventOrganiserSchema), async (req, res) => {
  try {
    const { error } = await supabase
      .from('event_organiser_verifications')
      .upsert({ user_id: req.params.userId, verified_by: req.user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) throw error;
    logger.info(`[ADMIN] ${req.user.id} verified event organiser ${req.params.userId}`);
    res.json({ verified: true });
  } catch (err) {
    logger.error(`[ADMIN] Failed to verify organiser: ${err.message}`);
    res.status(500).json({ error: 'Failed to verify organiser' });
  }
});

router.delete('/event-organisers/:userId', validateRequestParams(eventOrganiserSchema), async (req, res) => {
  try {
    const { error } = await supabase
      .from('event_organiser_verifications')
      .delete()
      .eq('user_id', req.params.userId);
    if (error) throw error;
    logger.info(`[ADMIN] ${req.user.id} unverified event organiser ${req.params.userId}`);
    res.json({ verified: false });
  } catch (err) {
    logger.error(`[ADMIN] Failed to unverify organiser: ${err.message}`);
    res.status(500).json({ error: 'Failed to remove organiser verification' });
  }
});

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
    // Resolution is one-shot. A repeated 'release' (double click, retry, two
    // admins) used to pay the seller again on every request. resolved_at is
    // checked too: charge.dispute.closed overwrites status with Stripe's own
    // ('won' / 'lost'), which would otherwise make a released dispute look open.
    if (DISPUTE_TERMINAL.includes(dispute.status) || dispute.resolved_at) {
      return res.status(409).json({ error: 'This dispute has already been resolved' });
    }

    // Look up the order (release only) BEFORE claiming, so a missing order
    // leaves the dispute untouched.
    let order = null;
    if (action === 'release') {
      ({ data: order } = await supabase
        .from('orders')
        .select('id, seller_id, listing_id, seller_proceeds_aud, order_items')
        .eq('id', dispute.order_id)
        .maybeSingle());
      if (!order) return res.status(404).json({ error: 'Order for this dispute no longer exists' });
    }

    // Claim the resolution atomically BEFORE any money moves: only the request
    // whose conditional update gets the row back may pay. A concurrent or
    // repeated request matches nothing and gets a 409.
    const newStatus = action === 'release' ? 'resolved_released' : 'resolved_kept';
    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from('payment_disputes')
      .update({
        status: newStatus,
        resolution_notes: resolution_notes?.trim() || null,
        resolved_by: req.user.id,
        resolved_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', dispute.status)
      .is('resolved_at', null)
      .select()
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) return res.status(409).json({ error: 'This dispute has already been resolved' });

    // Put the dispute back the way it was, so a release whose payout failed can
    // be retried (lines already paid are skipped, and the transfers carry
    // idempotency keys, so a retry can't pay anyone twice).
    const unclaim = async () => {
      const { error: undoErr } = await supabase
        .from('payment_disputes')
        .update({
          status: dispute.status,
          resolution_notes: dispute.resolution_notes ?? null,
          resolved_by: null,
          resolved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', newStatus);
      if (undoErr) logger.error(`[ADMIN] Could not re-open dispute ${id} after a failed release: ${undoErr.message}`);
    };

    let payout = null;
    if (action === 'release') {
      try {
        // Cart orders carry seller_id = null and record each seller's payout on
        // the order_items line (line.payout) — handleDisputeCreated reversed
        // those line by line, so release must re-issue them line by line too.
        // Calling payoutSeller with the order-level columns here returned
        // { status: 'none' } and paid nobody while reporting success.
        const lines = Array.isArray(order.order_items) ? order.order_items : [];
        const reversedLines = lines.filter(l => l?.seller_id && l?.payout
          && ['transferred', 'wallet_credited'].includes(l.payout.status)
          && Number(l.payout.proceeds) > 0
          && l.payout.releasedForDispute !== id);
        if (reversedLines.length > 0) {
          payout = await releaseCartLinePayouts(order, lines, reversedLines, id);
        } else {
          payout = await payoutSeller(stripe, {
            sellerId: order.seller_id,
            sellerProceeds: order.seller_proceeds_aud,
            orderId: order.id,
            listingId: order.listing_id,
            idempotencyKey: `dispute-release-${id}`,
          });
        }
      } catch (payErr) {
        await unclaim();
        throw payErr;
      }
      if (payout?.status === 'failed' || Number(payout?.failed) > 0) {
        await unclaim();
        logger.error(`[ADMIN] ${req.user.id} release of dispute ${id} failed to pay out — dispute re-opened for retry`);
        return res.status(502).json({ error: 'The seller payout failed — the dispute is still open, try releasing it again', payout });
      }
    }

    logger.info(`[ADMIN] ${req.user.id} resolved dispute ${id} → ${newStatus}${payout ? ` (payout: ${payout.status})` : ''}`);
    res.json({ success: true, dispute: claimed, payout });
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

// ─── Affiliate product metadata scrape (admin-only) ───────────────────────────
// Convenience for the Shop Affiliate Products admin: paste an affiliate link and
// pre-fill the title / image / description from the destination page's Open
// Graph tags, so the admin doesn't retype everything by hand.
//
// This is a best-effort helper, NOT a guaranteed data source: Amazon (and
// others) frequently block automated fetches from datacenter IPs, in which case
// this returns 502 and the admin fills the fields manually. Prices are
// deliberately NOT scraped — Amazon's Associates terms restrict displaying
// non-API prices, and scraped prices go stale.
//
// TODO(affiliate): once the Associate account has 3 confirmed qualifying sales,
// replace this OG scrape with the official Amazon Product Advertising API
// (PA-API 5.0) — it returns title/image/description AND live, compliant pricing.
// See the PR that introduced this ("Option B") and docs on PA-API access.
//
// SSRF is contained by an allow-list of affiliate hosts: the endpoint will only
// fetch well-known retail domains, never arbitrary or internal URLs.
const AFFILIATE_HOST_SUFFIXES = [
  'amazon.com', 'amazon.com.au', 'amazon.co.uk', 'amazon.ca', 'amazon.de',
  'amazon.co.jp', 'amazon.in', 'amazon.fr', 'amazon.it', 'amazon.es',
  // Short links: amzn.to / a.co, and link.amazon — the format SiteStripe's
  // "Get link" hands out now. Without it every current Associates link was
  // refused and products were saved with no image.
  'amzn.to', 'amzn.com', 'a.co', 'link.amazon',
];

// Beyond the explicit list, accept any host on Amazon's own domains: every
// amazon.<cc> / amazon.co.<cc> / amazon.com.<cc> storefront, the .amazon brand
// TLD, and amzn.<tld>. Short links bounce through intermediate Amazon hosts
// (regional storefronts, redirect services) that an exact list keeps missing.
const AMAZON_OWNED_HOST = /(?:^|\.)(?:amazon(?:\.(?:com|(?:com?\.)?[a-z]{2}))?|amzn\.[a-z]{2,3})$/;

const isAllowedAffiliateHost = (hostname) => {
  const host = String(hostname || '').toLowerCase();
  return AFFILIATE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
    || AMAZON_OWNED_HOST.test(host);
};

// Pull the content of the first matching <meta property/name="..."> tag.
const metaContent = (html, key) => {
  // property="og:title" content="..."  OR  content="..." property="og:title"
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
};

// Amazon product pages usually carry NO og:image, so fall back to the main
// product photo in the page markup: the landing image's data-old-hires /
// data-a-dynamic-image attributes, then the "hiRes"/"large" entries in the
// inline image-gallery JSON. Only https m.media-amazon.com-style image URLs
// are accepted so a stray match can't produce junk.
const AMAZON_IMAGE_URL = /^https:\/\/[a-z0-9.-]*(?:media-amazon\.com|ssl-images-amazon\.com|images-amazon\.com)\/images\//i;

const amazonProductImage = (html) => {
  const candidates = [];
  const oldHires = html.match(/data-old-hires=["'](https:[^"']+)["']/i);
  if (oldHires) candidates.push(oldHires[1]);
  const dynamic = html.match(/data-a-dynamic-image=["']\{\s*(?:&quot;|")(https:[^"&]+)/i);
  if (dynamic) candidates.push(dynamic[1]);
  const hiRes = html.match(/"hiRes"\s*:\s*"(https:[^"]+)"/i);
  if (hiRes) candidates.push(hiRes[1]);
  const large = html.match(/"large"\s*:\s*"(https:[^"]+)"/i);
  if (large) candidates.push(large[1]);
  return candidates.map((u) => u.replace(/\\\//g, '/')).find((u) => AMAZON_IMAGE_URL.test(u)) || null;
};

const decodeEntities = (str) =>
  String(str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .trim();

router.post('/affiliate-metadata', async (req, res) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'A valid URL is required.' });
  }
  if (parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only https:// links are supported.' });
  }
  if (!isAllowedAffiliateHost(parsed.hostname)) {
    return res.status(400).json({ error: `Only Amazon affiliate links can be auto-filled right now (got ${parsed.hostname}).` });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // Redirects are followed BY HAND so the allow-list and the private-address
    // check apply to every hop, not just the first. Two of the allow-listed
    // hosts (amzn.to, a.co) are URL shorteners whose whole job is to redirect,
    // and the previous `redirect: 'follow'` let the redirect target skip both
    // checks entirely — a redirect to http://169.254.169.254/ would have been
    // fetched. The SSRF-safe dispatcher additionally pins each DNS-resolved
    // hostname to the address it validated, closing the rebinding window.
    const MAX_HOPS = 5;
    let current = parsed;
    let upstream = null;

    for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
      if (current.protocol !== 'https:') {
        return res.status(400).json({ error: 'Only https:// links are supported.' });
      }
      if (!isAllowedAffiliateHost(current.hostname)) {
        // Name the host so an unexpected redirect target is diagnosable from the toast.
        return res.status(400).json({ error: `The link redirected to ${current.hostname}, which can't be auto-filled. Enter the details manually.` });
      }
      assertNotLiteralPrivateAddress(current.toString());

      const hopResponse = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        dispatcher: ssrfSafeDispatcher,
        headers: {
          // Look like a real browser — Amazon serves a bot page to obvious crawlers.
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
      });

      if ([301, 302, 303, 307, 308].includes(hopResponse.status)) {
        const location = hopResponse.headers.get('location');
        await hopResponse.body?.cancel().catch(() => {});
        if (!location) {
          return res.status(502).json({ error: 'The page could not be read. Enter the details manually.' });
        }
        current = new URL(location, current);
        continue;
      }

      upstream = hopResponse;
      break;
    }

    if (!upstream) {
      return res.status(502).json({ error: 'The page redirected too many times. Enter the details manually.' });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `The page could not be read (HTTP ${upstream.status}). Enter the details manually.` });
    }

    // Cap how much we read so a huge page can't exhaust memory (~512KB is plenty
    // for the <head> where OG tags live).
    const buf = await upstream.arrayBuffer();
    const html = Buffer.from(buf.slice(0, 512 * 1024)).toString('utf8');

    const title = decodeEntities(
      metaContent(html, 'og:title') ||
      metaContent(html, 'twitter:title') ||
      (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]) || ''
    );
    const image = decodeEntities(
      metaContent(html, 'og:image') ||
      metaContent(html, 'og:image:secure_url') ||
      metaContent(html, 'twitter:image') ||
      metaContent(html, 'twitter:image:src') ||
      amazonProductImage(html) || ''
    );
    const description = decodeEntities(
      metaContent(html, 'og:description') ||
      metaContent(html, 'twitter:description') ||
      metaContent(html, 'description') || ''
    );

    if (!title && !image && !description) {
      return res.status(502).json({ error: 'No product details found on the page. Enter them manually.' });
    }

    // Clean up Amazon's title suffixes like " : Amazon.com.au: ..." for a tidier default.
    const cleanTitle = title.replace(/\s*[:|-]\s*Amazon\.[a-z.]+.*$/i, '').trim() || title;

    return res.json({ title: cleanTitle, image, description });
  } catch (err) {
    logger.warn(`[ADMIN] affiliate-metadata fetch failed: ${err.message}`);
    return res.status(502).json({ error: 'Could not reach the page. Enter the details manually.' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
