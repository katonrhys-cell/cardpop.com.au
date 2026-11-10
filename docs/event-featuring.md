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
| Full Feature | $149 | the above and a second story in show week (the homepage spot is automatic) |

**Early bird:** booked 28+ days before the event's first day (Sydney date),
20% off every package (`EARLY_BIRD`). To change a price or a package, edit
that file only (and the `package` check in a new migration if a key changes).

**3-event pack** (`BUNDLE`): one package across three of the organiser's
events, in one checkout:

| Package | 3 singles | Pack (GST incl.) |
|---|---|---|
| Calendar Spotlight | $147 | $119 |
| Spotlight + Instagram | $297 | $239 |
| Full Feature | $447 | $359 |

`featuredBundleQuote()` splits the pack price across the three events in whole
cents (remainder on the first), then takes the early bird off the share of
any event 28+ days away, so a pack is never dearer than three singles. Each
event must pass `featureEligibility()` on its own. Change the pack prices in
`BUNDLE.priceAud`.

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

**Pack flow:** `POST /hcgi/api/events/feature-bundle-checkout`
(`{ package, eventIds: [3 ids] }`, same auth) runs the same checks on each
event, writes three `pending` rows sharing a `bundle_id`, and opens one
session with a line per event and `metadata.bundleId`. The webhook finds the
rows by `bundle_id` and features each event as above (each row claims its own
transition, so a redelivery finishes only what's left); expiry expires all
three. If an event was already featured by another payment in the meantime
its row can't go `paid` (one paid row per event): the webhook logs an error
naming the amount to refund in Stripe and carries on with the others.

In the UI, the Feature dialog shows a **This event / 3-event pack** switch
when the organiser has three or more featurable events, and My Events shows
a **Choose 3 events** banner; `/list-your-event` lists the pack price under
each package.

The checkout success-page fallback in `GET /stripe/session/:id` skips this
kind, so a feature payment can never become an order.

## Data

`event_feature_purchases` (`20261110104532_event_feature_purchases.sql`):
one row per event per session (a pack's three rows share `bundle_id` and the
session, `20261110194228_event_feature_bundles.sql`); at most one `paid` row per event; the organiser reads
their own rows, admins read all, the browser writes nothing. Test with
`tests/db/run-event-feature-purchases-migration.sh`.

## Not yet automated

- **Refunds**: refund in the Stripe Dashboard, then switch Featured off in
  the event form. The purchase row stays `paid`.
- **Tax invoice**: Stripe's emailed receipt is the record; these payments are
  not `orders`, so they don't get an `INV-` invoice.

## Homepage Featured events

Full Feature also sets `events.homepage_featured`
(`20261110124303_event_homepage_featured.sql`), which puts the event in the
**Featured events** section of the homepage
(`components/home/HomepageFeaturedEvents.jsx`, gold like the calendar cards):
up to 3 approved events that haven't ended, soonest first, read through the
edge-cached homepage bundle (`queryHomepageEvents` in
`lib/homepageQueries.js`). The section hides itself when there are none.
Admins can switch it either way in the event form ("Show on the homepage",
next to "Featured on the calendar"); organisers can't write the column (a
BEFORE trigger pins it, like `is_featured`).

## Where featuring is offered

- **Right after submitting** (Account → My Events): the form's `onSubmitted`
  callback (a member's real submission, never a draft or a live edit) shows a
  gold card, `components/events/FeatureUpsellCard.jsx`, with the cheapest
  package's price for that event, early bird included. Once, dismissable,
  and only while `featureEligibility()` allows it.
- **In the "your event is live" email**: `featureOffer()` in
  `src/routes/events.js` adds a gold block to the approval email with the
  same price and a link to `/account/events?feature=<event id>`, which opens
  that event's package picker. Left out once the event is featured or has
  started.
- **On `/list-your-event`**: the packages section and "Feature Now"
  (`?feature=1`).
