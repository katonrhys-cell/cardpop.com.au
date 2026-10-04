# Retention emails

The daily **retention sweep** is the one scheduled job that brings shoppers
back. It runs at 07:47 AEST (`.github/workflows/cron-retention-sweep.yml` →
`GET /api/retention/sweep`, `CRON_SECRET` bearer, fail-closed) and does six
small, independent jobs — one failing never blocks the rest. Engine:
`src/services/retentionSweepService.js`; templates at the bottom of
`src/emails/templates.js`; senders in `src/utils/emailService.js`.

Every send is stamped in the database **before** the result is checked, so a
retry, a double-fired cron, or a provider timeout can never produce a second
copy of the same email. Where the recipient has an account,
`notification_preferences` (type, `email`) is honoured; no row means "on".

| Job | Who gets it | When | Stamp |
|---|---|---|---|
| Abandoned checkout | A **signed-in buyer**, or a guest who **ticked the newsletter box** at checkout (`orders.marketing_consent`, written from the Stripe session's `wantsNewsletter`) | An order still `pending`/`cancelled` 1–72 h after it was created | `orders.abandoned_email_sent_at` (one per order, ever) |
| Watchlist price drop | The watcher | Listing `active` and `price_aud` below `last_alert_price_aud ?? price_at_add_aud` | `watchlist.last_alert_price_aud` (one per new low) |
| Watched card sold | The watcher | Listing `sold` | `watchlist.sold_alerted_at` |
| Saved-search digest | The owner of the saved search | New `active` listings created since `last_alerted_at ?? created_at` that match the saved params (q / min / max / graded / cat / franchise / set) | `saved_searches.last_alerted_at` (advanced even when nothing matched) |
| Back in stock | Anyone who clicked **Notify me** on a sold-out shop product (`POST /shop-enquiry/notify` → `shop_restock_requests`) | Product purchasable again (`PURCHASABLE_SHOP_STATUSES`, stock > 0 or unlimited) | `shop_restock_requests.notified_at` |
| Welcome code (social sign-ups) | A profile < 48 h old with no `welcome_offers` row (Google/Apple/Facebook sign-ups bypass the signup page's `POST /welcome-offer/issue`) | Daily | the `welcome_offers` row itself (`issueWelcomeOffer` is idempotent) |
| Welcome code expiry reminder | A user whose code is unused and expires within 7 days | Daily | `welcome_offers.reminder_sent_at` |

## Consent (Spam Act 2003)

The abandoned-checkout email is marketing, so it only goes to someone who has
a relationship with us (an account) or who expressly agreed (the newsletter
tick). A guest who did not tick the box is never emailed — their order row has
`marketing_consent = false` and the sweep skips it. The signup newsletter box
is **unticked by default** for the same reason. Every retention email says why
the recipient got it and where to turn it off.

## The cart-restore link

The abandoned-checkout email links to
`/checkout?restore=<orderId>&t=<token>`. The token is an HMAC of the order id
(`src/utils/restoreToken.js`, secret `CART_RESTORE_SECRET` → `ENCRYPTION_KEY`
→ `CRON_SECRET`), so knowing an order id is not enough. The checkout page
calls the **public** `GET /orders/:id/abandoned-cart?t=` which, with a valid
token, returns only the lines (type, id, title, unit price, quantity, variant)
— never the address or the email — and only while the order is still
`pending`/`cancelled` (410 once paid). The page re-adds each line through the
normal `addToCart`, so sold listings are simply skipped, then strips the
params from the URL.

## Watchlist prices

`WatchlistContext.toggle(listingId, { priceAud })` stores the price the buyer
saw as `watchlist.price_at_add_aud`; rows saved before this column exists have
`null`; the sweep's select requires `price_at_add_aud` to be set, so those
legacy rows are left alone entirely (no price or sold alerts).

## Alert types in Account → Notification settings

`watchlist_price_drop`, `watchlist_sold`, `saved_search_match`,
`abandoned_checkout` (email flag). Back-in-stock has no preference row — the
request itself is the opt-in and it is a single email.

## Running it by hand

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://cardpop.com.au/api/retention/sweep
```

The response is a per-job summary (`{ abandonedCheckouts: { candidates,
emailed, skipped, errors }, … }`). A job that throws reports
`{ error }` and the others still run.

## Migration

`supabase/migrations/20261004002054_retention_alerts.sql` — adds the columns
above and the `shop_restock_requests` table (RLS on, no client policies: it is
written and read only through the API with the service role).
