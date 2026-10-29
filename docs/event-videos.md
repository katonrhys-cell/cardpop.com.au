# Event videos

Every event page can embed **several YouTube videos** — the organiser's
recap, a vendor walkthrough, last year's highlights — directly below the
photo gallery. The first one starts playing by itself (muted) ten seconds
after the page opens, so the best video goes first.

## Where it lives

| Piece | Location |
|---|---|
| Column | `events.event_videos` (jsonb, `[{ title, url }]`, display order). `events.youtube_url` stays as the **first video's URL** — the form writes both — so readers that predate the list keep working. Migration `20261029005944_event_videos.sql` (adds the column, folds an existing `youtube_url` into a one-item list, re-exposes `events_public`) |
| Shape & limits | `utils/eventVideos.js` — `cleanEventVideos(videos, legacyUrl)` is the one normaliser: only links with a parseable YouTube id survive (watch, youtu.be, shorts, live, embed), duplicates keep their first slot, 12 videos, 80-char titles; an empty list falls back to `youtube_url` as one untitled video. Returns `{ title, url, id }` with the canonical watch URL. Dependency-free so the form, the page, `lib/eventSeo.js` and `api/prerender.js` agree |
| Editor | `components/events/EventVideosEditor.jsx` on the event form's **Details** tab, under the photo gallery (admin and public submissions alike): per-video URL with a live "YouTube video found / Not a YouTube link" check and thumbnail, optional title, reorder, remove, **Add another video**. The Facebook post / Reel field stays on the Organiser tab |
| Page | `components/events/EventVideos.jsx`, rendered by `EventDetailCard` straight after `EventPhotoAlbums`: "Event Video(s)" heading with the count, one `youtube-nocookie.com` iframe per video (`?enablejsapi=1`) with the title as a caption, the Facebook embed last. The first iframe loads eagerly and is sent `mute` + `playVideo` through the player API `VIDEO_AUTOPLAY_DELAY_MS` (10 s) after mount — only the first, so several never play at once, and a visitor who already pressed play keeps watching |
| SEO | `buildVideoJsonLds(event)` in `lib/eventSeo.js` and `buildEventVideoLds()` in `api/prerender.js` emit one `VideoObject` per video (`<event> — <title>`, or `Event Video N`), with the YouTube thumbnail and `uploadDate` = the row's `updated_at`. The prerender also lists each video as a link under an "Event Videos" heading so a crawler without JS sees them |

## Rules

- **Put the best video first** — it is the one that autoplays and the one
  `youtube_url` carries.
- Only YouTube: the embed host is in the CSP `frame-src`; anything else
  would be blocked, and an arbitrary stored URL must never become an iframe
  src. The editor refuses other hosts and `cleanEventVideos` drops them.
- Never set `youtube_url` without `event_videos` from new code; the single
  column exists for readers that predate the list and is derived on save.
- Add a column to `events_public` only by appending it in a migration that
  recreates the view — `create or replace view` can't drop or reorder.
