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

## Shop owners

CardPop builds a shop's page; the shop's real owner can then apply to take it
over. It is the same path an event organiser takes
(`docs/event-organiser-access.md`), and the same application form.

1. **Apply.** A signed-in member with a confirmed email opens **Account → My
   Events** and uses **Apply as an organiser or shop owner**. The form's first
   field is a dropdown — **I'm applying as**: *Event organiser* or *Card shop
   owner*. A shop owner picks their shop from the list of shops in the
   directory that have no owner yet, and can add their role, a website or
   social link and a note. A shop that isn't listed is added through
   `/card-shops/add` first.
   Every shop page without an owner also shows **Is this your shop? → Apply to
   manage this page**, which lands on that form with the shop already picked
   (`/account/events?claim=<slug>`); a visitor who isn't a member yet goes
   through sign-up first and arrives at the same place.
2. **Admins are told.** Every admin gets a bell (`store_owner_request`) and one
   email with the member, the shop, their role, link and message.
3. **Admin confirms** in **Admin → Store Directory → Shop owner requests**:
   *Confirm as owner*, or *Decline* with a required reason.
4. **Member is told.** Bell (`store_owner_approved` / `store_owner_rejected`) +
   email. Approval makes them the shop's `owner_id`; the shop page then shows
   them **Edit this page**, which opens the same editor admins use.

Admins keep editing every page as before, and can take a page back with
**Remove owner** on the shop's row.

### What an owner can and can't do

Enforced in the database (`20261116221914_store_owner_requests.sql`), not the UI:

- **Can** edit their shop's suburb, address, phone, website, Instagram,
  description, opening hours, what it stocks, logo, photos and videos, and
  upload into their own shop's folder of the `media` bucket
  (`stores/<slug>/…`, insert only — storage policy `store_owner_media_insert`).
- **Cannot** change the `name`, `slug`, `city`, `state`, `status`, `owner_id` or
  the submitter columns — the guard trigger `trg_local_game_stores_owner_guard`
  pins them for everyone but admins and the service role.
- **Cannot** add or delete a shop, or edit one they don't own.
- A shop has one owner; one member may own several shops (a chain).
- `store_owner_requests` has **no browser write policy** (members `select` their
  own rows only); every write goes through `src/routes/store-owner-requests.js`
  with the service role. One *pending* request per member per shop.

| | |
|---|---|
| Migration | `supabase/migrations/20261116221914_store_owner_requests.sql` |
| API | `src/routes/store-owner-requests.js` → `/store-owner-requests` (`GET /me`, `POST /`, admin `GET /admin`, `PATCH /admin/:id`, `DELETE /admin/owner/:id`); validation in `src/schemas/storeOwnerRequestSchemas.js` |
| Email | `storeOwnerRequestOutcomeEmail` / `sendStoreOwnerRequestOutcome` |
| Member UI | `components/events/OrganiserAccessCard.jsx` (the shared form), `hooks/useStoreOwnerAccess.js`, `pages/stores/StorePage.jsx` |
| Admin UI | `components/admin/StoreOwnerRequests.jsx` in `pages/admin/StoreDirectoryAdminPage.jsx` |
| Tests | `tests/backend/storeOwnerRequests.test.js`, `tests/frontend/organiserAccessCard.test.jsx`, `tests/db/run-store-owner-requests-migration.sh` |
