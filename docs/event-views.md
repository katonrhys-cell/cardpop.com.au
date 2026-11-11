# Event page views and Google search figures

An organiser sees how their events are doing on **Account → My Events**: how many
people viewed each live or completed event (total, last 7 and 30 days) and, via the
**Search** button, how its page performs in Google.

## Page views

One **view** = one browser opening the event's page (`/events/<slug>`) or its
pop-up on the events list, **at most once per browser per event per Australian
day** (`localStorage`, `lib/eventViews.js`). It is a popularity signal, not a
unique-visitor or billing figure — there is no per-visitor identity.

Not counted: crawlers and automation (`navigator.webdriver`, bot-like user agents —
bots also get the prerendered page and never run the SPA), legacy static events
with no database row, events that aren't public (draft, pending review, rejected,
cancelled), and — enforced in the database by `record_event_view()` — the event's
own organiser and any admin, so refreshing your own page doesn't inflate it.

**Who can read it:** `event_views_daily` (event, Australia/Sydney day, count) has no
browser write policy — only `record_event_view()` (security definer, callable by
anyone) moves it. The organiser (`events.organiser_id = auth.uid()`) and admins
read through `event_view_stats()`, which re-checks ownership itself; a stranger or
signed-out caller gets nothing. Events with no views return no row (shown as 0).
Giving an admin-made event to its real organiser (Event Management → Organiser
account → Link) is what makes them the owner who sees the numbers.

| | |
|---|---|
| Migration | `supabase/migrations/20261111003031_event_page_views.sql` |
| Recorder / reader | `lib/eventViews.js`, `hooks/useRecordEventView.js` (used by `pages/EventDetailPage.jsx` and `components/EventDetailModal.jsx`) |
| Display | `pages/account/AccountEvents.jsx` |
| Tests | `tests/frontend/eventViews.test.js`, `tests/db/run-event-views-migration.sh` |

Views counted before the migration reaches production are not backfilled.

## Google search figures (Search Console)

A live or completed event has a **Search** button: impressions, clicks, click rate,
average position and the top ten searches that showed the event's page in Google,
for the 28 days ending two days ago (Search Console's data lags). It reuses the
site's existing Search Console service account (`GSC_SITE_URL` +
`GA4_SERVICE_ACCOUNT_JSON`, see `docs/site-traffic.md`) — nothing new to configure.

- **API:** `GET /events/:id/search-performance` (`src/routes/events.js` →
  `src/services/eventSearchPerformance.js`). **Owner only** — `events.organiser_id`
  must be the caller; admins have Search Console itself, so there is no admin
  bypass. The page is matched by its exact canonical URL
  (`https://cardpop.com.au/events/<slug>`), so an organiser only ever sees their own
  page's figures.
- **Answers:** `{ available: false }` for an event that isn't public yet; 503 while
  Search Console isn't configured (the dialog says it isn't available yet); 502 if
  Google fails.
- **Cost control:** cached per page for 6 hours (`EVENT_SEARCH_CACHE_TTL_MS`, `0`
  disables); each uncached open is two Search Console calls.
- **Privacy:** Google omits rare (anonymised) queries, so the list can be shorter
  than the totals imply. Only aggregated figures reach the browser.
- UI `components/events/EventSearchDialog.jsx`, helpers `utils/eventSearchStats.js`.
  Tests `tests/backend/eventSearchPerformance.test.js`,
  `tests/frontend/eventSearchDialog.test.jsx`.
