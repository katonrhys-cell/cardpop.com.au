# Messages to event organisers

A collector can write to an organiser from the organiser's page
(`/events/organisers/<slug>`): the **Message** button beside the social links,
and the **Feedback & questions** section under the event lists. Every message
is screened before anyone receives it, so organisers are not harassed through
CardPop.

## What happens to a message

| Screen says | Page has an owner | Result (`status`) |
|---|---|---|
| clean | yes | `delivered` — the owner is belled (`organiser_message`) and emailed, reply-to set to the sender; it shows in **Your messages** on their own page |
| clean | no | `forwarded` — every admin is belled + emailed (`organiser_message_review`); it sits under **For CardPop** in Admin → Organiser Messages |
| flagged, or the screen could not run | either | `held` — reaches nobody; every admin is belled + emailed with the reason |

An admin decides a held message in **Admin → Organiser Messages**
(`/admin/organiser-messages`): **Release** delivers it to the owner
(`released`), or keeps it for CardPop when the page has no owner (`forwarded`);
**Dismiss** closes it (`dismissed`).

The sender always gets the same "message sent" answer. Telling someone their
message was flagged teaches them how to word the next one.

## Who can send

- Signed-in members with a **confirmed email** only. A signed-out visitor is
  sent to sign in and brought back to the page.
- Not the page's own owner.
- **3 messages a day to one organiser, 10 a day in total**
  (`utils/organiserMessages.js`), counted over every message sent, held and
  dismissed ones included, and checked before a screen is spent.
- The sender's name and email are shared with whoever receives the message, and
  the form says so. The organiser's email is never shown to the sender; they
  reveal it only if they choose to reply.

## The screen (`src/utils/organiserMessageScan.js`)

1. **Rules, no model**: more than two links is spam; a short list of explicit
   threat wording is a threat. Deliberately narrow.
2. **One Claude call** (`claude-opus-5-5` at low effort, structured output:
   `allow`, `category`, `reason`). The prompt tells it that blunt or angry
   feedback about an event is allowed and that abuse aimed at a person is not,
   and to hold when unsure. The member's text is wrapped as data and the prompt
   says never to follow instructions inside it. A refusal from the model itself
   is re-run on a fallback model in the same call (`fallbacks: "default"`).

It **fails closed**: no `ANTHROPIC_API_KEY`, an API error, a timeout
(`OUTBOUND_TIMEOUT_MS.anthropicScreen`, 12 s), a refusal or an unreadable reply
all hold the message for an admin. Nothing reaches an organiser unless a screen
said it was clean, or an admin released it.

Each call is recorded in the AI usage ledger as `organiser_message_scan`
(Admin → Finance) and traced to Sentry like every other Claude call. A screen
costs roughly half a US cent. `ORGANISER_MESSAGE_SCAN_MODEL` swaps the model.

## Where it lives

- `supabase/migrations/20261116120000_organiser_messages.sql` — the
  `organiser_messages` table and the two bell types. The table has **no browser
  policy**: it holds private messages and sender emails, and a browser INSERT
  would be a way round the screen. Never add one.
- `src/routes/organiser-messages.js` — `POST /` (send), `GET /inbox` (the
  owner's delivered + released messages, no screening detail),
  `GET /admin`, `PATCH /admin/:id` (`release` / `dismiss`, claimed on
  `status = 'held'` so two admins can't both decide).
- `components/events/OrganiserMessageDialog.jsx` (the form),
  `components/events/OrganiserInbox.jsx` (the owner's inbox on their page),
  `pages/admin/OrganiserMessagesAdminPage.jsx`.
- Emails: `organiserMessageEmail` (to the owner) and the shared admin review
  alert.

## Tests

- `tests/backend/organiserMessages.test.js` — the three paths, fail-closed,
  limits, inbox scoping, admin decisions.
- `tests/backend/organiserMessageScan.test.js` — rules, verdict parsing, the
  request sent to the model.
- `tests/frontend/organiserMessaging.test.jsx` — the form, sign-in gate, inbox.
- `tests/db/run-organiser-messages-migration.sh` — the migration on a throwaway
  Postgres: constraints, and no direct access for anon / members / the owner.
