import crypto from 'node:crypto';
import { runEventScan } from '../src/utils/eventScanner.js';
import supabase from '../src/utils/supabaseClient.js';
import logger from '../src/utils/logger.js';

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

// A manual run started within this window blocks another one. Two concurrent
// scans would double-spend on the model and race each other to insert the same
// draft, and an impatient double-click is the likeliest way to cause it.
const CONCURRENT_RUN_WINDOW_MS = 10 * 60 * 1000;

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
    if (user.app_metadata?.is_admin === true) return user.id;
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    return data?.is_admin === true ? user.id : null;
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
