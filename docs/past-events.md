# Past events & collector reviews

The event calendar opens on what's coming up, but a finished show keeps its
page — and the collectors who went can rate it and write it up there.

## What "past" means

`utils/eventPast.js` (dependency-free) is the one definition, mirrored in the
DB by `event_has_ended()`:

- **By date** — the event's last day (`end_date`, else `start_date`) is before
  today. "Today" is the viewer's local date in the browser and the Sydney date
  in the DB, never UTC.
- **By admin** — `events.status = 'completed'`. That is the admin's "archive":
  set it in Admin → Event Management → Edit → Status. A completed event is
  treated as past whatever its date.

`pending_review`, `rejected` and `cancelled` events stay hidden everywhere, as
before. Migration: `supabase/migrations/20261017044544_past_events_and_attendee_reviews.sql`
— it widens the public SELECT policy on `events` and the `events_public` view
from `approved` to `approved | completed`, and adds the review table.

## Where past events show

| Surface | Behaviour |
|---|---|
| `/events` (+ the type pages) | Default: `approved` events from today → next year. The **Past Events** switch in the filter bar (`?past=1` in the URL) flips the window to yesterday → two years back, newest first, plus every `completed` event. Cards get a *Past event* badge, the star summary instead of the RSVP strip, and a *Details & Reviews* button. |
| `/events/:slug` | Loads for `completed` events too (SPA and `api/prerender.js`). A past event shows a *This event has ended* panel in place of RSVP / tickets / calendar, and the **Collector Reviews** section (`#reviews`). |
| Related events, local map, homepage count | Still `approved` + upcoming only — they filter `status = 'approved'` explicitly now that the view also carries completed rows. |
| Sitemap | Includes completed events inside the same 30-day recent window as approved ones. |
| Site search | Finds past events too (they are real pages now). |

`buildEventsQuery()` in `pages/community/CommunityEventsPage.jsx` builds both
modes; `tests/frontend/columnProjections.test.js` pins the filter strings.

## Collector reviews

Table `event_attendee_reviews` — distinct from `event_reviews`, which is
CardPop's own editorial review of a show (`docs/event-reviews.md`).

- One review per signed-in user per event: 1–5 whole stars, an optional
  headline (≤120 chars) and a body (10–2000 chars).
- **Only once the event has finished** — the BEFORE INSERT trigger calls
  `event_has_ended()` and refuses otherwise (`22023`). The UI never shows the
  form for an unfinished event (`canReviewEvent()`), the DB is the backstop.
- Reviews are **live immediately** (like forum posts) and every admin gets a
  bell (`event_review_posted`) linking to the event page.
- Authors edit or remove their own. Admins can **Hide** (sets `is_visible =
  false`; the author still sees it) or delete. The update trigger keeps the
  moderation columns and the row's identity out of a non-admin's hands.
- `event_attendee_review_stats` (view) gives `review_count` / `average_rating`
  per event from visible rows — what the past grid's cards and the section
  header read. Never average client-side across a paged list.

Frontend: data helpers in `lib/eventAttendeeReviews.js`, the section in
`components/events/EventAttendeeReviews.jsx`, validation shared with the DB in
`utils/eventPast.js`.

## Testing

- `npx vitest run tests/frontend/eventPast.test.js tests/frontend/eventAttendeeReviews.test.jsx tests/frontend/columnProjections.test.js`
- Migration behaviour (needs a local Postgres):
  `PGHOST=… PGPORT=… PGUSER=postgres tests/db/run-event-attendee-review-migrations.sh`
  — applies the migration twice onto a stub schema and asserts visibility,
  the finished-only rule, one-per-person, author edit limits, admin hide and
  the admin notifications.
