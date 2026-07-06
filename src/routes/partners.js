import express from 'express';
import stripe from '../utils/stripeClient.js';
import logger from '../utils/logger.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import {
  submitPartnerApplication,
  getPartnerDashboard,
  recordPartnerClick,
  payoutPartner,
} from '../services/partnerService.js';

const router = express.Router();

/**
 * POST /partners/apply
 * Authenticated partner application ("Apply as Partner" form). Lands as
 * status=pending; approved from the admin dashboard, where the code and
 * per-partner rates are set.
 */
router.post('/apply', authMiddleware, async (req, res) => {
  // Honeypot: the form renders an invisible "company" field humans never fill.
  if (req.body?.company) return res.json({ ok: true });
  try {
    const result = await submitPartnerApplication(req.user.id, req.body || {});
    res.json({ ok: true, status: result.status, duplicate: !!result.duplicate });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[PARTNER] /apply error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

/**
 * GET /partners/me
 * The caller's application/partner record plus dashboard stats and ledger.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const dashboard = await getPartnerDashboard(req.user.id);
    res.json(dashboard || { partner: null });
  } catch (err) {
    logger.error(`[PARTNER] /me error: ${err.message}`);
    res.status(500).json({ error: 'Could not load your partner details' });
  }
});

/**
 * POST /partners/click
 * Public ?ref=CODE click tracking. Always responds ok — an invalid code is
 * not the visitor's problem, and the response must not leak code validity.
 */
router.post('/click', async (req, res) => {
  recordPartnerClick(req.body?.code).catch(() => {});
  res.json({ ok: true });
});

/**
 * POST /partners/admin/payout
 * Admin-only: sweep a partner's pending commission into a Stripe Connect
 * transfer to their connected account.
 */
router.post('/admin/payout', authMiddleware, async (req, res) => {
  try {
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { partnerId } = req.body || {};
    if (!partnerId) return res.status(400).json({ error: 'partnerId is required' });
    const result = await payoutPartner(stripe, partnerId);
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 500) logger.error(`[PARTNER] /admin/payout error: ${err.message}`);
    res.status(code).json({ error: err.message });
  }
});

export default router;
