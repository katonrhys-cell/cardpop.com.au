-- Google Search Console figures alongside the GA4 visitor counts.
--
-- The home page stats strip now leads with how CardPop shows up on Google:
-- impressions (times a CardPop page appeared in Google Search results) and
-- clicks (searchers who clicked through), both over the last 30 days with a
-- since-launch total underneath. The nightly sync (src/services/
-- siteTrafficService.js) pulls them from the Search Console Search Analytics
-- API with the same service account GA4 uses, when GSC_SITE_URL is set.
-- Runbook: docs/site-traffic.md → Search Console.
--
-- Same tables, more columns, so one public SELECT serves the whole strip:
--   • site_traffic_daily   gains search_clicks / search_impressions per day
--                          (Search Console reports by Pacific-time day, GA4 by
--                          the property's timezone — close enough for a strip
--                          and a sparkline; the summary totals are what's shown).
--   • site_traffic_summary gains the 30-day and since-launch totals, the
--                          window they cover and their own synced_at, so a
--                          Search Console outage can't make the GA4 tile look
--                          stale or vice versa.
-- Aggregate numbers only — still publicly readable, still no write policy.

ALTER TABLE site_traffic_daily
  ADD COLUMN IF NOT EXISTS search_clicks      integer NOT NULL DEFAULT 0 CHECK (search_clicks >= 0),
  ADD COLUMN IF NOT EXISTS search_impressions integer NOT NULL DEFAULT 0 CHECK (search_impressions >= 0);

ALTER TABLE site_traffic_summary
  ADD COLUMN IF NOT EXISTS search_clicks_30d            integer NOT NULL DEFAULT 0 CHECK (search_clicks_30d >= 0),
  ADD COLUMN IF NOT EXISTS search_impressions_30d       integer NOT NULL DEFAULT 0 CHECK (search_impressions_30d >= 0),
  ADD COLUMN IF NOT EXISTS search_clicks_all_time       integer NOT NULL DEFAULT 0 CHECK (search_clicks_all_time >= 0),
  ADD COLUMN IF NOT EXISTS search_impressions_all_time  integer NOT NULL DEFAULT 0 CHECK (search_impressions_all_time >= 0),
  -- The 30-day window the *_30d figures cover and the first day Search
  -- Console has data from (it keeps 16 months, so "since launch" means
  -- "as far back as Google reports" for an older site).
  ADD COLUMN IF NOT EXISTS search_window_start          date,
  ADD COLUMN IF NOT EXISTS search_window_end            date,
  ADD COLUMN IF NOT EXISTS search_since_date            date,
  ADD COLUMN IF NOT EXISTS search_synced_at             timestamptz;
