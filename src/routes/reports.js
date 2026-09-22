import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { reportLimiter } from '../middleware/endpoint-rate-limit.js';
import logger from '../utils/logger.js';

// User-facing content reporting — the missing "report a scam/counterfeit/abuse"
// primitive every marketplace needs. Reports are written with the service-role
// client (so the schema's RLS doesn't have to expose the table for client
// inserts), the reporter is always derived from the auth token, and submission
// is rate-limited + de-duplicated to blunt brigading. Admin endpoints let
// moderators triage the queue.
const router = Router();

// What can be reported and why. Keep these allowlists in sync with the DB
// CHECK constraints in the content_reports migration.
const TARGET_TYPES = ['listing', 'user', 'review', 'message', 'event'];
const REASONS = [
  'counterfeit',       // fake / not authentic
  'scam',              // fraudulent seller / non-delivery risk
  'prohibited_item',   // against policy
  'misrepresentation', // condition/grade not as described
  'inappropriate',     // offensive / abusive content
  'spam',
  'other',
];
const STATUSES = ['open', 'reviewing', 'actioned', 'dismissed'];
const MAX_DETAILS = 2000;

// ─── Submit a report (authenticated users) ────────────────────────────────────
router.post('/', authMiddleware, reportLimiter, async (req, res) => {
  const { target_type, target_id, reason, details } = req.body || {};
  const reporter_id = req.user.id; // never trust a client-supplied reporter

  if (!TARGET_TYPES.includes(target_type)) {
    return res.status(400).json({ error: 'A valid target_type is required' });
  }
  if (!target_id || typeof target_id !== 'string') {
    return res.status(400).json({ error: 'target_id is required' });
  }
  if (!REASONS.includes(reason)) {
    return res.status(400).json({ error: 'A valid reason is required' });
  }
  if (details != null && (typeof details !== 'string' || details.length > MAX_DETAILS)) {
    return res.status(400).json({ error: `details must be a string under ${MAX_DETAILS} characters` });
  }
  // You can't report yourself.
  if (target_type === 'user' && target_id === reporter_id) {
    return res.status(400).json({ error: 'You cannot report yourself' });
  }

  try {
    // De-dupe: one open report per reporter per target. Prevents a single user
    // inflating the signal by re-reporting the same thing.
    const { data: existing } = await supabase
      .from('content_reports')
      .select('id')
      .eq('reporter_id', reporter_id)
      .eq('target_type', target_type)
      .eq('target_id', target_id)
      .eq('status', 'open')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'You have already reported this. Our team is reviewing it.' });
    }

    const { data, error } = await supabase
      .from('content_reports')
      .insert({
        reporter_id,
        target_type,
        target_id,
        reason,
        details: details?.trim() || null,
        status: 'open',
      })
      .select('id, status, created_at')
      .single();
    if (error) throw error;

    logger.info(`[REPORT] ${reporter_id} reported ${target_type}:${target_id} (${reason})`);

    // Fraud signal: if enough DISTINCT users independently report the same
    // target, escalate to admins. Reports are de-duped per reporter, so the open
    // count == distinct reporters — a real signal, not one person brigading.
    // We deliberately don't auto-hide the target (that itself would be a
    // brigading takedown vector); we just alert moderators.
    await maybeEscalate(target_type, target_id).catch((e) =>
      logger.warn(`[REPORT] escalation check failed: ${e.message}`),
    );

    res.status(201).json({ success: true, report: data });
  } catch (err) {
    logger.error(`[REPORT] Failed to file report: ${err.message}`);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Number of distinct open reports that escalates a target to admins.
const ESCALATION_THRESHOLD = 3;

async function maybeEscalate(target_type, target_id) {
  const { data: open } = await supabase
    .from('content_reports')
    .select('id')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .eq('status', 'open');

  const count = open?.length || 0;
  // Fire exactly once, on the report that crosses the threshold.
  if (count !== ESCALATION_THRESHOLD) return;

  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true);

  if (!admins?.length) return;

  const notifications = admins.map((a) => ({
    user_id: a.id,
    type: 'report_escalation',
    title: 'Content flagged by multiple users',
    body: `A ${target_type} has reached ${count} independent reports and needs review.`,
  }));
  await supabase.from('notifications').insert(notifications).then(() => {}, () => {});
  logger.warn(`[REPORT] Escalated ${target_type}:${target_id} — ${count} distinct reports`);
}

// ─── Admin: list the moderation queue ─────────────────────────────────────────
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  const { status } = req.query;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  try {
    let query = supabase
      .from('content_reports')
      .select('*, reporter:profiles!reporter_id(id, display_name, username)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (err) {
    logger.error(`[REPORT] Failed to list reports: ${err.message}`);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

// ─── Admin: triage a report ───────────────────────────────────────────────────
router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { id } = req.params;
  const { status, resolution_notes } = req.body || {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'A valid status is required' });
  }

  try {
    const isResolved = status === 'actioned' || status === 'dismissed';
    const { data, error } = await supabase
      .from('content_reports')
      .update({
        status,
        resolution_notes: resolution_notes?.trim() || null,
        reviewed_by: req.user.id,
        reviewed_at: isResolved ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Report not found' });

    logger.info(`[REPORT] ${req.user.id} set report ${id} → ${status}`);
    res.json({ success: true, report: data });
  } catch (err) {
    logger.error(`[REPORT] Failed to update report: ${err.message}`);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
