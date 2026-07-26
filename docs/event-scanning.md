# Automated event scanning

CardPop's events calendar is filled two ways: organisers and admins add events by
hand, and a nightly job goes looking for the ones nobody told us about. This
document covers the second one.

**The job never publishes anything.** Every event it finds lands in `events` with
`status = 'pending_review'` — the same moderation queue user-submitted events go
into — flagged `auto_discovered = true`. A human approves each one in
**Admin → Event Management**.

---

## Schedule

Vercel Cron hits `/cron/event-scan` at **17:00 UTC daily**, which is **3am AEST**.

Vercel Cron expressions are UTC only, and Australia observes daylight saving, so
the local fire time drifts by an hour across the year:

| Period | UTC offset | Local fire time |
|---|---|---|
| Winter (AEST) | UTC+10 | 3:00am |
| Summer (AEDT) | UTC+11 | 4:00am |

That's fine for a background job — nothing downstream depends on the exact hour.
If it ever needs to be 3am local year-round, the schedule has to be edited twice
a year in `vercel.json`.

The two existing crons (`/api/prices/refresh` at 19:30 UTC, `/cron/blog-generate`
at 21:00 UTC) run earlier in the UTC day, so the three don't overlap.

---

## How a run works

```
event_scan_sources          (what to look for)
        │
        ▼
  ① DISCOVERY — one Claude call with the web-search server tool
        │        candidate URLs harvested from the search-result blocks
        ▼
event_scan_candidates       (every URL ever seen — the dedupe ledger)
        │        only URLs never seen before continue
        ▼
  ② FETCH — page pulled through the SSRF-safe fetcher, stripped to text
        │
        ▼
  ③ EXTRACT — Claude under a JSON schema, using the same EventScraperPrompt
        │        the admin scraper panel uses
        ▼
  ④ GATE — is it an event? does it have a date? is the date in the future?
        │        is it already on the site?
        ▼
events (status = 'pending_review', auto_discovered = true)
```

### ① Discovery

One `claude-opus-5` call with the `web_search_20260209` server tool, given every
active query in the run. Candidate URLs are read out of the `web_search_result`
blocks programmatically — **not** parsed from the model's prose — so a chatty or
truncated answer can't corrupt the list.

Login-walled hosts (Facebook, Instagram, Reddit, X, TikTok, Pinterest) are
excluded at search time. The fetcher only ever gets a consent page from those, so
letting them through would burn candidate slots for nothing.

### ② Fetch

Pages go through `src/utils/safeFetch.js`, the same SSRF-guarded fetcher the
admin scraper uses: private/loopback/link-local addresses are refused, and the
DNS lookup that validates the address is the one undici connects with, so a
short-TTL rebinding record can't slip past the check.

### ③ Extraction

A second `claude-opus-5` call per page, at `effort: 'low'`, under a JSON schema
that mirrors `EventScraperPrompt`'s contract. The schema adds one field the admin
path doesn't have — `is_trading_card_event` — so the model can say "this is a
shop homepage, not an event" instead of inventing a plausible-looking event to
satisfy the shape.

Page text is passed as data with an explicit instruction not to follow
instructions found in it. It's untrusted web content.

### ④ Gates

A candidate is rejected (and recorded as such, with a reason) when:

- the model says it isn't a trading card event
- the page has under 200 characters of readable text
- there's no specific `start_date` — `events.start_date` is `NOT NULL`, and an
  undated page is usually a recurring "every second Sunday" listing
- the date has already passed, or is more than 400 days out
- an event with the same `source_url` already exists
- an event on the same date has the same comparable title (punctuation and year
  stripped) or the same venue — an organiser listing one show on three sites
  shouldn't produce three drafts

---

## Cost control

The whole design hangs off `event_scan_candidates.url` being **unique**. A URL is
recorded the first time it is seen and never fetched or sent to the model again.
Rerunning the same queries every night therefore costs one search call, not N
extractions — the marginal cost of a night where nothing new was published is a
single Claude call.

Per-run budgets (`src/utils/eventScanner.js`):

| Constant | Value | Why |
|---|---|---|
| `MAX_SOURCES_PER_RUN` | 6 | Sources rotate on `last_scanned_at`, so a capped run still works through the whole list over a few nights |
| `MAX_CANDIDATES_PER_RUN` | 8 | One fetch + one extraction is comfortably 20s |
| `RUN_DEADLINE_MS` | 240,000 | Stops gracefully inside the function's 300s ceiling; leftovers stay `pending` for tomorrow |
| `MAX_DAYS_AHEAD` | 400 | Beyond this a "date" is almost always a misparse |

---

## Admin panel

**Admin → Event Management → Automated Scan** opens the control panel:

- **Recent runs** — the last 10 runs with counts (queries, results, pages read,
  drafts created, duplicates skipped), plus any warnings or the failure reason.
- **What it searches for** — add, remove, or switch off individual queries and
  seed pages.
- **Run scan now** — starts a run immediately. Takes a few minutes.

The Events list gains a **Found by scan** filter whenever there are unreviewed
discovered drafts, and each discovered event carries a small radar icon.

### Why "Run scan now" doesn't go through `/hcgi/api`

A run takes minutes; `api/index.js` caps at 40s. The button posts directly to
`/cron/event-scan`, which has its own 300s `maxDuration`. That endpoint accepts
**either** the `CRON_SECRET` bearer (Vercel Cron) **or** a signed-in admin's
Supabase access token (the button) — so the cron secret never reaches the
browser. A second manual run is refused while one is still in flight.

---

## Adding and tuning sources

Two kinds:

- **`search_query`** — handed to the web-search tool verbatim. Write it the way
  you'd type it into Google: `"Pokemon card show Sydney upcoming"`.
- **`seed_url`** — a page fetched directly every run without searching. Use for
  an organiser's calendar or a venue's "what's on" page you already know about.

`priority` orders the rotation (lower runs first); `is_active` switches one off
without deleting it. Seeds live in
`supabase/migrations/20260726061300_seed_event_scan_sources.sql`, but day-to-day
edits belong in the admin panel, not in a migration.

**Tuning tip:** if a query keeps producing rejected candidates, look at the
reasons in the run's warnings. Queries that return shop homepages usually need a
date word (`upcoming`, `dates`, `tickets`) added.

---

## Environment

| Variable | Effect if unset |
|---|---|
| `ANTHROPIC_API_KEY` | The run fails immediately with a recorded error — no discovery, no extraction |
| `CRON_SECRET` | Scheduled runs **fail closed** (401). Manual admin runs still work |
| `SUPABASE_SERVICE_ROLE_KEY` | Everything fails — the scanner writes with the service-role client |

The scanner shares `ANTHROPIC_API_KEY` and `CRON_SECRET` with the blog generator;
nothing new needs to be added to Vercel if that's already running.

---

## Schema

| Table | Purpose |
|---|---|
| `event_scan_sources` | Queries and seed URLs, with `priority`, `is_active`, `last_scanned_at` |
| `event_scan_runs` | One row per run: counts, `warnings` (jsonb), `error`, `trigger`, `triggered_by` |
| `event_scan_candidates` | Every URL ever considered, unique on `url`, with `status` and `reason` |

Plus two columns on `events`: `auto_discovered` (boolean) and `discovered_at`.

All three tables are RLS-enabled with **admin read only** — the backend writes
them with the service-role key, so no write policies exist at all. Source edits
go through `/event-scan/sources` on the API rather than direct client writes.

---

## Troubleshooting

**A run says `completed` but created nothing.** Normal on most nights — the
dedupe ledger means only genuinely new URLs are processed. Check
`candidates_found` against `pages_fetched`: if results were found but no pages
read, everything was already known.

**Every candidate is rejected.** Open the run's warnings. If the reasons are all
"not a trading card event", the queries are pulling shop homepages — tighten them
with date words. If they're fetch timeouts, the sites may be blocking the
scraper's user agent.

**`Discovery declined by the model`.** A safety classifier refused. The request
already opts into `fallbacks: 'default'`, so this means the fallback refused too.
Look at the query list for something that reads oddly.

**Run stuck at `running`.** The function was killed (timeout or a deploy
mid-run). The row stays `running`; the next run is unaffected, and manual runs
unblock automatically after 10 minutes.

**A wrong event got created.** Delete it in Event Management as normal. Its
candidate row keeps `status = 'imported'`, so the scanner won't recreate it from
the same URL.

---

## Related

- `docs/blog-automation.md` — the other nightly Claude job, same cron pattern
- `src/utils/eventScanner.js` — the engine
- `api/event-scan.js` — the cron/admin entrypoint
- `src/routes/event-scraper.js` — the manual, one-URL admin scraper this reuses
