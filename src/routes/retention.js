import { Router } from 'express';
import crypto from 'node:crypto';
import { runRetentionSweep } from '../services/retentionSweepService.js';
import logger from '../utils/logger.js';

const router = Router();

const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};
// Fail-closed like every other cron entrypoint: no CRON_SECRET, no run.
const isAuthorisedCronCall = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) { logger.warn('[RETENTION] CRON_SECRET is not set — refusing /sweep (fail-closed).'); return false; }
  return timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`);
};

/**
 * GET /retention/sweep
 * Daily cron (.github/workflows/cron-daily.yml): abandoned-checkout
 * reminders, watchlist price-drop / sold alerts, saved-search digests,
 * back-in-stock emails, welcome codes for accounts the signup page didn't
 * issue, and welcome-code expiry reminders. See docs/retention.md.
 */
router.get('/sweep', async (req, res) => {
  if (!isAuthorisedCronCall(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    res.json(await runRetentionSweep());
  } catch (err) {
    logger.error(`[RETENTION] sweep failed: ${err.message}`);
    res.status(500).json({ error: 'Retention sweep failed' });
  }
});

export default router;
