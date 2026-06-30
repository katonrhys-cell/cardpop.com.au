import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import stripe from '../utils/stripeClient.js';
import { payoutSeller } from '../services/payoutService.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { validateRequestBody, validateRequestParams, validateRequestQuery } from '../middleware/validateRequest.js';
import { setUserRoleSchema, setUserRoleBodySchema, reviewVerificationSchema, reviewVerificationBodySchema, processRefundSchema, processRefundBodySchema, getDisputesSchema, resolveDisputeSchema, resolveDisputeBodySchema } from '../schemas/adminSchemas.js';
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

const round2 = (n) => Math.round(n * 100) / 100;

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
    }).catch(() => {});

    logger.info(`[ADMIN] ${req.user.id} set is_admin=${is_admin} for ${userId}`);
    res.json({ success: true, user: data });
  } catch (err) {
    logger.error(`[ADMIN] Failed to update admin flag: ${err.message}`);
    res.status(500).json({ error: 'Failed to update admin status' });
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
    }).catch(() => {});

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
      .from('refunds').select('*').eq('id', id).single();
    if (fetchErr || !refund) return res.status(404).json({ error: 'Refund not found' });

    if (action === 'reject') {
      const { error } = await supabase.from('refunds')
        .update({ status: 'rejected', rejection_reason, admin_notes: admin_notes || null })
        .eq('id', id);
      if (error) throw error;
      await supabase.from('orders').update({ refund_status: 'rejected' }).eq('id', refund.order_id);
      await supabase.from('notifications').insert({
        user_id: refund.buyer_id, type: 'refund_rejected', title: 'Refund Request Declined',
        body: `Your refund request was not approved. Reason: ${rejection_reason}`,
      }).catch(() => {});
      logger.info(`[ADMIN] ${req.user.id} rejected refund ${id}`);
      return res.json({ success: true, status: 'rejected' });
    }

    // Approve — compute the refundable amount server-side (never trust the client).
    const totalFee = (refund.commission_aud || 0) + (refund.gst_aud || 0);
    const retainedFee = round2(totalFee * 0.5);
    const refundAmount = round2((refund.total_paid_aud || 0) - retainedFee);

    const { error } = await supabase.from('refunds')
      .update({ status: 'approved', admin_notes: admin_notes || null })
      .eq('id', id);
    if (error) throw error;
    await supabase.from('orders').update({ refund_status: 'approved' }).eq('id', refund.order_id);
    await supabase.from('notifications').insert({
      user_id: refund.buyer_id, type: 'refund_approved', title: 'Refund Approved',
      body: `Your refund of $${refundAmount.toFixed(2)} AUD has been approved and will be processed shortly.`,
    }).catch(() => {});

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

export default router;
