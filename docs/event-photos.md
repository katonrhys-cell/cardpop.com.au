# Event photos & albums

Every event page can carry a photo gallery directly below **About this
event** — the proof a show is real, busy and worth the trip, and the
material the social accounts reuse. Photos are grouped into **albums** so a
recurring show keeps each year's photos together ("2025", "2024") or an
organiser can split one weekend into "Day 1" / "Day 2" / "Vendors".

## Where it lives

| Piece | Location |
|---|---|
| Storage | `events` bucket, `events/gallery/<timestamp>-<album>-<n>-<rand>.<ext>` — immutable, `cacheControl: 31536000`, compressed in the browser before upload |
| Columns | `events.gallery_albums` (jsonb, `[{ title, images: [url] }]`, display order) and `events.gallery_images` (`text[]`, the same photos flattened — the form writes both). Migrations `20261027110841_event_gallery_images.sql`, `20261027212713_event_gallery_albums.sql` (adds the column, folds existing photos into one untitled album, re-exposes `events_public`) |
| Shape & limits | `utils/eventGallery.js` — `cleanGalleryAlbums(albums, legacyImages)` is the one normaliser (unsafe URLs and empty albums dropped, 12 albums × 24 photos, 40-char titles; no albums → the flat list as one untitled album). Dependency-free so the form, the page, `lib/eventSeo.js` and `api/prerender.js` agree |
| Editor | `components/events/EventGalleryEditor.jsx` on the event form's **Details** tab (admin and public submissions alike): per-album title, multi-upload, reorder photos, reorder/remove albums, **Add another album** |
| Page | `components/events/EventPhotoAlbums.jsx` — heading with the total count, album chips (`aria-pressed`) when there is more than one album, and `EventPhotoGrid` (the tile grid + keyboard lightbox split out of `components/reviews/EventReviewGallery.jsx`, which the admin event reviews still use) |
| Bots | `api/prerender.js` renders the albums as `<h3>` + `<figure>`s so a crawler without JS sees real content; Event JSON-LD `image` lists the cover then up to `MAX_JSON_LD_GALLERY_IMAGES` gallery photos (both `lib/eventSeo.js` and the prerender), which Google uses in event rich results |

## Rules

- **Put the latest year first** — the first album is what opens.
- Never set `gallery_images` without `gallery_albums` from new code; the flat
  column exists for readers that predate albums and is derived on save.
- URLs are canonical Supabase Storage URLs in the DB and rewritten onto the
  image CDN at render (`toCdnUrl`) — never store a CDN host.
- Alt text is generated (`<event> — <album> (n of N)`); there are no per-photo
  captions on event galleries (the admin **event review** gallery has them).

Videos sit directly below the gallery — see `docs/event-videos.md`.
