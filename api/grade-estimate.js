import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import gradeEstimatorRouter from '../src/routes/grade-estimator.js';
import { errorMiddleware } from '../src/middleware/error.js';
import { noCacheHeaders } from '../src/middleware/secureHeaders.js';
import { isCloudflareIp } from '../src/utils/cloudflareIps.js';

// Dedicated serverless function for the grade estimator.
//
// This runs on its own for the same reason the event scan and blog
// generation do: one estimate is a Sonnet vision call that reads two photos
// and writes six graders' worth of JSON, which is regularly 30–60 s, and
// api/index.js caps at 40 s. That 40 s is right for every other endpoint, so
// this gets its own maxDuration in vercel.json instead of raising the ceiling
// for the whole API. Before this every estimate died on the clock and the
// page read "That estimate took too long".
//
// Reached via the /grade-estimate/:path* rewrite — a path under /api would be
// swallowed by the "/api/:path*" → "/api/index" catch-all. The browser calls
// it directly (hooks/useGradeEstimator.js) rather than through /hcgi/api, so
// the request gets this function's budget. Vercel hands the function the
// original request path, so the router is mounted under each spelling.
//
// The same router (src/routes/grade-estimator.js) carries its own auth, the
// shared AI rate limit and the upload guard; this file only hosts it.

const app = express();
app.disable('x-powered-by');

// Same proxy trust as src/app.js, so req.ip is the real visitor for the
// IP-keyed fallback of the rate limiter — see the note there.
const trustProxyHops = (() => {
  const parsed = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
  return Number.isNaN(parsed) ? 1 : parsed;
})();
app.set('trust proxy', (addr, hop) => hop < trustProxyHops || isCloudflareIp(addr));

for (const prefix of ['/grade-estimate', '/api/grade-estimate', '/']) {
  app.use(prefix, noCacheHeaders, gradeEstimatorRouter);
}

// Upload-guard rejections (wrong type, too big) are 4xx, not 500s.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Each photo must be 10 MB or smaller.' });
  if (err?.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (/invalid file type/i.test(err?.message || '')) return res.status(400).json({ error: err.message });
  next(err);
});
app.use(errorMiddleware);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

export default app;
