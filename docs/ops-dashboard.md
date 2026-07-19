# Weekly Ops Dashboard (Google Sheet)

A Google Sheet that appends one row per week with the site's key numbers pulled
live from Search Console, Stripe, Sentry and (optionally) Supabase — so the
metrics that currently arrive as scattered emails live in one trend view.

- **Sheet:** *CardPop — Weekly Ops Dashboard*
  (`https://docs.google.com/spreadsheets/d/1SJytlmn_dFYoqPakBvafHeJsFok3CBQbfG1rc_scsM0/edit`),
  in the **CardPop** folder in Drive.
- **Script:** `scripts/ops-dashboard/Code.gs` + `scripts/ops-dashboard/appsscript.json`
  (version-controlled here; the running copy lives in the sheet's Apps Script project).

## What it records

| Column | Source | Secret needed |
|---|---|---|
| GSC clicks / impressions / CTR / avg position (7d) | Google Search Console | **None** — uses your Google login |
| Stripe gross + payment count (7d) | Stripe API | `STRIPE_API_KEY` |
| Sentry error events (7d) | Sentry API | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` |
| Supabase new users + active listings | Supabase REST | `SUPABASE_SERVICE_KEY` *(optional)* |

Each source is independent. If you don't set a secret, that column is just left
blank. If a source errors on a given week, the run still completes and the error
is written into that row's **Notes** column — one broken API never blocks the
others.

## One-time setup

### 1. Open the script editor

Open the sheet → **Extensions → Apps Script**.

### 2. Paste the code

- Replace the contents of `Code.gs` with `scripts/ops-dashboard/Code.gs`.
- Click the gear (**Project Settings**) → tick **"Show `appsscript.json` manifest
  file in editor"**. Back in the editor, open `appsscript.json` and replace it
  with `scripts/ops-dashboard/appsscript.json` (this declares the OAuth scopes,
  including Search Console read access).
- **Save.**

### 3. Add the secrets you want (Script Properties)

Project Settings → **Script Properties** → add rows. All are optional; add only
the sources you want to track.

| Property | Value | How to get it |
|---|---|---|
| `STRIPE_API_KEY` | A **restricted** Stripe key | Stripe Dashboard → Developers → API keys → **Create restricted key**. Grant **read** on *Charges* only. Use a **live** key for real sales. |
| `SENTRY_AUTH_TOKEN` | Sentry auth token | Sentry → Settings → Account → **Auth Tokens** (or an Org token) with `org:read` + `project:read`. |
| `SENTRY_ORG` | Your Sentry org **slug** | In any Sentry URL: `sentry.io/organizations/<slug>/`. |
| `SUPABASE_SERVICE_KEY` | Supabase **service role** key | Supabase → Project Settings → API. ⚠️ Full DB access — only add if you want the Supabase columns; treat it like a password. |

> **Why a restricted Stripe key and not the main secret key?** The dashboard only
> needs to *read* charge totals. A restricted read-only key can't move money or
> change anything, so if the sheet were ever compromised the blast radius is a
> read of your sales figures — not your account.

### 4. Authorise + arm the weekly run

In the editor's function dropdown pick **`setup`** → **Run**. Google will ask you
to authorise the scopes (Sheets, external requests, Search Console) — approve as
`admin@cardpop.com.au`. This:

- builds the **Weekly Metrics** tab with headers, and
- creates a time-based trigger that runs **every Monday ~08:00** (Australia/Melbourne).

### 5. Test it

Reload the sheet (a **CardPop Ops** menu appears) → **CardPop Ops → Run snapshot
now**. A row should append. Any source you haven't configured is blank; any that
errored explains itself in **Notes**.

## Notes & gotchas

- **Search Console lag:** GSC data trails by ~2 days, so each run reports the
  7-day window ending 2 days ago (not "yesterday"). This is expected and keeps
  the numbers from being artificially low.
- **Search Console access:** the authorising account (`admin@cardpop.com.au`)
  must have access to the `https://cardpop.com.au/` property in Search Console.
  If you use a **Domain** property instead, change `GSC_SITE_URL` in `Code.gs` to
  `sc-domain:cardpop.com.au`.
- **Stripe pagination** is capped at 2,000 charges/week (20 pages) — plenty of
  headroom; raise the guard in `fetchStripe_` if you ever exceed it.
- **Supabase columns** assume a `profiles.created_at` column and a `listings`
  table with `status`. If your schema differs, adjust the queries in
  `fetchSupabase_` — wrong names fail soft (blank), they don't crash the run.
- **Editing the script later:** change it here in the repo *and* in the sheet's
  Apps Script project (they aren't auto-synced). `clasp` can link the two if you
  want one-command pushes.
