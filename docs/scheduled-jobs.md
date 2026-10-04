# Scheduled jobs

CardPop's five recurring backend jobs are driven by **GitHub Actions**, not
Vercel Cron. `vercel.json` has no `crons` block.

| Job | Endpoint | Schedule (UTC) | Local | Workflow |
|---|---|---|---|---|
| Price refresh | `/api/prices/refresh` | `30 19 * * *` | 05:30 AEST daily | `cron-prices-refresh.yml` |
| Reconcile pending payments | `/api/stripe/reconcile-pending` | `15 */2 * * *` | every 2 hours | `cron-reconcile-pending.yml` |
| Blog article generation | `/cron/blog-generate` | `7 21 * * *` | 07:07 AEST daily | `cron-blog-generate.yml` |
| Event scan | `/cron/event-scan` | `7 17 * * 0` | 03:07 AEST Monday | `cron-event-scan.yml` |
| Event website re-scan | `/cron/event-scan?mode=watches` | `43 16 * * *` | 02:43 AEST daily | `cron-event-watch.yml` |
| Supplier price watch | `/api/shop-supplier-watch/run` | `17 20 * * *` | 06:17 AEST daily (each product weekly) | `cron-supplier-price-watch.yml` |
| Delivery sweep | `/api/orders/delivery-sweep` | `37 20 * * *` | 06:37 AEST daily | `cron-delivery-sweep.yml` |
| Retention sweep | `/api/retention/sweep` | `47 21 * * *` | 07:47 AEST daily | `cron-retention-sweep.yml` |
| Site traffic sync (GA4 visitors) | `/api/site-traffic/sync` | `23 19 * * *` | 05:23 AEST daily | `cron-site-traffic.yml` |

Each caller workflow is a dozen lines that delegate to the reusable runner
`.github/workflows/cron-job.yml`, which makes one authenticated `GET` and fails
the run on any non-2xx.

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

## Setup

One repository secret is required:

**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `CRON_SECRET` | Exactly the same string as the `CRON_SECRET` environment variable in the Vercel dashboard |

Optionally, a repository *variable* `CRON_BASE_URL` points the jobs somewhere
other than production (e.g. a preview deployment). Unset means
`https://cardpop.com.au`.

All four endpoints **fail closed**: with no `CRON_SECRET` configured on the
server they refuse to run rather than being publicly triggerable. So the
workflows are not a privilege boundary — a fork or a PR cannot trigger them,
and without the secret nothing happens.

## Running one by hand

Every workflow has `workflow_dispatch`: **Actions → pick the job → Run
workflow**. That is also how you re-run a job after fixing a failure.

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
however briefly it actually runs. That is why the runner checks out nothing and
installs no toolchain: the work is one `curl`, so each run costs the 1-minute
minimum.

Current cost, approximately:

| Job | Runs/month | Minutes/month |
|---|---|---|
| Reconcile pending | ~360 | ~360 |
| Price refresh | ~30 | ~30 |
| Blog generation | ~30 | ~30 |
| Event scan | ~4 | ~4 |
| Delivery sweep | ~30 | ~30 |
| Retention sweep | ~30 | ~30 |
| Site traffic sync | ~30 | ~30 |
| **Total** | | **~455** |

That leaves roughly 1,575 minutes for CI (`ci.yml`, `main-ci.yml`, `e2e.yml`,
`lighthouse.yml`, `snyk-security.yml`, …), which is the far larger consumer.
Watch the total under **Settings → Billing**. Raising the reconciler to hourly
(`15 * * * *`) would roughly double the scheduled-job share to ~790 minutes.

## Troubleshooting

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

**A job stops firing entirely.** Check whether the 60-day inactivity disable
kicked in (Actions tab shows a banner), and that the schedule is on `main`.
