# Vultr rollout

Working notes for moving CardPop's hosting onto Vultr. This file tracks the
plan and the decisions made along the way; it is the anchor for the
`vultr-rollout` branch and will be filled in as the work lands.

## Current hosting (as of this branch)

- **App**: Vercel, via its native Git integration — `dist/` static build plus
  `api/index.js` (Express) as a serverless function, with the longer-running
  jobs split into their own functions (`api/blog-generate.js`,
  `api/event-scan.js`, `api/grade-estimate.js`, `api/prerender.js`,
  `api/sitemap.js`).
- **Edge**: Cloudflare is authoritative for DNS and proxies all traffic in
  front of Vercel. The image CDN (`img.cardpop.com.au`) and the scheduler
  (`cloudflare/scheduler/worker.js`, Cron Triggers) are Cloudflare Workers.
- **Data**: Supabase (PostgreSQL + Auth + Storage) — unaffected by a hosting
  move.

## What a Vultr move touches

- Serving the SPA (`dist/`) and the `/hcgi/api/*` → Express proxy that
  `vercel.json` rewrites today.
- Running `src/app.js` as a long-lived process instead of per-request
  functions (removes the 40 s / 300 s function budgets the code works around).
- The cron endpoints the scheduler Worker calls (`CRON_SECRET` bearer) — the
  Worker's target host changes, nothing else.
- Environment variables listed in `CLAUDE.md` → Deployment, which today live in
  the Vercel dashboard.
- Cloudflare DNS: the `cardpop.com.au` records that currently point at Vercel.
- The `vercel.json` headers (CSP, caching) and rewrites, which need an
  equivalent in whatever serves the app on Vultr.

## Decisions

_None yet._

## Rollout steps

_To be written._
