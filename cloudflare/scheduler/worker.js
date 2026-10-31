// Cloudflare Worker: CardPop's scheduler.
//
// Fires every recurring backend job on a Cron Trigger and calls the matching
// production endpoint with the CRON_SECRET bearer. This replaced the
// `.github/workflows/cron-*.yml` schedules on 2026-10-31: this repository is
// private, so every GitHub Actions run billed a whole metered minute however
// briefly it ran, and the four schedules alone cost ~425–485 minutes a month
// of the 2,000-minute allowance for a few seconds of real work each. Cron
// Triggers are free on the Workers plan and bill nothing per run.
//
// This file is the source of truth. Deploy it with
//   npx wrangler deploy --config cloudflare/scheduler/wrangler.toml
// (the Cron Triggers come from that wrangler.toml), or paste it into the
// dashboard and add the same four triggers by hand — see docs/scheduled-jobs.md.
//
// What runs when (all times UTC — Cron Triggers do not shift for daylight
// saving): see SCHEDULES below. Each schedule is keyed by its cron expression,
// which is what the runtime hands `scheduled()` (`controller.cron`), so the
// expressions configured on the Worker must match the ones here exactly.
//
// Every endpoint fails closed (it refuses to run without the secret on the
// server side), so this Worker is not a privilege boundary: without the
// secret nothing runs. It also never fulfils anything itself — each endpoint
// is idempotent or self-deduplicating (every send, snapshot or check is
// stamped in the database), which is why retries and overlapping runs are
// harmless for the jobs that allow them.
//
// Bindings (wrangler.toml / dashboard → Settings):
//   CRON_SECRET     secret, required — exactly the Vercel `CRON_SECRET` value.
//   BASE_URL        var, optional — origin to call; unset = production.
//   ALERT_EMAIL     var, optional — where failure alerts go.
//   RESEND_API_KEY  secret, optional — with ALERT_EMAIL, failures are emailed
//                   through Resend (the same provider as the app's own mail).
//   ALERT_FROM      var, optional — sender; default "CardPop Scheduler
//                   <noreply@cardpop.com.au>" (must be on the verified domain).
//   STATE           KV namespace, optional — de-duplicates alerts so a job
//                   failing on every tick emails once per ALERT_SUPPRESS_SECONDS
//                   rather than every run. Without it every failing run emails.

export const DEFAULT_BASE_URL = 'https://cardpop.com.au';
export const USER_AGENT = 'CardPop-Scheduler/1.0 (+https://github.com/katonrhys-cell/cardpop.com.au)';

// Pause between attempts of a retryable job. Short, because a Cron Trigger
// invocation has a 15-minute wall-clock ceiling and the daily run holds a
// 300 s function.
export const RETRY_DELAY_MS = 10_000;

// How long one failure alert silences the next for the same schedule when a
// STATE KV namespace is bound.
export const ALERT_SUPPRESS_SECONDS = 12 * 60 * 60;

// Bytes of a response body kept in the run report (and so in the logs).
const BODY_EXCERPT_BYTES = 1024;

// Every endpoint the scheduler knows how to call. `maxSeconds` is the
// per-attempt timeout and should exceed the function's `maxDuration` in
// vercel.json (40 s on api/index.js, 300 s on the standalone functions).
// `attempts` stays at 1 for anything that spends money on a model call — a
// retry can double-spend on a run that succeeded but answered slowly.
export const JOBS = Object.freeze({
  // ── Daily maintenance ────────────────────────────────────────────────────
  // GA4 visitor counts → site_traffic_daily / site_traffic_summary
  // (docs/site-traffic.md). Idempotent upserts.
  site_traffic: { endpoint: '/api/site-traffic/sync', maxSeconds: 50, attempts: 2 },
  // Daily card price snapshots. Keyed per card per day, so a re-run is a no-op.
  prices: { endpoint: '/api/prices/refresh', maxSeconds: 50, attempts: 2 },
  // Weekly re-scan of each event's "Website to scrape" (docs/event-scanning.md).
  // Its own 300 s function; may spend on a model call, so never retried — a
  // due watch left over is simply picked up tomorrow.
  event_watch: { endpoint: '/cron/event-scan?mode=watches', maxSeconds: 330, attempts: 1 },
  // Supplier price watch (docs/supplier-price-watch.md). A product checked
  // once isn't due again for a week, so a retry only picks up the rest.
  supplier_watch: { endpoint: '/api/shop-supplier-watch/run', maxSeconds: 50, attempts: 2 },
  // Delivery sweep: carrier tracking or 10 days after posting → delivered
  // (docs/order-delivery.md). A delivered order is skipped on a retry.
  delivery_sweep: { endpoint: '/api/orders/delivery-sweep', maxSeconds: 50, attempts: 2 },
  // Retention emails (docs/retention.md). Every send is stamped in the DB,
  // so a retry can't repeat one.
  retention_sweep: { endpoint: '/api/retention/sweep', maxSeconds: 50, attempts: 2 },

  // ── Own schedules ────────────────────────────────────────────────────────
  // Asks Stripe whether a still-'pending' order was in fact paid. Read-only
  // against Stripe, and notifications dedupe on related_id, so a retry can't
  // double-report (src/services/pendingOrderAlertService.js).
  reconcile_pending: { endpoint: '/api/stripe/reconcile-pending', maxSeconds: 50, attempts: 2 },
  // Claims one blog topic and asks Claude for a draft (docs/blog-automation.md).
  // Never retried: a slow-but-successful generation would be billed twice and
  // leave two drafts in the queue.
  blog_generate: { endpoint: '/cron/blog-generate', maxSeconds: 330, attempts: 1 },
  // Weekly event discovery (docs/event-scanning.md). The endpoint refuses a
  // second run within 10 minutes of one starting, and each run spends on
  // search plus page extractions, so never retried.
  event_scan: { endpoint: '/cron/event-scan', maxSeconds: 330, attempts: 1 },
});

// One entry per Cron Trigger. The jobs of a schedule run concurrently: they
// are independent, and the daily run's worst case (two 50 s attempts on five
// endpoints plus one 330 s call) would not fit the 15-minute ceiling in series.
export const SCHEDULES = Object.freeze([
  {
    // Every 2 hours at :15 past. A stuck payment is caught within ~2 hours.
    cron: '15 */2 * * *',
    key: 'reconcile',
    name: 'Reconcile pending payments',
    jobs: ['reconcile_pending'],
  },
  {
    // 19:23 UTC = 05:23 AEST (06:23 AEDT): after GA4 has closed out the
    // previous AEST day, before the morning inboxes the retention sweep
    // writes to.
    cron: '23 19 * * *',
    key: 'daily',
    name: 'Daily maintenance',
    jobs: ['site_traffic', 'prices', 'event_watch', 'supplier_watch', 'delivery_sweep', 'retention_sweep'],
  },
  {
    // 21:07 UTC = 07:07 AEST.
    cron: '7 21 * * *',
    key: 'blog',
    name: 'Blog article generation',
    jobs: ['blog_generate'],
  },
  {
    // 17:07 UTC Sunday = 03:07 AEST Monday. Cloudflare names weekdays 1–7 or
    // SUN–SAT; it does not accept 0 for Sunday.
    cron: '7 17 * * SUN',
    key: 'event-scan',
    name: 'Event scan',
    jobs: ['event_scan'],
  },
]);

export const normaliseCron = (cron) => String(cron || '').trim().replace(/\s+/g, ' ');

export const scheduleForCron = (cron) => {
  const wanted = normaliseCron(cron);
  return SCHEDULES.find((s) => normaliseCron(s.cron) === wanted) || null;
};

export const scheduleForKey = (key) => SCHEDULES.find((s) => s.key === key) || null;

const baseUrl = (env) => String(env?.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

// Constant-time string comparison for the manual-run bearer.
export const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One authenticated GET with the job's retry policy. Never throws: the result
// describes what happened so a report can carry every job's outcome.
export async function callJob(jobName, env, deps = {}) {
  const job = JOBS[jobName];
  if (!job) return { job: jobName, ok: false, status: 0, attempts: 0, error: `Unknown job "${jobName}"` };
  const doFetch = deps.fetch || globalThis.fetch;
  const sleep = deps.sleep || defaultSleep;
  const retryDelayMs = deps.retryDelayMs ?? RETRY_DELAY_MS;
  const url = `${baseUrl(env)}${job.endpoint}`;

  if (!env?.CRON_SECRET) {
    return {
      job: jobName, endpoint: job.endpoint, ok: false, status: 0, attempts: 0,
      error: 'CRON_SECRET is not set on the Worker. Add it as a secret (wrangler secret put CRON_SECRET) with exactly the value Vercel holds.',
    };
  }

  let status = 0;
  let body = '';
  let error = null;
  for (let attempt = 1; attempt <= job.attempts; attempt += 1) {
    status = 0;
    body = '';
    error = null;
    const startedAt = Date.now();
    try {
      const res = await doFetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(job.maxSeconds * 1000),
      });
      status = res.status;
      body = (await res.text().catch(() => '')).slice(0, BODY_EXCERPT_BYTES);
    } catch (err) {
      error = err?.name === 'TimeoutError' ? `No response within ${job.maxSeconds}s` : (err?.message || String(err));
    }
    const ms = Date.now() - startedAt;

    if (status >= 200 && status < 300) {
      return { job: jobName, endpoint: job.endpoint, ok: true, status, attempts: attempt, ms, body };
    }
    // Retrying a rejected credential only repeats the rejection. A 403 with
    // an HTML body is Cloudflare's WAF/Bot Fight Mode challenging this Worker
    // rather than the endpoint rejecting the token — see docs/scheduled-jobs.md.
    if (status === 401 || status === 403) {
      return {
        job: jobName, endpoint: job.endpoint, ok: false, status, attempts: attempt, ms, body,
        error: `Rejected (HTTP ${status}). Check that the Worker's CRON_SECRET matches Vercel's, and that Cloudflare isn't challenging the Worker.`,
      };
    }
    if (attempt < job.attempts) await sleep(retryDelayMs);
  }
  return {
    job: jobName, endpoint: job.endpoint, ok: false, status, attempts: job.attempts, body,
    error: error || `Failed after ${job.attempts} attempt(s) — last status HTTP ${status}`,
  };
}

// Runs every job of a schedule concurrently and returns one report.
export async function runSchedule(schedule, env, deps = {}) {
  const startedAt = new Date();
  const results = await Promise.all(schedule.jobs.map((name) => callJob(name, env, deps)));
  const failed = results.filter((r) => !r.ok).map((r) => r.job);
  return {
    schedule: schedule.key,
    name: schedule.name,
    cron: schedule.cron,
    startedAt: startedAt.toISOString(),
    ms: Date.now() - startedAt.getTime(),
    ok: failed.length === 0,
    failed,
    results,
  };
}

const describeFailure = (report) => report.results
  .filter((r) => !r.ok)
  .map((r) => `• ${r.job} (${r.endpoint || '?'}): ${r.error || `HTTP ${r.status}`}${r.body ? `\n  ${r.body.replace(/\s+/g, ' ').slice(0, 300)}` : ''}`)
  .join('\n');

// Emails a failed report through Resend when ALERT_EMAIL + RESEND_API_KEY are
// configured. With a STATE KV binding, one alert per schedule silences the
// next ALERT_SUPPRESS_SECONDS so a job failing every tick doesn't flood the
// inbox; the Worker's own logs still record every run.
export async function sendFailureAlert(report, env, deps = {}) {
  if (!env?.ALERT_EMAIL || !env?.RESEND_API_KEY) return { sent: false, reason: 'alerts not configured' };
  const doFetch = deps.fetch || globalThis.fetch;
  const suppressKey = `alert:${report.schedule}`;
  if (env.STATE) {
    try {
      if (await env.STATE.get(suppressKey)) return { sent: false, reason: 'suppressed' };
    } catch { /* KV read failure must not block the alert */ }
  }
  const subject = `[CardPop] Scheduled job failing: ${report.name}`;
  const text = [
    `The "${report.name}" schedule (${report.cron} UTC) failed at ${report.startedAt}.`,
    'Until it passes again whatever it maintains (price snapshots, retention emails, stuck-payment checks, blog drafts, event discovery) is not running.',
    '',
    describeFailure(report),
    '',
    'Most likely causes, in order:',
    '1. HTTP 401 — the Worker\'s CRON_SECRET and Vercel\'s have drifted apart, or the Vercel variable is unset (every endpoint fails closed).',
    '2. HTTP 403 with an HTML body — Cloudflare\'s WAF / Bot Fight Mode is challenging the Worker; add a skip rule for the CardPop-Scheduler user-agent.',
    '3. HTTP 5xx / no response — the endpoint itself failed; check the Vercel function logs.',
    '',
    'Runbook: docs/scheduled-jobs.md. Re-run by hand: POST https://<worker>/run/' + report.schedule + ' with the CRON_SECRET bearer.',
  ].join('\n');
  try {
    const res = await doFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.ALERT_FROM || 'CardPop Scheduler <noreply@cardpop.com.au>',
        to: [env.ALERT_EMAIL],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { sent: false, reason: `Resend HTTP ${res.status}` };
    if (env.STATE) {
      try { await env.STATE.put(suppressKey, report.startedAt, { expirationTtl: ALERT_SUPPRESS_SECONDS }); } catch { /* best effort */ }
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err?.message || String(err) };
  }
}

const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const bearerOf = (request) => {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
};

// `deps` lets tests inject fetch/sleep; production uses the defaults.
export function createHandlers(deps = {}) {
  return {
    // Cron Trigger entry point. Throws on any failure so the invocation shows
    // as failed in the dashboard's cron events, after the alert has been sent.
    async scheduled(controller, env, ctx) {
      const schedule = scheduleForCron(controller?.cron);
      if (!schedule) {
        const message = `No schedule for cron "${controller?.cron}". The Worker's Cron Triggers must match the expressions in SCHEDULES.`;
        console.error(JSON.stringify({ level: 'error', message }));
        throw new Error(message);
      }
      const report = await runSchedule(schedule, env, deps);
      console.log(JSON.stringify({ level: report.ok ? 'info' : 'error', ...report }));
      if (!report.ok) {
        const alert = sendFailureAlert(report, env, deps);
        if (ctx?.waitUntil) ctx.waitUntil(alert); else await alert;
        throw new Error(`${schedule.name}: failed job(s) ${report.failed.join(', ')}`);
      }
    },

    // Manual runs and a health check:
    //   GET  /                      → plain "ok" (no auth, nothing sensitive)
    //   POST /run/<schedule key>    → runs that schedule's jobs now
    //   POST /run/<job name>        → runs one job now
    // Both POSTs need `Authorization: Bearer <CRON_SECRET>` — the same secret
    // the endpoints themselves require, so this adds no new access.
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === '/' || url.pathname === '') {
        return new Response('CardPop scheduler: ok\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
      }
      const run = /^\/run\/([a-z0-9_-]+)\/?$/i.exec(url.pathname);
      if (!run) return json({ error: 'Not found' }, 404);
      if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
      if (!env?.CRON_SECRET || !safeEqual(bearerOf(request), env.CRON_SECRET)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const target = run[1];
      const schedule = scheduleForKey(target)
        || (JOBS[target] ? { key: target, name: `Job: ${target}`, cron: 'manual', jobs: [target] } : null);
      if (!schedule) {
        return json({ error: `Unknown schedule or job "${target}"`, schedules: SCHEDULES.map((s) => s.key), jobs: Object.keys(JOBS) }, 404);
      }
      const report = await runSchedule(schedule, env, deps);
      console.log(JSON.stringify({ level: report.ok ? 'info' : 'error', trigger: 'manual', ...report }));
      return json(report, report.ok ? 200 : 502);
    },
  };
}

export default createHandlers();
