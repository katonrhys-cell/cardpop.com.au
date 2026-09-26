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

Vercel Cron hits `/cron/event-scan` **weekly**, at `0 17 * * 0` — **17:00 UTC on
Sunday**, which is **3am Monday AEST**.

The day-of-week offset is the easy thing to get wrong here. Cron expressions are
UTC only and Australia is UTC+10/+11, so a Monday-morning local job fires on
**Sunday** in UTC. `0 17 * * 1` would be Tuesday 3am local, not Monday.

Australia observes daylight saving, so the local fire time drifts by an hour
across the year:

| Period | UTC offset | Local fire time |
|---|---|---|
| Winter (AEST) | UTC+10 | Monday 3:00am |
| Summer (AEDT) | UTC+11 | Monday 4:00am |

That's fine for a background job — nothing downstream depends on the exact hour.
If it ever needs to be 3am local year-round, the schedule has to be edited twice
a year in `vercel.json`.

**It ran nightly until August 2026.** Weekly is a deliberate trade: one run a
week costs roughly a seventh of the Claude spend, but it also discovers roughly a
seventh as much, because each run is capped by the function's 300s ceiling and
cannot simply do seven nights' work in one go. The per-run budgets below were
widened to claw some of that back. To go back to nightly, set the schedule to
`0 17 * * *` — that single change is the whole revert.

The other crons (`/api/prices/refresh` at 19:30 UTC, `/cron/blog-generate` at
21:00 UTC, `/api/stripe/reconcile-pending` at 21:15 UTC) run later in the UTC
day, so they don't overlap.

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
| `MAX_SOURCES_PER_RUN` | 12 | Sources rotate on `last_scanned_at`. Discovery is one batched call, so widening this adds searches inside a single request rather than extra requests — the cheap axis |
| `MAX_CANDIDATES_PER_RUN` | 12 | One fetch + one extraction is comfortably 20s |
| `RUN_DEADLINE_MS` | 240,000 | Stops gracefully inside the function's 300s ceiling; leftovers stay `pending` for next week |
| `MAX_DAYS_AHEAD` | 550 | Beyond this a "date" is usually a misparse — but 400 was rejecting the national circuits, which publish a year-plus ahead |

**Don't raise `MAX_SOURCES_PER_RUN` much further without testing.** Discovery
runs *before* the extraction loop and is not deadline-checked, so if that single
call grows past the 300s function ceiling the run is killed outright and its row
is stranded at `running`. The extraction loop is the part that degrades safely.

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
- **`seed_url`** — a page fetched directly without searching. Use for an
  organiser's calendar or a venue's "what's on" page you already know about.
  **See the limitation below before adding one.**

### `seed_url` is read once, not every run

The intent was that a seed page is re-read on every run. The engine doesn't do
that, and two things stop it:

- seed URLs go through `registerCandidates()` like any other candidate, and that
  function returns only URLs it has *never* seen. After the first run the seed's
  URL is in the ledger, so it is touched and skipped forever;
- `extractEventFromPage()` returns a **single** event per page, so a calendar
  listing twenty shows yields at most one of them anyway.

Together those make a seed URL on an aggregator calendar close to worthless: it
imports one event, then goes dormant. Until that changes, prefer a
`search_query` naming the series or venue — those re-run properly every rotation.

Making seed URLs behave as described needs both an exemption from the dedupe
ledger (or a re-read window) and multi-event extraction. That's an engine
change, not a config change.

`priority` orders the rotation (lower runs first); `is_active` switches one off
without deleting it. Seeds live in
`supabase/migrations/20260726061300_seed_event_scan_sources.sql`, but day-to-day
edits belong in the admin panel, not in a migration.

**Tuning tip:** if a query keeps producing rejected candidates, look at the
reasons in the run's warnings. Queries that return shop homepages usually need a
date word (`upcoming`, `dates`, `tickets`) added.

---

## Weekly re-scan of an event's website

The discovery scan above finds events we don't have. This is its counterpart for
events we **do** have: in Admin → Event Management → edit an event → **Organiser**
tab, the **Website to scrape** field (`events.source_url`) takes the organiser's
event page, with **Re-scan weekly for updates** on by default.

- **On save** the page is scanned straight away (the form calls
  `/cron/event-scan?mode=watches&event=<id>` — the 300s function — without
  waiting on it, and toasts the result when it lands).
- **Then every 7 days.** A daily GitHub Actions job (`cron-event-watch.yml`,
  02:43 AEST) calls `/cron/event-scan?mode=watches`, which scans every watch
  whose `next_scan_at` has passed (up to 10 per run, 240s budget — anything left
  over is still due the next day) and pushes each one out another week. A failed
  scan retries the next day.
- **Scan now** in the form re-scans on demand (and skips the unchanged-page
  shortcut so you get a real answer).

What a scan may do to a live event is deliberately narrow:

| Found on the page | What happens |
|---|---|
| A detail the event has **no value for yet** (ticket link, end time, venue, organiser contact, descriptions, SEO copy, tags…) | **Saved automatically.** It's new information and nothing is overwritten. |
| A **different** date, time, venue/address, entry or presale fee, ticket link or capacity | **Queued** in the form under "Changes found on the website" with ✓ Apply / ✕ Dismiss (and Apply all / Dismiss all). Never written without you — the extractor can misread a page, and your hand corrections must not be reverted next week. |
| A dismissed value again | Ignored. It's only re-proposed if the page later says something *different*. |
| Prose that's merely reworded | Ignored — descriptions/SEO copy are fill-only, since the model rephrases them every run. |

Applying an entry fee also flips the event's Free/paid switch to match.

Cost control: the page's readable text is hashed (`content_hash`), and a page
that hasn't changed since the last scan skips the model call entirely — most
weeks, most pages cost nothing but a fetch. A scan also stops itself for good
once the event's end date has passed. The page is fetched through the same
SSRF-safe fetcher and extracted with the same prompt/schema as discovery.

State lives in `event_source_watches` (one row per event, admin read-only under
RLS, written by the service-role backend). The admin routes are
`PUT /event-scan/watches/:eventId` (`{ enabled }` — follows the event's current
`source_url`; a new or changed URL resets the comparison state and schedules an
immediate scan), `POST /event-scan/watches/:eventId/apply` and `/dismiss`
(`{ fields: [...] }`). The engine is `src/utils/eventSourceWatcher.js`.

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

| `event_source_watches` | Per-event weekly re-scan of `events.source_url`: `next_scan_at`, `last_status`/`last_message`, `content_hash`, `pending_changes`, `dismissed_changes`, `filled_fields` |

Plus two columns on `events`: `auto_discovered` (boolean) and `discovered_at`.

All four tables are RLS-enabled with **admin read only** — the backend writes
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
- `src/utils/eventSourceWatcher.js` — the per-event weekly re-scan
- `api/event-scan.js` — the cron/admin entrypoint
- `src/routes/event-scraper.js` — the manual, one-URL admin scraper this reuses
