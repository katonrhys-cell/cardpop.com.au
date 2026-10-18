# Scheduled jobs

CardPop's recurring backend jobs are driven by **GitHub Actions**, not Vercel
Cron. `vercel.json` has no `crons` block.

Four workflows carry nine endpoints:

| Workflow | Schedule (UTC) | Local | What it calls |
|---|---|---|---|
| `cron-daily.yml` — **Daily maintenance** | `23 19 * * *` | 05:23 AEST daily | The six daily endpoints below, back to back in one run |
| `cron-reconcile-pending.yml` | `15 */2 * * *` | every 2 hours | `/api/stripe/reconcile-pending` |
| `cron-blog-generate.yml` | `7 21 * * *` | 07:07 AEST daily | `/cron/blog-generate` |
| `cron-event-scan.yml` | `7 17 * * 0` | 03:07 AEST Monday | `/cron/event-scan` |

The daily run's steps, in order (each `continue-on-error`, so one failing never
blocks the rest; the run itself goes red at the end if any step failed):

| Step | Endpoint | Function budget | Runbook |
|---|---|---|---|
| Site traffic sync (GA4 visitors) | `/api/site-traffic/sync` | 40 s | `docs/site-traffic.md` |
| Price refresh | `/api/prices/refresh` | 40 s | — |
| Event website re-scan (each watch weekly) | `/cron/event-scan?mode=watches` | 300 s | `docs/event-scanning.md` |
| Supplier price watch (each product weekly) | `/api/shop-supplier-watch/run` | 40 s | `docs/supplier-price-watch.md` |
| Delivery sweep | `/api/orders/delivery-sweep` | 40 s | `docs/order-delivery.md` |
| Retention sweep | `/api/retention/sweep` | 40 s | `docs/retention.md` |

Also on a schedule, but not a backend job: `merchant-listings-check.yml`
(`33 20 * * 1`, 06:33 AEST Tuesday) fetches public pages with
`scripts/check-merchant-listings.mjs` to check the live Product markup, and
files a tracking issue on failure, like `migration-drift.yml`.

Every endpoint call is the composite action `.github/actions/cron-call`: one
authenticated `GET`, failing on any non-2xx, with 401/403 never retried. The
three single-endpoint workflows are a dozen lines each that delegate to the
reusable runner `.github/workflows/cron-job.yml`, which wraps that action.

## Why not Vercel Cron

**Vercel's Hobby plan rejects any cron firing more than once a day.** A
sub-daily schedule doesn't degrade — it fails the whole deployment build with
`Hobby accounts are limited to daily cron jobs`, which is how it once silently
blocked every production deploy.

That limit distorted the stuck-payment reconciler. An order row is written
`pending` when its Checkout Session is created and only moves forward when
`checkout.session.completed` reaches the webhook; if that event never arrives
the buyer has paid and nothing happens, with no error anywhere. This job is the
only thing that notices, and on Vercel it could only look once a day. It now
runs **every two hours**, so a stuck payment is caught within ~2 hours instead
of up to 24.

Moving the schedules here also means the cadences are no longer coupled to the
hosting plan at all.

## Why the daily jobs share one run

This repository is private, so Actions minutes are metered and **every run is
billed rounded up to a whole minute**, however briefly it runs (see below). The
six daily endpoints each take a few seconds, so as six workflows they cost six
minutes a day for well under a minute of work. As one run they cost one to
three. Nothing depended on their old spacing: every job is idempotent or
self-deduplicating (each send, snapshot or check is stamped in the database),
so running them back to back changes nothing but the bill. The reconciler,
blog draft and event scan keep their own runs because their cadences differ.

## Setup

One repository secret is required:

**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `CRON_SECRET` | Exactly the same string as the `CRON_SECRET` environment variable in the Vercel dashboard |

Optionally, a repository *variable* `CRON_BASE_URL` points the jobs somewhere
other than production (e.g. a preview deployment). Unset means
`https://cardpop.com.au`.

Every endpoint **fails closed**: with no `CRON_SECRET` configured on the server
it refuses to run rather than being publicly triggerable. So the workflows are
not a privilege boundary — a fork or a PR cannot trigger them, and without the
secret nothing happens.

## Running one by hand

Every workflow has `workflow_dispatch`: **Actions → pick the job → Run
workflow**. That is also how you re-run a job after fixing a failure. Running
**Daily maintenance** by hand re-runs all six steps; a step whose work is
already done for the day is a no-op.

The event scan additionally has an in-app trigger — Admin → Event Management →
"Run scan now" — which calls `/cron/event-scan` with the signed-in admin's
Supabase token instead of the secret.

## Things to know about Actions schedules

- **They only run from the default branch.** A schedule added on a feature
  branch fires nothing until it is merged to `main`.
- **They are best-effort and often late.** GitHub queues scheduled runs and
  drops them under load; a delay of 5–30 minutes is normal and an occasional
  skipped run is expected. Every one of these jobs is idempotent or
  self-deduplicating, so a late or missed run is harmless — but don't build
  anything here that needs to fire at an exact minute. Schedules are deliberately
  a few minutes off the top of the hour, where congestion is worst.
- **They are disabled after 60 days of no repository activity.** GitHub emails
  the repo admin first. Any push re-enables them.
- **Schedules are always UTC** and do not shift for daylight saving. AEDT
  (October–April) moves the local times an hour later than the table above.

## Actions minutes

This repository is private, so Actions minutes are metered — 2,000/month on the
GitHub Free plan — and **every run is billed rounded up to a whole minute**,
however briefly it actually runs. That is why the runner checks out only the
composite action's folder and installs no toolchain: the work is one `curl` per
endpoint, so a single-endpoint run costs the 1-minute minimum.

Current cost, approximately:

| Workflow | Runs/month | Minutes/month |
|---|---|---|
| Reconcile pending | ~360 | ~360 |
| Daily maintenance (six endpoints) | ~30 | ~30–90 |
| Blog generation | ~30 | ~30 |
| Event scan | ~4 | ~4 |
| **Total** | | **~425–485** |

Before the daily jobs were merged into one run this was ~635 minutes a month,
and the reconciler is the one worth watching: it is ~80% of the scheduled bill
and most of its runs find nothing. Raising it to hourly (`15 * * * *`) would
add another ~360 minutes.

That leaves roughly 1,500 minutes for CI (`ci.yml`, `main-ci.yml`, `e2e.yml`,
`lighthouse.yml`, `snyk-security.yml`, …), which is the far larger consumer.
Watch the total under **Settings → Billing**.

## Database-side schedules

Not every schedule is in Actions. pg_cron inside the Supabase project runs:

| Job | Schedule | Owner |
|---|---|---|
| `expire-stale-offers` | every 15 min | `20260928071648_binding_offers_lifecycle.sql` |
| `stripe-sync-worker` | every 5 min | Created by the Stripe Sync Engine integration (`docs/stripe-sync.md`); cadence set by `20261010022330_stripe_sync_worker_cadence.sql` |

## Troubleshooting

**Every run fails in a few seconds with "CRON_SECRET is empty".** The `CRON_SECRET`
repository secret was never added (this is how every schedule sat broken from
2026-09-13 to 2026-10-18: price snapshots stopped, no retention email went out,
the blog stopped publishing). Add it under Settings → Secrets and variables →
Actions with exactly the value Vercel holds, then re-run each workflow by hand.
`.github/workflows/cron-health.yml` now opens one tracking issue the first time
any `Cron ·` workflow fails so this can't go unnoticed again.

**A run fails with HTTP 401.** The `CRON_SECRET` repository secret and the
`CRON_SECRET` environment variable in Vercel have drifted apart, or the Vercel
variable is unset (every endpoint fails closed, so unset reads as 401).

**A run fails with HTTP 403 and an HTML body.** That is Cloudflare, not the
endpoint. Cloudflare proxies all production traffic, and Bot Fight Mode or a WAF
rule can challenge a datacentre IP — GitHub's runners are Azure-hosted. The runner
sends a `CardPop-Scheduler/1.0` user-agent; add a WAF skip rule matching it, or
match the request paths, in the Cloudflare dashboard. See `docs/ddos-protection.md`.

**A run fails with HTTP 000.** curl never got a response — the function exceeded
`max_seconds`, or the site was unreachable. Check the Vercel function logs.

**Daily maintenance is red.** Open the run: the final step names which steps
failed, and each failed step's log has the response body. The other steps still
ran. Re-run the workflow after fixing; completed steps are no-ops.

**A job stops firing entirely.** Check whether the 60-day inactivity disable
kicked in (Actions tab shows a banner), and that the schedule is on `main`.
