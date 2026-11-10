# SEO growth plan — November 2026

Where Search Console stood on 6 Nov 2026 (28 days vs the 28 before), and what
we do about it, in order.

| | This month | Last month | Change |
|---|---|---|---|
| Clicks | 1,273 | 1,691 | −24.7% |
| Impressions | 91,429 | 61,442 | +48.8% |
| CTR | 1.4% | 2.8% | −49% |
| Avg. position | 10.5 | 8.8 | worse |

## What the numbers actually say

1. **Impressions up and position down are the same fact.** Google is showing
   CardPop for far more queries, and most of the new ones rank on the bottom of
   page 1 or on page 2. Those add impressions, drag the average position down
   and earn few clicks, so CTR halves. That part is growth, not decay.
2. **The click drop is the event treadmill.** Nearly all clicks land on event
   pages in the weeks before a show (the "rising" pages on 6 Nov were Hobby
   Hangout XL Sydney and Collectorama Keilor, which both ran on 1 Nov). After
   the show, that page's clicks go to near zero, and the next edition is a
   **new dated URL with no history**. Month-on-month numbers will rise and fall
   with the show calendar. September was packed; late October was quieter.
3. **What we can't see yet:** query-level data. The nightly Search Console sync
   (`GSC_SITE_URL`, `docs/site-traffic.md`) isn't configured:
   `site_traffic_daily` is empty. Until it is, every call here rests on the
   dashboard screenshot.

Event titles and descriptions are already good (date + venue, 45–65
characters), so rewriting snippets is not the lever. The levers are keeping
recurring-show demand on CardPop from one edition to the next, and climbing
from position 8–15 to 1–3 on the queries Google is already testing us on.

## What "number 1" means

The three query families CardPop can realistically lead in Australia:

1. **Card shows and events**: show names, "card shows <city>", "card show
   this weekend". Already where the traffic comes from. Win it outright.
2. **AUD card prices**: "<card> price australia". eBay and USD price sites
   are the competition. CardPop has AUD snapshots (`tracked_cards`, `/prices`).
3. **Grading in Australia**: local graders, PSA from Australia, ROI. The
   Grading Hub exists; it needs depth and links.

Head marketplace terms ("buy pokemon cards australia") belong to eBay and big
retailers and need inventory before SEO can help. Don't chase them first.

## Roadmap

### Done (this PR)
- **Next-edition handoff.** A finished event's page (SPA and bot prerender)
  now leads with its next edition: same organiser, preferring the same state,
  else the city's card-show page (`utils/eventNextEdition.js`,
  `components/events/NextEditionBanner.jsx`). Someone who searches a show's
  name and lands on last year's page gets this year's date, and the old page's
  link authority passes to the new URL.
- **Every event page links its `/card-shows/<city>` hub**, giving the new city
  pages internal links from every event.

### Owner actions (unblock measurement)
- [ ] Set `GSC_SITE_URL` and add the GA4 service account to Search Console as a
      restricted user (`docs/site-traffic.md`). The sync then records daily
      clicks and impressions.
- [ ] In Search Console, export **Queries** filtered to position 5–20 with 50+
      impressions, and **Pages** for `/events/` vs everything else. That list
      decides build #2 below.
- [ ] Submit the sitemap again after this deploy and request indexing for the
      three biggest upcoming shows.

### Next builds, in priority order
1. **Organiser pages as the evergreen series page.** `/events/organisers/<slug>`
   already lists every edition. Put the next date in its title ("Hobby Hangout
   XL 2027: Dates, Tickets & Venues"), give it `Event` JSON-LD for the next
   edition, and link to it from every edition. One URL that keeps its rank
   from year to year.
2. **Striking-distance pass.** For each query at position 5–15 with real
   impressions, strengthen the ranking page's H1/intro, internal links and
   FAQ. Needs the export above.
3. **"Card shows this weekend" / monthly calendar pages** for each city:
   recurring, high-intent queries that refresh themselves from the events table.
4. **Price pages at scale** for the most-searched AUD price queries, each with
   real snapshot data (never a made-up number; `docs/adsense-readiness.md`).
5. **Backlinks from organisers.** The organiser badge and `/list-your-event`
   (#1170, #1171) are the outreach tool: every organiser who links "Listed on
   CardPop" adds a relevant Australian backlink. Sellers (Account → Listings)
   and grading partners (Admin → Grading Partners) have the same badge — see
   `docs/event-exposure.md`. Price pages carry an embeddable price widget
   (`docs/price-widget.md`) for collectors' blogs and forums.

## How we'll know it's working
- Clicks to `/events/*` pages of **finished** shows should fall more slowly
  than before, with clicks moving to the next edition's URL.
- Average position on show-name queries: aim for top 3.
- Compare quarter on quarter, not month on month: the show calendar is
  seasonal.
