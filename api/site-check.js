// Sentry before anything else — see src/instrument.js.
import '../src/instrument.js';
import crypto from 'node:crypto';
import { runSiteCheck } from '../src/utils/siteCheck.js';
import logger from '../src/utils/logger.js';

// Daily site check (src/utils/siteCheck.js): the sitemap, a sample of the
// pages it lists as crawlers are served them, and the Product markup on the
// sampled product pages — all in process, so Cloudflare's bot protection is
// never in the way. Its own function because it loads the prerenderer and
// renders ~90 pages; reached via the /cron/site-check rewrite (a path under
// /api would be swallowed by the "/api/:path*" → "/api/index" catch-all).
//
// 200 = clean. 502 = problems found, listed first in the body so the
// scheduler's alert email (which quotes the start of the response) shows them.

const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

const clampSample = (value, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 50 ? n : fallback;
};

export default async function handler(req, res) {
  // Fail closed: it is not secret, but it renders a lot of pages per call.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[SITE_CHECK] CRON_SECRET is not set — refusing to run (fail-closed).');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!timingSafeEqualStr(req.headers.authorization || '', `Bearer ${secret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const report = await runSiteCheck({
      sample: clampSample(req.query?.sample, undefined),
      productSample: clampSample(req.query?.productSample, undefined),
    });
    const body = {
      ok: report.ok,
      problems: report.problems.slice(0, 50),
      problemCount: report.problems.length,
      urls: report.urls,
      pages: report.pages,
      products: report.products,
    };
    if (report.ok) logger.info(`[SITE_CHECK] ${JSON.stringify(body)}`);
    else logger.error(`[SITE_CHECK] ${JSON.stringify(body)}`);
    return res.status(report.ok ? 200 : 502).json(body);
  } catch (error) {
    logger.error(`[SITE_CHECK] ${error.message}`);
    return res.status(502).json({ ok: false, problems: [`The site check itself failed: ${error.message}`] });
  }
}
