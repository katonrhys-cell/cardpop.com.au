# Paid Featured Placement for events

Organisers pay to feature their event from **Account → My Events → Feature**
(or **Feature Now** on `/list-your-event`, which lands on My Events with
`?feature=1`). What featuring does on the site is in `docs/event-exposure.md`.

## Packages and prices

One table, `utils/featuredPackages.js`, read by the dialog, the
`/list-your-event` page and its prerender, and the server that charges:

| Package | Price (GST incl.) | What the team does by hand |
|---|---|---|
| Calendar Spotlight | $49 | nothing |
| Spotlight + Instagram | $99 | Instagram post + story before the show |
| Full Feature | $149 | the above, a second story in show week, homepage spot |

**Early bird:** booked 28+ days before the event's first day (Sydney date),
20% off every package (`EARLY_BIRD`). To change a price or a package, edit
that file only (and the `package` check in a new migration if a key changes).

## Flow

1. `POST /hcgi/api/events/:id/feature-checkout` (`src/routes/events.js`,
   auth + `requireAal2`): the caller must be the event's organiser; the event
   must be pending review or live, not started, and not already featured.
   The price comes from `featuredQuote()`, never the request. A `pending`
   `event_feature_purchases` row is written and a Stripe Checkout Session
   opened with `metadata.kind = 'event_feature'`.
2. The Stripe webhook (`checkout.session.completed`) routes that kind to
   `handleEventFeaturePaid()` (`src/services/eventFeatureService.js`): the
   row goes `paid`, `events.is_featured` is switched on with the service role
   (the organiser write guard pins that column for members), the organiser and
   every admin are belled (`event_featured`) and the admins are emailed the
   hand-done extras for the package. Idempotent on redelivery.
3. `checkout.session.expired` / `async_payment_failed` mark a pending row
   `expired`, so the organiser can try again.

The checkout success-page fallback in `GET /stripe/session/:id` skips this
kind, so a feature payment can never become an order.

## Data

`event_feature_purchases` (`20261110104532_event_feature_purchases.sql`):
one row per session; at most one `paid` row per event; the organiser reads
their own rows, admins read all, the browser writes nothing. Test with
`tests/db/run-event-feature-purchases-migration.sh`.

## Not yet automated

- **Refunds**: refund in the Stripe Dashboard, then switch Featured off in
  the event form. The purchase row stays `paid`.
- **Tax invoice**: Stripe's emailed receipt is the record; these payments are
  not `orders`, so they don't get an `INV-` invoice.
- **Homepage spot** (Full Feature): the homepage has no events section yet.
  It must exist before a Full Feature is sold, so it is the next change.
