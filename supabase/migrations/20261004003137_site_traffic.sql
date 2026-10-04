-- Site traffic (visitors) — Google Analytics 4 snapshots.
--
-- The app runs GA4 on every production page (lib/analytics.js), so GA4 is the
-- system of record for "how many people land on the site". Nothing in the
-- database knew those numbers until now. A nightly job
-- (.github/workflows/cron-site-traffic.yml → GET /api/site-traffic/sync →
-- src/services/siteTrafficService.js) pulls them through the GA4 Data API with
-- a service account and writes them here, so the home page stats strip and the
-- admin dashboard can show them with a plain Supabase read. Runbook:
-- docs/site-traffic.md.
--
-- Two tables:
--   • site_traffic_daily   — one row per calendar day (GA4's reporting
--                            timezone): users, sessions, pageviews. Feeds the
--                            admin 30-day sparkline. Re-synced for the last few
--                            days each run because GA4 finalises a day late.
--   • site_traffic_summary — a single row of de-duplicated totals. "Visitors in
--                            the last 30 days" and "visitors since launch" are
--                            GA4 activeUsers over those date ranges, which GA4
--                            de-duplicates across days; summing the daily rows
--                            would double-count anyone who came back.
--
-- Both hold aggregate numbers only (no per-visitor data), so they are publicly
-- readable: the home page is anonymous. Writes come from the service-role
-- backend only — there is deliberately no insert/update policy.

CREATE TABLE IF NOT EXISTS site_traffic_daily (
  day        date PRIMARY KEY,
  users      integer NOT NULL DEFAULT 0 CHECK (users >= 0),
  sessions   integer NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  pageviews  integer NOT NULL DEFAULT 0 CHECK (pageviews >= 0),
  source     text NOT NULL DEFAULT 'ga4',
  synced_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_traffic_summary (
  -- Single-row table: the CHECK pins the only allowed key.
  id                   boolean PRIMARY KEY DEFAULT true CHECK (id),
  visitors_30d         integer NOT NULL DEFAULT 0 CHECK (visitors_30d >= 0),
  sessions_30d         integer NOT NULL DEFAULT 0 CHECK (sessions_30d >= 0),
  pageviews_30d        integer NOT NULL DEFAULT 0 CHECK (pageviews_30d >= 0),
  visitors_all_time    integer NOT NULL DEFAULT 0 CHECK (visitors_all_time >= 0),
  sessions_all_time    integer NOT NULL DEFAULT 0 CHECK (sessions_all_time >= 0),
  pageviews_all_time   integer NOT NULL DEFAULT 0 CHECK (pageviews_all_time >= 0),
  -- The 30-day window the *_30d figures cover and the first day of data the
  -- all-time figures start from ("since launch").
  window_start         date,
  window_end           date,
  since_date           date,
  source               text NOT NULL DEFAULT 'ga4',
  synced_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_traffic_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_traffic_summary ENABLE ROW LEVEL SECURITY;

-- Public read: aggregate counts shown to every visitor on the home page.
DROP POLICY IF EXISTS site_traffic_daily_public_read ON site_traffic_daily;
CREATE POLICY site_traffic_daily_public_read
  ON site_traffic_daily FOR SELECT USING (true);

DROP POLICY IF EXISTS site_traffic_summary_public_read ON site_traffic_summary;
CREATE POLICY site_traffic_summary_public_read
  ON site_traffic_summary FOR SELECT USING (true);

-- No write policies on purpose: only the service-role backend (which bypasses
-- RLS) writes these rows.
