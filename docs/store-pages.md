# Card shop pages

Every store in the card shop directory (`/card-shops`) has its own page at
`/card-shops/<city>/<slug>` — for example
`/card-shops/melbourne/swap-itt-melbourne`.

## What a page shows

Everything comes from the store's `local_game_stores` row:

| Part | Column |
|---|---|
| Name, suburb, city, state, what it stocks, write-up, website | the directory columns it always had |
| Street address (with an "Open in Google Maps" link), phone | `address`, `phone` |
| Opening hours | `opening_hours` — plain text, one line per row, written `Day: hours` |
| Instagram | `instagram_url` |
| Logo — on the shop's card in the city list (instead of the cover photo) and beside the name on its page | `logo_url` |
| Photo gallery | `photos` — `[{ url, caption }]`, in display order; the first is the cover |
| Videos | `videos` — `[{ url, poster_url, caption }]`; an uploaded clip or a YouTube / Vimeo link |

`utils/storePage.js` is the one normaliser (`cleanStorePhotos`,
`cleanStoreVideos`, `storeHoursLines`, `normalizeStoreInput`) and builds the
path, title, description and `Store` JSON-LD. It is dependency-free, so the SPA
page (`pages/stores/StorePage.jsx`), the admin editor, `api/prerender.js`
(`renderStore`) and `api/sitemap.js` all use it.

## Updating a page

**Admin → Store Directory** (`/admin/store-directory`):

- **Edit** on any store opens the editor (`components/admin/StoreEditorDialog.jsx`):
  details, opening hours, photos and videos. Signed-in admins also get an
  **Edit this page** button on the public page itself.
- **Upload logo** — one image, shown on the shop's card in the directory and
  on its page. A square PNG works best; without a logo the card shows the
  cover photo.
- **Add photos** — pick several at once; they are compressed in the browser.
  Add a caption, reorder with the arrows, remove with the bin. Up to 24.
- **Upload a clip** — MP4, MOV or WebM up to 50 MB — or paste a YouTube / Vimeo
  link for anything longer. Up to 6.
- **Add store** creates a store that is live straight away (the public
  "Add your store" form still lands as pending for review).
- Nothing changes on the public page until **Save**.

Uploads go through `utils/uploadStoreMedia.js` into the admin-only `media`
bucket at `stores/<slug>/photos|videos/<timestamp>-…` with a year-long cache
header. A media URL may also be a site-relative path to a file bundled with the
app — Swap Itt Melbourne's first photos live in
`public/stores/swap-itt-melbourne/` and were seeded by the migration.

iPhone note: a `.mov` straight off an iPhone is HEVC, which not every browser
plays. If a clip shows as a black box for some visitors, export it as MP4
(H.264) first or put it on YouTube.

## Database

`supabase/migrations/20261114212757_store_pages_media.sql` adds the five
columns, grants `SELECT` on them (the table's SELECT is granted column by
column so `submitter_email` stays private), adds the admin-only INSERT policy
and seeds Swap Itt Melbourne. Admin edits are browser writes under the existing
admin UPDATE policy. Test with `tests/db/run-store-pages-migration.sh`.

Never `select('*')` on `local_game_stores` from the browser — it fails on the
private columns. Use `STORE_PAGE_COLUMNS` / `STORE_LIST_COLUMNS`.

## Search

A page with nothing beyond its directory line is already fully shown on its
city page, so it is `noindex` and left out of the sitemap. It becomes indexable
(`storeIsIndexable`) once it has a photo, a video or opening hours. The
prerender serves the same content to crawlers without JavaScript.
