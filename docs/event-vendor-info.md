# Event vendor information

Card shows run a vendor programme beside the ticket sales: an application
form, a vendor FAQ, a trader pack PDF, a floor plan. The event form's
**Vendors** tab (second tab, `components/EventFormModal.jsx`) collects all of
it in one place — admins and an event's own organiser alike.

## What's stored

| Field | Where | Notes |
|---|---|---|
| Trader / Vendor Applications URL | `events.vendor_application_url` | moved here from the Organiser tab; still the "Apply for a Trader Table" button |
| Information for vendors | `vendor_info.intro` | free text, 3,000 chars |
| Vendor documents | `vendor_info.documents` `[{ title, url }]` | PDF or image, 20 MB, up to 10 — uploaded on save into the `events` bucket at `vendor-info/<uuid>.<ext>` (`utils/uploadEventVendorFile.js`; never a `Date.now()` name, which would make the bucket look for a thumbnail) |
| Vendor links | `vendor_info.links` `[{ label, url }]` | up to 6, http(s) only; a link with no label reads "More vendor info" |
| Vendor FAQs | `vendor_info.faqs` `[{ question, answer }]` | up to 30; a row needs both halves |

`vendor_info` is one `jsonb` object column (`20261119000153_event_vendor_info.sql`,
test with `tests/db/run-event-vendor-info-migration.sh`). That migration also
lets the `events` bucket take `application/pdf`. `cleanVendorInfo()` in
`utils/eventVendorInfo.js` is the one normaliser — the form, the page and the
prerender all read through it.

It is an ordinary organiser-editable column: live edits are logged like any
other field (`event_logged_fields()` / `EVENT_LOGGED_FIELDS`), and the public
page reads it through `events_public` `select('*')`. **Don't add it to
`EVENT_CARD_COLUMNS`** — list cards don't need it.

## On the event page

Nothing shows until something is entered (`hasVendorInfo()` — any vendor info,
or an application link), and nothing shows once the event has passed.

- Under the **Attend / Sell as Vendor** buttons: *Want to be a vendor? See all
  the vendor info for this event*, linking to `#vendor-info`.
- A **Vendor Information** section in the main column, after the videos
  (`components/events/EventVendorInfo.jsx`): the intro, Apply + link buttons,
  documents (PDFs open in a new tab; images show a thumbnail), and the FAQ as
  an accordion.
- The prerender (`eventVendorInfoHtml()` in `api/prerender.js`) emits the same
  as plain text — FAQ as a `<dl>` — for no-JS readers, read in its own
  best-effort query so the page renders before the migration lands.
