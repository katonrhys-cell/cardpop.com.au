import express from 'express';
import logger from '../utils/logger.js';
import { parseSignedRequest } from '../utils/facebookSignedRequest.js';
import {
  handleFacebookDeletionRequest,
  getDeletionRequestStatus,
} from '../services/dataDeletionService.js';

const router = express.Router();

/**
 * Facebook Data Deletion Request callback.
 *
 * Configured as the "Data Deletion Request URL" in the Meta App Dashboard.
 * Facebook POSTs `signed_request` (application/x-www-form-urlencoded) when a
 * user removes the app and requests deletion of their data. We verify the
 * signature, initiate deletion, and return the JSON Meta requires:
 *
 *   { url: '<status url>', confirmation_code: '<code>' }
 *
 * The `url` lets the user check the status of their request (our public
 * /data-deletion page) and `confirmation_code` identifies it.
 */
router.post('/facebook', async (req, res) => {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const signedRequest = req.body?.signed_request;

  const data = parseSignedRequest(signedRequest, appSecret);
  if (!data) {
    // Invalid/unverifiable request — do not initiate any deletion.
    return res.status(400).json({ error: 'Invalid signed_request' });
  }

  try {
    const { confirmationCode, statusUrl } = await handleFacebookDeletionRequest(data.user_id);
    // Exact response shape required by Meta.
    return res.status(200).json({ url: statusUrl, confirmation_code: confirmationCode });
  } catch (err) {
    logger.error('[data-deletion] Callback handler error', err);
    return res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

/**
 * Public status lookup for the /data-deletion page. Given a confirmation code,
 * returns a small, non-sensitive summary of the request's progress.
 */
router.get('/status/:code', async (req, res) => {
  const status = await getDeletionRequestStatus(req.params.code);
  if (!status) {
    return res.status(404).json({ error: 'No deletion request found for that confirmation code.' });
  }
  return res.status(200).json(status);
});

export default router;
