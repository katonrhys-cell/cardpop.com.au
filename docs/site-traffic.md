# Site traffic — visitor counts on the home page and admin dashboard

CardPop shows how many people land on the site in two places:

- **Home page stats strip** — a "Visitors · last 30 days" tile with the
  since-launch total underneath, next to Live Listings / Cards in Member
  Vaults / Active Members / Events Listed (`pages/HomePage.jsx`).
- **Admin → Dashboard → Visitors card** (`components/admin/SiteTrafficCard.jsx`)
  — the same two figures plus 30-day page views, a daily-visitors sparkline
  (hover for a day's count) and a **Sync now** button.

The numbers are **Google Analytics 4**'s, not something the app counts itself.
GA4 already runs on every production page (`lib/analytics.js`, property
`G-NCZ6K9VFF8`) and is the system of record; counting in the browser would
double-count and include bots, and Vercel Analytics on the Hobby plan keeps
only a month of data. Search Console "clicks" are a subset (Google search
only), so expect GA4's figure to be higher.

## How it flows

```
GitHub Actions  cron-daily.yml (step 1)  05:23 AEST daily
   └─ GET /api/site-traffic/sync        (CRON_SECRET bearer, fail-closed)
        └─ src/services/siteTrafficService.js
             ├─ GA4 Data API runReport ×2  (src/utils/ga4Client.js, service account)
             ├─ upsert site_traffic_daily    one row per day: users, sessions, pageviews
             └─ upsert site_traffic_summary  single row: 30-day + all-time totals
Home page / admin  ← plain Supabase reads (public SELECT; aggregate numbers only)
```

Two GA4 reports per run, both by `date` with a `TOTAL` aggregation:

1. **All days since `GA4_START_DATE`** → refreshes every daily row (GA4
   finalises a day up to ~48 h late, so re-pulling the whole history each
   night self-heals; it's a few hundred rows) and gives the all-time totals.
2. **`30daysAgo` → `yesterday`** → the last-30-days totals and the window
   dates shown in admin.

**Why not sum the daily rows?** `activeUsers` is de-duplicated *within a
report's date range*. Someone who visits on five days is one visitor in the
30-day total but would be five if the daily rows were added up. The `TOTAL`
row is the honest figure; the daily rows are for the sparkline.

`since_date` is the first day GA4 recorded a session, so "since launch" is
real regardless of how early `GA4_START_DATE` is set.

## Tables (`supabase/migrations/20261004003137_site_traffic.sql`)

| Table | Rows | Columns |
|---|---|---|
| `site_traffic_daily` | one per day | `day` (PK), `users`, `sessions`, `pageviews`, `source`, `synced_at` |
| `site_traffic_summary` | exactly one (`id = true`) | `visitors_30d`, `sessions_30d`, `pageviews_30d`, `visitors_all_time`, `sessions_all_time`, `pageviews_all_time`, `window_start`, `window_end`, `since_date`, `synced_at` |

Both are publicly readable (the home page is anonymous and the rows hold
aggregate counts only) and have **no write policy** — only the service-role
backend writes them.

## One-time setup (≈10 minutes)

1. **Property id** — GA4 → Admin → Property settings → copy the numeric
   *Property ID* (not the `G-…` measurement id).
2. **Service account** — [Google Cloud console](https://console.cloud.google.com)
   → any project → *APIs & Services → Library* → enable **Google Analytics
   Data API**. Then *IAM & Admin → Service Accounts → Create*; no project
   roles needed. Open it → *Keys → Add key → JSON* and download the file.
3. **Grant it access** — GA4 → Admin → Property → *Property access
   management* → **+** → paste the service account's email
   (`…@….iam.gserviceaccount.com`) with the **Viewer** role.
4. **Vercel env vars** (Settings → Environment Variables, Production):

   | Variable | Value |
   |---|---|
   | `GA4_PROPERTY_ID` | the numeric property id (`properties/123…` also accepted) |
   | `GA4_SERVICE_ACCOUNT_JSON` | the whole JSON key file, pasted as-is (or base64-encoded — both are accepted) |
   | `GA4_START_DATE` | *(optional)* `YYYY-MM-DD` launch date; default `2025-01-01`. GA4 returns nothing for days before the property existed, so early is harmless |

5. Redeploy (env changes need one), then **Admin → Dashboard → Visitors →
   Sync now**. A green toast with a 30-day number means the credentials work.
   The nightly job takes over from there.

The `CRON_SECRET` Actions secret is shared with the other scheduled jobs
(`docs/scheduled-jobs.md`) — nothing extra is needed on the GitHub side.

## Display rules

- The **home page tile hides itself** until the 30-day visitor count reaches
  `MIN_PUBLIC_VISITORS_30D` (100, `utils/siteTraffic.js`) and whenever the
  summary is older than 14 days — a tiny or stale number is a worse signal
  than none. The headline is last-30-days; the small line is
  "`<all-time>` since `<launch month>`". The all-time figure is never shown
  below the 30-day one (possible if `GA4_START_DATE` is after the launch).
- The admin card shows everything regardless and explains what to set when
  there's no summary row yet.
- Until GA4 is configured `GET /api/site-traffic/sync` answers **503**, so
  the Actions run stays red as a reminder rather than silently doing nothing.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/site-traffic/sync` | `CRON_SECRET` bearer | nightly sync |
| `POST /api/admin/site-traffic/sync` | admin (`requireAdmin`, MFA) | "Sync now" button |

## Troubleshooting

| Symptom | Cause |
|---|---|
| 503 `GA4 is not configured` | one of the two env vars is missing or the JSON isn't a service-account key (needs `client_email` + `private_key`) |
| 502, logs show `token exchange failed (400)` | malformed key or clock skew; re-download the JSON key |
| 502, logs show `runReport failed (403)` | the service account isn't a Viewer on the property, or the Analytics Data API isn't enabled in the Cloud project |
| 502, `runReport failed (429)` | GA4 Data API quota — the job makes 2 requests a night, so this is another consumer |
| numbers lower than Search Console clicks | GA4 is blocked by ad-blockers for some visitors; Search Console counts the click, GA4 can't see the visit. Expected gap of 10–30% |
| yesterday looks low | GA4 hasn't finalised it yet; tomorrow's run overwrites it |

Tests: `tests/backend/ga4-client.test.js`, `tests/backend/site-traffic-service.test.js`,
`tests/backend/site-traffic-route.test.js`, `tests/frontend/siteTraffic.test.js`.
