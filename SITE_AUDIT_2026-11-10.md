# Site audit — 10 November 2026

A full bug examination of the codebase and the live production signals
(Supabase policies and advisors, Vercel runtime errors, Sentry), plus a feature
comparison against TCGplayer and Cherry Collectables. Six parallel reviews:
money path, auth / database security, marketplace backend, core frontend flows,
browse / search / SEO plumbing, and product gaps.

Baseline before any change: lint clean, 5,274 tests passing, build green — so
everything below is a bug the existing checks did not catch.

**Fixed in this change** is marked ✅. Everything else is open and ranked.

## 1. Fixed in this change

### Security (database)

| | Finding | Fix |
|---|---|---|
| ✅ **Critical** | **A buyer could accept their own offer and buy any buy-now card for $1.** The `offers_update_access` policy's USING and WITH CHECK are independent ORs, so a buyer's *pending* offer passed "buyer may withdraw" on the way in and "buyer may accept a counter" on the way out. `PATCH /rest/v1/offers {"status":"accepted"}` with the buyer's own session, then checkout with `offerId`. Confirmed against production's live policy; reproduced in a local Postgres. Production showed no sign of use (1 offer ever, 0 accepted). | `20261110202311_offers_role_bound_transitions.sql` — the lifecycle trigger now owns who may make which move; policy rewritten per actor. Test: `tests/db/offers_role_transitions.test.sql` (fails before, passes after). |
| ✅ High | Buyers could insert a refund row with any status / amount (`approved`, or `processed` with $99,999). | Policy dropped — the API inserts with the service role. |
| ✅ Medium | Anyone could post unlimited seller reviews with no order (and earn 10 points each). | Policy dropped — the API inserts with the service role. |
| ✅ Medium | Any member could put their card in the homepage Featured strip by inserting it with `is_featured = true`. | Insert trigger drops the flag for non-admins. |
| ✅ Medium | A seller could list **another member's** vault card: it became public, its value was overwritten and it was offered for sale under the attacker's name. | Trigger: a listing's card must be in the seller's own vault. |
| ✅ Low | A trade's initiator could accept their own proposal, bypassing `accept_trade()`. | Policy WITH CHECK refuses `accepted` / `fee_paid` / `completed` from the browser. |

The last five are `20261110203544_close_direct_write_gaps.sql`, tested by
`tests/db/run-direct-write-gaps-migration.sh`.

### Payments and orders

- ✅ A late `payment_intent.payment_failed` event could flip a **paid** (even shipped) order to `payment_failed`. Now guarded on `pending`.
- ✅ Unpaid checkouts counted against the new-buyer / guest velocity caps: five looks at the payment form locked a real buyer out for a day, and anyone could lock a stranger's email out of guest checkout. `pending` no longer counts.
- ✅ A failed `platform_settings` read was cached as "no setting" for 30 s, pricing every checkout on that instance with code defaults (fees, identity threshold). Failed reads are no longer cached.
- ✅ Carrier tracking treated "Cannot be delivered", "To be delivered today", "Scheduled to be delivered" as **delivered**, completing the order and starting the Buyer Protection clock.
- ✅ A shop pre-order not yet shipped 45 days after purchase told the buyer "the 14-day return window has closed".
- ✅ Marking an order shipped could overwrite a refund / cancellation that landed in between.
- ✅ **My Orders showed every unpaid checkout as "Confirmed"** (one row per visit to the payment step).
- ✅ Paying for "shop items only" from a mixed cart emptied the whole cart, including the marketplace cards the page said it would keep.
- ✅ Checkout summary and final review never showed quantity (3 × $9.95 displayed as one line of $9.95).

### Selling

- ✅ **Editing a card and adding one photo deleted its other extra photos; removing a photo never saved.**
- ✅ "Add Another" on the card-saved toast did nothing.

### Platform

- ✅ **`Permissions-Policy: camera=(), geolocation=()` blocked the site's own card scanner and "use my location"** in Chrome / Edge / Android. Now `(self)`.
- ✅ **Prerender answered 404 + noindex (cached 1 h, stale 24 h) whenever a Supabase lookup failed**, telling Googlebot to drop good pages. Lookup errors now take the 503 / no-store path.
- ✅ Contact-form and shop-enquiry emails lost their Reply-To (the Resend SDK ignores `reply_to`; it wants `replyTo`) — replies went to `noreply@`.
- ✅ "Price: high to low" led with every unpriced (trade / EOI) listing; price sorts had no tie-breaker, so cards could repeat or vanish between pages.
- ✅ Login trimmed the password (sign-up doesn't) — a password with a leading / trailing space could never log in.
- ✅ Login dropped the query string of the page it returns to and ignored `?next=`.
- ✅ Two shop grids toasted "added to cart" when the add was refused for stock.
- ✅ Mobile buy bar showed no price on Expression-of-Interest listings.
- ✅ `GET /search-suggestions?q=a&q=b` returned 500.

## 2. Needs your action (not code)

1. **Merge this PR promptly** — the offers fix only reaches production when the migration is pushed on merge.
2. **Sentry was reporting to a different organisation than the one in use** — corrected after the audit: the DSNs in the code and in Vercel pointed at an older Sentry organisation, while the connected one (`cardpop-australia-yr`) had received nothing. Repointed on 2026-11-10 (code fallbacks + Vercel `SENTRY_DSN`).
3. **PSA verification was failing in production** with `403` from the PSA API. `PSA_API_TOKEN` was replaced in Vercel on 2026-11-10; confirm by looking up a cert on the live site after the next deploy.
4. ~~eBay credentials are missing~~ — **wrong, withdrawn.** The keys are set for production; the error seen came from a preview deployment, where they are not set.
5. **Turn on leaked-password protection** in Supabase Auth (one switch; flagged by the advisor).
6. `/api/prerender` has hit its 10 s limit twice — raise `maxDuration` to 20–30 s when convenient.

## 3. Open — recommended next, in order

### Money (each is a design change, not a one-line fix)

1. **Retrying checkout locks the buyer out of their promo code (24 h), welcome code (1 h) or wallet.** Every "Review and pay" creates a new Checkout Session and a new reservation; nothing expires the previous one. Fix: expire the buyer's previous open session and release its reservations before creating a new one; set `expires_at` ≈ 30 min. This also removes the cause of the "abandoned cart" email being sent to buyers who paid on a second session.
2. **A card paid for after it sold to someone else is not refunded automatically** and is recorded as a normal sale (seller told "your card sold", invoice issued). Sessions stay payable for 24 h with no hold on the listing. Fix: insert as `pending`, claim, then confirm; auto-refund a lost claim; short `expires_at`.
3. **Seller wallet clawback is floored at $0 but recorded as recovered.** A seller who has withdrawn, then is refunded against: the platform absorbs the loss silently; if a chargeback is later won, "Release" pays the seller a second time. Fix: return the amount actually recovered, record it, alert on shortfall.
4. **Unlimited free 30-day trials** (cancel and restart) and a second concurrent subscription can be created; the old one's `deleted` event can then drop a paying member to Hobby.
5. **Fulfilment can't resume after a timeout**: the seller payout is the last step after three emails; a function timeout leaves the seller unpaid with nothing alerting. Reconciliation only looks at `pending` orders.
6. **Refunds issued in the Stripe dashboard aren't synced** (no `charge.refunded` handler): order stays confirmed, no credit note, revenue still counted, payout not reversed. Guest orders have no in-app refund path at all.
7. Welcome discount reusable after its 1 h reservation lapses; partner commission survives a refund.

### Security

8. **Admin MFA is enforced only in Express.** With an admin's password alone (no second factor) an attacker can call the database API directly and, among other things, make any account an admin. Fix: an `is_admin_mfa()` helper in every admin policy, and remove the admin branch from the `profiles` update policy.
9. `GET /vault/public` and search suggestions read with the service role and filter on `is_public` rather than `publicly_listed` — leaks cards that are pending approval or delisted.
10. A suspended user with a live token can un-suspend their own profile row (`is_active` / `is_deleted` not pinned). Giveaway CSV export is open to spreadsheet-formula injection. `/stores/sole-trader-change` can be replayed to spam every admin.

### Marketplace logic

11. **An accepted offer doesn't hold the listing.** Someone else can Buy Now; the offer buyer can't pay; 48 h later they are told "you didn't pay".
12. A seller of one card in a cart that also has CardPop Shop lines can mark the whole order shipped (deliberate today — needs per-line shipments to fix properly).
13. Giveaway draw pool is capped at 1,000 entries (later entrants can never win). Newsletter opt-in on giveaway entry is fire-and-forget on a serverless function and can be dropped.
14. Multi-day events vanish from "upcoming" on day two; Event JSON-LD hard-codes `+10:00` (wrong in daylight saving and for SA / NT / WA); server-side "today" is the UTC date.

### Frontend / SEO

15. Wallet "Total Earned" is the sum of the last 20 sales; a failed Connect status fetch reads as "Not Connected".
16. Checkout shipping inputs have no programmatic labels (screen readers hear "edit text" eight times).
17. "Listing updated / removed" toasts when RLS changed nothing (sold listings).
18. Merchant feed colour rows link to a page whose markup describes a different colour's price / stock / GTIN; cards are `NewCondition` in markup but `used` in the feed.
19. The bot rewrite matches any user agent containing "bot" (e.g. Cubot phones get the no-JS page). Service worker page cache is unbounded. Deleted photos stay public forever in the image CDN's R2 copy.

## 4. Against TCGplayer and Cherry Collectables

**Already strong, keep:** buyer protection and refunds, GST / invoicing / finance, Connect payouts, AI scan-to-list, retention emails, prerender / SEO, performance, events and community content. Cherry has no equivalent of most of these.

**The two real gaps:**

- **TCGplayer is catalogue-first** — one page per card, every seller's copy under it, lowest price, market price, set checklists, cart optimiser. CardPop is one page per physical listing; `card_catalogue` exists but listings don't reference it.
- **Cherry is a deep sealed retailer** with loyalty, breaks and a release calendar. CardPop's shop is ~46 accessory lines. That is a supply and capital problem, not an engineering one.

### Roadmap

**Now (0–4 weeks)**
1. Ship this PR; do the six actions in §2; fix money items 1–3.
2. **Link listings to the catalogue** (`vault_items.catalogue_id`, written by the scan flow, backfilled). Small now, expensive later — it gates everything TCGplayer-like.
3. **Portfolio value** on the vault (total + daily snapshot chart) — the reason collectors come back daily.
4. **Points that mean something**: earn on purchase, redeem at checkout (`points_ledger` is there; today it's a daily claim only).
5. Refund-to-wallet and gift cards; seller-location filter and "local pickup".

**Next (1–3 months)**
6. **Catalogue card pages** `/cards/<set>/<card>`: all sellers, "from $X", CardPop sold history.
7. **Set pages and checklists** with own / want / for-sale ticks; a want list that alerts.
8. **Seller CSV import, bulk reprice ("match market"), sales export.**
9. Sealed range (supplier accounts) + a **release calendar** — pre-order, RRP and restock code is already built.
10. Shipping tiers (letter / tracked / signature + insured), tracked required above a value; label purchase.
11. Auctions (the PRD has the spec; needs bids, atomic `place_bid()`, anti-snipe, settlement sweep).

**Later (3–12 months)**
12. Cart optimiser across sellers. 13. **CardPop Direct** — authenticated consignment, one parcel. 14. Buylist / trade-in for store credit. 15. Live breaks (start with break spots as shop products + YouTube embed). 16. Grading submission orders. 17. Seller inventory API, native scan app, NZ.

**Decisions only you can make:** Afterpay / Zip (shop-only is the sensible version given the fee model); whether to launch P2P trading (built, switched off, writes still client-side); how much capital to put into sealed stock.
