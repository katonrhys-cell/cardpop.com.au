import crypto from 'node:crypto';
import { runEventScan } from '../src/utils/eventScanner.js';
import { runDueEventSourceScans, scanEventSource } from '../src/utils/eventSourceWatcher.js';
import supabase from '../src/utils/supabaseClient.js';
import logger from '../src/utils/logger.js';
import { decodeAal } from '../src/middleware/requireAal2.js';

// Dedicated serverless function for the nightly event scan.
//
// This runs on its own for the same reason blog generation does: a run makes a
// web-search call plus up to eight page fetches and extractions, which is
// minutes, and api/index.js caps at 40s. That 40s is right for every other
// endpoint, so this gets its own maxDuration in vercel.json instead of raising
// the ceiling for the whole API.
//
// Reached via the /cron/event-scan rewrite — a path under /api would be
// swallowed by the "/api/:path*" → "/api/index" catch-all.
//
// Two callers, two credentials:
//   • Vercel Cron sends `Bearer <CRON_SECRET>` nightly.
//   • The admin panel's "Run scan now" button sends the signed-in admin's
//     Supabase access token. It calls this path directly rather than going
//     through /hcgi/api so the request gets the 300s budget — proxying it
//     through the 40s API function would time out mid-run.
//
// Two jobs, picked by query string:
//   • (none)                      — the weekly discovery scan.
//   • ?mode=watches               — the daily re-scan of every event website
//                                   that has come due (docs/event-scanning.md).
//   • ?mode=watches&event=<uuid>  — re-scan one event's website now; what the
//                                   admin event form calls straight after a
//                                   website is added, and its "Scan now".

// A manual run started within this window blocks another one. Two concurrent
// scans would double-spend on the model and race each other to insert the same
// draft, and an impatient double-click is the likeliest way to cause it.
const CONCURRENT_RUN_WINDOW_MS = 10 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const timingSafeEqualStr = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

/** Resolve the caller to an admin profile id, or null if they aren't one. */
async function resolveAdmin(token) {
  if (!token) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    let isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      isAdmin = data?.is_admin === true;
    }
    if (!isAdmin) return null;
    // Same MFA step-up as requireAal2 in the Express app: an admin who enrolled
    // MFA must present an AAL2 token, otherwise a password alone could start a
    // paid model run. Fails closed if factor status can't be read.
    if (decodeAal(token) !== 'aal2') {
      const { data: mfa, error: mfaError } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
      if (mfaError) return null;
      if ((mfa?.factors ?? []).some((f) => f.status === 'verified')) return null;
    }
    return user.id;
  } catch {
    return null;
  }
}

async function hasRunInFlight() {
  const since = new Date(Date.now() - CONCURRENT_RUN_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('event_scan_runs')
    .select('id')
    .eq('status', 'running')
    .gte('started_at', since)
    .limit(1);
  return Boolean(data?.length);
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  // Fail-closed: without CRON_SECRET configured the scheduled job refuses to
  // run rather than being publicly triggerable. An admin can still start one
  // by hand — that path authenticates the person, not the secret.
  const secret = process.env.CRON_SECRET;
  const isCron = Boolean(secret) && timingSafeEqualStr(authHeader, `Bearer ${secret}`);

  let trigger = 'cron';
  let triggeredBy = null;

  if (!isCron) {
    const adminId = await resolveAdmin(token);
    if (!adminId) {
      if (!secret) logger.warn('[EVENT_SCAN] CRON_SECRET is not set — scheduled scans are disabled (fail-closed).');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    trigger = 'manual';
    triggeredBy = adminId;
  }

  const query = req.query || {};
  if (query.mode === 'watches') {
    try {
      if (query.event) {
        if (!UUID_RE.test(String(query.event))) {
          return res.status(400).json({ error: 'event must be an event id.' });
        }
        // Scan-on-save and "Scan now" want a real answer, so skip the
        // unchanged-page shortcut; the per-watch lock still stops a double scan.
        const result = await scanEventSource(String(query.event), { force: trigger === 'manual' });
        logger.info(`[EVENT_WATCH] ${JSON.stringify(result)}`);
        const code = result.status === 'busy' ? 409 : result.status === 'missing' ? 404 : 200;
        return res.status(code).json(result);
      }
      const summary = await runDueEventSourceScans();
      logger.info(`[EVENT_WATCH] ${JSON.stringify({ ...summary, results: undefined })}`);
      return res.status(200).json(summary);
    } catch (error) {
      logger.error(`[EVENT_WATCH] ${error.message}`);
      return res.status(502).json({ error: 'Event website re-scan failed.' });
    }
  }

  if (trigger === 'manual') {
    if (await hasRunInFlight()) {
      return res.status(409).json({ error: 'A scan is already running. Wait for it to finish before starting another.' });
    }
  }

  try {
    const summary = await runEventScan({ trigger, triggeredBy });
    logger.info(`[EVENT_SCAN] ${JSON.stringify(summary)}`);
    return res.status(200).json(summary);
  } catch (error) {
    logger.error(`[EVENT_SCAN] ${error.message}`);
    return res.status(502).json({ error: 'Event scan failed.' });
  }
}
