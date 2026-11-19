# Site bug audit — 19 November 2026

A bug check of everything since the 10 November audit (about 65 merged changes)
plus the live production signals. Five parallel code reviews (money path,
database and authorisation, frontend flows, SEO / prerender / routing, backend
jobs), then a check of each finding against the code and, where it mattered,
against the live database.

**Baseline before any change:** lint clean, 5,995 tests passing. Sentry had
three one-off browser errors in 14 days, all from extensions or blocked eval,
none from CardPop code. Nothing below was caught by the existing checks.

✅ = fixed in this change, with a test that fails before and passes after.

## 1. Fixed in this change

### Privacy and security (database)

| | Finding | Fix |
|---|---|---|
| ✅ **High** | **Organisers' personal email and phone were public.** `events.organizer_email` / `organizer_phone` (and `organiser_id`, `source_url`) were readable by anyone with the public key: `GET /rest/v1/events?select=organizer_email,organizer_phone`. `events_public` hid them, but the base table didn't. **Confirmed live: 12 approved events exposed them.** Since 10 Nov members submit their own events, so these are members' personal details. | The anonymous role now has a per-column grant without those four columns. A migration that adds an `events` column must re-run the grant; `tests/backend/eventsAnonColumnGrant.test.js` enforces that. |
| ✅ Medium | **A seller could read the buyer's name and street address for an order that was never paid.** The cart checkout writes the address on the `pending` row; `seller_sale_shipping()` didn't check status. | Paid orders only. |
| ✅ Low | A member could insert a trade that was already `accepted`, or wind an accepted trade back to `proposed`. | Insert forced to `proposed`; reopening refused. |
| ✅ Low | `vault_items.publicly_listed`, described as "database-owned", could be set by the owner, publishing an unlisted card and its photos with no listing. | Recomputed from listings on any signed-in write. |

All four are `20261119050236_close_private_data_gaps.sql`, tested on Postgres 16
with `tests/db/run-private-data-gaps-migration.sh`.

### Payments and membership

- ✅ **The ID check could be skipped on high-value Expression of Interest sales.** The identity gate priced a purchase from `listings.price_aud`, which is null on an EOI listing, and ignored the offer. A $5,000 accepted offer was valued at $0, under the $500 threshold. It now uses the largest of the Buy Now price, the EOI minimum and the offer amount.
- ✅ **A new member who paid could be left on Hobby.** Stripe doesn't order events, and a yearly sign-up sends `created` (incomplete) and `updated` (active) about a second apart. If `created` was processed last, the member was dropped to Hobby, and on a yearly plan nothing would correct it for up to a year. The webhook now reads the subscription fresh from Stripe.
- ✅ A failed profile write on a membership event was logged and the event marked done, so Stripe never retried it. It now returns 500 and Stripe retries.

### Checkout

- ✅ **Reloading the order-confirmed page emptied the cart**, including the cards a shop-only checkout had promised to keep and anything added since. The cart is now settled once per payment.
- ✅ **After a reload, or coming back from ID verification, the address the buyer had typed was replaced with their saved default** and marked verified. A gift sent to a friend could go to the buyer's own address. A typed address is now kept.

### Emails

- ✅ **"View Order" in the order-confirmed and refund emails went to a 404** (`/orders/<id>` never existed). The links now go to Account → Orders / Sales, and the old path redirects so emails already sent still work.
- ✅ **"Your cart is waiting" went to buyers who had already paid** on a second attempt (every visit to the payment step makes its own pending order), once per abandoned attempt. It is now skipped when a later order was paid or the buyer was already reminded.
- ✅ The watchlist "sold to another collector" email went to the collector who bought the card.

### Search engines (Google)

- ✅ **A brief database outage told Google to drop good pages.** Price cards, player pages, organiser pages, shop product slugs, shop category / sealed grids, card-show city pages and the forum answered 404 or `noindex` when a read failed, cached at the edge for an hour (stale for a day). They now answer 503 / no-store, as the rest of the prerender already did.
- ✅ A sitemap missing whole sections (a slow table) was cached for an hour. It is now sent no-store.

### Admin and content

- ✅ **Saving a shop product before its wholesale cost had loaded deleted the cost and supplier link**, with no message.
- ✅ The article and event-review **slug fields couldn't take a hyphen while typing** (`card-` snapped back to `card`).
- ✅ "Schedule" on an article reported success when the article had already been published and nothing was saved.
- ✅ Saving Account → Profile dropped any social link the form doesn't show.

### Background jobs

- ✅ **One web page could stall the event scanner.** The HTML text stripper was quadratic on unclosed `<script>` tags: 2 MB took about two minutes, synchronously, past the 300 s limit, and the page was retried (and failed) every day. It is now linear (4 ms).
- ✅ Price snapshots counted "Not graded", "raw PSA ready", "PSA 10 candidate" and "not PSA" listings as **graded**, pulling the graded figures down.

## 2. Needs your action (not code)

1. **Merge this PR soon.** The organiser email/phone leak is live until the migration is pushed on merge.
2. **Turn on leaked-password protection** in Supabase → Authentication → Passwords. Still off; flagged by the Supabase advisor and in the 10 Nov audit.
3. **Check the homepage as Google sees it.** On Vercel, rewrites run after static files, so the bot rewrite for `/` may never fire: Googlebot and AdSense may still get the hero-only `index.html` that caused the October AdSense rejection. I couldn't fetch production from here. To check: Search Console → URL Inspection on `https://cardpop.com.au/` → View crawled page. If it shows only the hero, the fix is to rename the static home shell and rewrite `/` to it after the bot rule.

## 3. Open — ranked

### Money

1. **"Includes GST of $X" overstates the GST** on marketplace and discounted orders. The figure counts the GST on commission twice and ignores discounts: a $1,000 card shows $98.21 instead of $95.48, and a 20%-off $550 shop order shows $50 on $440 paid. The invoice lines are right but disagree with the header. Confirm the intended figure with your accountant before changing it.
2. **Wallet credit is booked as a discount**, so a $100 order paid $99.50 from the wallet produces a $0.50 tax invoice, and wallet top-ups appear in no sales or GST record.
3. **Wallet credit and membership share one Stripe balance**: a member's card wallet can be swallowed by their membership renewal, and a downgrade credit can be spent on cards.
4. Seller transfers don't use `source_transaction`, so they draw on the platform's available balance and can fail while the buyer's funds are still pending.
5. A paid event Spotlight isn't applied if the event update fails mid-webhook; a retry skips it.
6. A failed wallet debit at checkout is logged and ignored; the buyer keeps the credit.
7. A refused single-item payment (overseas card, amount mismatch) leaves no order row, so each reload of the success page re-sends the refusal emails.

### Abuse and data

8. A member can repeatedly email and bell every admin by flipping their event between draft and submitted.
9. Organisers can move a live event's date after buying an early-bird Spotlight, or rename it to another organiser.
10. Organiser messages: the daily limits are checked before the multi-second screening call, so 30 parallel requests all get through.
11. `/geocode/batch` is unauthenticated and writes every new string to the cache table and to OpenStreetMap from the server's IP.
12. Approving an organiser or shop-owner request can silently replace an existing owner if two admins approve at once.
13. The shop-owner upload policy has no file-type limit. The media bucket allows SVG and PDF; the image proxy hardens SVG.

### Product and content

14. A colour variant's price override isn't shown on the product page: the page and the % off ribbon show the base price, but the cart charges the override. No live product uses an override today.
15. A seller's social links on `/seller/<id>` aren't normalised (`@myshop` → a 404 link).
16. Refund quote in Account → Orders hardcodes "50% retained" rather than the admin setting.
17. Unpublishing an article in the editor clears its publish date, so republishing it dates it today.
18. A blog topic can be stuck in `generating` forever if the function times out mid-draft; and five deferred topics at the top of the queue block every topic below them.
19. "Weekly" re-checks (event sources, supplier prices) run every 8 days, because the due time is stamped at the end of a run and compared at the start of the next.
20. Pre-order `availability_date` in the Merchant Center feed is the 1st of the ETA month, which is in the past for this month's pre-orders.
21. Listing URLs disagree across surfaces when a card name has no Latin letters (`/marketplace/<id>/` vs `/listing`).
22. `event.website_url` and `store.website` are emitted into prerendered links without an http(s) check.

## 4. Checked and sound

Cart pricing and the processing-fee gross-up; promo-code reservation; return-URL
allow-listing; offer lifecycle and seller binding; order numbers; invoice
triggers; the new event, organiser, shop-owner and messaging routes (auth, admin
+ MFA, ownership); SECURITY DEFINER functions' caller checks; cron auth on all
nine scheduled endpoints (fail-closed, constant-time); SSRF guard; email
escaping; Sentry scrubbing; CSP coverage of Google Maps, YouTube, Vimeo, Stripe
and Turnstile; service worker; every lazy route and internal link resolves; the
scheduler Worker's paths and crons.
