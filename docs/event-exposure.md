# Event exposure: featured events, city pages, organiser badge

Three features that get events seen and help the events section rank.

## Featured events

An admin turns on **Featured** in the event form (Admin → Events), which
sets `events.is_featured`. While the event is **approved and hasn't
ended**, it gets:

- a red **Featured** badge and highlighted border on its card,
- a place in the **Featured events** strip at the top of the calendar and
  of each city page (soonest first, up to 6),
- first position within its month on the calendar,
- a **Featured event** badge on its own page.

The rule lives in `utils/eventFeatured.js` (`isFeaturedEvent`). Featuring
lapses on its own once the event ends, so it never needs switching off
afterwards. It's the paid tier on `/list-your-event`.

## City pages: `/card-shows/<city>`

There is one page per state, named after its capital because that's what
people search for: melbourne, sydney, brisbane, adelaide, perth, hobart,
canberra and darwin. Each page lists every upcoming event in the state, with
city copy that names the regional towns it covers.

- Copy and slugs: `data/eventRegions.js`, shared by the SPA
  (`pages/community/EventRegionPage.jsx` → `CommunityEventsPage` with
  `region`), the prerender (`renderEventsLanding(…, region)`) and the
  sitemap.
- **Sitemap:** a city is listed only while its state has an upcoming
  approved event. **Prerender:** a city with none is `noindex, follow`. An
  unknown city is a 404.
- **Internal links:** "Card shows by city" appears on every calendar page and
  on the bot `/events` page, and "All card shows in <city>" appears under
  related events on each event page.

To add a regional city later (e.g. Gold Coast), give it its own entry with a
narrower filter, because the current entries filter by state only.

## "Listed on CardPop" website badge

When an organiser's event is live, Account → My Events offers a **Website
badge** button. It gives them a copy-paste snippet
(`utils/eventBadge.js`) that shows `public/badges/listed-on-cardpop.svg`
and links to the event's CardPop page. It's a followed link, so a badge on
the organiser's own site is a real backlink to the event page. Ask
organisers to add it when you approve their event.

## Seller and grading-partner badges

The same copy-paste badge exists for two more kinds of partner. Both are built by
`utils/websiteBadge.js` (shared with the event badge) and shown in
`components/WebsiteBadgeDialog.jsx`:

- **Sellers**: Account → Listings → **Website badge** gives a "Buy my cards on
  CardPop" badge (`public/badges/sell-on-cardpop.svg`) linking to the seller's
  storefront, `/seller/<id>`. Sellers can put it on a website, blog or
  link-in-bio page.
- **Grading submission partners**: Admin → Grading Partners → the badge icon on
  each row gives a "CardPop grading partner" badge
  (`public/badges/grading-partner-cardpop.svg`) linking to
  `/grading/submission-partners`. Send it to the partner when you list them.

Every badge is a followed link. Never add `rel="nofollow"`, because the backlink
is the reason the badge exists (a test checks this).
