# Site traffic — Google figures on the home page and admin dashboard

CardPop shows how people find and land on the site in two places:

- **Home page stats strip** (`pages/HomePage.jsx`) — two panels side by side.
  **Found on Google**: Search Console *impressions* (times a CardPop page
  appeared in Google results), *clicks* (searchers who came through) and GA4
  *visitors*, each over the last 30 days with the since-launch total
  underneath. **The CardPop community**: Cards in Member Vaults / Active
  Members / Events Listed, with a "Join free" nudge for signed-out visitors.
  (Live Listings is no longer a tile — the ticker underneath already shows
  what's live.)
- **Admin → Dashboard → Visitors card** (`components/admin/SiteTrafficCard.jsx`)
  — the visitor figures plus 30-day page views, the Search Console line, a
  daily-visitors sparkline (hover for a day's count) and a **Sync now** button.

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

Two GA4 reports per run, both by `date` with a `TOTAL` aggregation, then
(when `GSC_SITE_URL` is set) one Search Console query — see **Search
Console** below:

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
| `site_traffic_daily` | one per day | `day` (PK), `users`, `sessions`, `pageviews`, `search_clicks`, `search_impressions`, `source`, `synced_at` |
| `site_traffic_summary` | exactly one (`id = true`) | `visitors_30d`, `sessions_30d`, `pageviews_30d`, `visitors_all_time`, `sessions_all_time`, `pageviews_all_time`, `window_start`, `window_end`, `since_date`, `synced_at`, plus the Search Console set `search_clicks_30d`, `search_impressions_30d`, `search_clicks_all_time`, `search_impressions_all_time`, `search_window_start`, `search_window_end`, `search_since_date`, `search_synced_at` (`20261031015048_site_traffic_search_console.sql`) |

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

## Search Console (clicks and impressions) — ≈5 more minutes

The "Found on Google" panel's impressions and clicks come from the **Search
Console Search Analytics API** (`src/utils/searchConsoleClient.js`), read
with the **same service account** as GA4 — it just needs a second scope
(`webmasters.readonly`; `ga4Client.getAccessToken({ scope })` caches a token
per scope) and access to the property:

1. **Enable the API** — Google Cloud console → the service account's project →
   *APIs & Services → Library* → enable **Google Search Console API**.
2. **Add the account to the property** — [Search Console](https://search.google.com/search-console)
   → the `cardpop.com.au` property → *Settings → Users and permissions → Add
   user* → the service account's email with **Restricted** permission (read
   only is enough).
3. **Vercel env var** — `GSC_SITE_URL` = the property exactly as Search
   Console names it: `sc-domain:cardpop.com.au` for a Domain property, or
   `https://cardpop.com.au/` for a URL-prefix property (the trailing slash
   is added if missing). Redeploy, then **Sync now** on the admin card; the
   toast now also reports the 30-day clicks.

How it's read: one query by `date`, from the later of `GA4_START_DATE` and
16 months ago (Search Console keeps 16 months), `dataState: 'all'` so the
last two or three not-yet-final days are included and simply overwritten
the next night. Clicks and impressions are additive across days, so the
totals are sums of the daily rows; "last 30 days" is the 30 days ending
yesterday regardless of how many of them Google has reported yet. Each
source writes **only its own columns**, in its own upsert, GA4 first — a
Search Console failure never costs the visitor figures (it is thrown after
the GA4 write so the cron run still goes red), and the sync runs with only
one of the two configured. If neither is configured the endpoints answer
503 as before.

**Why these can't be tallied in the app**: an impression is counted by
Google when a result is shown, before anything of CardPop's loads. Only
Search Console knows it.

## Display rules

- The **home page tiles hide themselves** below their floors in
  `utils/siteTraffic.js` — visitors `MIN_PUBLIC_VISITORS_30D` (100),
  impressions `MIN_PUBLIC_SEARCH_IMPRESSIONS_30D` (1,000; opens the Google
  panel), clicks `MIN_PUBLIC_SEARCH_CLICKS_30D` (50; shown alongside once
  reached) — and whenever that source's sync (`synced_at` /
  `search_synced_at`) is older than 14 days: a tiny or stale number is a
  worse signal than none. Every headline is last-30-days; the small line is
  "`<all-time>` since `<launch month>`", and the all-time figure is never
  shown below the 30-day one (possible if `GA4_START_DATE` is after the
  launch). With no Google figures at all the community panel stands alone.
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
| 502, logs show `searchAnalytics.query failed (403)` | the service account isn't a user on the Search Console property, the Search Console API isn't enabled in its Cloud project, or `GSC_SITE_URL` doesn't match the property name exactly (`sc-domain:` vs URL-prefix) |
| Google panel missing from the home page | impressions under 1,000 for the 30 days, or `search_synced_at` older than 14 days — check the admin card's Search line |
| numbers lower than Search Console clicks | GA4 is blocked by ad-blockers for some visitors; Search Console counts the click, GA4 can't see the visit. Expected gap of 10–30% |
| yesterday looks low | GA4 hasn't finalised it yet; tomorrow's run overwrites it |

Tests: `tests/backend/ga4-client.test.js`, `tests/backend/search-console-client.test.js`,
`tests/backend/site-traffic-service.test.js`, `tests/backend/site-traffic-route.test.js`,
`tests/frontend/siteTraffic.test.js`, `tests/frontend/homepageStatsStrip.test.jsx`.
