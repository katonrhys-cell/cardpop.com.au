# Scheduled jobs

CardPop's recurring backend jobs are fired by a **Cloudflare Worker with Cron
Triggers** — `cloudflare/scheduler/worker.js`, deployed as the
`cardpop-scheduler` Worker. Not Vercel Cron, and (since 2026-10-31) not GitHub
Actions either. `vercel.json` has no `crons` block.

Four triggers carry nine endpoints:

| Trigger (UTC) | Local | Key | What it calls |
|---|---|---|---|
| `15 */2 * * *` | every 2 hours | `reconcile` | `/api/stripe/reconcile-pending` |
| `23 19 * * *` | 05:23 AEST daily | `daily` | The six daily endpoints below, concurrently |
| `7 21 * * *` | 07:07 AEST daily | `blog` | `/cron/blog-generate` |
| `7 17 * * SUN` | 03:07 AEST Monday | `event-scan` | `/cron/event-scan` |

The daily run's jobs (independent, each with its own retry policy; one failing
never blocks the rest, and the run is reported failed at the end if any did):

| Job | Endpoint | Function budget | Retries | Runbook |
|---|---|---|---|---|
| `site_traffic` (GA4 visitors) | `/api/site-traffic/sync` | 40 s | 2 attempts | `docs/site-traffic.md` |
| `prices` | `/api/prices/refresh` | 40 s | 2 attempts | — |
| `event_watch` (each watch weekly) | `/cron/event-scan?mode=watches` | 300 s | never | `docs/event-scanning.md` |
| `supplier_watch` (each product weekly) | `/api/shop-supplier-watch/run` | 40 s | 2 attempts | `docs/supplier-price-watch.md` |
| `delivery_sweep` | `/api/orders/delivery-sweep` | 40 s | 2 attempts | `docs/order-delivery.md` |
| `retention_sweep` | `/api/retention/sweep` | 40 s | 2 attempts | `docs/retention.md` |

Every call is one authenticated `GET` with the `CRON_SECRET` bearer, failing on
any non-2xx; 401/403 are never retried, and neither is anything that spends on
a model call (blog, event scan, event watch) — a retry can double-spend on a
run that succeeded but answered slowly. The job table, the retry policy and
the schedule-to-jobs mapping are all in `worker.js` (`JOBS` / `SCHEDULES`);
the cron expressions the Worker is deployed with live in
`cloudflare/scheduler/wrangler.toml` and **must match `SCHEDULES` exactly**,
because the runtime identifies a firing by its cron string.
`tests/backend/schedulerWorker.test.js` checks the two stay in step.

Still on GitHub Actions, because they need a runner rather than an HTTP call:
`migration-drift.yml` (daily `supabase migration list`), `git-backup.yml`
(daily repo archive to Drive) and `merchant-listings-check.yml` (`33 20 * * 1`,
06:33 AEST Tuesday, checks the live Product markup with
`scripts/check-merchant-listings.mjs` and files an issue on failure).

## Why a Cloudflare Worker

**Vercel's Hobby plan rejects any cron firing more than once a day.** A
sub-daily schedule doesn't degrade — it fails the whole deployment build with
`Hobby accounts are limited to daily cron jobs`, which is how it once silently
blocked every production deploy. That capped the stuck-payment reconciler at
once a day: an order row is written `pending` when its Checkout Session is
created and only moves forward when `checkout.session.completed` reaches the
webhook; if that event never arrives the buyer has paid and nothing happens.
This job is the only thing that notices. It now runs **every two hours**.

**GitHub Actions bills a private repo a whole metered minute per run**,
however briefly it executes. The four schedules were ~425–485 minutes a month
(the two-hourly reconciler alone ~360) of the 2,000-minute allowance, for a
few seconds of real work each — and when the allowance ran out, *every*
workflow stopped, including the migration push on merge. Cloudflare Cron
Triggers are included on the Workers free plan and bill nothing per firing.
The Worker's only work is a `fetch`, well inside the free plan's CPU budget,
and a Cron Trigger invocation may run up to 15 minutes of wall clock, which
is why the daily run's six jobs run concurrently rather than in series.

The Worker itself is not a privilege boundary: every endpoint **fails closed**
(it refuses to run when the server has no `CRON_SECRET`), so without the
secret nothing happens.

## Setup (once)

From the repository root, with a Cloudflare account that owns the
`cardpop.com.au` zone:

```bash
npx wrangler login                                                        # opens the browser once
npx wrangler deploy --config cloudflare/scheduler/wrangler.toml            # creates the Worker + the four triggers
npx wrangler secret put CRON_SECRET --config cloudflare/scheduler/wrangler.toml
#   paste exactly the CRON_SECRET environment variable from the Vercel dashboard
```

That is enough for every schedule to run. Two optional extras:

- **Failure alerts by email.** `wrangler.toml` already sets `ALERT_EMAIL`
  (`admin@cardpop.com.au`) and `ALERT_FROM`; add the Resend key and the Worker
  emails each failed run:
  `npx wrangler secret put RESEND_API_KEY --config cloudflare/scheduler/wrangler.toml`
  (the same key Vercel holds, or a separate one from the Resend dashboard).
- **Alert de-duplication.** Without it, a job failing on every tick emails on
  every tick (the reconciler: twelve a day). Create a KV namespace, uncomment
  the `[[kv_namespaces]]` block in `wrangler.toml` with the id it prints, and
  redeploy — then one alert per schedule silences the next 12 hours:
  `npx wrangler kv namespace create STATE --config cloudflare/scheduler/wrangler.toml`

Changing a schedule or a job: edit `worker.js` and `wrangler.toml` together
and run the `deploy` command again. The dashboard route (Workers & Pages →
Create → paste the file, then Settings → Triggers → add the four cron
expressions, Settings → Variables → add the secret) works too, but the file
in the repo is the source of truth either way.

A repository variable is no longer involved: to point the jobs at a preview
deployment, change `BASE_URL` in `wrangler.toml` (or the dashboard) and
redeploy.

## Running one by hand

The Worker answers on its `workers.dev` URL (shown by `wrangler deploy`;
also under the Worker's Settings → Domains & Routes). Any schedule or single
job can be run now with the same bearer the endpoints require:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://cardpop-scheduler.<subdomain>.workers.dev/run/daily
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://cardpop-scheduler.<subdomain>.workers.dev/run/reconcile
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://cardpop-scheduler.<subdomain>.workers.dev/run/prices   # one job
```

The response is the run report (every job's status, attempts and the first
1 KB of its body); HTTP 200 when all succeeded, 502 when any failed. Re-running
a schedule whose work is already done for the day is a no-op. `GET /` answers
a plain `ok` without auth and nothing else is served without the bearer.

Any endpoint can also be called directly with `curl` and the bearer, exactly
as the Worker does. The event scan additionally has an in-app trigger —
Admin → Event Management → "Run scan now" — which calls `/cron/event-scan`
with the signed-in admin's Supabase token instead of the secret.

## Seeing what ran

- **Logs.** Cloudflare dashboard → Workers & Pages → `cardpop-scheduler` →
  Logs. Every run writes one JSON line (`schedule`, `ok`, `failed`, per-job
  `status`/`attempts`/`ms` and a body excerpt). A failed run also throws, so
  it shows as an error in the Worker's metrics and in the trigger's events.
- **Email.** With `RESEND_API_KEY` set, each failed run emails `ALERT_EMAIL`
  with the failing jobs, their response excerpts and the likely causes.

## Things to know about Cron Triggers

- **They are UTC** and do not shift for daylight saving. AEDT (October–April)
  moves the local times above an hour later.
- **A firing is identified by its cron string.** Editing a trigger in the
  dashboard to a different expression without changing `SCHEDULES` makes the
  Worker throw `No schedule for cron …` on every firing (and email, if alerts
  are on). Change both.
- **Up to 15 minutes per invocation**, and the Worker never retries an
  invocation on its own — the per-job `attempts` in `JOBS` is the whole retry
  policy.
- **The free plan allows a handful of triggers per Worker** (five at the time
  of writing); this Worker uses four.
- **No activity timeout.** Unlike Actions schedules, nothing disables them
  after 60 days without a push.

## Database-side schedules

Not every schedule is in the Worker. pg_cron inside the Supabase project runs:

| Job | Schedule | Owner |
|---|---|---|
| `expire-stale-offers` | every 15 min | `20260928071648_binding_offers_lifecycle.sql` |
| `stripe-sync-worker` | every 5 min | Created by the Stripe Sync Engine integration (`docs/stripe-sync.md`); cadence set by `20261010022330_stripe_sync_worker_cadence.sql` |

## Troubleshooting

**Every job reports "CRON_SECRET is not set on the Worker".** The secret was
never added to the Worker (`wrangler secret put CRON_SECRET …`, or Settings →
Variables and Secrets in the dashboard). This is the Worker's equivalent of
the Actions secret that was missing from 2026-09-13 to 2026-10-18, when every
schedule sat broken for five weeks: price snapshots stopped, no retention
email went out, the blog stopped publishing. Add it with exactly the value
Vercel holds, then run `/run/daily` by hand and check the report.

**A job fails with HTTP 401.** The Worker's `CRON_SECRET` and the `CRON_SECRET`
environment variable in Vercel have drifted apart, or the Vercel variable is
unset (every endpoint fails closed, so unset reads as 401). Set both to one
new value.

**A job fails with HTTP 403 and an HTML body.** That is Cloudflare, not the
endpoint: Bot Fight Mode or a WAF rule is challenging the Worker's request to
the site. The Worker sends a `CardPop-Scheduler/1.0` user-agent; add a WAF
skip rule matching it (or the `/api/…`/`/cron/…` paths with an
`Authorization` header present) in the zone's Security rules. See
`docs/ddos-protection.md`.

**A job reports "No response within Ns".** The function exceeded its budget,
or the site was unreachable. Check the Vercel function logs for that path.

**The run threw "No schedule for cron …".** A trigger on the Worker doesn't
match `SCHEDULES` — see above; make `wrangler.toml` and `worker.js` agree and
redeploy.

**Daily maintenance is red.** Open the log line (or the email): `failed`
names the jobs, and each result carries the response excerpt. The other jobs
still ran. Re-run `/run/daily` after fixing; completed jobs are no-ops.

**Nothing fires at all.** Check the Worker's Settings → Triggers lists the
four cron expressions (a dashboard-created Worker has none until they are
added), and that the deploy succeeded (`wrangler deploy` prints the schedule
it uploaded).
