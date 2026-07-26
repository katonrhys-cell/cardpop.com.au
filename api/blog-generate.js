import crypto from 'node:crypto';
import { runScheduledGeneration } from '../src/utils/blogArticleGenerator.js';
import logger from '../src/utils/logger.js';

// Dedicated serverless function for scheduled blog generation.
//
// This runs on its own because a single article takes minutes: the model
// thinks, drafts ~2,000 words, and may be asked to redraft once when the style
// guard rejects it. api/index.js caps at 40s, which is right for every other
// endpoint, so this gets its own (much longer) maxDuration in vercel.json
// instead of raising the ceiling for the whole API.
//
// Reached via the /cron/blog-generate rewrite — a path under /api would be
// swallowed by the "/api/:path*" → "/api/index" catch-all.

const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

export default async function handler(req, res) {
  // Fail-closed: without CRON_SECRET configured nobody can trigger a paid
  // model call, including Vercel Cron.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[BLOG_GEN] CRON_SECRET is not set — refusing to generate (fail-closed).');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const summary = await runScheduledGeneration();
    logger.info(`[BLOG_GEN] ${JSON.stringify(summary)}`);
    return res.status(200).json(summary);
  } catch (error) {
    logger.error(`[BLOG_GEN] ${error.message}`);
    return res.status(502).json({ error: 'Article generation failed.' });
  }
}
