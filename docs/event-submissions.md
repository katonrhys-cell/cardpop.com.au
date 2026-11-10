# Member event submissions

How a member (an organiser who isn't a CardPop admin) gets an event onto the
calendar, keeps it up to date, and hears back from us.

## The flow

| Stage | Organiser (Account → My Events) | Admin (Admin → Event Management) |
|---|---|---|
| **Submit** | **Submit Event** → the form in user mode (no Status, Featured or re-scan controls). Saved as `pending_review`. The **Member Offer** tab takes their own ticket discount code and referral link, saved with the submission (`docs/event-ticket-offers.md`). | Every admin: bell (`event_pending_review`, DB trigger) + email (`POST /events/notify-submission`). |
| **Pending** | **Edit** freely. | Toggle on = approve. **Ban** icon = reject with a reason. Or set the status in the form (a *Reason for the organiser* box appears for Rejected). |
| **Approved** | Bell `event_approved` + email "Your event is live". Badge **Live**, **View Live**, **Website badge**, **Request changes**. | — |
| **Rejected** | Bell `event_rejected` + email with the reason. Reason shown on the row. **Edit & resubmit** puts it back to `pending_review` (admins are belled and emailed again). | — |
| **Live, needs a change** | **Request changes** opens the same form prefilled. Saving records only the changed fields as an `event_change_requests` row. **The live page is unchanged** until an admin applies it. Badge **Changes pending review**; editing again updates the same request (saving with no differences withdraws it). | Bell `event_change_requested` + email listing the fields. **Change requests (n)** filter / **Changes requested** badge opens a current → requested comparison. **Apply changes** or **Dismiss**, with an optional note. |
| **Changes decided** | Bell + email: "Your event changes are live" / "weren't applied" (+ note). A dismissed request's note shows on the row. | — |

**Every event a person adds alerts every admin** — a member's submission or
resubmission (`event_pending_review`), and an admin's own event, often live
straight away (`event_created`), which goes to every *other* admin. Bell from
`notify_admins_on_event_submission()`; email from `POST /events/notify-submission`,
which the form calls after every insert and resubmission, sent to every admin
account plus the Notification Email (minus whoever added it) and claimed once
through `events.admins_notified_at` (cleared again on a resubmission). The
nightly scanner's finds (`auto_discovered`) are left to their own queue.

Organisers can turn the two organiser emails/bells off under Account →
Notification Settings → *Events you organise*.

## Where it lives

- **Schema:** `supabase/migrations/20261109235618_event_organiser_review_flow.sql`
  (test: `tests/db/run-event-organiser-review-migration.sh`).
  - `trg_guard_event_organiser_write` — a non-admin can't set `is_featured`,
    `is_cardpop_verified`, `auto_discovered`, `organiser_id`, `slug`, or the
    review columns; admin decisions stamp `reviewed_at` / `reviewed_by`, and
    approval clears `rejection_reason`.
  - Organiser UPDATE policy: editable while `pending_review` or `rejected`,
    and every save lands in `pending_review`.
  - `on_event_decision_notify_organiser` — the organiser's bell on approve /
    reject (never for an admin deciding their own event).
  - `event_change_requests` — one open (`pending`) request per event. Only the
    columns in `event_change_request_fields()` survive (kept equal to
    `EVENT_CHANGE_FIELDS` in `utils/eventChangeRequests.js` by a test). An
    organiser can only open one on their own **approved** event and can't
    decide it. `apply_event_change_request(id, note)` (admin-only, security
    definer) writes the changes to the event and marks it applied in one
    transaction.
- **Emails:** `src/routes/events.js` — `POST /events/:id/notify-decision`
  (admin), `POST /events/change-requests/:id/notify-admins` (the organiser),
  `POST /events/change-requests/:id/notify-decision` (admin). The browser calls
  them fire-and-forget after the write (`lib/eventReviewApi.js`); each send is
  claimed first (`events.organiser_notified_status`,
  `event_change_requests.admins_emailed_at` / `organiser_emailed_at`) so a
  repeat never emails twice. Templates: `eventReviewOutcomeEmail`,
  `eventChangeRequestedEmail` in `src/emails/templates.js`.
- **UI:** `pages/account/AccountEvents.jsx`, `components/EventFormModal.jsx`
  (`baseEvent` / `changeRequest` props → change-request mode),
  `pages/admin/EventsManagementPage.jsx`,
  `components/admin/EventRejectDialog.jsx`,
  `components/admin/EventChangeReviewDialog.jsx`.

## Handing an event to its organiser

An event only appears in a member's My Events if it is theirs
(`events.organiser_id`). An event an admin created belongs to that admin. To
give it to the real organiser: Event Management → the **people** icon on the
row → *Organiser account* → enter their username or login email → **Link**
(`PATCH /admin/events/:id/organiser`). From then on they can request changes
to it. Any open change request from the previous owner is dropped.
