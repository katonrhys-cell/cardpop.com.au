# Event scanning from Instagram

The event scanner (`docs/event-scanning.md`) searches the web, but it cannot see
Instagram: the site is login-walled, so it is on the search's blocked list and a
fetched post is a consent page. Most Australian card shows are announced on
Instagram first, usually as a flyer image with a short caption.

This is the second half of the scanner. It reads Instagram through **Meta's
official Instagram Graph API** with CardPop's own account token, and files what
it finds as `pending_review` drafts in the same queue as everything else.

**It never publishes anything, and it never acts on Instagram** — no posts,
likes, follows, comments or messages. It is read-only.

---

## What it can and cannot read

| Reads | How |
|---|---|
| Recent posts of the accounts on the source list | Business Discovery, by handle |
| Posts in which another account **tagged** CardPop | The account's `/tags` edge |

| Cannot read | Why |
|---|---|
| CardPop's home feed, or "everyone CardPop follows" | Meta's API has no feed and no following list. Accounts are listed by hand (or with **Add organisers' accounts**) |
| Personal or private accounts | Business Discovery only returns Business and Creator accounts |
| Stories | Not available for other accounts |
| Hashtag search (`#cardshow`) | Possible in the API but needs Meta App Review ("Instagram Public Content Access") and is capped at 30 hashtags a week. Not built |
| The words inside a Reel | A video post is read from its caption only |

Logging in as the account and scraping the app would get around these limits. It
is against Instagram's terms and gets accounts restricted, so it is not done.

---

## How a run works

`GET /cron/event-scan?mode=instagram` → `runInstagramEventScan()` in
`src/utils/instagramEventScanner.js`. Daily, from the scheduler Worker's `daily`
schedule (`event_instagram` job), and on demand from **Scan Instagram now** in
Admin → Event Management → Automated Event Scan → *What it searches for*.

1. **Claim sources** — active `event_scan_sources` rows of kind
   `instagram_account` (value = handle) and `instagram_tagged` (one fixed row),
   oldest-scanned first, up to 20 a run.
2. **Read posts** — the newest 8 posts per account (15 for tagged posts). Posts
   older than 45 days, and posts with no photo and almost no caption, are
   dropped before anything is recorded.
3. **Dedupe** — each post is an `event_scan_candidates` row keyed by its
   permalink. A post already there is never sent to the model again. This is the
   cost control: after the first week a run only pays for genuinely new posts.
4. **Extract** — one Claude call per new post (`EXTRACTION_MODEL`, low effort,
   the same `EVENT_SCHEMA` and cached `EventScraperPrompt` as a web page) with
   the caption **and up to two photos**, because the date and venue are usually
   only on the flyer. Photos are downloaded from Meta's CDN, sent inline and
   never stored. Recorded in the AI usage ledger as `event_instagram_extraction`.
5. **Gates** — exactly the web scan's (`fileExtraction()` in `eventScanner.js`):
   must be a dated, upcoming Australian event, not more than 550 days out, not
   already on the site. One more duplicate rule applies here: **same organiser
   Instagram + same start date = the same event**, because an organiser posts
   about one show many times under different wording.
6. **Draft** — `status = 'pending_review'`, `auto_discovered = true`,
   `source_url` = the post, `instagram_url` = the organiser's profile.
   `image_url` is left empty: Meta's CDN links expire within days, so add the
   image when reviewing the draft.

Budgets per run: 20 posts in total, 4 new posts per account (newest first — the
rest are left unrecorded and picked up the next day), 240 s. Posts the run had
no time to read are released rather than left recorded.

A run row is written to `event_scan_runs` with `scope = 'instagram'`; for these
rows `queries_run` is accounts checked, `candidates_found` new posts and
`pages_fetched` posts read. No row is written when Instagram is not connected or
no Instagram source is switched on — the cron call answers `200 { skipped }`.

### Failures

- **Token expired or revoked** (Graph error 190): the run stops at the first
  call and is recorded `failed`; the endpoint answers 502, so the scheduler
  Worker emails `admin@cardpop.com.au`. The panel's status line says the same.
- **One account can't be read** (renamed, deleted, switched to a personal
  account): a warning on the run, and the run carries on. Remove or fix the
  source.
- **One post fails** in the model: marked `failed` on its candidate row, warning
  on the run, the rest continue.

---

## Setting it up (one-off, in Meta's dashboards)

None of this can be done from the repo. It needs someone with admin access to
CardPop's Instagram and Facebook Page.

1. **Account type.** CardPop's Instagram must be a **Business** or **Creator**
   account linked to a **Facebook Page** (Instagram → Settings → Account type
   and tools; then link the Page).
2. **Meta app.** At developers.facebook.com create an app (use case: *Other* →
   type *Business*) and add the **Instagram** product, choosing **API setup with
   Facebook login** — Business Discovery is not available on the "Instagram
   login" variant.
3. **Token.** Recommended: in Meta Business Settings create a **System User**,
   assign it the app, the Facebook Page and the Instagram account, and generate
   a token with these permissions. A system-user token does not expire.
   - `instagram_basic`
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_manage_comments` — only for *posts that tag CardPop*
   - `business_management` — when the Page is held through Business Manager

   A personal long-lived user token also works but **expires after 60 days**;
   when it does, the daily run fails and emails the admin address.
4. **Account id.** With that token, in the Graph API Explorer:
   `GET /me/accounts?fields=instagram_business_account{id,username}` — the
   `instagram_business_account.id` (a long number) is the account id.
5. **Environment variables** (Vercel → Settings → Environment Variables, then
   redeploy; on the VPS stack, `/opt/cardpop/shared/.env`):

   | Variable | Value |
   |---|---|
   | `INSTAGRAM_ACCESS_TOKEN` | The token from step 3. Server-side only — never a `VITE_` variable |
   | `INSTAGRAM_ACCOUNT_ID` | The numeric id from step 4 |
   | `INSTAGRAM_GRAPH_VERSION` | *(optional)* Graph API version, e.g. `v25.0`. Default is pinned in `src/utils/instagramClient.js`; Meta retires a version about two years after release, so bump it before then |

6. **Check it.** Admin → Event Management → Automated Event Scan → *What it
   searches for*. The Instagram box should read **Connected as @…**. Press
   **Add organisers' accounts** (adds every Instagram link already on an
   organiser page or event), add any other handles, then **Scan Instagram now**.
7. **Daily run.** Redeploy the scheduler Worker so the `event_instagram` job
   exists there: `npx wrangler deploy --config cloudflare/scheduler/wrangler.toml`.
   Until then only the button runs it.

### Not verified from the repo

The Graph API calls are covered by tests against stubbed responses; they have
not been run against Meta, because that needs CardPop's token. Two things to
confirm on the first real run:

- **Access level.** Reading with your own account's token while you hold a role
  on the app is expected to work on Standard Access, without App Review. If
  Meta answers with a permissions error (codes 10 or 200) the app needs
  Advanced Access for the permissions above.
- **Tagged posts permission.** If the *Posts that tag CardPop* source reports a
  permissions warning on each run while accounts work, the token is missing
  `instagram_manage_comments` — add it, or switch that source off.

---

## Choosing accounts

Each watched account costs nothing to check and one model call per **new** post
(roughly a cent or two with a photo). An organiser who posts twice a week is
cheap; a shop that posts stock photos five times a day is not, and almost none
of it is events. Watch organisers and show accounts; leave retail shops off
unless they run regular events.

The Instagram links on store pages are deliberately not imported by **Add
organisers' accounts** for that reason.

---

## Schema

`supabase/migrations/20261117001144_event_scan_instagram_sources.sql`:

- `event_scan_sources.kind` also allows `instagram_account` and
  `instagram_tagged` (one seeded row, on by default).
- `event_scan_runs.scope` — `web` (default) or `instagram`.
- `events_instagram_start_date_idx` for the organiser-and-date duplicate check.

## Code

| File | Role |
|---|---|
| `src/utils/instagramClient.js` | Graph API reads, handle cleaning, photo download (Meta CDN hosts only) |
| `src/utils/instagramEventScanner.js` | The run: sources → posts → extraction → drafts |
| `src/utils/eventScanner.js` | Shared gates (`fileExtraction`), dedupe, schema |
| `api/event-scan.js` | `?mode=instagram` on the 300 s function |
| `src/routes/event-scan.js` | `GET /event-scan/instagram/status`, `POST /event-scan/instagram/import-organisers`, Instagram handles in `POST /event-scan/sources` |
| `components/EventScanPanel.jsx` | Status, the two buttons, account sources |
