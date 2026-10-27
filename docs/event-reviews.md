# Event reviews

A first-hand write-up of a card show or TCG event that CardPop attended —
"we went to Vault Melbourne, here's how it rated". Written by an admin, published
to The Parallel Report, and linked from the event's own page.

## What a review is

Two rows, one editor:

| Where | What |
|---|---|
| `blog_articles` | The story. A normal article with `category = 'event-reviews'` (`data/blogCategories.js` → `EVENT_REVIEWS_CATEGORY`), so it appears in the blog index, the category hub `/blog/category/event-reviews`, the sitemap and the prerenderer like any other article. |
| `event_reviews` | The structured half, 1:1 with the article (`article_id` unique): `event_id`, `attended_on`, `overall_rating` (half stars, 0.5–5), `scores` (jsonb keyed by the five scorecard categories), `go_again` (`yes` / `maybe` / `no`), `verdict`, `ticket_paid_aud`, `hours_spent`, `crowd_level` (`quiet` / `steady` / `busy` / `packed`), `headline_pickup`, `gallery` (`[{url, caption, alt}]`), `video` (`{url, poster_url, caption}` or null — an upload to the `media` bucket or a YouTube/Vimeo link), `pickups` (`[{name, price_aud, url, image_url, note}]`). Migrations: `supabase/migrations/20261009213329_event_reviews.sql`, `20261027070258_event_review_video.sql` (the `video` column + video MIME types on the `media` bucket). |

**Visibility follows the article.** The `event_reviews` SELECT policy returns a
row when its article `is_published`, or to an admin. Only admins insert /
update / delete. A draft is therefore invisible everywhere public, including the
event page teaser.

## The rules live in one place

`utils/eventReview.js` is dependency-free (no React, no Supabase) so the admin
editor, the article page, the event-page teaser **and** `api/prerender.js` share
it:

- `SCORE_CATEGORIES` — Vendors & stock, Prices, Venue & organisation,
  Atmosphere, Value for money. Add a category here and the editor, scorecard and
  tests pick it up.
- `CROWD_LEVELS`, `GO_AGAIN_OPTIONS` — the quick-fact vocabularies (also
  enforced by CHECK constraints in the migration; keep both lists in step).
- `computeOverall(scores)` — half-star average of the set sub-scores. The editor
  stores this as `overall_rating` unless the admin switches on **Set the overall
  myself**.
- `normalizeReview(form)` — the only path from form state to the DB row: drops
  unknown keys, trims, nulls blanks, validates scores and **sanitises links**
  (`safeLink`: `http(s)://` or a site-relative `/path` only — a `javascript:`
  URL in a pickup link is dropped, never rendered).
- `reviewPublishProblems()` — what publishing needs: a title, the event, and
  **at least one of** a star rating, photos, a video or the written report.
  Those four parts are independent — a review can be just a rating, just a
  gallery, just a video or just the report, in any combination. A report that
  was started but is under 40 characters blocks publishing (finish it or clear
  it). Drafts save with anything.
- `cleanVideo()` / `videoKind()` / `reviewVideoFileError()` — the video: kept
  only when it is a `.mp4/.webm/.mov/.m4v` URL (an upload) or a link
  `utils/videoEmbed.js` can embed (YouTube / Vimeo); uploads are capped at the
  `media` bucket's 50 MB, so longer footage goes up as a link.
- `buildEventReviewJsonLd()` — the schema.org `Review` (of an `Event`) emitted
  on the article page and by the prerenderer. Returns null without a rating,
  because Google rejects a `Review` with no `reviewRating`.

## Admin UI

- **Admin → Event Reviews** (`/admin/event-reviews`,
  `pages/admin/EventReviewsAdminPage.jsx`) lists every review with its event and
  draft/published state.
- **Write a review** (`/admin/event-reviews/new`, or the clipboard button on an
  event's row in Admin → Events, which preselects that event via `?eventId=`)
  opens the full-page editor `pages/admin/EventReviewEditorPage.jsx`:
  1. **Which event?** — searchable picker over `events` (admins read the table
     directly). Selecting an event defaults `attended_on` to its start date and
     suggests a title.
  2. **The story** — title (auto-slug until the slug is edited), standfirst,
     byline (defaults to the admin's display name), cover photo, and the body in
     `components/admin/RichTextEditor.jsx` (Tiptap). It reads and writes the same
     HTML `blog_articles.content` already stores, so the article renders through
     the existing `.article-content` styles and DOMPurify pass unchanged. Body
     photos are uploaded through the toolbar.
  3. **Scorecard** — `components/admin/StarInput.jsx` per category (left half of
     a star = half score), the derived or hand-set overall, "Would you go
     again?", one-line verdict.
  4. **Quick facts**, 5. **Photo gallery** (multi-upload, captions, alt text,
     reorder), 6. **Video** (upload a clip up to 50 MB, or paste a YouTube /
     Vimeo link; optional caption; live preview), 7. **Pickups** (name, price
     paid, optional CardPop link, optional photo, note), 8. **Publishing**
     (tags, SEO, featured).
- The sticky bar saves a **draft** or **publishes**; Publish is disabled until
  `reviewPublishProblems()` is empty and the reasons are listed in the
  Publishing card.

Every image goes through `utils/uploadReviewImage.js`: compressed in the browser
(`utils/compressImage.js`), stored in the admin-only `media` bucket under
`event-reviews/<covers|gallery|pickups|body>/` with a timestamped immutable
filename and `cacheControl: 31536000`, exactly like every other upload
(`docs/image-cdn.md`). The DB keeps canonical Supabase URLs; `toCdnUrl()` rewrites
them onto the image CDN at render time.

The video goes through `uploadReviewVideo()` in the same file: stored as-is
(never re-encoded) under `event-reviews/videos/` with a JPEG poster frame
beside it (`<path minus ext>.poster.jpg`, captured in the browser by
`captureVideoPoster()`; a failed capture never fails the upload). The player's
`src` stays the canonical Supabase URL because the CSP `media-src` allows the
Supabase host, not the image CDN; the service worker never intercepts video.

## Public rendering

- **Article page** (`pages/blog/BlogArticlePage.jsx`): after the article loads it
  fetches the `event_reviews` row by `article_id` and the event from
  `events_public`. Scorecard (`components/reviews/EventReviewScorecard.jsx`) and
  quick facts (`EventReviewQuickFacts.jsx`) sit between the hero and the body;
  video (`EventReviewVideo.jsx` — native `<video>` for an upload, a
  `youtube-nocookie` / Vimeo iframe for a link), gallery
  (`EventReviewGallery.jsx`, keyboard-navigable lightbox) and pickups
  (`EventReviewPickups.jsx`) follow the body. Each section renders nothing when
  its data is empty, so a review with no photos has no empty gallery heading,
  and a review published without a written report shows no "No content"
  placeholder.
  The `Review` JSON-LD joins the existing BlogPosting / Breadcrumb / FAQ nodes.
- **Event page** (`pages/EventDetailPage.jsx`): `EventReviewTeaser` queries
  `event_reviews` joined to its published article for that `event_id` and shows a
  "CardPop was there" card — stars, verdict, standfirst, cover photo and a link
  to the full review. No review → nothing rendered.
- **Prerender** (`api/prerender.js`): for `event-reviews` articles the bot HTML
  adds the same `Review` node.

## Adding the first review

The Vault Melbourne show is already in `events`
(`Vault – Melbourne Card & Collectible Show`, 4 Oct 2026). Open Admin → Events,
click the clipboard icon on its row, and write.

## Tests

- `tests/frontend/eventReview.test.js` — the helper module: scores, overall,
  sanitising, publish rules, formatting, JSON-LD.
- `tests/frontend/eventReviewSections.test.jsx` — the public components and the
  star input render and behave (lightbox navigation, link safety, totals).
