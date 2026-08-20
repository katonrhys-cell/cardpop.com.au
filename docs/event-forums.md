# Event forums & information boards

Every event detail page (`/events/:eventId`, `pages/EventDetailPage.jsx`) now has
two community sections under the event card: an **Information Board** and an
**Event Discussion**. Migration:
`supabase/migrations/20260820081848_event_forums_and_info_board.sql`.

## Event discussions (shared with the community forum)

Event discussions are ordinary community forum posts with `posts.event_id`
set — one shared forum, two surfaces:

- The event page (`components/events/EventDiscussion.jsx`) lists the threads
  attached to that event and links "Start a Discussion" to
  `/community/discussion/new?eventId=<uuid>`, which pre-selects the *Events*
  category and stamps `event_id` on the insert.
- The same threads appear in `/community/forum`; opening one lands on the
  shared `/community/discussion/:id` page, which shows a "Event discussion:
  <title>" chip linking back to the event when `event_id` is set.

**Replies** live in the pre-existing `comments` table (`post_id`, optional
`parent_id`, `body`); `pages/community/CommunityDiscussionPage.jsx` renders the
list and composer. A DB trigger (`update_post_comment_count`) maintains
`posts.comment_count`, which the forum/community lists display. Authors can
delete their own replies; admins can delete any (policy added in this
migration). Views are counted through the `increment_post_views` RPC (definer)
because the `posts` UPDATE policy is author-only.

The migration also **repairs the forum**: the live `posts` table pre-dated this
repo and never had the `title`, `category` and `views` columns the forum UI
reads/writes, so creating a discussion failed in production until this landed.

Reading posts/comments requires a signed-in user (existing RLS, unchanged);
anonymous visitors get a join prompt. Making the forum publicly readable is a
one-line policy change if ever wanted.

## Information board

Publicly readable; writable by **admins, the event's organiser
(`events.organiser_id`), and users RSVP'd to the event as a vendor** — decided
by the `can_manage_event_board(event_id)` definer function, enforced by RLS and
mirrored in the UI (`components/events/EventInfoBoard.jsx`).

- `event_board_posts` — announcements (optional title, body, `is_pinned`).
  Pinned first, then newest. Authors/admins can pin, unpin and delete.
- `event_stall_layouts` — one floor-plan image per event (PK `event_id`).
  Uploaded to the `events` storage bucket under `layouts/<eventId>-<ts>.<ext>`
  (timestamped = immutable, per the image-CDN rules); the DB keeps the
  canonical Supabase URL and rendering goes through `publicImageUrl()`.
- `event_stalls` — structured stall list: `label` (stall number), `name`
  (vendor/business), `description`, optional `vendor_id`, `sort_order`, and
  **`pos_x`/`pos_y`** (0–100, % across the layout image). Placed stalls already
  render as numbered markers over the floor plan (click to highlight in the
  list); the same coordinates are the data model for the planned fully
  interactive clickable floor plan — no schema change needed.

## Badges

`get_event_participant_roles(event_id, user_ids[])` (definer RPC) returns
`organiser`/`vendor` roles for the given users only, so the UI can badge
authors without exposing `events.organiser_id` (hidden from `events_public`) or
raw `event_rsvps` rows (owner/admin-only RLS). Shared helpers:
`lib/eventBoard.js` (tests: `tests/frontend/eventBoard.test.js`).
