import express from 'express';
import { verifyGradingNumber, getCachedVerification } from '../services/gradingVerificationService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /grading-verification/verify
 * Verify a grading number against PSA or Beckett
 *
 * Body:
 *   gradingNumber (required) — the grading cert number to verify
 *   company       (optional) — 'psa' or 'beckett', defaults to 'psa'
 *
 * Response:
 *   {
 *     verified: boolean,
 *     company: 'psa' | 'beckett',
 *     details: object | null,
 *     cached: boolean,
 *     cachedAt?: ISO string
 *   }
 */
router.post('/verify', async (req, res) => {
  const { gradingNumber, company = 'psa', expectedGrade = null } = req.body;

  if (!gradingNumber || typeof gradingNumber !== 'string' || !gradingNumber.trim()) {
    logger.warn('[GRADING_VERIFICATION] Missing or invalid gradingNumber');
    return res.status(400).json({
      error: 'gradingNumber is required and must be a non-empty string'
    });
  }

  if (company !== 'psa' && company !== 'beckett') {
    logger.warn(`[GRADING_VERIFICATION] Invalid company: ${company}`);
    return res.status(400).json({
      error: 'company must be either "psa" or "beckett"'
    });
  }

  // expectedGrade lets us check the SELLER'S CLAIMED grade against the real cert,
  // not just that the cert exists. Optional, but it's how we catch inflated grades.
  if (expectedGrade != null && typeof expectedGrade !== 'string') {
    return res.status(400).json({ error: 'expectedGrade must be a string' });
  }

  try {
    logger.info(`[GRADING_VERIFICATION] Verifying ${gradingNumber} with ${company}`);
    const result = await verifyGradingNumber({ gradingNumber, company, expectedGrade });
    res.json(result);
  } catch (error) {
    logger.error(`[GRADING_VERIFICATION] Verification error: ${error.message}`);
    // A company we don't support yet is a capability gap, not an outage.
    if (/not yet implemented/i.test(error.message)) {
      return res.status(501).json({ error: error.message });
    }
    // Any other throw means the live lookup failed and we had no cached result
    // to fall back on — an upstream-availability problem, not a bad request.
    // Return 503 (and a generic message; the real error is logged server-side).
    res.status(503).json({
      error: 'Unable to reach the verification service right now. Please try again shortly.'
    });
  }
});

/**
 * GET /grading-verification/:gradingNumber
 * Get cached verification result for a grading number
 *
 * Query params:
 *   company (optional) — 'psa' or 'beckett', defaults to 'psa'
 *
 * Response:
 *   {
 *     verified: boolean,
 *     company: string,
 *     details: object | null,
 *     verified_at: ISO string,
 *     expires_at: ISO string | null
 *   }
 *   OR 404 if not cached
 */
router.get('/:gradingNumber', async (req, res) => {
  const { gradingNumber } = req.params;
  const { company = 'psa' } = req.query;

  if (!gradingNumber || !gradingNumber.trim()) {
    return res.status(400).json({
      error: 'gradingNumber parameter is required'
    });
  }

  if (company !== 'psa' && company !== 'beckett') {
    return res.status(400).json({
      error: 'company must be either "psa" or "beckett"'
    });
  }

  try {
    logger.info(`[GRADING_VERIFICATION] Fetching cached result for ${gradingNumber}`);
    // Cache-only read — this endpoint must not trigger a live external API call.
    const result = await getCachedVerification({ gradingNumber, company });

    if (!result) {
      return res.status(404).json({ error: 'No cached verification found' });
    }

    res.json({
      verified: result.verified,
      company: result.company,
      details: result.details,
      verified_at: result.cachedAt
    });
  } catch (error) {
    logger.error(`[GRADING_VERIFICATION] Fetch error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
