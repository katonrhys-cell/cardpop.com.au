import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
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
router.patch('/users/:userId/role', async (req, res) => {
  const { userId } = req.params;
  const { is_admin } = req.body;

  if (typeof is_admin !== 'boolean') {
    return res.status(400).json({ error: 'is_admin (boolean) is required' });
  }
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
router.patch('/verifications/:id', async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes, additional_info_requested, info_request } = req.body;

  const validStatuses = ['approved', 'rejected', 'suspended', 'revoked', 'info_requested'];
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
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'A valid status is required' });
    }
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
router.patch('/refunds/:id', async (req, res) => {
  const { id } = req.params;
  const { action, admin_notes, rejection_reason } = req.body;

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  }
  if (action === 'reject' && !rejection_reason?.trim()) {
    return res.status(400).json({ error: 'A rejection reason is required' });
  }

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

export default router;
