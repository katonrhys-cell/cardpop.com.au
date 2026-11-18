# Video watch pages

Every video on the site has a page of its own, where the video is the main
content:

```
<the page it belongs to>/videos/<key>
```

| The video is on | Its watch page |
|---|---|
| An event (`events.event_videos`) | `/events/<slug>/videos/<youtube id>` |
| An organiser page (`event_organisers.videos`) | `/events/organisers/<slug>/videos/<youtube id>` |
| An article's featured video, or an event review's videos | `/blog/<slug>/videos/<key>` |
| A card shop page (`local_game_stores.videos`) | `/card-shops/<city>/<slug>/videos/<key>` |

`<key>` is the YouTube id, `vimeo-<id>` for a Vimeo link, or `clip-<hash>` for
an uploaded clip (a hash of its URL, so it survives reordering and caption
edits).

## Why

Google indexes a video, and shows it as a video result, only on a **watch
page**: a page whose main purpose is that one video. An event page with a
video under the photo gallery is not one. In November 2026 Search Console
listed every event video under *Video indexing → "Video isn't on a watch
page"*, because the event pages carried a `VideoObject` for each video while
being about the event.

So the event (organiser, article, shop) page still **plays** the video for
visitors, but it no longer claims it: no `VideoObject`, and for crawlers a
link to the watch page instead. The watch page is the only place the markup
is emitted.

## Where it lives

| Piece | Location |
|---|---|
| Paths, titles, descriptions, `VideoObject` + breadcrumb | `utils/videoWatch.js` — dependency-free, shared by the SPA, the prerender and the sitemap. One `…WatchSource(row)` per kind of parent page; `buildWatchPage(source, key)` returns everything one watch page shows, or `null` when the parent has no such video; `watchLinks(source)` is what parent pages and the sitemap list |
| The page | `pages/videos/VideoWatchPage.jsx` (`kind` prop), four routes in `App.jsx`. Player first at full width, then the name, what it is from, a button back to the parent and the other videos from the same page. Parent rows load through `lib/videoWatch.js` |
| For crawlers | `renderVideoWatch()` in `api/prerender.js` — the same page as HTML with the real `<iframe>` / `<video>` above the `<h1>`, sized to stay large and inside the viewport. Bot rewrites in `vercel.json` (`/events/:slug/videos/:key`, `/events/organisers/:slug/videos/:key`, `/blog/:slug/videos/:key`; `/card-shops/:path*` already covers shops) |
| Links from the parent | "Open video page" under each player (`EventVideos`, `ReviewVideoPlayer`, the article's featured video) and, in the prerender, `watchLinksHtml()` — thumbnail + "Watch: …" per video |
| Sitemap | `api/sitemap.js` lists each watch page under its parent with Google's video extension (`<video:video>`: thumbnail, title, description, player or file). The video columns for organisers / articles / reviews are read in their own queries, so a failure there costs only the watch URLs |
| Upload date | `events.event_videos` / `event_organisers.videos` entries carry `added_at`, stamped by `eventVideosForSave()` when a video is first added (a saved video keeps what it had). A video saved before the stamp existed uses the listing's `created_at`; articles use `published_at`, shops `updated_at` |

## Rules

- **`VideoObject` is only ever built in `utils/videoWatch.js`.**
  `tests/backend/videoObjectOnlyOnWatchPages.test.js` fails CI if the type
  appears as a string anywhere else. Never add one to a page that is about
  something other than the video.
- **A new kind of page that carries videos** gets a `…WatchSource()` in
  `utils/videoWatch.js`, a loader in `lib/videoWatch.js` and in
  `WATCH_SOURCE_LOADERS` (`api/prerender.js`), a route in `App.jsx`, a bot
  rewrite in `vercel.json`, and its watch URLs in `api/sitemap.js`. Its own
  page links to the watch pages with `watchVideoPath()`.
- The markup is only emitted with every field Google requires (name,
  description, thumbnail, upload date). A video with no thumbnail anywhere
  (a Vimeo link on a page with no image) still gets its page, without the
  `VideoObject`.
- `embedUrl` is the player's own URL (the iframe `src`); `contentUrl` is only
  ever a real media file. A `youtube.com/watch?v=` link is neither.
- A removed video's watch URL answers **301 to its parent page** for crawlers
  and redirects there in the SPA. A watch page whose parent isn't public is a
  404.
- Embeds stay on the hosts in the CSP `frame-src` (`youtube-nocookie.com`,
  `player.vimeo.com`); uploaded clips play from the Supabase host
  (`media-src`).

## After a deploy

In Search Console → **Video indexing**, the event URLs drop out of "Video
isn't on a watch page" as Google recrawls them (their markup is gone), and
the `/videos/` URLs appear under indexed videos. To hurry one along, run
**URL Inspection → Request indexing** on its watch URL. Note that for a
YouTube embed Google may still prefer youtube.com's own page for the same
video in results — the watch page makes the video *eligible* here, it does
not outrank the original.
