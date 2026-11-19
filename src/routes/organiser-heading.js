import express from 'express';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import {
  readHeadingStyleFromLogo, LOGO_MEDIA_TYPES, MAX_LOGO_BASE64_CHARS,
} from '../utils/organiserHeadingReader.js';

// POST /organiser-heading/from-logo   { name, image: { media_type, data } }
// "Match heading to logo" in the organiser page editor (admins only): reads
// the lettering style off a logo so the page heading can be set to match.
// The logo arrives inline (downsized by the browser) and is never stored;
// nothing is saved here — docs/organiser-heading-style.md
const router = express.Router();

router.post('/from-logo', authMiddleware, requireAdmin, async (req, res) => {
  const name = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const mediaType = req.body?.image?.media_type;
  const base64 = req.body?.image?.data;
  if (!name) return res.status(400).json({ error: 'The organiser name is missing.' });
  if (!LOGO_MEDIA_TYPES.includes(mediaType) || typeof base64 !== 'string'
    || !base64 || base64.length > MAX_LOGO_BASE64_CHARS || !/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    return res.status(400).json({ error: 'Send the logo as a JPG, PNG, WebP or GIF image.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Logo reading isn’t set up on this server (ANTHROPIC_API_KEY).' });
  }
  try {
    res.json(await readHeadingStyleFromLogo({ name, mediaType, base64, userId: req.user?.id || null }));
  } catch (error) {
    logger.warn(`[ORGANISER_HEADING] from-logo failed: ${error.message}`);
    res.status(422).json({ error: `Couldn’t read that logo: ${error.message}` });
  }
});

export default router;
