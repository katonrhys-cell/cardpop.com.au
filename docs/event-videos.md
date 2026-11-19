# Event videos

Every event page can embed **several YouTube videos** — the organiser's
recap, a vendor walkthrough, last year's highlights — directly below the
photo gallery. The first one starts playing by itself (muted) ten seconds
after the page opens, so the best video goes first.

## Where it lives

| Piece | Location |
|---|---|
| Column | `events.event_videos` (jsonb, `[{ title, url, added_at?, creator? }]`, display order). `events.youtube_url` stays as the **first video's URL** — the form writes both — so readers that predate the list keep working. Migration `20261029005944_event_videos.sql` (adds the column, folds an existing `youtube_url` into a one-item list, re-exposes `events_public`) |
| Shape & limits | `utils/eventVideos.js` — `cleanEventVideos(videos, legacyUrl)` is the one normaliser: only links with a parseable YouTube id survive (watch, youtu.be, shorts, live, embed), duplicates keep their first slot, 12 videos, 80-char titles; an empty list falls back to `youtube_url` as one untitled video. Returns `{ title, url, id, added_at? }` with the canonical watch URL. Dependency-free so the form, the page, `lib/eventSeo.js` and `api/prerender.js` agree |
| Editor | `components/events/EventVideosEditor.jsx` on the event form's **Details** tab, under the photo gallery (admin and public submissions alike): per-video URL with a live "YouTube video found / Not a YouTube link" check and thumbnail, optional title, reorder, remove, **Add another video**. The Facebook post / Reel field stays on the Organiser tab |
| Page | `components/events/EventVideos.jsx`, rendered by `EventDetailCard` straight after `EventPhotoAlbums`: "Event Video(s)" heading with the count, one `youtube-nocookie.com` iframe per video (`?enablejsapi=1`) with the title as a caption, the Facebook embed last. The first iframe loads eagerly and is sent `mute` + `playVideo` through the player API `VIDEO_AUTOPLAY_DELAY_MS` (10 s) after mount — only the first, so several never play at once, and a visitor who already pressed play keeps watching |
| SEO | Each video has its own **watch page**, `/events/<slug>/videos/<youtube id>`, and that page — not the event page — carries its `VideoObject` (`utils/videoWatch.js`, `docs/video-watch-pages.md`). An event page is not a watch page, so it emits none: it links each video to its watch page ("Open video page" under the player; a thumbnail + "Watch: …" link in the prerender). `added_at` on each entry (stamped by `eventVideosForSave()` on first save) is the upload date the watch page reports |

## Creator credit

A video can credit whoever made it — the YouTuber or influencer who filmed the
show. Under **Add creator credit (picture & socials)** on each video row the
form takes a picture, a name and Instagram / YouTube / TikTok / Facebook / X
(a handle such as `@thenew50noob`, or a pasted profile link). The page shows
them directly under that video: the round picture, "Video by *name*" and one
chip per social with its icon and handle (`components/events/VideoCreatorCredit.jsx`).
The same credit shows on the video's watch page and in its prerendered copy.

- Stored inside the video entry: `creator: { name, avatar_url, instagram,
  youtube, tiktok, facebook, x }`, only the fields that are set. No column or
  migration — it rides in `events.event_videos` / `event_organisers.videos`.
- `cleanVideoCreator()` is the one normaliser. Each social becomes a canonical
  profile URL on **that platform's own host** (`creatorProfileUrl()`); anything
  else is dropped, because the stored value becomes a link.
- The picture uploads when it is picked, through
  `utils/uploadVideoCreatorAvatar.js`: 256 px, `events` bucket,
  `logos/creator-<uuid>.<ext>` (same naming rule as the organiser logo — never
  a `Date.now()` name in that bucket).
- A credit can be **saved and reused**: *Saved creators* in the form picks one,
  admins save a new one from what they typed, and each saved creator has a page
  at `/creators/<slug>` listing their videos — see `docs/video-creators.md`.
- Forms hold videos as `videosToForm(cleanEventVideos(...))`. Mapping a list
  down to `{ title, url }` by hand drops the credit on the next save.

## Rules

- **Put the best video first** — it is the one that autoplays and the one
  `youtube_url` carries.
- Only YouTube: the embed host is in the CSP `frame-src`; anything else
  would be blocked, and an arbitrary stored URL must never become an iframe
  src. The editor refuses other hosts and `cleanEventVideos` drops them.
- Never emit a `VideoObject` for these on the event page — it is not a watch
  page (see `docs/video-watch-pages.md`); a test fails CI if one comes back.
- Save the list through `eventVideosForSave()` so new videos get `added_at`.
- Never set `youtube_url` without `event_videos` from new code; the single
  column exists for readers that predate the list and is derived on save.
- Add a column to `events_public` only by appending it in a migration that
  recreates the view — `create or replace view` can't drop or reorder.
