# Event organiser links

The event form's **Organiser** tab (`components/EventFormModal.jsx`, admin and
public submissions alike) collects every outbound link an event page shows.
Each one is its own nullable `text` column on `events`, exposed through
`events_public`, so the page, the Event JSON-LD and the prerendered copy read
them without parsing anything.

| Field | Column | Where it shows |
|---|---|---|
| Event Website | `website_url` | "Official Website" under Follow the Organiser; `organizer.url` in JSON-LD; prerender |
| Tickets / Registration URL | `ticket_url` | the **Get Tickets** button (routed through the member offer's referral link when one is set — `docs/event-ticket-offers.md`) |
| Trader / Vendor Applications URL | `vendor_application_url` | **Apply for a trader table** button under the ticket/directions/calendar actions, upcoming events only |
| Instagram URL | `instagram_url` | Follow the Organiser; `organizer.sameAs` |
| Facebook URL | `facebook_url` | Follow the Organiser; `organizer.sameAs` |
| YouTube Channel URL | `youtube_channel_url` | Follow the Organiser; `organizer.sameAs` |
| TikTok URL | `tiktok_url` | Follow the Organiser; `organizer.sameAs` |
| X (Twitter) URL | `x_url` | Follow the Organiser; `organizer.sameAs` |
| Discord URL | `discord_url` | Follow the Organiser; `organizer.sameAs` |
| Facebook Public Post / Reel URL | `facebook_video_url` | embedded in Event Videos after the YouTube list — `docs/event-videos.md` |

**A YouTube *channel* is not a YouTube *video*.** Videos embedded on the page
live in `events.event_videos` (first one mirrored to `youtube_url`), edited in
**Event Videos** on the Details tab. The channel link only ever renders as a
button.

## Where the links are read

- `components/EventDetailCard.jsx` — the "Follow the Organiser" block (hidden
  when every link is blank) and the trader-table button (`isPast` hides it).
- `lib/eventSeo.js` — `buildEventJsonLd()` puts every profile link in
  `organizer.sameAs`, blanks skipped.
- `api/prerender.js` — `EVENT_FIELDS` selects them and `organiserLinksHtml()`
  emits the same list for no-JS readers; only `http(s)` values are kept.
- `pages/community/CommunityEventsPage.jsx` — `EVENT_CARD_COLUMNS` is the
  explicit projection every events read uses, so a new column must be added
  there or the page never sees it.

## Adding another link

1. `supabase migration new <name>`: `add column if not exists`, a column
   comment, and recreate `events_public` with the column **appended**
   (`create or replace view` can't reorder) — template:
   `20261029020720_event_organiser_links.sql`.
2. `EventFormModal.jsx`: `INITIAL_STATE`, the load-from-event block, the save
   payload (`.trim() || null`) and an `<Input type="url">` on the Organiser tab.
3. `EVENT_CARD_COLUMNS`, `EVENT_FIELDS` + `ORGANISER_LINKS` in the prerender,
   `sameAs` in `lib/eventSeo.js` if it is a profile, and the detail card.
4. Tests: `tests/frontend/eventFormModal.test.jsx` (labels),
   `eventDetailSections.test.jsx` (buttons), `eventSeo.test.js` (`sameAs`).
