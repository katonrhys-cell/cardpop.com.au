# Saved video creators

The YouTubers and influencers who film card shows are credited under each
event video (`docs/event-videos.md` → Creator credit). A **saved creator**
keeps that credit — picture, name, social handles — once, so it can be picked
on any other video, and gives the creator a public page listing every event
video of theirs on CardPop.

## Using it

**Save someone**: open the event (or organiser page) form → the video →
*Creator credit* → fill in their picture, name and handles → **Save creator for
future videos** (admins only). Then save the event so the video keeps its link.
A credit typed before this feature existed is saved the same way: open it and
press the button.

**Credit them again**: on any video, *Creator credit* → **Saved creators** →
pick them. The fields fill in and the video is linked to their page. Organisers
editing their own event can pick from the list too; they can't add to it or
edit a saved creator (for them the fields of a saved creator are read-only —
**Unlink** to type something different).

**Change their details**: edit the fields on any video that credits them →
**Update saved creator**. The database rewrites the credit on every video that
uses it — no need to open the other events.

**Their page**: `/creators/<slug>` — picture, name, follow links, every video
crediting them (each linking to its watch page, with the event and its date),
and the list of events they have covered. Under each video, the creator's name
and *More event videos by …* link there.

## How it is stored

- `public.video_creators` (`20261118235054_video_creators.sql`): `id`, `slug`
  (unique, the page address), `name`, `avatar_url`, `instagram`, `youtube`,
  `tiktok`, `facebook`, `x`. Public read; insert / update / delete are
  admin-only RLS policies (browser writes, no server route).
- A video's credit stays the snapshot inside its JSON entry
  (`events.event_videos[].creator`, `event_organisers.videos[].creator`), so
  every existing reader keeps working. A saved creator's credit also carries
  `id` + `slug` (`cleanVideoCreator()` keeps them only when both are well
  formed).
- `trg_video_creators_sync_credits` keeps the snapshots in step: an update
  rewrites every credit with that `id`; a delete keeps the credit and removes
  its `id` / `slug`. It is fail-safe — a problem there warns and never blocks
  the save.
- `id`, `slug`, `created_at` and `created_by` are pinned on update
  (`trg_video_creators_before_write`): renaming a creator never moves their
  page.
- "Which videos credit this creator" is a jsonb containment read
  (`creatorVideosProbe()`; GIN index `events_event_videos_gin`).

## Code

| What | Where |
|---|---|
| Shapes, slug, page path, page title / description / JSON-LD, video list | `utils/videoCreators.js` |
| Browser reads + admin writes | `lib/videoCreators.js` |
| Picker, Save / Update / Unlink in the video form | `components/events/EventVideosEditor.jsx` |
| Credit under a video (links to the page) | `components/events/VideoCreatorCredit.jsx` |
| Public page | `pages/creators/VideoCreatorPage.jsx` |
| Crawler copy | `renderVideoCreator()` in `api/prerender.js`, bot rewrite in `vercel.json` |
| Sitemap | `api/sitemap.js` → *Video creators* |

## Rules

- The page is `noindex` and out of the sitemap until at least one public video
  credits the creator.
- No `VideoObject` on the creator page — a video's markup lives only on its
  watch page (`docs/video-watch-pages.md`). The page emits `ProfilePage` /
  `Person` with the socials as `sameAs`.
- Never write `creator.id` / `creator.slug` by hand; pick from the list
  (`creatorRowToCredit()`).
- Test the migration with `tests/db/run-video-creators-migration.sh`.
