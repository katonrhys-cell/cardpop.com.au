import logger from '../utils/logger.js';
import express from 'express';

const router = express.Router();

const KIT_API_BASE = 'https://api.kit.com/v4';

router.post('/subscribe', async (req, res) => {
  const { email, firstName } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    return res.status(503).json({ error: 'Newsletter service is not configured.' });
  }

  try {
    const response = await fetch(`${KIT_API_BASE}/forms/${formId}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email_address: email.trim().toLowerCase(),
        ...(firstName?.trim() && { first_name: firstName.trim() }),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body?.errors?.[0]?.message || body?.message || 'Subscription failed.';
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('[newsletter] subscribe error:', err);
    return res.status(500).json({ error: 'Failed to connect to newsletter service.' });
  }
});

export default router;
