# Event organiser access

How a member becomes a confirmed **event organiser** and gets to edit their own
organiser page (`/events/organisers/<slug>`). Nothing is granted automatically:
an admin confirms every request.

## The flow

1. **Ask.** A signed-in member uses **Apply as an organiser or shop owner** on
   Account → My Events, leaves the **I'm applying as** dropdown on *Event organiser*
   (the other choice, *Card shop owner*, is `docs/store-pages.md` → Shop owners)
   and fills in the organiser name, a website/social link and an optional note.
   A request needs a **confirmed email** so an admin has a real address — the
   route refuses one without it. The sign-up form no longer asks: the
   "I run card shows or events" tick was removed from `/signup` (2026-11) so
   organiser access is only ever requested from inside a verified account.
   `POST /organiser-requests/from-signup` stays for accounts created while the
   tick existed (their choice sits in auth metadata, `organiser_interest` /
   `organiser_name`) and is a no-op for everyone else.
2. **Admins are told.** Every admin gets a bell (`organiser_request`) and one
   email (via `alertAdminsToReview`) with the member's name, email, organiser
   name, website/social link and message.
3. **Admin confirms** in **Admin → Organiser Requests** (`/admin/organiser-requests`):
   *Confirm as organiser* — linking an existing, unowned directory entry or creating
   a page from the name given — or *Decline* with a required reason.
4. **Member is told.** Bell (`organiser_approved` / `organiser_rejected`) + email.
   Approval makes them the **owner** of the `event_organisers` row; My Events then
   shows "You manage <name>" with a link to the page, which shows an **Edit page**
   button to its owner (and to admins). A declined member can send a new request.

## What an owner can and can't do

Enforced in the database (`20261110224209_event_organiser_requests.sql`), not the UI:

- **Can** edit their own page's `logo_url`, `description` (≤ 2000 chars) and
  `website_url` / `instagram_url` / `facebook_url` / `youtube_url` (http(s) only).
- **Cannot** change `name`, `slug`, `owner_id` or `created_at` — the guard trigger
  `trg_event_organisers_owner_guard` pins them for everyone but admins and the
  service role (events match a page by name; the slug is its public URL).
- **Cannot** insert or delete a page, or edit one they don't own.
- One owner per page and one page per member (partial unique index on `owner_id`).
- `organiser_requests` has **no browser write policy** (members `select` their own
  rows only); every write goes through `src/routes/organiser-requests.js` with the
  service role. One *pending* request per member (partial unique index); a decided
  one doesn't block a new one.

Owning a page does not bypass event review — events are still submitted and
approved as in `docs/event-submissions.md`.

## Where it lives

| | |
|---|---|
| Migration | `supabase/migrations/20261110224209_event_organiser_requests.sql` |
| API | `src/routes/organiser-requests.js` → `/organiser-requests` (`GET /me`, `POST /`, `POST /from-signup`, admin `GET /admin`, `PATCH /admin/:id`); validation in `src/schemas/organiserRequestSchemas.js` |
| Email | `organiserRequestOutcomeEmail` / `sendOrganiserRequestOutcome` |
| Member UI | `components/events/OrganiserAccessCard.jsx`, `hooks/useOrganiserAccess.js`, `components/events/OrganiserPageEditor.jsx`, `pages/community/EventOrganiserPage.jsx`, `utils/organiserPage.js` |
| Admin UI | `pages/admin/OrganiserRequestsAdminPage.jsx` |
| Tests | `tests/backend/organiserRequests.test.js`, `tests/frontend/organiserPage.test.js`, `tests/db/run-event-organiser-requests-migration.sh` |

The page reads the new profile columns with a fallback to the original four
(`BASE_ORGANISER_COLUMNS`), so the app is safe if it deploys before the migration.

## What crawlers see

The prerendered organiser page (`api/prerender.js` → `renderEventOrganiser`) mirrors
the SPA, so a no-JS reader (and Google) gets what the owner wrote: an
**About <name>** section, a **Follow <name>** list (http(s) links only, `rel="nofollow
noopener ugc"` — they're member-supplied), `description` and `sameAs` on the
Organization JSON-LD, and the organiser's own words as the meta description
(`organiserMetaDescription()` in `utils/organiserPage.js`, shared with the SPA: whitespace
collapsed, cut at a word boundary within 155 characters). With nothing written the
generated summary is used unchanged. The sitemap needs no change: it already lists the
page (gated on having public events) with the row's `updated_at`, which an owner's edit
bumps, so `lastmod` follows their changes. If the profile columns aren't deployed yet
the prerender falls back to the original four, like the SPA.

## Related: "verified organiser"

`event_organiser_verifications` (Admin → an event → Organiser access) is a
separate, older flag that lets an event's organiser see its vendor list. It is
independent of page ownership; an admin sets each deliberately.


## Social links

An organiser can also show **contact details** — a contact name, email and
phone (`contact_name` / `contact_email` / `contact_phone`,
`20261118232637_organiser_contact_details.sql`). All three are optional, entered
in **Edit page** (never copied from the member's account) and shown publicly on
the page as `mailto:` / `tel:` links; `organiserContact()` in
`utils/organiserPage.js` is the one normaliser for the SPA and the prerender.

An organiser page carries website, Instagram, Facebook, YouTube, **TikTok, X and
Linktree** links (`event_organisers.*_url`, http(s) only by a CHECK constraint;
TikTok / X / Linktree arrived in `20261116110000_organiser_tiktok_x_linktree_links.sql`).
The owner edits them in **Edit page** (`components/events/OrganiserPageEditor.jsx`);
`organiserLinks()` in `utils/organiserPage.js` is the one list the page's icon
buttons and the prerender's `Organization.sameAs` read. To add another, extend
`LINK_FIELDS` + `ORGANISER_PAGE_COLUMNS` there, the editor's `LINKS`, and the
page's `LINK_ICONS`.

## Messages from collectors

The owner of an organiser page also receives the messages collectors send from
it (screened first) and reads them in **Your messages** on the page —
`docs/organiser-messages.md`.

## Photos and videos on the organiser page

An organiser (or an admin) can add **photo albums** and **YouTube videos** from their previous events: Edit page → *Photo Gallery* / *Event Videos*, the same editors the event form uses. They are stored in `event_organisers.gallery_albums` (`[{title, images[]}]`, normalised by `cleanGalleryAlbums()`) and `event_organisers.videos` (`[{title, url}]`, `cleanEventVideos()`), added by `20261117190000_organiser_page_photos_and_videos.sql`. They render under the header via `EventPhotoAlbums` / `EventVideos`, and `renderEventOrganiser()` in `api/prerender.js` emits them for bots. Photos upload through `uploadEventImage()` into `events/organisers/gallery/`. The owner guard trigger is unchanged — these are ordinary editable profile columns.
