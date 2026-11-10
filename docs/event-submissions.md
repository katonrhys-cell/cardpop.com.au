# Member event submissions

How a member (an organiser who isn't a CardPop admin) gets an event onto the
calendar, keeps it up to date, and how admins stay across it.

## Ownership — the hard rule

A member can see and change **only their own events** (`events.organiser_id =
auth.uid()`). Everything else belongs to admins. Enforced in the database, not
the UI:

- `events` — members insert only as themselves (the guard trigger overwrites
  `organiser_id` and `status`), and update only their own event while it is
  `pending_review`, `rejected` or `approved`. They can never set the status,
  featuring, the CardPop-verified badge, the slug, the owner or any review
  column (`trg_guard_event_organiser_write`), and can't delete an event.
- `event_ticket_offers` — the member ticket offer of their own event only.
- `event_change_log` — they read only their own entries; only admins mark
  them reviewed.
- Event info board, stalls and stall layout — `can_manage_event_board()` is
  admins + the event's organiser (vendors used to qualify; not any more), and
  a board post can't be moved onto another event.
- RSVPs and collector reviews are each person's own rows.

Test: `tests/db/run-event-organiser-review-migration.sh` (applies
`20261109235618_event_organiser_review_flow.sql`,
`20261110002320_event_organiser_offers_and_admin_alerts.sql`,
`20261110020313_event_status_draft.sql` and
`20261110020314_event_organiser_drafts.sql`). Drafts: an organiser inserts
or saves `draft` or `pending_review` (the guard forces anything else to
pending, and a live event stays `approved`), may delete only their own
draft, and `notify_admins_on_event_submission()` / `POST
/events/notify-submission` ignore drafts — submitting one is a new submission.

## The flow

| Stage | Organiser (Account → My Events) | Admins (Admin → Event Management) |
|---|---|---|
| **Draft** | **Save Draft** on the form keeps the event private (`draft`): only the organiser sees it, under **Drafts** at the top of My Events, where they can **Edit & submit** or **Delete** it. A pending or rejected event can be parked back in drafts; a live one can't. | Nothing — no bell, no email, and the publish toggle is off for drafts. Admins can still see drafts in Event Management (status *Organiser draft*). |
| **Submit** | **Submit Event** → the form in user mode (no Status, Featured or re-scan controls), incl. the **Member Offer** tab for their own ticket discount code and referral link (`docs/event-ticket-offers.md`). Saved as `pending_review`. | **Every admin**: bell (`event_pending_review`) + email. |
| **Pending** | **Edit** freely. | Toggle on = approve. **Ban** icon = reject with a reason (or set the status in the form; a *Reason for the organiser* box appears). |
| **Approved** | Bell `event_approved` + email "Your event is live". | — |
| **Rejected** | Bell `event_rejected` + email with the reason, shown on the row. **Edit & resubmit** puts it back to `pending_review`. | Every admin: bell ("Event resubmitted") + email again. |
| **Live, edited** | **Edit** — the save **goes live straight away** and the event stays approved. Offer changes too. | Every admin: bell `event_updated` + email with a **Field / Before / Now** table. In Event Management the row shows **Edited by organiser (n)** (and an **Organiser edits (n)** filter); it opens the field-by-field history with **Mark as reviewed**. The **History** icon on any live event shows past edits. To undo something, edit the event. |

**Every event a person adds alerts every admin** — a member's submission or
resubmission (`event_pending_review`), and an admin's own event, often live
straight away (`event_created`), which goes to every *other* admin. The nightly
scanner's finds (`auto_discovered`) are left to their own queue.

Organisers can turn their approve / reject emails and bells off under Account →
Notification Settings → *Events you organise*.

## The form (components/EventFormModal.jsx)

The form checks itself (`noValidate`) through `utils/eventFormValidation.js`
rather than leaving it to the browser, whose bubbles only show for the open tab:

- **Errors land on the field.** `validateEventForm()` returns the field and tab
  (title, start date, end before start, a same-day end time before the start,
  a 4-digit postcode, the contact email, every link, prices, capacity); the form
  switches tab and focuses it.
- **Links are fixed, not refused.** `normalizeEventUrl()` turns
  `instagram.com/show` / `www.show.com.au` into `https://…` before saving.
- **Photos are checked when picked** (`eventImageFileError()`): only the types
  the `events` bucket stores (JPG, PNG, WebP, GIF, 20MB), with a plain message
  for iPhone HEIC — it used to fail deep in the upload as "mime type not supported".
- **A refused save is never "saved".** An update RLS refuses returns zero rows
  and no error, so the form asks for the row back and reports it;
  `describeEventSaveError()` turns RLS / storage / network errors into English.
- **Nothing is lost by accident.** Closing (Cancel, Escape, a click outside)
  asks first once anything has been changed; **Clear Form** is offered only on a
  new event. The Save / Submit footer stays pinned while the fields scroll.

## Where it lives

- **Change log:** `event_change_log` — one row per organiser save on a live
  event, `changes = { field: { from, to } }`, written by
  `log_organiser_event_edit()` (fields: `event_logged_fields()`, kept equal to
  `EVENT_LOGGED_FIELDS` in `utils/eventChangeLog.js` by a test) and
  `log_organiser_offer_edit()` (offer fields `offer_text`, `discount_code`,
  `referral_url`, `offer_is_active`) through `record_event_change()`, which
  also bells every admin. Admin edits and the offer's click / reveal counters
  are never logged.
- **Bells:** `notify_admins_on_event_submission()` (new events, resubmissions),
  `notify_organiser_on_event_decision()` (approve / reject),
  `record_event_change()` (live edits). The status triggers fire on any update
  and check the change themselves — the guard can move the status without the
  statement naming the column.
- **Emails** (`src/routes/events.js`, called fire-and-forget by the form):
  - `POST /events/notify-submission` — every admin, after every insert and
    resubmission; claimed once via `events.admins_notified_at` (cleared on a
    resubmission). Recipients: every admin account + the Notification Email,
    minus whoever added it.
  - `POST /events/:id/notify-changes` — every admin, after an organiser saves
    their live event: the caller's un-emailed log entries for that event,
    merged into one Before / Now table, stamped in `admins_emailed_at`.
  - `POST /events/:id/notify-decision` (admin) — the organiser, once per
    outcome (`events.organiser_notified_status`).
  - Templates: `eventSubmittedEmail`, `eventChangesMadeEmail`,
    `eventReviewOutcomeEmail` in `src/emails/templates.js`.
- **UI:** `pages/account/AccountEvents.jsx`, `components/EventFormModal.jsx`,
  `pages/admin/EventsManagementPage.jsx`,
  `components/admin/EventRejectDialog.jsx`,
  `components/admin/EventChangeLogDialog.jsx`, `lib/eventReviewApi.js`.

## Handing an event to its organiser

An event only appears in a member's My Events if it is theirs
(`events.organiser_id`). An event an admin created belongs to that admin. To
give it to the real organiser: Event Management → the **people** icon on the
row → *Organiser account* → enter their username or login email → **Link**
(`PATCH /admin/events/:id/organiser`). From then on they can edit it (and the
edits are logged as above); the previous owner can't.
