// Sentry (errors + agent tracing) before anything else — see src/instrument.js.
import '../src/instrument.js';
import crypto from 'node:crypto';
import { runScheduledGeneration } from '../src/utils/blogArticleGenerator.js';
import { publishDueArticles } from '../src/utils/blogScheduledPublish.js';
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

  // Scheduled drafts go live first, on their own: an article an admin has
  // approved and dated must not wait on the model, the API key or the draft
  // cap. A failure here is reported (non-200, so the scheduler emails the
  // admin address) but never stops tonight's generation.
  let scheduled = { published: [], failed: 0 };
  let scheduleError = null;
  try {
    scheduled = await publishDueArticles();
  } catch (error) {
    scheduleError = error.message;
    logger.error(`[BLOG_SCHEDULE] ${error.message}`);
  }
  const scheduledSummary = {
    published: scheduled.published.map((a) => a.slug),
    failed: scheduled.failed,
    ...(scheduleError ? { error: scheduleError } : {}),
  };
  const scheduleFailed = Boolean(scheduleError) || scheduled.failed > 0;

  try {
    const summary = { ...(await runScheduledGeneration()), scheduled: scheduledSummary };
    logger.info(`[BLOG_GEN] ${JSON.stringify(summary)}`);
    return res.status(scheduleFailed ? 502 : 200).json(summary);
  } catch (error) {
    logger.error(`[BLOG_GEN] ${error.message}`);
    return res.status(502).json({ error: 'Article generation failed.', scheduled: scheduledSummary });
  }
}
