# Paid Featured Placement and promotion extras for events

An organiser can pay CardPop for two **separate** things per event, both from
**Account → My Events** and both in one table, `utils/featuredPackages.js`
(read by the dialogs, the `/list-your-event` page and its prerender, and the
server that charges):

1. **Featured Placement** — where the event sits on the site (**Feature**
   button, or **Feature Now** on `/list-your-event`, which lands on My Events
   with `?feature=1`). What featuring does is in `docs/event-exposure.md`.
2. **Promotion extras** — work the team does by hand for the event (**Promote**
   button). See *Promotion extras* below.

Neither is part of the other, and extras are not part of any membership.

## Featured Placement

| Package | Price (GST incl.) | What the team does by hand |
|---|---|---|
| Calendar Spotlight | $49 | nothing |

It is the only featuring package. **The Ultimate membership includes it on
every event the member runs** (`docs/SUBSCRIPTION_SETUP.md` → Ultimate:
Calendar Spotlight), so an Ultimate member is never offered it. *Spotlight +
Instagram* ($99) and *Full Feature* ($149) were sold until 2026-11 and are
retired: their keys stay valid in the `package` check so old rows keep a label
(`RETIRED_FEATURED_PACKAGES`). The homepage Featured events section
(`events.homepage_featured`) is no longer sold — an admin switches it on in
the event form.

**Early bird:** booked 28+ days before the event's first day (Sydney date),
20% off (`EARLY_BIRD`). To change a price, edit that file only.

**3-event pack** (`BUNDLE`): Calendar Spotlight across three of the
organiser's events in one checkout — $119 instead of $147.

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

The retired Full Feature package also set `events.homepage_featured`
(`20261110124303_event_homepage_featured.sql`), which puts the event in the
**Featured events** section of the homepage
(`components/home/HomepageFeaturedEvents.jsx`, gold like the calendar cards):
up to 12 approved events that haven't ended, soonest first, read through the
edge-cached homepage bundle (`queryHomepageEvents` in
`lib/homepageQueries.js`). They sit in the same swipe / arrow carousel as
Trusted Australian Sellers (`components/PagedCarousel.jsx`: one, two or three
cards per page, arrows wrap round) — one event is one card wide, never the full
page. Each card carries the event's type, short
description, date, times, venue, entry fee and organiser. The section sits
directly under the stats strip and is always shown: with no featured event it
says the spot is open. The **List event** button (submit form, via sign-up
when signed out) and **Feature it here** sit under the cards — List event is
no longer in the community stats panel.
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

## Promotion extras

| Extra | Price (GST incl.) | What the team does by hand | Conditions |
|---|---|---|---|
| Instagram story | $49 | a story before the show | — |
| Instagram post | $99 | a feed post before the show | — |
| Full event review | $199 | attend on the day, write and publish the review, an Instagram post | the organiser provides free entry; attendance is on the day of the show only |

`EVENT_EXTRAS` in `utils/featuredPackages.js` is the one source (name, price,
selling points, `todo` for the admins, `terms` shown before payment). Anything
beyond these is an email to `EXTRAS_ENQUIRY_EMAIL` — the dialog and the public
page both say so.

Rules (`extraEligibility()`, mirrored by the server):

- **Any organiser, any plan.** Hobby, Pro and Ultimate buy extras the same
  way, at the same price. No early bird, no pack.
- **Independent of featuring.** An extra never touches `events.is_featured`,
  and an event can carry extras whether it is featured by payment, by an
  admin, by the Ultimate membership, or not at all. Buying an extra does not
  block buying Spotlight later, and a paid extra does **not** keep an event
  featured when an Ultimate membership ends.
- **One of each per event**, for an event that is submitted or live, dated
  and not yet started.

Flow: **Promote** opens `components/events/EventExtrasDialog.jsx` →
`POST /hcgi/api/events/:id/extra-checkout` (`{ extra }`, auth + `requireAal2`)
→ `createExtraCheckout()` writes a `pending` `event_feature_purchases` row with
`package` = the extra's key and opens a Checkout Session
(`metadata.kind = 'event_feature'`, so the existing webhook branch handles
it). On payment `handleEventFeaturePaid()` marks the row `paid`, bells the
organiser ("… booked") and every admin ("Event extra paid … To do: …") and
emails the admins the hand-done work. The review itself is written in Admin →
Event Reviews (`docs/event-reviews.md`).

Database (`20261116103431_event_promotion_extras.sql`): the `package` check
admits `story | post | review`; "one paid featuring per event" now covers the
featuring packages only (`event_feature_purchases_one_paid_featuring`), and
each extra is unique per event (`event_feature_purchases_one_paid_extra`).
Test with `tests/db/run-event-feature-purchases-migration.sh`.
