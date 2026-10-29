# Event organiser logo

An event page can carry the **organiser's logo** — a still image, or a
"moving" one (animated GIF / animated WebP, or a short muted MP4 / WebM loop)
— shown beside the event title, in the sidebar column **above Event
Details**. When an event has one, the title row splits like the content under
it: the title stops at the divider between *About This Event* and *Event
Details*, and the logo fills the column to its right. Without one, the title
keeps the full width as before.

## Where it lives

| Piece | Location |
|---|---|
| Column | `events.organizer_logo_url` (text, public URL; NULL = no logo). Migration `20261029022225_event_organiser_logo.sql` adds it, re-exposes `events_public`, and widens the `events` bucket's allowed MIME types to include `video/mp4` / `video/webm` (it was image-only) |
| Rules | `utils/eventOrganiserLogo.js` — dependency-free, shared by the form, the page, `lib/eventSeo.js` and `api/prerender.js`: accepted types (`LOGO_ACCEPT`), the 8 MB cap (`LOGO_MAX_BYTES`), `logoFileError()`, `isVideoLogoFile()` / `isVideoLogoUrl()` (video loops render with `<video>`, everything else with `<img>`), `safeLogoUrl()` (http(s) only — a stored value never becomes a `src` otherwise) and `logoAltText()` |
| Upload | `utils/uploadEventOrganiserLogo.js` → `events` bucket, `logos/<uuid>.<ext>`, one-year cache header. PNG/JPEG are compressed; GIF, WebP and video go up **untouched** (a canvas re-encode would freeze an animation on its first frame). The path is deliberately **not** `Date.now()`-stamped: `utils/imageUrl.js` infers a 480 px `.thumb.webp` companion from a timestamped filename in this bucket, and a logo has none |
| Form | Event form → **Organiser** tab, under Organizer Name (admin and public submissions alike): drop zone with an image/video preview and a remove button. The file is uploaded on save; an upload failure fails the save rather than silently dropping the logo |
| Page | `components/events/EventOrganiserLogo.jsx`, placed by `EventDetailCard` in the title row's third column (`lg:grid-cols-3`, title `lg:col-span-2` with the divider border). `<img>` routes through the image CDN; `<video>` uses the canonical Supabase URL (`publicVideoUrl`) because the CSP `media-src` only allows that host, and plays `autoPlay muted loop playsInline`. A load error hides the figure and the title goes back to full width on the next render of a page without one |
| SEO | An **image** logo becomes `organizer.logo` on the Event JSON-LD (`lib/eventSeo.js` and `buildEventLd()` in `api/prerender.js`) and an `<img>` in the bot prerender; a video loop is emitted nowhere (nothing to index, and the prerender never emits media) |

## Rules

- **Keep it small.** Every visitor to the event page downloads the logo on
  load; the 8 MB cap is a ceiling, not a target — a looping logo should be a
  few hundred KB.
- Animated logos must be uploaded **as GIF/WebP/video** — never pass them
  through `compressImage()`; it re-encodes through a canvas and keeps only the
  first frame.
- Never put the logo on a `Date.now()`-stamped path in the `events` bucket
  (see Upload above), and never write `organizer_logo_url` with anything but
  a public `https://` URL — the page refuses anything else.
